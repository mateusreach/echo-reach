-- Ponte interna Reach Brand → Reach Workspace (versão original).
--
-- SUBSTITUÍDA por 20260917221429_*.sql, que já criou public.workspace_task_sources
-- e a função public.dispatch_brand_item_to_workspace(...) com SECURITY DEFINER e
-- validação de permissão. Executar a versão original agora falharia (as políticas
-- já existem) e, pior, recolocaria a função como SECURITY INVOKER.
--
-- Este arquivo foi mantido apenas para preservar a ordem histórica e não altera
-- mais nada no banco.
SELECT 1;
