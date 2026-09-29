-- Uma solicitação tem uma tarefa de execução. Ao concluir a tarefa vinculada,
-- a entrega da própria solicitação passa a constar no histórico de entregas.
-- Tarefas avulsas e outras entregas da mesma execução continuam independentes.

CREATE OR REPLACE FUNCTION public.ensure_espaco360_request_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_task_brand uuid;
BEGIN
  IF NEW.task_id IS NULL THEN
    -- Usar o UUID da solicitação torna reprocessamentos seguros. Se um UUID
    -- legado já estiver ocupado, gera-se outro sem tocar na tarefa existente.
    IF EXISTS (SELECT 1 FROM public.espaco360_tasks WHERE id = NEW.id) THEN
      SELECT brand_id INTO v_task_brand FROM public.espaco360_tasks WHERE id = NEW.id;
      IF v_task_brand = NEW.brand_id THEN
        NEW.task_id := NEW.id;
      END IF;
    END IF;
    IF NEW.task_id IS NULL THEN
      INSERT INTO public.espaco360_tasks (
        id, brand_id, campaign_id, initiative_id, title, description,
        due_date, priority, owner_scope
      ) VALUES (
        CASE WHEN EXISTS (SELECT 1 FROM public.espaco360_tasks WHERE id = NEW.id)
          THEN gen_random_uuid() ELSE NEW.id END,
        NEW.brand_id, NEW.campaign_id, NEW.initiative_id, NEW.title,
        NEW.description, NEW.due_date, NEW.priority, 'agencia'
      ) RETURNING id INTO NEW.task_id;
    END IF;
  ELSE
    SELECT brand_id INTO v_task_brand FROM public.espaco360_tasks WHERE id = NEW.task_id;
    IF v_task_brand IS NULL OR v_task_brand <> NEW.brand_id THEN
      RAISE EXCEPTION 'A tarefa da solicitação deve pertencer ao mesmo cliente.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_espaco360_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'concluida' AND NEW.task_id IS NOT NULL THEN
    UPDATE public.espaco360_tasks
    SET status = 'concluida'
    WHERE id = NEW.task_id AND brand_id = NEW.brand_id AND status <> 'concluida';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_espaco360_request_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request record;
BEGIN
  IF NEW.status <> 'concluida' THEN
    RETURN NEW;
  END IF;
  FOR v_request IN
    SELECT id, brand_id, campaign_id, title, description, due_date, status
    FROM public.solicitacoes WHERE task_id = NEW.id AND brand_id = NEW.brand_id
  LOOP
    IF v_request.status NOT IN ('concluida', 'cancelada') THEN
      UPDATE public.solicitacoes SET status = 'concluida' WHERE id = v_request.id;
    END IF;
    IF v_request.status = 'cancelada' THEN
      CONTINUE;
    END IF;
    -- A entrega canônica tem o UUID da solicitação. Entregas independentes
    -- podem compartilhar título ou tarefa sem suprimir esta entrega.
    INSERT INTO public.deliveries (
      id, brand_id, campaign_id, task_id, title, description,
      due_date, delivered_at, delivery_type, status
    ) VALUES (
      v_request.id, v_request.brand_id, v_request.campaign_id, NEW.id,
      v_request.title, v_request.description, v_request.due_date,
      now(), 'solicitacao', 'entregue'
    ) ON CONFLICT (id) DO UPDATE
      SET task_id = EXCLUDED.task_id,
          status = CASE WHEN public.deliveries.status = 'publicado' THEN 'publicado' ELSE 'entregue' END,
          delivered_at = COALESCE(public.deliveries.delivered_at, EXCLUDED.delivered_at)
      WHERE public.deliveries.brand_id = EXCLUDED.brand_id;
  END LOOP;
  RETURN NEW;
END;
$$;

-- Reconcilia solicitações históricas sem duplicar tarefas já vinculadas.
-- O vínculo por título entre registros antigos é ambíguo; somente o UUID
-- idêntico da solicitação é reaproveitado automaticamente.
DO $$
DECLARE
  v_request record;
  v_task_id uuid;
