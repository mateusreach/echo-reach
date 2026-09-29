-- ===========================================================================
-- Echo · índices de desempenho (página 25, F5)
-- As listas mais usadas filtram por cliente (brand_id) e estado (status), e
-- ordenam por data. Todos são IF NOT EXISTS: rodar de novo não faz mal.
-- ===========================================================================
CREATE INDEX IF NOT EXISTS workspace_tasks_brand_status_idx ON public.workspace_tasks (brand_id, status);
CREATE INDEX IF NOT EXISTS workspace_tasks_due_idx ON public.workspace_tasks (due_date) WHERE status <> 'Concluído';
CREATE INDEX IF NOT EXISTS workspace_work_orders_brand_status_idx ON public.workspace_work_orders (brand_id, status);
CREATE INDEX IF NOT EXISTS workspace_fronts_brand_idx ON public.workspace_fronts (brand_id);
CREATE INDEX IF NOT EXISTS conteudos_brand_status_idx ON public.conteudos (brand_id, status);
CREATE INDEX IF NOT EXISTS biblioteca_ideias_brand_status_idx ON public.biblioteca_ideias (brand_id, status);
CREATE INDEX IF NOT EXISTS solicitacoes_brand_status_idx ON public.solicitacoes (brand_id, status);
CREATE INDEX IF NOT EXISTS espaco360_campaigns_brand_status_idx ON public.espaco360_campaigns (brand_id, status);
CREATE INDEX IF NOT EXISTS espaco360_calendar_events_brand_date_idx ON public.espaco360_calendar_events (brand_id, event_date);
CREATE INDEX IF NOT EXISTS like_rounds_brand_status_idx ON public.like_rounds (brand_id, status);
CREATE INDEX IF NOT EXISTS like_items_publish_idx ON public.like_items (brand_id, publish_at);
CREATE INDEX IF NOT EXISTS like_items_due_pending_idx ON public.like_items (due_at) WHERE status IN ('aguardando','em_revisao','nova_versao');
CREATE INDEX IF NOT EXISTS like_items_task_idx ON public.like_items (task_id) WHERE task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS like_versions_item_idx ON public.like_versions (item_id, number);
CREATE INDEX IF NOT EXISTS like_decisions_brand_date_idx ON public.like_decisions (brand_id, created_at);
CREATE INDEX IF NOT EXISTS like_approvers_brand_idx ON public.like_approvers (brand_id, role);
CREATE INDEX IF NOT EXISTS like_share_links_brand_idx ON public.like_share_links (brand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_pending_email_idx ON public.notifications (created_at) WHERE email_status = 'pendente';
