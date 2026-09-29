import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LoadFailed } from "@/components/echo/blocks";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { EchoLayout } from "@/components/echo/layout";
import { Chip, Field, Select } from "@/components/echo/controls";
import { EmptyState, Skeleton } from "@/components/echo/primitives";
import { Icon } from "@/components/echo/icon";
import { useAccess } from "@/components/echo/session";
import { isViewingAsClient } from "@/lib/view-as";
import { KIND_META, highlight, searchAll, trackRecent, type Hit, type HitKind } from "@/lib/search-data";

export const Route = createFileRoute("/pesquisa")({
  head: () => ({ meta: [{ title: "Pesquisa · Echo" }] }),
  validateSearch: (s: Record<string, unknown>): { q?: string } => (typeof s.q === "string" && s.q ? { q: s.q } : {}),
  component: SearchPage,
});

const ENV_LABEL: Record<string, string> = { brand: "Brand", workspace: "Workspace", like: "Like", e360: "Espaço 360", agencia: "Agência" };
const ENV_COLOR: Record<string, string> = { brand: "var(--env-brand)", workspace: "var(--env-workspace)", like: "var(--env-like)", e360: "var(--env-360)", agencia: "var(--ink-3)" };
const PERIODS = [{ value: "", label: "Qualquer data" }, { value: "7", label: "Últimos 7 dias" }, { value: "30", label: "Últimos 30 dias" }, { value: "90", label: "Últimos 3 meses" }];

function Mark({ text, q }: { text: string; q: string }) {
  return <>{highlight(text, q).map((p, i) => (p.on ? <mark key={i}>{p.t}</mark> : <span key={i}>{p.t}</span>))}</>;
}

function SearchPage() {
  const { q: initial } = Route.useSearch();
  const navigate = useNavigate();
  const { isTeam } = useAccess();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const client = ready && (!isTeam || isViewingAsClient());
  const [q, setQ] = useState(initial ?? "");
  const [term, setTerm] = useState(initial ?? "");
  useEffect(() => { const t = setTimeout(() => { setTerm(q.trim()); navigate({ to: "/pesquisa", search: q.trim() ? { q: q.trim() } : {}, replace: true }); }, 200); return () => clearTimeout(t); }, [q]);
  const res = useQuery({ queryKey: ["search", term, client], queryFn: () => searchAll(term, { client, limit: 100 }), enabled: ready && term.length >= 2 });
  const [f, setF] = useState({ env: "", brand: "", kind: "", period: "" });

  const hits = res.data ?? [];
  const brands = useMemo(() => [...new Set(hits.map((h) => h.brandSlug).filter(Boolean))] as string[], [hits]);
  const since = f.period ? new Date(Date.now() - Number(f.period) * 86400e3).toISOString() : "";
  const shown = hits.filter((h) => (!f.env || KIND_META[h.kind].env === f.env) && (!f.brand || h.brandSlug === f.brand) && (!f.kind || h.kind === f.kind) && (!since || (h.at ?? "") >= since));
  const kinds = [...new Set(hits.map((h) => h.kind))] as HitKind[];
  const envs = [...new Set(hits.map((h) => KIND_META[h.kind].env))];
  const brandName = (slug: string) => hits.find((h) => h.brandSlug === slug && h.kind === "cliente")?.title ?? slug.replace(/-/g, " ");
  const open = (h: Hit) => trackRecent({ kind: h.kind, id: h.id, title: h.title, sub: h.sub, href: h.href });

  return (
    <EchoLayout eyebrow="Echo" title="Pesquisa" demoData>
      <div className="stack-lg">
        <div className="sr-bar e-glass">
          <Field icon="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="O que você procura?" aria-label="Pesquisar" autoFocus />
          <div className="sr-filters">
            <Select value={f.env} onChange={(v) => setF({ ...f, env: v })} options={[{ value: "", label: "Todos os ambientes" }, ...envs.map((e) => ({ value: e, label: ENV_LABEL[e] }))]} />
            <Select value={f.brand} onChange={(v) => setF({ ...f, brand: v })} options={[{ value: "", label: "Todos os clientes" }, ...brands.map((b) => ({ value: b, label: brandName(b) }))]} />
            <Select value={f.period} onChange={(v) => setF({ ...f, period: v })} options={PERIODS} />
          </div>
          {kinds.length > 1 && <div className="e-row wrap" style={{ gap: 6 }}>
            <Chip pressed={!f.kind} onClick={() => setF({ ...f, kind: "" })} count={hits.length}>Tudo</Chip>
            {kinds.map((k) => <Chip key={k} icon={KIND_META[k].icon} pressed={f.kind === k} onClick={() => setF({ ...f, kind: f.kind === k ? "" : k })} count={hits.filter((h) => h.kind === k).length}>{KIND_META[k].plural}</Chip>)}
          </div>}
        </div>

        {term.length < 2 ? <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState kind="search" title="Pesquise em todo o Echo" text="Clientes, tarefas, entregas, ideias, conteúdos, campanhas, solicitações, materiais do Like, pessoas e seções do plano." /></div>
          : res.isError ? <LoadFailed what="a pesquisa" onRetry={() => res.refetch()} />
          : res.isLoading ? <Skeleton h={300} r={24} />
          : shown.length === 0 ? <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState kind="search" title={`Nada encontrado para “${term}”`} text={hits.length ? "Tente tirar algum filtro." : "Confira a grafia ou use outra palavra."} /></div>
          : (
            <section className="settings-section e-glass">
              <p className="e-caption" style={{ margin: 0 }}>{shown.length} {shown.length === 1 ? "resultado" : "resultados"}{client ? " · só o que você pode ver" : ""}</p>
              <ul className="sr-list">
                {shown.map((h, i) => (
                  <li key={`${h.kind}-${h.brandSlug ?? ""}-${h.id}-${i}`}>
                    <Link to={h.href as never} className="sr-hit" onClick={() => open(h)}>
                      <span className="sr-ic" style={{ ["--c" as string]: ENV_COLOR[KIND_META[h.kind].env] }}><Icon name={KIND_META[h.kind].icon} size="sm" /></span>
                      <span className="sr-txt"><b><Mark text={h.title} q={term} /></b>{h.sub && <small><Mark text={h.sub} q={term} /></small>}</span>
                      <span className="sr-meta"><span className="sr-env"><i style={{ background: ENV_COLOR[KIND_META[h.kind].env] }} />{ENV_LABEL[KIND_META[h.kind].env]}</span><small>{KIND_META[h.kind].label}</small></span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
      </div>
    </EchoLayout>
  );
}