BEGIN
  FOR v_request IN
    SELECT * FROM public.solicitacoes WHERE task_id IS NULL ORDER BY created_at, id
  LOOP
    v_task_id := NULL;
    SELECT id INTO v_task_id FROM public.espaco360_tasks
    WHERE id = v_request.id AND brand_id = v_request.brand_id;
    IF v_task_id IS NULL THEN
      INSERT INTO public.espaco360_tasks (
        id, brand_id, campaign_id, initiative_id, title, description,
        due_date, priority, owner_scope, status
      ) VALUES (
        CASE WHEN EXISTS (SELECT 1 FROM public.espaco360_tasks WHERE id = v_request.id)
          THEN gen_random_uuid() ELSE v_request.id END,
        v_request.brand_id, v_request.campaign_id, v_request.initiative_id,
        v_request.title, v_request.description, v_request.due_date,
        v_request.priority, 'agencia',
        CASE WHEN v_request.status = 'concluida' THEN 'concluida' ELSE 'a_fazer' END
      ) RETURNING id INTO v_task_id;
    END IF;
    UPDATE public.solicitacoes SET task_id = v_task_id WHERE id = v_request.id;
  END LOOP;
END;
$$;

-- Só associa entrega legada sem vínculo quando há exatamente uma solicitação
-- e uma entrega concluída com o mesmo título, cliente e campanha.
WITH candidates AS (
  SELECT d.id AS delivery_id, s.task_id,
    count(*) OVER (PARTITION BY d.id) AS request_matches,
    count(*) OVER (PARTITION BY s.id) AS delivery_matches
  FROM public.deliveries d
  JOIN public.solicitacoes s
    ON s.brand_id = d.brand_id
   AND s.campaign_id IS NOT DISTINCT FROM d.campaign_id
   AND lower(trim(s.title)) = lower(trim(d.title))
  WHERE d.task_id IS NULL AND d.status IN ('entregue', 'publicado')
    AND s.task_id IS NOT NULL
)
UPDATE public.deliveries d SET task_id = c.task_id
FROM candidates c
WHERE d.id = c.delivery_id AND c.request_matches = 1 AND c.delivery_matches = 1;

-- Registros históricos concluídos recebem sua entrega canônica. A chave é o
-- UUID da solicitação, então outras entregas da tarefa continuam independentes.
INSERT INTO public.deliveries (
  id, brand_id, campaign_id, task_id, title, description,
  due_date, delivered_at, delivery_type, status
)
SELECT s.id, s.brand_id, s.campaign_id, s.task_id, s.title, s.description,
  s.due_date, NULL, 'solicitacao', 'entregue'
FROM public.solicitacoes s
JOIN public.espaco360_tasks t ON t.id = s.task_id AND t.brand_id = s.brand_id
WHERE (s.status = 'concluida' OR t.status = 'concluida')
  AND s.status <> 'cancelada'
ON CONFLICT (id) DO UPDATE
  SET task_id = EXCLUDED.task_id,
      status = CASE WHEN public.deliveries.status = 'publicado' THEN 'publicado' ELSE 'entregue' END
  WHERE public.deliveries.brand_id = EXCLUDED.brand_id;

DROP TRIGGER IF EXISTS trg_espaco360_request_task ON public.solicitacoes;
CREATE TRIGGER trg_espaco360_request_task
  BEFORE INSERT OR UPDATE ON public.solicitacoes
  FOR EACH ROW EXECUTE FUNCTION public.ensure_espaco360_request_task();

DROP TRIGGER IF EXISTS trg_espaco360_request_completion ON public.solicitacoes;
CREATE TRIGGER trg_espaco360_request_completion
  AFTER INSERT OR UPDATE OF status ON public.solicitacoes
  FOR EACH ROW EXECUTE FUNCTION public.complete_espaco360_request();

DROP TRIGGER IF EXISTS trg_espaco360_task_delivery ON public.espaco360_tasks;
CREATE TRIGGER trg_espaco360_task_delivery
  AFTER INSERT OR UPDATE OF status ON public.espaco360_tasks
  FOR EACH ROW EXECUTE FUNCTION public.record_espaco360_request_delivery();
