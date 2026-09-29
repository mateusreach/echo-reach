-- ===========================================================================
-- Echo · busca global (página 24)
-- Índices de texto em português e echo_search(), que roda como SECURITY INVOKER:
-- a RLS de cada tabela vale, então o cliente só encontra o que pode ver (A2).
-- Tarefas internas e comentários internos nunca entram para o cliente.
-- ===========================================================================

CREATE INDEX IF NOT EXISTS brands_fts ON public.brands USING gin (to_tsvector('portuguese', coalesce(name, '') || ' ' || coalesce(segment, '')));
CREATE INDEX IF NOT EXISTS workspace_tasks_fts ON public.workspace_tasks USING gin (to_tsvector('portuguese', coalesce(title, '') || ' ' || coalesce(note, '')));
CREATE INDEX IF NOT EXISTS workspace_work_orders_fts ON public.workspace_work_orders USING gin (to_tsvector('portuguese', coalesce(title, '') || ' ' || coalesce(description, '')));
CREATE INDEX IF NOT EXISTS workspace_fronts_fts ON public.workspace_fronts USING gin (to_tsvector('portuguese', coalesce(name, '')));
CREATE INDEX IF NOT EXISTS biblioteca_ideias_fts ON public.biblioteca_ideias USING gin (to_tsvector('portuguese', coalesce(title, '') || ' ' || coalesce(description, '')));
CREATE INDEX IF NOT EXISTS conteudos_fts ON public.conteudos USING gin (to_tsvector('portuguese', coalesce(title, '') || ' ' || coalesce(legenda, '')));
CREATE INDEX IF NOT EXISTS espaco360_campaigns_fts ON public.espaco360_campaigns USING gin (to_tsvector('portuguese', coalesce(title, '') || ' ' || coalesce(description, '')));
CREATE INDEX IF NOT EXISTS solicitacoes_fts ON public.solicitacoes USING gin (to_tsvector('portuguese', coalesce(title, '') || ' ' || coalesce(description, '')));
CREATE INDEX IF NOT EXISTS like_items_fts ON public.like_items USING gin (to_tsvector('portuguese', coalesce(title, '')));
CREATE INDEX IF NOT EXISTS brand_home_sections_fts ON public.brand_home_sections USING gin (to_tsvector('portuguese', coalesce(title, '')));
CREATE INDEX IF NOT EXISTS profiles_fts ON public.profiles USING gin (to_tsvector('simple', coalesce(display_name, '') || ' ' || coalesce(job_title, '')));

