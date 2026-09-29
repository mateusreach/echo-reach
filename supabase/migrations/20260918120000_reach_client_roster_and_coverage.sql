-- Cadastro único para Brand e Workspace. O Espaço 360 é habilitado somente
-- para Fina Fragrância, Isabela Gomes e Zelus. Esta migração não cria tarefas.
-- Datas informadas em setembro de 2026; uma data já posterior é preservada.
-- Variações de fala/escrita do pedido: Elisa = Eliza; Azelos = Zelus;
-- "O Oão de queijo da Maria" = Pão de Queijo da Maria;
-- "A Spirale" = Spirale. Nenhuma outra informação do cliente é inferida.

CREATE OR REPLACE FUNCTION public.provision_reach_client_roster(p_organization_id uuid)
RETURNS TABLE (clients_created integer, fronts_created integer, fronts_updated integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_client record;
  v_front record;
  v_brand_id uuid;
  v_front_id uuid;
  v_slug text;
  v_modules jsonb;
  v_old_approved date;
  v_clients_created integer := 0;
  v_fronts_created integer := 0;
  v_fronts_updated integer := 0;
  v_360_brand_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'A organização é obrigatória.';
  END IF;

  -- A chamada pela aplicação exige administrador da própria organização.
  -- O contexto postgres é usado nesta migração; service_role é usado somente
  -- pelo servidor, depois que a função HTTP verifica agency_admin.
  IF auth.uid() IS NULL THEN
    IF session_user NOT IN ('postgres', 'supabase_admin', 'service_role') AND auth.role() IS DISTINCT FROM 'service_role' THEN
      RAISE EXCEPTION 'Sessão autenticada obrigatória.';
    END IF;
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND organization_id = p_organization_id
      AND role = 'agency_admin'
  ) THEN
    RAISE EXCEPTION 'Somente administradores da agência podem provisionar clientes.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_organization_id) THEN
    RAISE EXCEPTION 'Organização não encontrada.';
  END IF;

  FOR v_client IN
    SELECT * FROM (VALUES
      ('dra-giuliana', 'Dra. Giuliana', false, ARRAY['dra. giuliana', 'dra giuliana', 'giuliana'], ARRAY['dra-giuliana', 'giuliana']),
      ('fina-fragrancia', 'Fina Fragrância', true, ARRAY['fina fragrância', 'fina fragrancia', 'finofragrance'], ARRAY['fina-fragrancia', 'finofragrance']),
      ('emporium', 'A Emporium', false, ARRAY['a emporium', 'emporium'], ARRAY['a-emporium', 'emporium']),
      ('esense', 'Esense', false, ARRAY['esense'], ARRAY['esense']),
      ('eliza', 'Eliza', false, ARRAY['eliza', 'elisa'], ARRAY['eliza', 'elisa']),
      ('pao-de-queijo-da-maria', 'Pão de Queijo da Maria', false, ARRAY['pão de queijo da maria', 'pao de queijo da maria', 'oão de queijo da maria'], ARRAY['pao-de-queijo-da-maria', 'oao-de-queijo-da-maria']),
      ('gaby-mota-cachos', 'Gaby Mota Cachos', false, ARRAY['gaby mota cachos'], ARRAY['gaby-mota-cachos']),
      ('gamo-atelie', 'Gamô Ateliê', false, ARRAY['gamô ateliê', 'gamo atelie'], ARRAY['gamo-atelie']),
      ('zelus', 'Zelus', true, ARRAY['zelus', 'azelos', 'a zelus'], ARRAY['zelus', 'azelos', 'a-zelus']),
      ('spirale', 'Spirale', false, ARRAY['spirale', 'a spirale'], ARRAY['spirale', 'a-spirale']),
      ('isabela-gomes', 'Isabela Gomes', true, ARRAY['isabela gomes', 'isabela'], ARRAY['isabela-gomes', 'isabela'])
    ) AS seed(slug, name, has_360, name_aliases, slug_aliases)
  LOOP
    SELECT id INTO v_brand_id
    FROM public.brands
    WHERE organization_id = p_organization_id
      AND (slug = ANY(v_client.slug_aliases) OR lower(trim(name)) = ANY(v_client.name_aliases))
    ORDER BY (slug = v_client.slug) DESC, created_at, id
    LIMIT 1;

    IF v_brand_id IS NULL THEN
      v_slug := v_client.slug;
      IF EXISTS (SELECT 1 FROM public.brands WHERE slug = v_slug) THEN
        v_slug := v_slug || '-' || left(replace(p_organization_id::text, '-', ''), 12);
      END IF;
      INSERT INTO public.brands (organization_id, name, slug, modules, status)
      VALUES (
        p_organization_id, v_client.name, v_slug,
        jsonb_build_object('biblioteca', true, 'plano', false, 'workspace', true, 'espaco360', v_client.has_360),
        'ativo'
      )
      RETURNING id INTO v_brand_id;
      v_clients_created := v_clients_created + 1;
    ELSE
      -- Preserva nome, identidade, conteúdo e demais opções já personalizadas.
      v_modules := coalesce((SELECT modules FROM public.brands WHERE id = v_brand_id), '{}'::jsonb)
        || jsonb_build_object('biblioteca', true, 'plano', false, 'workspace', true, 'espaco360', v_client.has_360);
      UPDATE public.brands SET modules = v_modules
      WHERE id = v_brand_id AND modules IS DISTINCT FROM v_modules;
    END IF;

    IF v_client.has_360 THEN
      v_360_brand_ids := array_append(v_360_brand_ids, v_brand_id);
    END IF;

    FOR v_front IN
      SELECT * FROM (VALUES
        ('dra-giuliana', 'Feed', DATE '2026-10-02', ARRAY['feed', 'feed instagram', 'instagram feed', 'posts']),
        ('fina-fragrancia', 'Feed', DATE '2026-10-02', ARRAY['feed', 'feed instagram', 'instagram feed', 'posts']),
        ('fina-fragrancia', 'TikTok', DATE '2026-09-30', ARRAY['tiktok', 'tik tok']),
        ('emporium', 'Feed', DATE '2026-09-30', ARRAY['feed', 'feed instagram', 'instagram feed', 'posts']),
        ('esense', 'Feed', DATE '2026-09-30', ARRAY['feed', 'feed instagram', 'instagram feed', 'posts']),
        ('eliza', 'Feed', DATE '2026-09-30', ARRAY['feed', 'feed instagram', 'instagram feed', 'posts']),
        ('eliza', 'Stories', DATE '2026-09-23', ARRAY['stories', 'stories da eliza', 'stories da elisa']),
        ('pao-de-queijo-da-maria', 'Feed', DATE '2026-09-30', ARRAY['feed', 'feed instagram', 'instagram feed', 'posts']),
        ('gaby-mota-cachos', 'Feed', DATE '2026-09-30', ARRAY['feed', 'feed instagram', 'instagram feed', 'posts']),
        ('gamo-atelie', 'Feed', DATE '2026-09-30', ARRAY['feed', 'feed instagram', 'instagram feed', 'posts']),
        ('zelus', 'Feed', DATE '2026-09-30', ARRAY['feed', 'feed instagram', 'instagram feed', 'posts']),
        ('zelus', 'Stories', DATE '2026-09-28', ARRAY['stories', 'stories da zelus', 'stories das zelus', 'stories da azelos']),
        ('spirale', 'Feed', DATE '2026-09-30', ARRAY['feed', 'feed instagram', 'instagram feed', 'posts']),
        ('spirale', 'Stories', DATE '2026-09-30', ARRAY['stories', 'stories da spirale']),
        ('isabela-gomes', 'Feed', DATE '2026-09-30', ARRAY['feed', 'feed instagram', 'instagram feed', 'posts']),
        ('isabela-gomes', 'Stories', DATE '2026-09-30', ARRAY['stories', 'stories isabela', 'stories da isabela'])
      ) AS seed(client_slug, name, approved_until, name_aliases)
      WHERE client_slug = v_client.slug
    LOOP
      v_front_id := NULL;
      v_old_approved := NULL;
      SELECT id, approved_until INTO v_front_id, v_old_approved
      FROM public.workspace_fronts
      WHERE brand_id = v_brand_id AND lower(trim(name)) = ANY(v_front.name_aliases)
      ORDER BY (lower(trim(name)) = lower(v_front.name)) DESC, created_at, id
      LIMIT 1;

      IF v_front_id IS NULL THEN
        INSERT INTO public.workspace_fronts (brand_id, name, approved_until)
        VALUES (v_brand_id, v_front.name, v_front.approved_until);
        v_fronts_created := v_fronts_created + 1;
      ELSIF v_old_approved IS NULL OR v_old_approved < v_front.approved_until THEN
        UPDATE public.workspace_fronts
        SET approved_until = v_front.approved_until
        WHERE id = v_front_id;
        v_fronts_updated := v_fronts_updated + 1;
      END IF;
    END LOOP;
  END LOOP;

  -- Nesta agência o Espaço 360 pertence somente aos três clientes indicados.
  UPDATE public.brands
  SET modules = coalesce(modules, '{}'::jsonb) || '{"espaco360": false}'::jsonb
  WHERE organization_id = p_organization_id
    AND NOT (id = ANY(v_360_brand_ids))
    AND coalesce(modules->>'espaco360', 'false') = 'true';

  RETURN QUERY SELECT v_clients_created, v_fronts_created, v_fronts_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_reach_client_roster(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provision_reach_client_roster(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.provision_reach_client_roster(uuid) TO service_role;

-- Atualiza a organização identificada pela Fina. Em um projeto com uma única
-- organização, ela é a agência desta instalação mesmo antes de criar a Fina.
-- Em instalação multiagência sem Fina, o admin pode chamar a função com o id.
DO $$
DECLARE
  v_org record;
BEGIN
  FOR v_org IN
    SELECT DISTINCT id FROM (
      SELECT organization_id AS id FROM public.brands
      WHERE organization_id IS NOT NULL
        AND (slug IN ('fina-fragrancia', 'finofragrance')
          OR lower(trim(name)) IN ('fina fragrância', 'fina fragrancia', 'finofragrance'))
      UNION ALL
      SELECT id FROM public.organizations
      WHERE (SELECT count(*) FROM public.organizations) = 1
    ) AS target_organizations
  LOOP
    PERFORM public.provision_reach_client_roster(v_org.id);
  END LOOP;
END;
$$;
