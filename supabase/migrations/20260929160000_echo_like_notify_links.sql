-- ===========================================================================
-- Echo · Like: notificações, preferências, lembretes e links externos (página 23)
-- ---------------------------------------------------------------------------
-- • notification_prefs: eventos, canais e horário silencioso por pessoa.
-- • like_notify(): grava na tabela notifications (sino em tempo real); o e-mail
--   sai pela função de servidor supabase/functions/like-notify.
-- • Gatilhos: nova rodada, nova versão, comentário, resposta, menção, decisão.
-- • like_send_reminders(): lembretes 1 dia antes, no dia e depois do prazo,
--   no máximo 1 por pessoa por dia, fora do horário silencioso (pg_cron, a cada hora).
-- • Links externos: token de 32 bytes guardado só como hash, validade, revogação,
--   e-mail restrito com código, limite de tentativas; convidado age como 'guest'.
-- ===========================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- Preferências ----------
CREATE TABLE IF NOT EXISTS public.notification_prefs (
  user_id uuid PRIMARY KEY DEFAULT auth.uid(),
  events jsonb NOT NULL DEFAULT '{}'::jsonb,          -- { "like.nova_rodada": false, ... } (ausente = ligado)
  in_app boolean NOT NULL DEFAULT true,
  email boolean NOT NULL DEFAULT true,
  daily_digest boolean NOT NULL DEFAULT false,
  quiet_start time,
  quiet_end time,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notification_prefs_own ON public.notification_prefs;
CREATE POLICY notification_prefs_own ON public.notification_prefs FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS email_status text NOT NULL DEFAULT 'pendente';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS dedupe_key text;
DO $$ BEGIN
  ALTER TABLE public.notifications ADD CONSTRAINT notifications_email_status_chk CHECK (email_status IN ('pendente','enviado','resumo','ignorado'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_idx ON public.notifications (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;

-- Convidados: identidade informada fica registrada junto da ação.
ALTER TABLE public.like_comments ADD COLUMN IF NOT EXISTS guest_email text;
ALTER TABLE public.like_decisions ADD COLUMN IF NOT EXISTS guest_email text;
ALTER TABLE public.like_share_links ADD COLUMN IF NOT EXISTS label text;
ALTER TABLE public.like_share_links ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.like_share_links ADD COLUMN IF NOT EXISTS failed_attempts int NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.like_link_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.like_share_links(id) ON DELETE CASCADE,
  email text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  verified_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.like_link_codes ENABLE ROW LEVEL SECURITY; -- só funções SECURITY DEFINER acessam

-- ---------- Envio de notificações ----------
CREATE OR REPLACE FUNCTION public.like_wants(p_user uuid, p_kind text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT (events ->> p_kind)::boolean FROM notification_prefs WHERE user_id = p_user), true)
     AND coalesce((SELECT in_app OR email FROM notification_prefs WHERE user_id = p_user), true);
$$;

CREATE OR REPLACE FUNCTION public.like_notify(p_users uuid[], p_brand uuid, p_kind text, p_title text, p_body text, p_link text, p_dedupe text DEFAULT NULL, p_payload jsonb DEFAULT '{}'::jsonb)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  INSERT INTO notifications (user_id, brand_id, kind, title, body, link, payload, dedupe_key)
  SELECT DISTINCT u, p_brand, p_kind, p_title, p_body, p_link, p_payload, p_dedupe
  FROM unnest(p_users) u
  WHERE u IS NOT NULL AND u IS DISTINCT FROM auth.uid() AND public.like_wants(u, p_kind)
  ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.like_client_recipients(p_brand uuid) RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(array_agg(user_id), '{}') FROM like_approvers WHERE brand_id = p_brand AND role IN ('aprovador','revisor');
$$;
-- Equipe do material: quem criou o material e quem enviou versões.
CREATE OR REPLACE FUNCTION public.like_team_recipients(p_item uuid) RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(array_agg(DISTINCT u), '{}') FROM (
    SELECT created_by u FROM like_items WHERE id = p_item
    UNION SELECT created_by FROM like_versions WHERE item_id = p_item
  ) x WHERE u IS NOT NULL;
$$;

-- Material enviado (rascunho → aguardando): uma notificação por rodada por dia.
CREATE OR REPLACE FUNCTION public.like_notify_items() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE slug text;
BEGIN
  SELECT b.slug INTO slug FROM brands b WHERE b.id = NEW.brand_id;
  IF OLD.status = 'rascunho' AND NEW.status = 'aguardando' THEN
    PERFORM public.like_notify(public.like_client_recipients(NEW.brand_id), NEW.brand_id, 'like.nova_rodada', 'Novos materiais para aprovar',
      'A Reach enviou materiais para você revisar.', '/like/' || slug || coalesce('/rodada/' || NEW.round_id, ''),
      'rodada:' || coalesce(NEW.round_id::text, NEW.id::text) || ':' || current_date, jsonb_build_object('item_id', NEW.id));
  ELSIF NEW.status = 'nova_versao' AND OLD.status IS DISTINCT FROM 'nova_versao' THEN
    PERFORM public.like_notify(public.like_client_recipients(NEW.brand_id), NEW.brand_id, 'like.nova_versao', 'Nova versão: ' || NEW.title,
      (SELECT changes_note FROM like_versions WHERE id = NEW.current_version_id), '/like/' || slug || '/m/' || NEW.id, NULL, jsonb_build_object('item_id', NEW.id));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS like_items_notify ON public.like_items;
CREATE TRIGGER like_items_notify AFTER UPDATE OF status ON public.like_items FOR EACH ROW EXECUTE FUNCTION public.like_notify_items();

-- Comentários: do cliente para a equipe; resposta da equipe para quem comentou; menções.
CREATE OR REPLACE FUNCTION public.like_notify_comment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i like_items; slug text; link text; parent_author uuid; parent_kind text;
BEGIN
  SELECT * INTO i FROM like_items WHERE id = NEW.item_id;
  SELECT b.slug INTO slug FROM brands b WHERE b.id = i.brand_id;
  link := '/like/' || slug || '/m/' || i.id;
  IF NEW.author_kind IN ('client','guest') AND NOT NEW.internal THEN
    PERFORM public.like_notify(public.like_team_recipients(i.id), i.brand_id, 'like.comentario', coalesce(NEW.author_name, 'Cliente') || ' comentou em ' || i.title, left(NEW.body, 180), link, NULL, jsonb_build_object('item_id', i.id));
  END IF;
  IF NEW.parent_id IS NOT NULL AND NOT NEW.internal THEN
    SELECT author_id, author_kind INTO parent_author, parent_kind FROM like_comments WHERE id = NEW.parent_id;
    IF parent_kind = 'client' THEN
      PERFORM public.like_notify(ARRAY[parent_author], i.brand_id, 'like.resposta', coalesce(NEW.author_name, 'A Reach') || ' respondeu seu comentário', left(NEW.body, 180), link, NULL, jsonb_build_object('item_id', i.id));
    END IF;
  END IF;
  IF array_length(NEW.mentions, 1) > 0 THEN
    PERFORM public.like_notify(NEW.mentions, i.brand_id, 'like.mencao', coalesce(NEW.author_name, 'Alguém') || ' mencionou você', left(NEW.body, 180), link, NULL, jsonb_build_object('item_id', i.id));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS like_comments_notify ON public.like_comments;
CREATE TRIGGER like_comments_notify AFTER INSERT ON public.like_comments FOR EACH ROW EXECUTE FUNCTION public.like_notify_comment();

-- Decisões: avisa a equipe (aprovado, ajuste, reprovado).
CREATE OR REPLACE FUNCTION public.like_notify_decision() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i like_items; slug text;
BEGIN
  IF NEW.decision = 'undone' THEN RETURN NEW; END IF;
  SELECT * INTO i FROM like_items WHERE id = NEW.item_id;
  SELECT b.slug INTO slug FROM brands b WHERE b.id = i.brand_id;
  PERFORM public.like_notify(public.like_team_recipients(i.id), i.brand_id,
    CASE NEW.decision WHEN 'changes_requested' THEN 'like.ajuste' ELSE 'like.decisao' END,
    coalesce(NEW.decider_name, 'Cliente') || CASE NEW.decision WHEN 'approved' THEN ' aprovou ' WHEN 'changes_requested' THEN ' pediu ajustes em ' ELSE ' reprovou ' END || i.title,
    concat_ws(' · ', array_to_string(NEW.phrases, ', '), NEW.note), '/like/' || slug || '/m/' || i.id, NULL, jsonb_build_object('item_id', i.id, 'decision', NEW.decision));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS like_decisions_notify ON public.like_decisions;
CREATE TRIGGER like_decisions_notify AFTER INSERT ON public.like_decisions FOR EACH ROW EXECUTE FUNCTION public.like_notify_decision();

-- ---------- Lembretes automáticos ----------
CREATE OR REPLACE FUNCTION public.like_in_quiet(p_user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((
    SELECT CASE
      WHEN quiet_start IS NULL OR quiet_end IS NULL THEN false
      WHEN quiet_start <= quiet_end THEN (now() AT TIME ZONE timezone)::time BETWEEN quiet_start AND quiet_end
      ELSE (now() AT TIME ZONE timezone)::time >= quiet_start OR (now() AT TIME ZONE timezone)::time <= quiet_end END
    FROM notification_prefs WHERE user_id = p_user), false);
$$;

CREATE OR REPLACE FUNCTION public.like_send_reminders() RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; total int := 0; n int; kind text;
BEGIN
  FOR r IN
    SELECT i.id, i.brand_id, i.title, i.due_at, i.current_version_id, b.slug, coalesce(s.remind_before, true) rb, coalesce(s.remind_on_day, true) rd, coalesce(s.remind_late, true) rl, a.user_id
    FROM like_items i
    JOIN brands b ON b.id = i.brand_id
    LEFT JOIN like_settings s ON s.brand_id = i.brand_id
    JOIN like_approvers a ON a.brand_id = i.brand_id AND a.role = 'aprovador'
    WHERE i.status IN ('aguardando','em_revisao','nova_versao') AND i.due_at IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM like_decisions d WHERE d.item_id = i.id AND d.version_id = i.current_version_id AND d.decided_by = a.user_id AND d.decision <> 'undone')
  LOOP
    kind := CASE
      WHEN r.due_at::date = current_date + 1 AND r.rb THEN 'antes'
      WHEN r.due_at::date = current_date AND r.rd THEN 'no_dia'
      WHEN r.due_at < now() AND r.rl THEN 'atrasado' END;
    CONTINUE WHEN kind IS NULL OR public.like_in_quiet(r.user_id);
    -- dedupe por pessoa e dia: nunca mais de um lembrete por dia (A4)
    n := public.like_notify(ARRAY[r.user_id], r.brand_id, 'like.lembrete',
      CASE kind WHEN 'antes' THEN 'Amanhã vence a aprovação' WHEN 'no_dia' THEN 'Hoje vence a aprovação' ELSE 'Aprovação atrasada' END,
      r.title, '/like/' || r.slug, 'lembrete:' || current_date, jsonb_build_object('item_id', r.id, 'kind', kind));
    total := total + n;
  END LOOP;
  -- Rodadas vencidas: avisa a equipe uma vez por rodada.
  FOR r IN SELECT rd.id, rd.brand_id, rd.title, b.slug FROM like_rounds rd JOIN brands b ON b.id = rd.brand_id WHERE rd.status = 'aberta' AND rd.due_at < now() LOOP
    UPDATE like_rounds SET status = 'vencida', updated_at = now() WHERE id = r.id;
    PERFORM public.like_notify((SELECT coalesce(array_agg(DISTINCT created_by), '{}') FROM like_items WHERE round_id = r.id), r.brand_id, 'like.rodada_vencida',
      'Rodada vencida: ' || r.title, 'O prazo de decisão passou.', '/like/' || r.slug || '/rodada/' || r.id, 'vencida:' || r.id);
  END LOOP;
  RETURN total;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('like-reminders') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'like-reminders');
    PERFORM cron.schedule('like-reminders', '5 * * * *', 'SELECT public.like_send_reminders()');
  END IF;
END $$;

-- ---------- Links externos ----------
CREATE OR REPLACE FUNCTION public.like_token_hash(p_token text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT encode(digest(p_token, 'sha256'), 'hex') $$;

CREATE OR REPLACE FUNCTION public.like_link_create(p_brand uuid, p_round uuid, p_item uuid, p_comment boolean, p_decide boolean, p_days int DEFAULT 7, p_email text DEFAULT NULL, p_label text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE token text; link_id uuid;
BEGIN
  IF NOT public.is_agency_for_brand(p_brand) THEN RAISE EXCEPTION 'Sem permissão.'; END IF;
  IF NOT coalesce((SELECT allow_share_links FROM like_settings WHERE brand_id = p_brand), false) THEN RAISE EXCEPTION 'Links externos estão desligados para este cliente.'; END IF;
  token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO like_share_links (brand_id, round_id, item_id, token_hash, can_view, can_comment, can_decide, expires_at, email, label)
  VALUES (p_brand, p_round, p_item, public.like_token_hash(token), true, p_comment, p_decide, now() + make_interval(days => greatest(1, least(p_days, 60))), nullif(lower(trim(p_email)), ''), p_label)
  RETURNING id INTO link_id;
  RETURN jsonb_build_object('id', link_id, 'token', token); -- o token só aparece aqui, uma vez
END $$;

CREATE OR REPLACE FUNCTION public.like_link_revoke(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE like_share_links SET revoked_at = now() WHERE id = p_id AND public.is_agency_for_brand(brand_id);
END $$;

-- Valida o token. Revogado ou expirado não devolve nada além do motivo (A2).
CREATE OR REPLACE FUNCTION public.like_link_check(p_token text) RETURNS like_share_links LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l like_share_links;
BEGIN
  SELECT * INTO l FROM like_share_links WHERE token_hash = public.like_token_hash(p_token);
  IF l.id IS NULL THEN RAISE EXCEPTION 'link_invalido'; END IF;
  IF l.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'link_revogado'; END IF;
  IF l.expires_at < now() THEN RAISE EXCEPTION 'link_expirado'; END IF;
  IF l.failed_attempts >= 10 THEN RAISE EXCEPTION 'link_bloqueado'; END IF;
  RETURN l;
END $$;

CREATE OR REPLACE FUNCTION public.like_link_open(p_token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l like_share_links; b brands;
BEGIN
  BEGIN l := public.like_link_check(p_token);
  EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('status', replace(SQLERRM, 'link_', '')); END;
  SELECT * INTO b FROM brands WHERE id = l.brand_id;
  UPDATE like_share_links SET uses = uses + 1, last_used_at = now() WHERE id = l.id;
  RETURN jsonb_build_object('status', 'ok', 'brand', b.name, 'can_comment', l.can_comment, 'can_decide', l.can_decide, 'needs_code', l.email IS NOT NULL, 'expires_at', l.expires_at,
    'items', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'title', i.title, 'kind', i.kind, 'status', i.status, 'publish_at', i.publish_at, 'preset_dimension', i.preset_dimension,
       'version', (SELECT to_jsonb(v) - 'created_by' FROM like_versions v WHERE v.id = i.current_version_id),
       'comments', (SELECT coalesce(jsonb_agg(jsonb_build_object('author_name', c.author_name, 'body', c.body, 'anchor', c.anchor, 'created_at', c.created_at) ORDER BY c.created_at), '[]') FROM like_comments c WHERE c.item_id = i.id AND NOT c.internal AND c.deleted_at IS NULL)
     ) ORDER BY i.order_index), '[]')
     FROM like_items i WHERE (i.id = l.item_id OR (l.item_id IS NULL AND i.round_id = l.round_id)) AND i.status NOT IN ('rascunho','cancelado')));
END $$;

-- Código de verificação para links restritos a um e-mail. Só a função de servidor
-- (service role) chama isto: ela recebe o código e manda por e-mail; o navegador nunca o vê.
CREATE OR REPLACE FUNCTION public.like_link_request_code(p_token text, p_email text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l like_share_links; code text;
BEGIN
  l := public.like_link_check(p_token);
  IF l.email IS NULL THEN RETURN NULL; END IF;
  IF lower(trim(p_email)) <> l.email THEN
    UPDATE like_share_links SET failed_attempts = failed_attempts + 1 WHERE id = l.id;
    RETURN NULL;
  END IF;
  IF (SELECT count(*) FROM like_link_codes WHERE link_id = l.id AND created_at > now() - interval '1 hour') >= 5 THEN RAISE EXCEPTION 'Muitas tentativas. Tente de novo em uma hora.'; END IF;
  code := lpad((floor(random() * 1000000))::int::text, 6, '0');
  INSERT INTO like_link_codes (link_id, email, code_hash, expires_at) VALUES (l.id, l.email, public.like_token_hash(code || l.id::text), now() + interval '15 minutes');
  RETURN code; -- só o hash fica guardado
END $$;

CREATE OR REPLACE FUNCTION public.like_link_guest_ok(l like_share_links, p_email text, p_code text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c like_link_codes;
BEGIN
  IF l.email IS NULL THEN RETURN true; END IF;
  IF lower(trim(p_email)) <> l.email THEN RETURN false; END IF;
  SELECT * INTO c FROM like_link_codes WHERE link_id = l.id AND expires_at > now() ORDER BY created_at DESC LIMIT 1;
  IF c.id IS NULL OR c.attempts >= 5 THEN RETURN false; END IF;
  IF c.code_hash <> public.like_token_hash(coalesce(p_code, '') || l.id::text) THEN
    UPDATE like_link_codes SET attempts = attempts + 1 WHERE id = c.id;
    UPDATE like_share_links SET failed_attempts = failed_attempts + 1 WHERE id = l.id;
    RETURN false;
  END IF;
  UPDATE like_link_codes SET verified_at = coalesce(verified_at, now()) WHERE id = c.id;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.like_guest_comment(p_token text, p_name text, p_email text, p_code text, p_item uuid, p_body text, p_anchor jsonb DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l like_share_links; i like_items; cid uuid;
BEGIN
  l := public.like_link_check(p_token);
  IF NOT l.can_comment THEN RAISE EXCEPTION 'Este link não permite comentar.'; END IF;
  IF length(trim(coalesce(p_name, ''))) < 2 OR p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'Informe seu nome e e-mail.'; END IF;
  IF NOT public.like_link_guest_ok(l, p_email, p_code) THEN RAISE EXCEPTION 'Código inválido.'; END IF;
  SELECT * INTO i FROM like_items WHERE id = p_item AND (id = l.item_id OR (l.item_id IS NULL AND round_id = l.round_id));
  IF i.id IS NULL THEN RAISE EXCEPTION 'Material fora deste link.'; END IF;
  INSERT INTO like_comments (item_id, brand_id, version_id, author_id, author_name, author_kind, body, anchor, guest_email)
  VALUES (i.id, i.brand_id, i.current_version_id, NULL, trim(p_name), 'guest', trim(p_body), p_anchor, lower(trim(p_email))) RETURNING id INTO cid;
  RETURN cid;
END $$;

-- Decisão por convidado: o link com permissão de decidir vale como aprovador.
CREATE OR REPLACE FUNCTION public.like_guest_decide(p_token text, p_name text, p_email text, p_code text, p_item uuid, p_decision text, p_note text DEFAULT NULL, p_phrases text[] DEFAULT '{}')
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l like_share_links; i like_items; dec_id uuid;
BEGIN
  l := public.like_link_check(p_token);
  IF NOT l.can_decide THEN RAISE EXCEPTION 'Este link não permite decidir.'; END IF;
  IF length(trim(coalesce(p_name, ''))) < 2 OR p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'Informe seu nome e e-mail.'; END IF;
  IF NOT public.like_link_guest_ok(l, p_email, p_code) THEN RAISE EXCEPTION 'Código inválido.'; END IF;
  SELECT * INTO i FROM like_items WHERE id = p_item AND (id = l.item_id OR (l.item_id IS NULL AND round_id = l.round_id)) FOR UPDATE;
  IF i.id IS NULL THEN RAISE EXCEPTION 'Material fora deste link.'; END IF;
  IF p_decision NOT IN ('approved','changes_requested','rejected') THEN RAISE EXCEPTION 'Decisão inválida.'; END IF;
  IF i.status NOT IN ('aguardando','em_revisao','nova_versao') THEN
    IF i.status = 'aprovado' AND p_decision = 'approved' THEN RETURN i.status; END IF;
    RAISE EXCEPTION 'Este material não está aguardando decisão.';
  END IF;
  IF p_decision <> 'approved' AND coalesce(trim(p_note), '') = '' AND coalesce(array_length(p_phrases, 1), 0) = 0 THEN RAISE EXCEPTION 'Diga o que ajustar.'; END IF;
  INSERT INTO like_decisions (item_id, brand_id, version_id, decision, decided_by, decider_name, decider_kind, note, phrases, via, guest_email)
  VALUES (i.id, i.brand_id, i.current_version_id, p_decision, NULL, trim(p_name), 'guest', p_note, p_phrases, 'like', lower(trim(p_email))) RETURNING id INTO dec_id;
  INSERT INTO like_activity (brand_id, item_id, round_id, actor_name, event, payload) VALUES (i.brand_id, i.id, i.round_id, trim(p_name) || ' (convidado)', 'decidido', jsonb_build_object('decision', p_decision, 'decision_id', dec_id, 'guest_email', lower(trim(p_email))));
  IF p_decision = 'approved' THEN
    PERFORM public.like_apply_approval(i.id, i.current_version_id);
  ELSIF p_decision = 'changes_requested' THEN
    UPDATE like_items SET status = 'ajustes', decided_at = now(), updated_at = now() WHERE id = i.id;
    IF i.task_id IS NOT NULL THEN UPDATE workspace_tasks SET status = 'Ajuste', updated_at = now() WHERE id = i.task_id; END IF;
  ELSE
    UPDATE like_items SET status = 'reprovado', decided_at = now(), updated_at = now() WHERE id = i.id;
    IF i.task_id IS NOT NULL THEN UPDATE workspace_tasks SET status = 'Ajuste', updated_at = now() WHERE id = i.task_id; END IF;
  END IF;
  RETURN (SELECT status FROM like_items WHERE id = i.id);
END $$;

REVOKE ALL ON FUNCTION public.like_link_request_code(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.like_link_request_code(text, text) TO service_role;
REVOKE ALL ON FUNCTION public.like_link_open(text), public.like_guest_comment(text, text, text, text, uuid, text, jsonb), public.like_guest_decide(text, text, text, text, uuid, text, text, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.like_link_open(text), public.like_guest_comment(text, text, text, text, uuid, text, jsonb), public.like_guest_decide(text, text, text, text, uuid, text, text, text[]) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.like_link_check(text), public.like_link_guest_ok(like_share_links, text, text), public.like_send_reminders(), public.like_notify(uuid[], uuid, text, text, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.like_link_create(uuid, uuid, uuid, boolean, boolean, int, text, text), public.like_link_revoke(uuid) TO authenticated;
