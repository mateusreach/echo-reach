-- ============ ENTREGAS (WORK ORDERS) ============
CREATE TABLE IF NOT EXISTS public.workspace_work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  front_id uuid REFERENCES public.workspace_fronts(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'manual',
  title text NOT NULL,
  description text,
  period_start date,
  period_end date,
  requested_due_date date,
  internal_due_date date,
  priority integer NOT NULL DEFAULT 999,
  status text NOT NULL DEFAULT 'Aberta',
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_work_orders TO authenticated;
GRANT ALL ON public.workspace_work_orders TO service_role;
ALTER TABLE public.workspace_work_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_work_orders_agency ON public.workspace_work_orders;
CREATE POLICY workspace_work_orders_agency ON public.workspace_work_orders
  FOR ALL TO authenticated
  USING (public.is_agency_for_brand(brand_id))
  WITH CHECK (public.is_agency_for_brand(brand_id));

CREATE UNIQUE INDEX IF NOT EXISTS workspace_work_orders_cycle_key
  ON public.workspace_work_orders (front_id, period_start, period_end)
  WHERE front_id IS NOT NULL AND period_start IS NOT NULL AND period_end IS NOT NULL;

CREATE INDEX IF NOT EXISTS workspace_work_orders_brand_idx ON public.workspace_work_orders (brand_id);

DROP TRIGGER IF EXISTS trg_ws_work_orders_touch ON public.workspace_work_orders;
CREATE TRIGGER trg_ws_work_orders_touch BEFORE UPDATE ON public.workspace_work_orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ ORIGEM DAS ENTREGAS ============
CREATE TABLE IF NOT EXISTS public.workspace_work_order_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.workspace_work_orders(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  source_module text NOT NULL,
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, source_module, source_type, source_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_work_order_sources TO authenticated;
GRANT ALL ON public.workspace_work_order_sources TO service_role;
ALTER TABLE public.workspace_work_order_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_work_order_sources_agency ON public.workspace_work_order_sources;
CREATE POLICY workspace_work_order_sources_agency ON public.workspace_work_order_sources
  FOR ALL TO authenticated
  USING (public.is_agency_for_brand(brand_id))
  WITH CHECK (public.is_agency_for_brand(brand_id));

-- ============ TAREFA PASSA A PERTENCER A UMA ENTREGA ============
ALTER TABLE public.workspace_tasks
  ADD COLUMN IF NOT EXISTS work_order_id uuid REFERENCES public.workspace_work_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS workspace_tasks_work_order_idx ON public.workspace_tasks (work_order_id);

-- ============ MATERIALIZAÇÃO DO PRÓXIMO CICLO ============
CREATE OR REPLACE FUNCTION public.ensure_front_work_order(
  p_front_id uuid,
  p_period_start date,
  p_period_end date,
  p_title text DEFAULT NULL,
  p_internal_due_date date DEFAULT NULL
)
RETURNS TABLE(work_order_id uuid, created boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_front public.workspace_fronts%ROWTYPE;
  v_existing uuid;
  v_new uuid;
BEGIN
  SELECT * INTO v_front FROM public.workspace_fronts WHERE id = p_front_id;
  IF v_front.id IS NULL THEN RAISE EXCEPTION 'Frente não encontrada.'; END IF;
  IF NOT public.is_agency_for_brand(v_front.brand_id) THEN
    RAISE EXCEPTION 'Sem permissão para criar entregas deste cliente.';
  END IF;

  SELECT id INTO v_existing FROM public.workspace_work_orders
   WHERE front_id = p_front_id AND period_start = p_period_start AND period_end = p_period_end;
  IF v_existing IS NOT NULL THEN
    RETURN QUERY SELECT v_existing, false; RETURN;
  END IF;

  INSERT INTO public.workspace_work_orders
    (brand_id, front_id, kind, title, period_start, period_end, internal_due_date, created_by)
  VALUES (
    v_front.brand_id, p_front_id, 'content_cycle',
    COALESCE(NULLIF(btrim(COALESCE(p_title, '')), ''),
             v_front.name || ' · ' || to_char(p_period_start, 'DD/MM') || ' a ' || to_char(p_period_end, 'DD/MM')),
    p_period_start, p_period_end, COALESCE(p_internal_due_date, p_period_start), auth.uid()
  )
  RETURNING id INTO v_new;

  RETURN QUERY SELECT v_new, true;
END;
$$;

-- ============ ENVIO INTERNO: ITEM DO BRAND → ENTREGA ============
CREATE OR REPLACE FUNCTION public.dispatch_brand_item_to_work_order(
  p_brand_id uuid,
  p_source_module text,
  p_source_type text,
  p_source_id uuid,
  p_title text,
  p_kind text DEFAULT 'brand_request',
  p_description text DEFAULT NULL,
  p_source_url text DEFAULT NULL,
  p_requested_due_date date DEFAULT NULL,
  p_internal_due_date date DEFAULT NULL,
  p_priority integer DEFAULT 999
)
RETURNS TABLE(work_order_id uuid, created boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing uuid;
  v_new uuid;
BEGIN
  IF NOT public.is_agency_for_brand(p_brand_id) THEN
    RAISE EXCEPTION 'Apenas a equipe da agência pode enviar itens para execução.';
  END IF;

  SELECT s.work_order_id INTO v_existing
  FROM public.workspace_work_order_sources s
  WHERE s.brand_id = p_brand_id AND s.source_module = p_source_module
    AND s.source_type = p_source_type AND s.source_id = p_source_id;
  IF v_existing IS NOT NULL THEN
    RETURN QUERY SELECT v_existing, false; RETURN;
  END IF;

  INSERT INTO public.workspace_work_orders
    (brand_id, kind, title, description, requested_due_date, internal_due_date, priority, created_by)
  VALUES (p_brand_id, COALESCE(NULLIF(btrim(COALESCE(p_kind,'')),''), 'brand_request'), btrim(p_title),
          NULLIF(btrim(COALESCE(p_description,'')), ''), p_requested_due_date, p_internal_due_date,
          GREATEST(COALESCE(p_priority, 999), 1), auth.uid())
  RETURNING id INTO v_new;

  INSERT INTO public.workspace_work_order_sources
    (work_order_id, brand_id, source_module, source_type, source_id, source_url)
  VALUES (v_new, p_brand_id, p_source_module, p_source_type, p_source_id, p_source_url);

  RETURN QUERY SELECT v_new, true;
END;
$$;

-- ============ ENTRADA DO CLIENTE: SOLICITAÇÃO DO 360 → TRIAGEM ============
CREATE OR REPLACE FUNCTION public.submit_client_request_to_workspace(
  p_source_type text,
  p_source_id uuid,
  p_source_url text DEFAULT NULL
)
RETURNS TABLE(work_order_id uuid, created boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_brand uuid;
  v_title text;
  v_desc text;
  v_due date;
  v_existing uuid;
  v_new uuid;
BEGIN
  IF p_source_type = 'solicitacao' THEN
    SELECT brand_id, title, description, due_date INTO v_brand, v_title, v_desc, v_due
      FROM public.solicitacoes WHERE id = p_source_id;
  ELSIF p_source_type = 'tarefa' THEN
    SELECT brand_id, title, description, due_date INTO v_brand, v_title, v_desc, v_due
      FROM public.espaco360_tasks WHERE id = p_source_id AND owner_scope IN ('agencia','compartilhada');
  ELSE
    RAISE EXCEPTION 'Este item não pode ser enviado para execução.';
  END IF;

  IF v_brand IS NULL THEN RAISE EXCEPTION 'Item não encontrado.'; END IF;
  IF NOT (public.is_brand_member(v_brand) OR public.is_agency_for_brand(v_brand)) THEN
    RAISE EXCEPTION 'Sem permissão sobre este cliente.';
  END IF;

  SELECT s.work_order_id INTO v_existing
  FROM public.workspace_work_order_sources s
  WHERE s.brand_id = v_brand AND s.source_module = 'espaco360'
    AND s.source_type = p_source_type AND s.source_id = p_source_id;
  IF v_existing IS NOT NULL THEN
    RETURN QUERY SELECT v_existing, false; RETURN;
  END IF;

  INSERT INTO public.workspace_work_orders
    (brand_id, kind, title, description, requested_due_date, priority, status, created_by)
  VALUES (v_brand, 'brand_request', v_title, v_desc, v_due, 999, 'Aberta', auth.uid())
  RETURNING id INTO v_new;

  INSERT INTO public.workspace_work_order_sources
    (work_order_id, brand_id, source_module, source_type, source_id, source_url)
  VALUES (v_new, v_brand, 'espaco360', p_source_type, p_source_id, p_source_url);

  RETURN QUERY SELECT v_new, true;
END;
$$;