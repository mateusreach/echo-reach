-- Ordem de execução do Workspace concluída → origem do Espaço 360 concluída.
--
-- Complementa 20260918183000_espaco360_request_task_delivery.sql: quando todas as
-- tarefas de uma ordem de execução (workspace_work_orders) chegam a "Concluído",
-- a ordem passa a "Concluída" e a tarefa do Espaço 360 que a originou (direta ou
-- via solicitação) também é concluída. Os gatilhos da migração anterior então
-- registram a entrega da solicitação — sempre a mesma, sem duplicar.
-- Reabrir uma etapa no Workspace reabre a ordem e a tarefa do 360.
--
-- Também marca a solicitação como "em execução" quando ela é enviada ao Workspace.

CREATE OR REPLACE FUNCTION public.sync_work_order_completion(p_work_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total integer;
  v_done integer;
  v_status text;
BEGIN
  IF p_work_order_id IS NULL THEN RETURN; END IF;
  SELECT status INTO v_status FROM public.workspace_work_orders WHERE id = p_work_order_id;
  IF v_status IS NULL THEN RETURN; END IF;

  SELECT count(*), count(*) FILTER (WHERE status = 'Concluído')
    INTO v_total, v_done
  FROM public.workspace_tasks WHERE work_order_id = p_work_order_id;

  IF v_total > 0 AND v_total = v_done THEN
    UPDATE public.workspace_work_orders SET status = 'Concluída'
     WHERE id = p_work_order_id AND status <> 'Concluída';

    UPDATE public.espaco360_tasks t SET status = 'concluida'
    FROM public.workspace_work_order_sources src
    WHERE src.work_order_id = p_work_order_id
      AND src.source_module = 'espaco360'
      AND t.status <> 'concluida'
      AND t.id = CASE src.source_type
                   WHEN 'tarefa' THEN src.source_id
                   WHEN 'solicitacao' THEN (SELECT task_id FROM public.solicitacoes WHERE id = src.source_id)
                 END;
  ELSIF v_status = 'Concluída' THEN
    UPDATE public.workspace_work_orders SET status = 'Aberta' WHERE id = p_work_order_id;

    UPDATE public.espaco360_tasks t SET status = 'em_andamento'
    FROM public.workspace_work_order_sources src
    WHERE src.work_order_id = p_work_order_id
      AND src.source_module = 'espaco360'
      AND t.status = 'concluida'
      AND t.id = CASE src.source_type
                   WHEN 'tarefa' THEN src.source_id
                   WHEN 'solicitacao' THEN (SELECT task_id FROM public.solicitacoes WHERE id = src.source_id)
                 END;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_workspace_task_order_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.sync_work_order_completion(OLD.work_order_id);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.work_order_id IS DISTINCT FROM NEW.work_order_id THEN
    PERFORM public.sync_work_order_completion(OLD.work_order_id);
  END IF;
  PERFORM public.sync_work_order_completion(NEW.work_order_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_workspace_task_order_sync ON public.workspace_tasks;
CREATE TRIGGER trg_workspace_task_order_sync
  AFTER INSERT OR DELETE OR UPDATE OF status, work_order_id ON public.workspace_tasks
  FOR EACH ROW EXECUTE FUNCTION public.trg_workspace_task_order_sync();

REVOKE EXECUTE ON FUNCTION public.sync_work_order_completion(uuid) FROM PUBLIC, anon, authenticated;

-- Envio ao Workspace: a solicitação passa a "em execução".
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

  IF p_source_type = 'solicitacao' THEN
    UPDATE public.solicitacoes SET status = 'em_execucao'
     WHERE id = p_source_id AND status IN ('nova', 'em_analise', 'aprovada');
  END IF;

  RETURN QUERY SELECT v_new, true;
END;
$$;

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

  IF p_source_module = 'espaco360' AND p_source_type = 'solicitacao' THEN
    UPDATE public.solicitacoes SET status = 'em_execucao'
     WHERE id = p_source_id AND status IN ('nova', 'em_analise', 'aprovada');
  END IF;

  RETURN QUERY SELECT v_new, true;
END;
$$;
