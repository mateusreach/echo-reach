-- 1) Modelo de execução "Feed" (as 7 tarefas predeterminadas do Workspace anterior)
--    e setores. Idempotente: só insere o que ainda não existe.
-- 2) Responsável e antecedência POR CLIENTE para cada tarefa do modelo.
-- 3) Metas semanais (gerais e de tarefa específica) com benefício para a equipe.

DO $$
DECLARE v_org uuid;
BEGIN
  FOR v_org IN SELECT DISTINCT organization_id FROM public.brands WHERE organization_id IS NOT NULL LOOP
    INSERT INTO public.workspace_sectors (organization_id, name, order_index)
    SELECT v_org, s.name, s.ord
    FROM (VALUES ('Planejamento', 1), ('Conteúdo', 2), ('Estratégia', 3), ('Criação / Entrega', 4)) AS s(name, ord)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.workspace_sectors x WHERE x.organization_id = v_org AND lower(x.name) = lower(s.name)
    );

    INSERT INTO public.workspace_templates (organization_id, name, kind, tasks)
    SELECT v_org, 'Feed', 'content_cycle', jsonb_build_array(
      jsonb_build_object('title', 'Estratégia',   'sector', 'Planejamento',     'days_before', 1),
      jsonb_build_object('title', 'Roteiros',     'sector', 'Conteúdo',         'days_before', 0),
      jsonb_build_object('title', 'Pré produção', 'sector', 'Estratégia',       'days_before', 0),
      jsonb_build_object('title', 'Briefing',     'sector', 'Criação / Entrega','days_before', 0),
      jsonb_build_object('title', 'Artes',        'sector', 'Criação / Entrega','days_before', 0),
      jsonb_build_object('title', 'Vídeos',       'sector', 'Criação / Entrega','days_before', 0),
      jsonb_build_object('title', 'Legendas',     'sector', 'Criação / Entrega','days_before', 0)
    )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.workspace_templates t WHERE t.organization_id = v_org AND lower(t.name) = 'feed'
    );
  END LOOP;
END;
$$;

-- Responsável por tarefa, definido por cliente (cada cliente tem sua configuração).
CREATE TABLE IF NOT EXISTS public.workspace_client_task_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  task_title text NOT NULL,
  owner_name text,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  days_before integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, task_title)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_client_task_owners TO authenticated;
GRANT ALL ON public.workspace_client_task_owners TO service_role;
ALTER TABLE public.workspace_client_task_owners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_client_task_owners_agency ON public.workspace_client_task_owners;
CREATE POLICY workspace_client_task_owners_agency ON public.workspace_client_task_owners
  FOR ALL TO authenticated
  USING (public.is_agency_for_brand(brand_id))
  WITH CHECK (public.is_agency_for_brand(brand_id));
DROP TRIGGER IF EXISTS trg_ws_client_task_owners_touch ON public.workspace_client_task_owners;
CREATE TRIGGER trg_ws_client_task_owners_touch BEFORE UPDATE ON public.workspace_client_task_owners
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Metas semanais. Uma meta vale para a semana iniciada em `week_start` (segunda-feira)
-- e, se `recurring`, para todas as semanas seguintes.
--   scope 'geral'  → conta todas as tarefas (ou entregas) concluídas na semana
--   scope 'tarefa' → conta só as tarefas com o título informado (ex.: "Artes")
--   brand_id / member_* opcionais restringem a meta a um cliente ou a uma pessoa.
CREATE TABLE IF NOT EXISTS public.workspace_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('geral', 'tarefa')),
  metric text NOT NULL DEFAULT 'tarefas' CHECK (metric IN ('tarefas', 'entregas')),
  task_title text,
  brand_id uuid REFERENCES public.brands(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  member_name text,
  target integer NOT NULL CHECK (target > 0),
  reward text,
  week_start date NOT NULL,
  recurring boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_goals_task_scope CHECK (scope <> 'tarefa' OR (task_title IS NOT NULL AND metric = 'tarefas'))
);
CREATE INDEX IF NOT EXISTS workspace_goals_org_week_idx ON public.workspace_goals (organization_id, week_start);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_goals TO authenticated;
GRANT ALL ON public.workspace_goals TO service_role;
ALTER TABLE public.workspace_goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_goals_agency ON public.workspace_goals;
CREATE POLICY workspace_goals_agency ON public.workspace_goals
  FOR ALL TO authenticated
  USING (public.is_agency_org(organization_id))
  WITH CHECK (public.is_agency_org(organization_id));
DROP TRIGGER IF EXISTS trg_ws_goals_touch ON public.workspace_goals;
CREATE TRIGGER trg_ws_goals_touch BEFORE UPDATE ON public.workspace_goals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Equipe: a conta da pessoa administradora e os nomes do Workspace anterior
-- (sem conta ainda; passam a ter acesso quando forem convidados).
INSERT INTO public.team_members (organization_id, user_id, name, email, kind)
SELECT p.organization_id, p.id, 'Mateus Viana', p.email, 'equipe'
FROM public.profiles p
WHERE p.email = 'mateus@reachbrasil.com.br' AND p.organization_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.team_members t WHERE t.user_id = p.id);

INSERT INTO public.team_members (organization_id, name, kind)
SELECT o.id, n.name, 'equipe'
FROM public.organizations o
CROSS JOIN (VALUES ('João'), ('Guilherme'), ('Sara')) AS n(name)
WHERE o.id = 'f9eb8ddb-d3d7-4943-92c2-7eaa91036386'
  AND NOT EXISTS (SELECT 1 FROM public.team_members t WHERE t.organization_id = o.id AND lower(t.name) = lower(n.name));
