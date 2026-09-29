CREATE TABLE IF NOT EXISTS public.workspace_task_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_task_id uuid NOT NULL REFERENCES public.workspace_tasks(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  source_module text NOT NULL,
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, source_module, source_type, source_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_task_sources TO authenticated;
GRANT ALL ON public.workspace_task_sources TO service_role;

ALTER TABLE public.workspace_task_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_task_sources_agency ON public.workspace_task_sources;
CREATE POLICY workspace_task_sources_agency ON public.workspace_task_sources
  FOR ALL TO authenticated
  USING (public.is_agency_for_brand(brand_id))
  WITH CHECK (public.is_agency_for_brand(brand_id));

CREATE OR REPLACE FUNCTION public.dispatch_brand_item_to_workspace(
  p_brand_id uuid,
  p_source_module text,
  p_source_type text,
  p_source_id uuid,
  p_title text,
  p_description text DEFAULT NULL,
  p_sector text DEFAULT NULL,
  p_owner_id uuid DEFAULT NULL,
  p_owner_name text DEFAULT NULL,
  p_due_date date DEFAULT NULL,
  p_priority integer DEFAULT 999,
  p_note text DEFAULT NULL,
  p_source_url text DEFAULT NULL
)
RETURNS TABLE (workspace_task_id uuid, created boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing uuid;
  new_task uuid;
  full_note text;
BEGIN
  IF NOT (public.is_agency_for_brand(p_brand_id) OR public.is_brand_member(p_brand_id)) THEN
    RAISE EXCEPTION 'Sem permissão para enviar itens deste cliente para o Workspace.';
  END IF;

  SELECT s.workspace_task_id INTO existing
  FROM public.workspace_task_sources s
  WHERE s.brand_id = p_brand_id
    AND s.source_module = p_source_module
    AND s.source_type = p_source_type
    AND s.source_id = p_source_id;

  IF existing IS NOT NULL THEN
    RETURN QUERY SELECT existing, false;
    RETURN;
  END IF;

  full_note := NULLIF(concat_ws(E'\n\n', NULLIF(btrim(coalesce(p_description, '')), ''), NULLIF(btrim(coalesce(p_note, '')), '')), '');

  INSERT INTO public.workspace_tasks (brand_id, title, sector, owner_id, owner_name, due_date, month, priority, note, status)
  VALUES (
    p_brand_id,
    p_title,
    NULLIF(btrim(coalesce(p_sector, '')), ''),
    p_owner_id,
    NULLIF(btrim(coalesce(p_owner_name, '')), ''),
    p_due_date,
    to_char(p_due_date, 'YYYY-MM'),
    greatest(coalesce(p_priority, 999), 1),
    full_note,
    'Parada'
  )
  RETURNING id INTO new_task;

  INSERT INTO public.workspace_task_sources (workspace_task_id, brand_id, source_module, source_type, source_id, source_url)
  VALUES (new_task, p_brand_id, p_source_module, p_source_type, p_source_id, p_source_url);

  RETURN QUERY SELECT new_task, true;
END;
$$;

DROP POLICY IF EXISTS workspace_fronts_member_read ON public.workspace_fronts;
DROP POLICY IF EXISTS workspace_tasks_member_read ON public.workspace_tasks;
DROP POLICY IF EXISTS workspace_reviews_member_read ON public.workspace_reviews;