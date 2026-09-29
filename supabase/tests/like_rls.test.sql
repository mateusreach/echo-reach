-- ===========================================================================
-- Echo · testes de RLS e regras do Like (página 25, F1)
-- Rodar no ambiente conectado:  supabase test db
-- Precisa de pgTAP (extensão padrão do Supabase). Tudo roda numa transação e
-- volta ao estado anterior no final (ROLLBACK).
-- ===========================================================================
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;

SELECT plan(14);

-- A2: nenhuma tabela pública sem RLS --------------------------------------------------
SELECT is(
  (SELECT count(*)::int FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity),
  0, 'Todas as tabelas do schema public têm RLS ligada');

-- Funções SECURITY DEFINER fixam o search_path -----------------------------------------
SELECT is(
  (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.prosecdef AND NOT coalesce(array_to_string(p.proconfig, ',') LIKE '%search_path%', false)),
  0, 'Toda função SECURITY DEFINER define search_path');

-- Código do link só para o servidor ----------------------------------------------------
SELECT ok(NOT has_function_privilege('anon', 'public.like_link_request_code(text, text)', 'EXECUTE'), 'anon não gera código de verificação');
SELECT ok(NOT has_function_privilege('authenticated', 'public.like_link_request_code(text, text)', 'EXECUTE'), 'usuário logado não gera código de verificação');
SELECT ok(has_function_privilege('anon', 'public.like_link_open(text)', 'EXECUTE'), 'convidado (anon) consegue abrir link');
SELECT ok(NOT has_function_privilege('anon', 'public.like_send_reminders()', 'EXECUTE'), 'anon não dispara lembretes');

-- Tabelas internas sem acesso direto do anon ------------------------------------------
SELECT ok(NOT has_table_privilege('anon', 'public.like_link_codes', 'SELECT') OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'like_link_codes'),
  'like_link_codes não tem política: só funções acessam');

-- Links: inválido, expirado e revogado (A2 da página 23) -------------------------------
SELECT is(public.like_link_open(repeat('0', 64)) ->> 'status', 'invalido', 'Token desconhecido é recusado');

DO $$
DECLARE b uuid; r uuid;
BEGIN
  SELECT id INTO b FROM brands ORDER BY created_at LIMIT 1;
  INSERT INTO like_rounds (id, brand_id, title) VALUES (gen_random_uuid(), b, 'Teste RLS') RETURNING id INTO r;
  INSERT INTO like_share_links (brand_id, round_id, token_hash, can_comment, can_decide, expires_at)
    VALUES (b, r, public.like_token_hash('teste-expirado'), true, true, now() - interval '1 day');
  INSERT INTO like_share_links (brand_id, round_id, token_hash, can_comment, can_decide, expires_at, revoked_at)
    VALUES (b, r, public.like_token_hash('teste-revogado'), true, true, now() + interval '7 days', now());
  INSERT INTO like_share_links (brand_id, round_id, token_hash, can_comment, can_decide, expires_at)
    VALUES (b, r, public.like_token_hash('teste-ok'), false, false, now() + interval '7 days');
END $$;

SELECT is(public.like_link_open('teste-expirado') ->> 'status', 'expirado', 'Link expirado mostra só o motivo');
SELECT is(public.like_link_open('teste-revogado') ->> 'status', 'revogado', 'Link revogado mostra só o motivo');
SELECT ok(public.like_link_open('teste-revogado') -> 'items' IS NULL, 'Link revogado não devolve materiais');
SELECT throws_ok($$ SELECT public.like_guest_decide('teste-revogado', 'Ana Teste', 'ana@teste.com', NULL, gen_random_uuid(), 'approved') $$,
  NULL, 'Decidir por link revogado falha');
SELECT throws_ok($$ SELECT public.like_guest_decide('teste-ok', 'Ana Teste', 'ana@teste.com', NULL, gen_random_uuid(), 'approved') $$,
  'Este link não permite decidir.', 'Link só de visualização não decide');
SELECT throws_ok($$ SELECT public.like_guest_comment('teste-ok', 'Ana Teste', 'ana@teste.com', NULL, gen_random_uuid(), 'oi') $$,
  'Este link não permite comentar.', 'Link só de visualização não comenta');

SELECT * FROM finish();
ROLLBACK;

-- ---------------------------------------------------------------------------
-- Próximos testes (precisam de usuários de teste; usar supabase_test_helpers):
--  • cliente aprovador não vê rascunho nem comentário interno;
--  • equipe recebe "A decisão é do cliente, no Like." ao chamar like_decide;
--  • revisor e observador recebem "Você não está entre os aprovadores";
--  • ajuste sem motivo falha com require_comment_on_adjust;
--  • aprovar de novo a mesma versão não duplica evento na agenda;
--  • like_undo só para quem decidiu, até 5 minutos.
-- Esses fluxos já estão cobertos no demo por /like/diagnostico (15 passos).
-- ---------------------------------------------------------------------------