CREATE OR REPLACE FUNCTION public.echo_search(p_q text, p_limit int DEFAULT 40)
RETURNS TABLE (kind text, id uuid, title text, sub text, brand_slug text, href text, at timestamptz, rank real)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH q AS (SELECT websearch_to_tsquery('portuguese', p_q) AS pt, websearch_to_tsquery('simple', p_q) AS sq,
                    coalesce(public.is_agency_org((SELECT organization_id FROM public.profiles WHERE id = auth.uid())), false) AS team)
  SELECT * FROM (
    SELECT 'cliente', b.id, b.name, b.segment, b.slug, CASE WHEN q.team THEN '/clientes/' || b.slug ELSE '/e360/' || b.slug END, b.updated_at,
           ts_rank(to_tsvector('portuguese', coalesce(b.name, '') || ' ' || coalesce(b.segment, '')), q.pt) + CASE WHEN b.name ILIKE p_q || '%' THEN 1 ELSE 0 END
    FROM brands b, q WHERE to_tsvector('portuguese', coalesce(b.name, '') || ' ' || coalesce(b.segment, '')) @@ q.pt OR b.name ILIKE '%' || p_q || '%'
    UNION ALL
    -- Tarefas: só a equipe (são internas)
    SELECT 'tarefa', t.id, t.title, coalesce(b.name, '') || coalesce(' · ' || t.status, ''), b.slug, '/workspace/cliente/' || b.slug, t.updated_at,
           ts_rank(to_tsvector('portuguese', coalesce(t.title, '') || ' ' || coalesce(t.note, '')), q.pt)
    FROM workspace_tasks t JOIN brands b ON b.id = t.brand_id, q WHERE q.team AND to_tsvector('portuguese', coalesce(t.title, '') || ' ' || coalesce(t.note, '')) @@ q.pt
    UNION ALL
    SELECT 'entrega', o.id, o.title, b.name, b.slug, '/workspace/cliente/' || b.slug, o.updated_at, ts_rank(to_tsvector('portuguese', coalesce(o.title, '') || ' ' || coalesce(o.description, '')), q.pt)
    FROM workspace_work_orders o JOIN brands b ON b.id = o.brand_id, q WHERE q.team AND to_tsvector('portuguese', coalesce(o.title, '') || ' ' || coalesce(o.description, '')) @@ q.pt
    UNION ALL
    SELECT 'frente', f.id, f.name, b.name, b.slug, '/workspace/controle', f.updated_at, ts_rank(to_tsvector('portuguese', coalesce(f.name, '')), q.pt)
    FROM workspace_fronts f JOIN brands b ON b.id = f.brand_id, q WHERE q.team AND to_tsvector('portuguese', coalesce(f.name, '')) @@ q.pt
    UNION ALL
    SELECT 'ideia', i.id, i.title, b.name, b.slug, '/b/' || b.slug || '/biblioteca', i.updated_at, ts_rank(to_tsvector('portuguese', coalesce(i.title, '') || ' ' || coalesce(i.description, '')), q.pt)
    FROM biblioteca_ideias i JOIN brands b ON b.id = i.brand_id, q WHERE to_tsvector('portuguese', coalesce(i.title, '') || ' ' || coalesce(i.description, '')) @@ q.pt
    UNION ALL
    SELECT 'conteudo', c.id, c.title, b.name || coalesce(' · ' || c.formato, ''), b.slug, '/b/' || b.slug || '/biblioteca', c.updated_at, ts_rank(to_tsvector('portuguese', coalesce(c.title, '') || ' ' || coalesce(c.legenda, '')), q.pt)
    FROM conteudos c JOIN brands b ON b.id = c.brand_id, q WHERE to_tsvector('portuguese', coalesce(c.title, '') || ' ' || coalesce(c.legenda, '')) @@ q.pt
    UNION ALL
    SELECT 'campanha', c.id, c.title, b.name, b.slug, '/e360/' || b.slug || '/campanha/' || c.id, c.updated_at, ts_rank(to_tsvector('portuguese', coalesce(c.title, '') || ' ' || coalesce(c.description, '')), q.pt)
    FROM espaco360_campaigns c JOIN brands b ON b.id = c.brand_id, q WHERE to_tsvector('portuguese', coalesce(c.title, '') || ' ' || coalesce(c.description, '')) @@ q.pt
    UNION ALL
    SELECT 'solicitacao', s.id, s.title, b.name || coalesce(' · ' || s.status, ''), b.slug, '/e360/' || b.slug, s.updated_at, ts_rank(to_tsvector('portuguese', coalesce(s.title, '') || ' ' || coalesce(s.description, '')), q.pt)
    FROM solicitacoes s JOIN brands b ON b.id = s.brand_id, q WHERE to_tsvector('portuguese', coalesce(s.title, '') || ' ' || coalesce(s.description, '')) @@ q.pt
    UNION ALL
    -- Materiais do Like: a RLS já esconde rascunhos do cliente; reforçamos aqui.
    SELECT 'material', l.id, l.title, b.name || ' · ' || l.status, b.slug, '/like/' || b.slug || '/m/' || l.id, l.updated_at,
           ts_rank(to_tsvector('portuguese', coalesce(l.title, '')), q.pt) + CASE WHEN l.title ILIKE '%' || p_q || '%' THEN .5 ELSE 0 END
    FROM like_items l JOIN brands b ON b.id = l.brand_id, q WHERE (q.team OR l.status <> 'rascunho') AND (to_tsvector('portuguese', coalesce(l.title, '')) @@ q.pt OR l.title ILIKE '%' || p_q || '%')
    UNION ALL
    SELECT 'secao', h.id, h.title, b.name || ' · Plano', b.slug, '/b/' || b.slug || '/plano', h.updated_at, ts_rank(to_tsvector('portuguese', coalesce(h.title, '')), q.pt)
    FROM brand_home_sections h JOIN brands b ON b.id = h.brand_id, q WHERE to_tsvector('portuguese', coalesce(h.title, '')) @@ q.pt
    UNION ALL
    SELECT 'pessoa', p.id, coalesce(p.display_name, p.email), p.job_title, NULL, '/agencia/equipe', NULL::timestamptz, ts_rank(to_tsvector('simple', coalesce(p.display_name, '') || ' ' || coalesce(p.job_title, '')), q.sq)
    FROM profiles p, q WHERE q.team AND coalesce(p.active, true) AND (to_tsvector('simple', coalesce(p.display_name, '') || ' ' || coalesce(p.job_title, '')) @@ q.sq OR p.display_name ILIKE '%' || p_q || '%')
  ) r (kind, id, title, sub, brand_slug, href, at, rank)
  ORDER BY rank DESC, at DESC NULLS LAST
  LIMIT greatest(1, least(p_limit, 100));
$$;
GRANT EXECUTE ON FUNCTION public.echo_search(text, int) TO authenticated;
