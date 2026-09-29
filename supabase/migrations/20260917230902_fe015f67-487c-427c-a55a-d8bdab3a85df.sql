REVOKE EXECUTE ON FUNCTION public.ensure_front_work_order(uuid, date, date, text, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.dispatch_brand_item_to_work_order(uuid, text, text, uuid, text, text, text, text, date, date, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.submit_client_request_to_workspace(text, uuid, text) FROM anon;