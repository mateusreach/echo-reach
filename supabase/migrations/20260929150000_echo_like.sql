-- ===========================================================================
-- Echo · Like (página 18): aprovação de materiais pelo cliente.
-- Idempotente. Tabelas, RLS, decisão com integrações (Workspace, Biblioteca,
-- cobertura, agenda do 360) e desfazer. Decisões e atividade são imutáveis.
-- ===========================================================================

-- ----- Tabelas ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.like_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  title text NOT NULL,
  front_id uuid REFERENCES public.workspace_fronts(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES public.espaco360_campaigns(id) ON DELETE SET NULL,
  period_start date, period_end date,
  due_at timestamptz,
  message text,
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','concluida','vencida','cancelada')),
  created_by uuid DEFAULT auth.uid(),
  sent_at timestamptz,
  is_example boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.like_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  round_id uuid REFERENCES public.like_rounds(id) ON DELETE SET NULL,
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'post' CHECK (kind IN ('post','carrossel','video','stories','roteiro','texto','peca','outro')),
  channel_id uuid REFERENCES public.brand_identity_channels(id) ON DELETE SET NULL,
  preset_id uuid REFERENCES public.brand_identity_presets(id) ON DELETE SET NULL,
  front_id uuid REFERENCES public.workspace_fronts(id) ON DELETE SET NULL,
  work_order_id uuid REFERENCES public.workspace_work_orders(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.workspace_tasks(id) ON DELETE SET NULL,
  conteudo_id uuid REFERENCES public.conteudos(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES public.espaco360_campaigns(id) ON DELETE SET NULL,
  solicitacao_id uuid REFERENCES public.solicitacoes(id) ON DELETE SET NULL,
  publish_at timestamptz,
  due_at timestamptz,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','aguardando','em_revisao','aprovado','ajustes','nova_versao','reprovado','agendado','publicado','cancelado')),
  current_version_id uuid,
  priority text NOT NULL DEFAULT 'media',
  order_index int NOT NULL DEFAULT 0,
  sent_at timestamptz, decided_at timestamptz,
  published_link text,
  is_example boolean NOT NULL DEFAULT false,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS like_items_brand_status_idx ON public.like_items (brand_id, status);
CREATE INDEX IF NOT EXISTS like_items_round_idx ON public.like_items (round_id);

CREATE TABLE IF NOT EXISTS public.like_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.like_items(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  number int NOT NULL,
  assets jsonb NOT NULL DEFAULT '[]'::jsonb,
  caption text, hashtags text, cta text,
  script jsonb NOT NULL DEFAULT '[]'::jsonb,
  text_body text,
  changes_note text,
  sent boolean NOT NULL DEFAULT false,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, number)
);
DO $$ BEGIN
  ALTER TABLE public.like_items ADD CONSTRAINT like_items_current_version_fk FOREIGN KEY (current_version_id) REFERENCES public.like_versions(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.like_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.like_items(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  version_id uuid REFERENCES public.like_versions(id) ON DELETE SET NULL,
  parent_id uuid REFERENCES public.like_comments(id) ON DELETE CASCADE,
  author_id uuid DEFAULT auth.uid(),
  author_name text,
  author_kind text NOT NULL DEFAULT 'agency' CHECK (author_kind IN ('agency','client','guest')),
  body text NOT NULL CHECK (length(trim(body)) > 0),
  mentions uuid[] NOT NULL DEFAULT '{}',
  anchor jsonb,
  internal boolean NOT NULL DEFAULT false,
  resolved_at timestamptz, resolved_by uuid,
  edited_at timestamptz, deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS like_comments_item_idx ON public.like_comments (item_id, created_at);

CREATE TABLE IF NOT EXISTS public.like_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.like_items(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES public.like_versions(id) ON DELETE CASCADE,
  decision text NOT NULL CHECK (decision IN ('approved','changes_requested','rejected','undone')),
  decided_by uuid DEFAULT auth.uid(),
  decider_name text,
  decider_kind text NOT NULL DEFAULT 'client' CHECK (decider_kind IN ('agency','client','guest')),
  note text,
  phrases text[] NOT NULL DEFAULT '{}',
  via text NOT NULL DEFAULT 'like' CHECK (via IN ('like','outro_canal')),
  justification text,
  undoes uuid REFERENCES public.like_decisions(id),
  prior_state jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (via = 'like' OR length(coalesce(trim(justification), '')) >= 10)
);
CREATE INDEX IF NOT EXISTS like_decisions_item_idx ON public.like_decisions (item_id, created_at);

CREATE TABLE IF NOT EXISTS public.like_approvers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'aprovador' CHECK (role IN ('aprovador','revisor','observador')),
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.like_settings (
  brand_id uuid PRIMARY KEY REFERENCES public.brands(id) ON DELETE CASCADE,
  rule text NOT NULL DEFAULT 'qualquer' CHECK (rule IN ('qualquer','todos','sequencial')),
  decision_days int NOT NULL DEFAULT 2,
  remind_before boolean NOT NULL DEFAULT true,
  remind_on_day boolean NOT NULL DEFAULT true,
  remind_late boolean NOT NULL DEFAULT true,
  require_comment_on_adjust boolean NOT NULL DEFAULT true,
  allow_download boolean NOT NULL DEFAULT false,
  watermark boolean NOT NULL DEFAULT true,
  allow_share_links boolean NOT NULL DEFAULT false,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.like_views (
  item_id uuid NOT NULL REFERENCES public.like_items(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES public.like_versions(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, version_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.like_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  round_id uuid REFERENCES public.like_rounds(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.like_items(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  can_view boolean NOT NULL DEFAULT true,
  can_comment boolean NOT NULL DEFAULT true,
  can_decide boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_by uuid DEFAULT auth.uid(),
  last_used_at timestamptz,
  uses int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (round_id IS NOT NULL OR item_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  brand_id uuid REFERENCES public.brands(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications (user_id, read_at, created_at DESC);

CREATE TABLE IF NOT EXISTS public.like_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.like_items(id) ON DELETE CASCADE,
  round_id uuid REFERENCES public.like_rounds(id) ON DELETE CASCADE,
  actor_id uuid DEFAULT auth.uid(),
  actor_name text,
  event text NOT NULL CHECK (event IN ('criado','enviado','visto','comentado','decidido','nova_versao','lembrado','agendado','publicado','cancelado','desfeito')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS like_activity_item_idx ON public.like_activity (item_id, created_at);

-- Vínculo evento da agenda ↔ material (para não duplicar e para desfazer).
ALTER TABLE public.espaco360_calendar_events ADD COLUMN IF NOT EXISTS like_item_id uuid REFERENCES public.like_items(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS espaco360_calendar_events_like_item_uq ON public.espaco360_calendar_events (like_item_id) WHERE like_item_id IS NOT NULL;

-- ----- Imutabilidade --------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.like_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Registro imutável: % não pode ser alterado nem apagado.', TG_TABLE_NAME; END $$;
DROP TRIGGER IF EXISTS like_decisions_immutable ON public.like_decisions;
CREATE TRIGGER like_decisions_immutable BEFORE UPDATE OR DELETE ON public.like_decisions FOR EACH ROW EXECUTE FUNCTION public.like_immutable();
DROP TRIGGER IF EXISTS like_activity_immutable ON public.like_activity;
CREATE TRIGGER like_activity_immutable BEFORE UPDATE OR DELETE ON public.like_activity FOR EACH ROW EXECUTE FUNCTION public.like_immutable();

-- Versão enviada não muda.
CREATE OR REPLACE FUNCTION public.like_version_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.sent AND (NEW.assets IS DISTINCT FROM OLD.assets OR NEW.caption IS DISTINCT FROM OLD.caption OR NEW.script IS DISTINCT FROM OLD.script OR NEW.text_body IS DISTINCT FROM OLD.text_body OR NEW.cta IS DISTINCT FROM OLD.cta OR NEW.hashtags IS DISTINCT FROM OLD.hashtags) THEN
    RAISE EXCEPTION 'Esta versão já foi enviada ao cliente. Crie uma nova versão.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS like_versions_frozen ON public.like_versions;
CREATE TRIGGER like_versions_frozen BEFORE UPDATE ON public.like_versions FOR EACH ROW EXECUTE FUNCTION public.like_version_frozen();

-- ----- RLS ------------------------------------------------------------------------

ALTER TABLE public.like_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.like_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.like_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.like_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.like_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.like_approvers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.like_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.like_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.like_share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.like_activity ENABLE ROW LEVEL SECURITY;

-- O cliente só enxerga material já enviado (nunca rascunho interno).
CREATE OR REPLACE FUNCTION public.like_client_can_see(p_item uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM like_items i WHERE i.id = p_item AND i.status <> 'rascunho'
    AND public.is_brand_member(i.brand_id) AND public.has_brand_permission('like.visualizar', i.brand_id));
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['like_rounds','like_items','like_versions','like_comments','like_approvers','like_settings','like_views','like_share_links','like_activity'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_agency', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_agency_for_brand(brand_id)) WITH CHECK (public.is_agency_for_brand(brand_id))', t || '_agency', t);
  END LOOP;
END $$;

-- Decisões: equipe lê e insere; cliente lê as da marca e insere se for aprovador.
DROP POLICY IF EXISTS like_decisions_agency_read ON public.like_decisions;
CREATE POLICY like_decisions_agency_read ON public.like_decisions FOR SELECT TO authenticated USING (public.is_agency_for_brand(brand_id));
DROP POLICY IF EXISTS like_decisions_client_read ON public.like_decisions;
CREATE POLICY like_decisions_client_read ON public.like_decisions FOR SELECT TO authenticated USING (public.like_client_can_see(item_id));

DROP POLICY IF EXISTS like_rounds_client ON public.like_rounds;
CREATE POLICY like_rounds_client ON public.like_rounds FOR SELECT TO authenticated USING (sent_at IS NOT NULL AND public.is_brand_member(brand_id) AND public.has_brand_permission('like.visualizar', brand_id));
DROP POLICY IF EXISTS like_items_client ON public.like_items;
CREATE POLICY like_items_client ON public.like_items FOR SELECT TO authenticated USING (public.like_client_can_see(id));
DROP POLICY IF EXISTS like_versions_client ON public.like_versions;
CREATE POLICY like_versions_client ON public.like_versions FOR SELECT TO authenticated USING (sent AND public.like_client_can_see(item_id));
DROP POLICY IF EXISTS like_comments_client_read ON public.like_comments;
CREATE POLICY like_comments_client_read ON public.like_comments FOR SELECT TO authenticated USING (NOT internal AND deleted_at IS NULL AND public.like_client_can_see(item_id));
DROP POLICY IF EXISTS like_comments_client_write ON public.like_comments;
CREATE POLICY like_comments_client_write ON public.like_comments FOR INSERT TO authenticated WITH CHECK (NOT internal AND author_kind = 'client' AND author_id = auth.uid() AND public.like_client_can_see(item_id) AND public.has_brand_permission('like.comentar', brand_id));
DROP POLICY IF EXISTS like_comments_client_edit ON public.like_comments;
CREATE POLICY like_comments_client_edit ON public.like_comments FOR UPDATE TO authenticated USING (author_id = auth.uid() AND NOT internal) WITH CHECK (author_id = auth.uid() AND NOT internal);
DROP POLICY IF EXISTS like_approvers_client ON public.like_approvers;
CREATE POLICY like_approvers_client ON public.like_approvers FOR SELECT TO authenticated USING (public.is_brand_member(brand_id));
DROP POLICY IF EXISTS like_settings_client ON public.like_settings;
CREATE POLICY like_settings_client ON public.like_settings FOR SELECT TO authenticated USING (public.is_brand_member(brand_id));
DROP POLICY IF EXISTS like_views_client ON public.like_views;
CREATE POLICY like_views_client ON public.like_views FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND public.like_client_can_see(item_id));
DROP POLICY IF EXISTS like_activity_client ON public.like_activity;
CREATE POLICY like_activity_client ON public.like_activity FOR SELECT TO authenticated USING (item_id IS NOT NULL AND public.like_client_can_see(item_id) AND coalesce((payload->>'internal')::boolean, false) = false);
DROP POLICY IF EXISTS notifications_own ON public.notifications;
CREATE POLICY notifications_own ON public.notifications FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ----- Estado e integrações ------------------------------------------------------------

-- Envio: material sai do rascunho; tarefa em Avaliação externa; solicitação aguardando cliente.
CREATE OR REPLACE FUNCTION public.like_send_items(p_items uuid[]) RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN SELECT * FROM like_items WHERE id = ANY(p_items) AND status IN ('rascunho','ajustes','nova_versao') LOOP
    IF NOT public.is_agency_for_brand(r.brand_id) THEN RAISE EXCEPTION 'Sem permissão para enviar.'; END IF;
    IF r.current_version_id IS NULL THEN RAISE EXCEPTION 'O material "%" não tem versão para enviar.', r.title; END IF;
    UPDATE like_versions SET sent = true WHERE id = r.current_version_id;
    UPDATE like_items SET status = 'aguardando', sent_at = coalesce(sent_at, now()), updated_at = now() WHERE id = r.id;
    IF r.task_id IS NOT NULL THEN UPDATE workspace_tasks SET status = 'Avaliação externa', updated_at = now() WHERE id = r.task_id; END IF;
    IF r.solicitacao_id IS NOT NULL THEN UPDATE solicitacoes SET status = 'aguardando_cliente' WHERE id = r.solicitacao_id; END IF;
    INSERT INTO like_activity (brand_id, item_id, round_id, event, payload) VALUES (r.brand_id, r.id, r.round_id, CASE WHEN r.status = 'rascunho' THEN 'enviado' ELSE 'nova_versao' END, '{}'::jsonb);
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

-- Aprovação: aplica as integrações uma única vez por versão (idempotente).
CREATE OR REPLACE FUNCTION public.like_apply_approval(p_item uuid, p_version uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i like_items; v like_versions;
BEGIN
  SELECT * INTO i FROM like_items WHERE id = p_item;
  SELECT * INTO v FROM like_versions WHERE id = p_version;
  UPDATE like_items SET status = 'aprovado', decided_at = now(), updated_at = now() WHERE id = p_item;
  IF i.task_id IS NOT NULL THEN
    UPDATE workspace_tasks SET status = 'Concluído', completed_at = coalesce(completed_at, now()), updated_at = now() WHERE id = i.task_id AND status <> 'Concluído';
  END IF;
  IF i.conteudo_id IS NOT NULL THEN
    UPDATE conteudos SET status = 'aprovada', legenda = coalesce(v.caption, legenda), cta = coalesce(v.cta, cta),
      roteiro = CASE WHEN jsonb_array_length(v.script) > 0 THEN (SELECT string_agg('## ' || (s->>'nome') || E'\n' || coalesce(s->>'texto', ''), E'\n\n') FROM jsonb_array_elements(v.script) s) ELSE roteiro END
    WHERE id = i.conteudo_id;
  END IF;
  IF i.front_id IS NOT NULL AND i.publish_at IS NOT NULL THEN
    UPDATE workspace_fronts SET approved_until = greatest(coalesce(approved_until, i.publish_at::date), i.publish_at::date), updated_at = now() WHERE id = i.front_id;
  END IF;
  IF i.publish_at IS NOT NULL THEN
    INSERT INTO espaco360_calendar_events (brand_id, campaign_id, title, event_type, event_date, start_time, status, like_item_id)
    VALUES (i.brand_id, i.campaign_id, i.title, 'publicacao', i.publish_at::date, to_char(i.publish_at, 'HH24:MI'), 'agendado', i.id)
    ON CONFLICT (like_item_id) WHERE like_item_id IS NOT NULL DO UPDATE SET status = 'agendado', event_date = EXCLUDED.event_date;
  END IF;
END $$;

-- Maior publicação aprovada de uma frente (usado ao desfazer).
CREATE OR REPLACE FUNCTION public.like_recompute_front(p_front uuid, p_base date) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE workspace_fronts SET approved_until = greatest(p_base, coalesce((SELECT max(publish_at::date) FROM like_items WHERE front_id = p_front AND status IN ('aprovado','agendado','publicado')), p_base)), updated_at = now() WHERE id = p_front;
$$;

/**
 * Decisão sobre uma versão. Respeita a regra do cliente (qualquer, todos,
 * sequencial). Aprovar duas vezes a mesma versão não duplica nada.
 */
CREATE OR REPLACE FUNCTION public.like_decide(p_item uuid, p_version uuid, p_decision text, p_note text DEFAULT NULL, p_phrases text[] DEFAULT '{}', p_via text DEFAULT 'like', p_justification text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i like_items; s like_settings; kind text; approvers int; approved int; next_ok boolean; prior jsonb; dec_id uuid;
BEGIN
  SELECT * INTO i FROM like_items WHERE id = p_item FOR UPDATE;
  IF i.id IS NULL THEN RAISE EXCEPTION 'Material não encontrado.'; END IF;
  IF i.current_version_id IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'Existe uma versão mais nova deste material.'; END IF;
  IF p_decision NOT IN ('approved','changes_requested','rejected') THEN RAISE EXCEPTION 'Decisão inválida.'; END IF;

  IF p_via = 'outro_canal' THEN
    IF NOT public.has_role(auth.uid(), 'agency_admin') OR NOT public.is_agency_for_brand(i.brand_id) THEN RAISE EXCEPTION 'Só um administrador da agência registra aprovação por outro canal.'; END IF;
    kind := 'agency';
  ELSIF public.is_agency_for_brand(i.brand_id) THEN
    RAISE EXCEPTION 'A decisão é do cliente, no Like.';
  ELSE
    IF NOT (public.like_client_can_see(p_item) AND public.has_brand_permission('like.aprovar', i.brand_id)
      AND EXISTS (SELECT 1 FROM like_approvers a WHERE a.brand_id = i.brand_id AND a.user_id = auth.uid() AND a.role = 'aprovador')) THEN
      RAISE EXCEPTION 'Você não está entre os aprovadores deste cliente.';
    END IF;
    kind := 'client';
  END IF;
  IF i.status NOT IN ('aguardando','em_revisao','nova_versao') THEN
    IF i.status = 'aprovado' AND p_decision = 'approved' THEN RETURN i.status; END IF; -- idempotente
    RAISE EXCEPTION 'Este material não está aguardando decisão.';
  END IF;

  SELECT * INTO s FROM like_settings WHERE brand_id = i.brand_id;
  IF p_decision = 'changes_requested' AND coalesce(s.require_comment_on_adjust, true) AND coalesce(trim(p_note), '') = '' AND coalesce(array_length(p_phrases, 1), 0) = 0
     AND NOT EXISTS (SELECT 1 FROM like_comments c WHERE c.item_id = p_item AND c.version_id = p_version AND NOT c.internal AND c.resolved_at IS NULL) THEN
    RAISE EXCEPTION 'Diga o que ajustar: comente no material ou escolha uma frase.';
  END IF;

  prior := jsonb_build_object('item_status', i.status,
    'task_status', (SELECT status FROM workspace_tasks WHERE id = i.task_id),
    'task_completed_at', (SELECT completed_at FROM workspace_tasks WHERE id = i.task_id),
    'conteudo', (SELECT to_jsonb(c) - 'updated_at' FROM conteudos c WHERE id = i.conteudo_id),
    'front_until', (SELECT approved_until FROM workspace_fronts WHERE id = i.front_id),
    'solicitacao_status', (SELECT status FROM solicitacoes WHERE id = i.solicitacao_id));

  INSERT INTO like_decisions (item_id, brand_id, version_id, decision, decider_kind, note, phrases, via, justification, prior_state,
    decider_name) VALUES (p_item, i.brand_id, p_version, p_decision, kind, p_note, p_phrases, p_via, p_justification, prior,
    (SELECT coalesce(display_name, email) FROM profiles WHERE id = auth.uid())) RETURNING id INTO dec_id;
  INSERT INTO like_activity (brand_id, item_id, round_id, event, payload) VALUES (i.brand_id, p_item, i.round_id, 'decidido', jsonb_build_object('decision', p_decision, 'decision_id', dec_id));

  IF p_decision = 'approved' THEN
    SELECT count(*) INTO approvers FROM like_approvers WHERE brand_id = i.brand_id AND role = 'aprovador';
    SELECT count(DISTINCT d.decided_by) INTO approved FROM like_decisions d WHERE d.item_id = p_item AND d.version_id = p_version AND d.decision = 'approved'
      AND NOT EXISTS (SELECT 1 FROM like_decisions u WHERE u.undoes = d.id);
    next_ok := coalesce(s.rule, 'qualquer') = 'qualquer' OR p_via = 'outro_canal' OR approved >= greatest(approvers, 1);
    IF next_ok THEN
      PERFORM public.like_apply_approval(p_item, p_version);
      IF i.task_id IS NOT NULL THEN
        INSERT INTO workspace_reviews (task_id, brand_id, scope, decision, phrases, comment, reviewer_name, checklist)
        VALUES (i.task_id, i.brand_id, CASE WHEN p_via = 'outro_canal' THEN 'externa_excecao' ELSE 'externa' END, 'aprovado', p_phrases, coalesce(p_justification, p_note), (SELECT coalesce(display_name, email) FROM profiles WHERE id = auth.uid()), '[]'::jsonb);
      END IF;
    ELSE
      UPDATE like_items SET status = 'em_revisao', updated_at = now() WHERE id = p_item;
    END IF;
  ELSIF p_decision = 'changes_requested' THEN
    UPDATE like_items SET status = 'ajustes', decided_at = now(), updated_at = now() WHERE id = p_item;
    IF i.task_id IS NOT NULL THEN
      UPDATE workspace_tasks SET status = 'Ajuste', updated_at = now() WHERE id = i.task_id;
      INSERT INTO workspace_reviews (task_id, brand_id, scope, decision, phrases, comment, reviewer_name, checklist)
      VALUES (i.task_id, i.brand_id, 'externa', 'ajuste', p_phrases,
        concat_ws(E'\n', p_note, (SELECT string_agg('• ' || body, E'\n') FROM like_comments WHERE item_id = p_item AND version_id = p_version AND NOT internal AND resolved_at IS NULL)),
        (SELECT coalesce(display_name, email) FROM profiles WHERE id = auth.uid()), '[]'::jsonb);
    END IF;
    IF i.solicitacao_id IS NOT NULL THEN UPDATE solicitacoes SET status = 'em_execucao' WHERE id = i.solicitacao_id; END IF;
  ELSE -- rejected
    UPDATE like_items SET status = 'reprovado', decided_at = now(), updated_at = now() WHERE id = p_item;
    IF i.task_id IS NOT NULL THEN UPDATE workspace_tasks SET status = 'Ajuste', note = concat_ws(E'\n', note, 'Reprovado pelo cliente: ' || coalesce(p_note, '')) WHERE id = i.task_id; END IF;
    IF i.conteudo_id IS NOT NULL THEN UPDATE conteudos SET status = 'rascunho' WHERE id = i.conteudo_id; END IF;
  END IF;
  RETURN (SELECT status FROM like_items WHERE id = p_item);
END $$;

-- Desfazer (até 5 minutos, só quem decidiu): restaura o estado anterior sem apagar nada.
CREATE OR REPLACE FUNCTION public.like_undo(p_decision uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d like_decisions; i like_items; p jsonb;
BEGIN
  SELECT * INTO d FROM like_decisions WHERE id = p_decision;
  IF d.id IS NULL OR d.decision = 'undone' THEN RAISE EXCEPTION 'Decisão não encontrada.'; END IF;
  IF d.decided_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Só quem decidiu pode desfazer.'; END IF;
  IF now() - d.created_at > interval '5 minutes' THEN RAISE EXCEPTION 'O prazo para desfazer (5 minutos) terminou.'; END IF;
  IF EXISTS (SELECT 1 FROM like_decisions WHERE undoes = d.id) THEN RETURN 'ja_desfeita'; END IF;
  SELECT * INTO i FROM like_items WHERE id = d.item_id FOR UPDATE;
  p := d.prior_state;
  INSERT INTO like_decisions (item_id, brand_id, version_id, decision, decider_kind, via, undoes, note)
  VALUES (d.item_id, d.brand_id, d.version_id, 'undone', d.decider_kind, 'like', d.id, 'Decisão desfeita');
  UPDATE like_items SET status = p->>'item_status', decided_at = NULL, updated_at = now() WHERE id = d.item_id;
  IF i.task_id IS NOT NULL AND p ? 'task_status' THEN
    UPDATE workspace_tasks SET status = p->>'task_status', completed_at = (p->>'task_completed_at')::timestamptz WHERE id = i.task_id;
  END IF;
  IF i.conteudo_id IS NOT NULL AND p->'conteudo' IS NOT NULL AND p->'conteudo' <> 'null'::jsonb THEN
    UPDATE conteudos SET status = p->'conteudo'->>'status', legenda = p->'conteudo'->>'legenda', cta = p->'conteudo'->>'cta', roteiro = p->'conteudo'->>'roteiro' WHERE id = i.conteudo_id;
  END IF;
  IF i.solicitacao_id IS NOT NULL AND p ? 'solicitacao_status' THEN UPDATE solicitacoes SET status = p->>'solicitacao_status' WHERE id = i.solicitacao_id; END IF;
  IF d.decision = 'approved' THEN
    DELETE FROM espaco360_calendar_events WHERE like_item_id = i.id;
    IF i.front_id IS NOT NULL THEN PERFORM public.like_recompute_front(i.front_id, (p->>'front_until')::date); END IF;
  END IF;
  INSERT INTO like_activity (brand_id, item_id, round_id, event, payload) VALUES (i.brand_id, i.id, i.round_id, 'desfeito', jsonb_build_object('decision_id', d.id));
  RETURN p->>'item_status';
END $$;

-- Primeiro comentário do cliente: Aguardando → Em revisão.
CREATE OR REPLACE FUNCTION public.like_comment_status() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.author_kind IN ('client','guest') AND NOT NEW.internal THEN
    UPDATE like_items SET status = 'em_revisao', updated_at = now() WHERE id = NEW.item_id AND status IN ('aguardando','nova_versao');
  END IF;
  INSERT INTO like_activity (brand_id, item_id, event, payload) VALUES (NEW.brand_id, NEW.item_id, 'comentado', jsonb_build_object('internal', NEW.internal));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS like_comments_status ON public.like_comments;
CREATE TRIGGER like_comments_status AFTER INSERT ON public.like_comments FOR EACH ROW EXECUTE FUNCTION public.like_comment_status();

-- Publicado: conteúdo vira Publicada e o evento da agenda é concluído.
CREATE OR REPLACE FUNCTION public.like_mark_published(p_item uuid, p_link text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i like_items;
BEGIN
  SELECT * INTO i FROM like_items WHERE id = p_item;
  IF NOT public.is_agency_for_brand(i.brand_id) THEN RAISE EXCEPTION 'Sem permissão.'; END IF;
  IF i.status NOT IN ('aprovado','agendado','publicado') THEN RAISE EXCEPTION 'Só materiais aprovados podem ser publicados.'; END IF;
  UPDATE like_items SET status = 'publicado', published_link = p_link, updated_at = now() WHERE id = p_item;
  IF i.conteudo_id IS NOT NULL THEN UPDATE conteudos SET status = 'publicada', published_link = p_link WHERE id = i.conteudo_id; END IF;
  UPDATE espaco360_calendar_events SET status = 'concluido' WHERE like_item_id = p_item;
  INSERT INTO like_activity (brand_id, item_id, round_id, event, payload) VALUES (i.brand_id, i.id, i.round_id, 'publicado', jsonb_build_object('link', p_link));
END $$;

-- Rodada: concluída quando todos têm decisão final; vencida quando passa do prazo.
CREATE OR REPLACE FUNCTION public.like_round_status() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.round_id IS NOT NULL THEN
    UPDATE like_rounds r SET status = CASE
      WHEN NOT EXISTS (SELECT 1 FROM like_items x WHERE x.round_id = r.id AND x.status IN ('rascunho','aguardando','em_revisao','ajustes','nova_versao')) THEN 'concluida'
      WHEN r.due_at < now() THEN 'vencida' ELSE 'aberta' END, updated_at = now()
    WHERE r.id = NEW.round_id AND r.status <> 'cancelada';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS like_items_round_status ON public.like_items;
CREATE TRIGGER like_items_round_status AFTER UPDATE OF status ON public.like_items FOR EACH ROW EXECUTE FUNCTION public.like_round_status();

-- ----- Storage -----------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public) VALUES ('like-assets', 'like-assets', false) ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS like_assets_agency ON storage.objects;
CREATE POLICY like_assets_agency ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'like-assets' AND public.is_agency_for_brand(((storage.foldername(name))[1])::uuid))
  WITH CHECK (bucket_id = 'like-assets' AND public.is_agency_for_brand(((storage.foldername(name))[1])::uuid));
DROP POLICY IF EXISTS like_assets_client_read ON storage.objects;
CREATE POLICY like_assets_client_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'like-assets' AND public.like_client_can_see(((storage.foldername(name))[2])::uuid));

-- Tempo real para comentários, decisões e status.
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.like_items, public.like_comments, public.like_decisions, public.workspace_fronts;
EXCEPTION WHEN others THEN NULL; END $$;
