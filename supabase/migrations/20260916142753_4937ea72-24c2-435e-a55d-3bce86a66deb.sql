-- ===== FASE 4: cliente único com módulos =====
UPDATE public.brands
SET modules = coalesce(modules, '{}'::jsonb) || jsonb_build_object(
  'brand', coalesce((modules->>'brand')::boolean, true),
  'workspace', coalesce((modules->>'workspace')::boolean, true)
);

ALTER TABLE public.brands ALTER COLUMN modules SET DEFAULT '{"brand": true, "workspace": true}'::jsonb;

-- ===== Equipe global: campos vindos do Workspace =====
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS palette text NOT NULL DEFAULT 'purple';
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS is_leader boolean NOT NULL DEFAULT false;

-- ===== Modelos de demanda operacional =====
CREATE TABLE IF NOT EXISTS public.workspace_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id),
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'Entrega',
  tasks jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_templates TO authenticated;
GRANT ALL ON public.workspace_templates TO service_role;
ALTER TABLE public.workspace_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_templates_agency" ON public.workspace_templates
  FOR ALL TO authenticated USING (public.is_agency_org(organization_id)) WITH CHECK (public.is_agency_org(organization_id));

-- ===== Setores / áreas =====
CREATE TABLE IF NOT EXISTS public.workspace_sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id),
  name text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_sectors TO authenticated;
GRANT ALL ON public.workspace_sectors TO service_role;
ALTER TABLE public.workspace_sectors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_sectors_agency" ON public.workspace_sectors
  FOR ALL TO authenticated USING (public.is_agency_org(organization_id)) WITH CHECK (public.is_agency_org(organization_id));

-- ===== Notas rápidas da equipe =====
CREATE TABLE IF NOT EXISTS public.workspace_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id),
  text text NOT NULL,
  author text,
  likes integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_notes TO authenticated;
GRANT ALL ON public.workspace_notes TO service_role;
ALTER TABLE public.workspace_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_notes_agency" ON public.workspace_notes
  FOR ALL TO authenticated USING (public.is_agency_org(organization_id)) WITH CHECK (public.is_agency_org(organization_id));

-- ===== Frentes de conteúdo (cliente nunca sem post) =====
CREATE TABLE IF NOT EXISTS public.workspace_fronts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  name text NOT NULL,
  recurrence text NOT NULL DEFAULT 'weekly' CHECK (recurrence IN ('weekly','biweekly','monthly','oneoff')),
  lead_days integer NOT NULL DEFAULT 3,
  approved_until date,
  pending_start date,
  pending_end date,
  one_off_date date,
  template_id uuid REFERENCES public.workspace_templates(id) ON DELETE SET NULL,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_fronts TO authenticated;
GRANT ALL ON public.workspace_fronts TO service_role;
ALTER TABLE public.workspace_fronts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_fronts_agency" ON public.workspace_fronts
  FOR ALL TO authenticated USING (public.is_agency_for_brand(brand_id)) WITH CHECK (public.is_agency_for_brand(brand_id));
CREATE POLICY "workspace_fronts_member_read" ON public.workspace_fronts
  FOR SELECT TO authenticated USING (public.is_brand_member(brand_id));

-- ===== Tarefas operacionais =====
CREATE TABLE IF NOT EXISTS public.workspace_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  front_id uuid REFERENCES public.workspace_fronts(id) ON DELETE CASCADE,
  title text NOT NULL,
  sector text,
  owner_id uuid REFERENCES public.profiles(id),
  owner_name text,
  status text NOT NULL DEFAULT 'Parada' CHECK (status IN (
    'Parada','Iniciada','Avaliação interna','Aguardando retorno externo','Ajuste','Avaliação externa','Concluído')),
  priority integer NOT NULL DEFAULT 999,
  urgency text,
  month text,
  due_date date,
  started_at date,
  completed_at date,
  event_time time,
  location text,
  highlighted boolean NOT NULL DEFAULT false,
  pinned boolean NOT NULL DEFAULT false,
  requires_review boolean NOT NULL DEFAULT false,
  review_text text,
  review_checklist text,
  note text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_tasks TO authenticated;
GRANT ALL ON public.workspace_tasks TO service_role;
ALTER TABLE public.workspace_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_tasks_agency" ON public.workspace_tasks
  FOR ALL TO authenticated USING (public.is_agency_for_brand(brand_id)) WITH CHECK (public.is_agency_for_brand(brand_id));
CREATE POLICY "workspace_tasks_member_read" ON public.workspace_tasks
  FOR SELECT TO authenticated USING (public.is_brand_member(brand_id));

CREATE INDEX IF NOT EXISTS idx_workspace_tasks_brand ON public.workspace_tasks(brand_id);
CREATE INDEX IF NOT EXISTS idx_workspace_tasks_front ON public.workspace_tasks(front_id);
CREATE INDEX IF NOT EXISTS idx_workspace_tasks_owner ON public.workspace_tasks(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspace_fronts_brand ON public.workspace_fronts(brand_id);

-- ===== Avaliações internas/externas =====
CREATE TABLE IF NOT EXISTS public.workspace_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.workspace_tasks(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'interna' CHECK (scope IN ('interna','externa')),
  decision text NOT NULL DEFAULT 'ajuste' CHECK (decision IN ('aprovado','ajuste')),
  phrases text[] NOT NULL DEFAULT '{}',
  comment text,
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  reviewer_id uuid REFERENCES public.profiles(id),
  reviewer_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_reviews TO authenticated;
GRANT ALL ON public.workspace_reviews TO service_role;
ALTER TABLE public.workspace_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_reviews_agency" ON public.workspace_reviews
  FOR ALL TO authenticated USING (public.is_agency_for_brand(brand_id)) WITH CHECK (public.is_agency_for_brand(brand_id));
CREATE POLICY "workspace_reviews_member_read" ON public.workspace_reviews
  FOR SELECT TO authenticated USING (public.is_brand_member(brand_id));

-- ===== updated_at =====
CREATE TRIGGER trg_ws_templates_touch BEFORE UPDATE ON public.workspace_templates FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_ws_sectors_touch BEFORE UPDATE ON public.workspace_sectors FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_ws_notes_touch BEFORE UPDATE ON public.workspace_notes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_ws_fronts_touch BEFORE UPDATE ON public.workspace_fronts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_ws_tasks_touch BEFORE UPDATE ON public.workspace_tasks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_ws_reviews_touch BEFORE UPDATE ON public.workspace_reviews FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();