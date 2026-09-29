import { createFileRoute } from "@tanstack/react-router";
import { LoadFailed } from "@/components/echo/blocks";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SpaceShell } from "@/components/reach/space-shell";
import { Badge, Button, EmptyState, ProgressRing, Skeleton } from "@/components/echo/primitives";
import { Field, Select } from "@/components/echo/controls";
import { Modal } from "@/components/echo/overlays";
import { Icon } from "@/components/echo/icon";
import { Panel } from "@/components/echo/blocks";
import { OBJECTIVE_PERIODS, OBJECTIVE_STATUSES } from "@/lib/reach-data";
import { toISO, today } from "@/lib/workspace-data";
import { likeIndicators, loadResults, saveKpi, type Kpi } from "@/lib/space-data";

export const Route = createFileRoute("/e360/$brandSlug/resultados")({
  head: () => ({ meta: [{ title: "Resultados · Espaço 360 · Echo" }] }),
  component: SpaceResults,
  validateSearch: (s: Record<string, unknown>) => ({ tab: typeof s.tab === "string" ? s.tab : undefined, filtro: typeof s.filtro === "string" ? s.filtro : undefined }),
});

const SOURCES = [{ key: "manual", label: "Manual" }, { key: "planilha", label: "Planilha" }, { key: "plataforma", label: "Plataforma de anúncios" }];
const label = (list: readonly { key: string; label: string }[], k?: string | null) => list.find((x) => x.key === k)?.label ?? k ?? "";
const pct = (v: number | null, t: number | null) => (t ? Math.min(100, Math.round(((v ?? 0) / t) * 100)) : 0);

function SpaceResults() {
  const { brandSlug } = Route.useParams();
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const [month, setMonth] = useState(toISO(today()).slice(0, 7));
  const [edit, setEdit] = useState<(Omit<Kpi, "id"> & { id?: string }) | null>(null);
  useEffect(() => setReady(true), []);
  const q = useQuery({ queryKey: ["space-results", brandSlug], queryFn: () => loadResults(brandSlug), enabled: ready });
  const d = q.data;
  const shell = (c: React.ReactNode) => <SpaceShell demoData brandSlug={brandSlug} brandName={d?.space.brand.name ?? ""} primaryColor={d?.space.brand.primary} accentColor={d?.space.brand.accent}>{c}</SpaceShell>;
  if (!ready || q.isLoading) return shell(<div className="stack-lg"><Skeleton h={160} r={24} /><Skeleton h={260} r={24} /></div>);
  if (q.isError) return shell(<LoadFailed what="os resultados" onRetry={() => q.refetch()} />);
  if (!d) return shell(<div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState icon="lock" title="Espaço 360 indisponível" /></div>);
  const objectives = d.objectives as { id: string; title: string; period_type: string; status: string; target_value: number | null; current_value: number | null; unit: string | null; period_label: string | null }[];
  const withTarget = objectives.filter((o) => o.target_value);
  const combined = withTarget.length ? Math.round(withTarget.reduce((a, o) => a + pct(o.current_value, o.target_value), 0) / withTarget.length) : 0;
  const ind = likeIndicators(d.decisions, month);
  const months = [...new Set([toISO(today()).slice(0, 7), ...d.decisions.map((x) => x.decidedAt.slice(0, 7))])].sort().reverse();
  const monthLabel = (m: string) => { const x = new Date(`${m}-01T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); return x[0].toUpperCase() + x.slice(1); };
  const canEdit = d.space.canEdit && d.space.isTeam;

  return shell(
    <div className="stack-lg">
      <section className="space-hero e-glass">
        <ProgressRing value={combined} size={84} label="Objetivos" />
        <div className="e-grow"><b>Progresso combinado dos objetivos</b><p className="e-small" style={{ margin: "4px 0 0" }}>Média do avanço dos objetivos com meta · {objectives.filter((o) => o.status === "atingido").length} de {objectives.length} atingidos</p></div>
      </section>
      <div className="grid-2" style={{ alignItems: "start" }}>
        <Panel title="Objetivos" icon="target" count={objectives.length} tone="var(--env-360)">
          {OBJECTIVE_PERIODS.map((p) => {
            const list = objectives.filter((o) => o.period_type === p.key);
            if (!list.length) return null;
            return (
              <div key={p.key} className="stack" style={{ gap: 6 }}>
                <span className="e-label">{p.plural}</span>
                {list.map((o) => (
                  <div key={o.id} className="kpi-row">
                    <span className="e-grow" style={{ minWidth: 0 }}><b className="e-ellipsis" style={{ display: "block" }}>{o.title}</b><span className="e-caption tnum">{o.target_value ? `${(o.current_value ?? 0).toLocaleString("pt-BR")} de ${o.target_value.toLocaleString("pt-BR")} ${o.unit ?? ""}` : "Sem meta numérica"}{o.period_label ? ` · ${o.period_label}` : ""}</span></span>
                    <span className="kpi-bar"><i style={{ width: `${pct(o.current_value, o.target_value)}%` }} /></span>
                    <Badge tone={o.status === "atingido" ? "done" : o.status === "nao_atingido" ? "late" : "doing"}>{label(OBJECTIVE_STATUSES, o.status)}</Badge>
                  </div>
                ))}
              </div>
            );
          })}
          {objectives.length === 0 && <EmptyState compact icon="target" title="Nenhum objetivo no plano" />}
        </Panel>
        <Panel title="Indicadores do Like" icon="heart" tone="var(--env-like)" action={<div style={{ width: 170 }}><Select value={month} onChange={setMonth} options={months.map((m) => ({ value: m, label: monthLabel(m) }))} /></div>}>
          <div className="like-kpis">
            <div><b className="tnum">{ind.approved}</b><span>materiais aprovados</span></div>
            <div><b className="tnum">{ind.avgHours === null ? "—" : ind.avgHours < 24 ? `${ind.avgHours}h` : `${Math.round(ind.avgHours / 24 * 10) / 10}d`}</b><span>tempo médio de decisão</span></div>
            <div><b className="tnum">{ind.adjustmentsPerMaterial.toLocaleString("pt-BR")}</b><span>ajustes por material</span></div>
          </div>
          {ind.byFront.length > 0 && <div className="stack" style={{ gap: 6 }}>
            <span className="e-label">Aprovados por frente</span>
            {ind.byFront.map(([f, n]) => <div key={f} className="week-row" style={{ gridTemplateColumns: "minmax(80px,120px) 1fr 28px" }}><span>{f}</span><span className="week-bar"><i style={{ width: `${(n / Math.max(...ind.byFront.map((x) => x[1]))) * 100}%`, background: "var(--env-like)" }} /></span><b className="tnum">{n}</b></div>)}
          </div>}
          {ind.decisions === 0 && <EmptyState compact icon="heart" title="Nenhuma decisão neste mês" />}
          <details className="like-history">
            <summary className="e-link">Ver o histórico de decisões ({ind.decisions})</summary>
            {d.decisions.filter((x) => x.decidedAt.slice(0, 7) === month).map((x) => <div key={x.id} className="ops-row" style={{ cursor: "default" }}><span className="e-grow e-ellipsis">{x.material} · {x.front}{x.round > 1 ? ` · rodada ${x.round}` : ""}</span><Badge tone={x.decision === "aprovado" ? "approved" : "adjust"}>{x.decision === "aprovado" ? "Aprovado" : "Ajustes"}</Badge><span className="e-caption tnum">{new Date(x.decidedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span></div>)}
          </details>
        </Panel>
      </div>
      <Panel title="Indicadores" icon="chart" count={d.kpis.length} tone="var(--env-workspace)" action={canEdit ? <Button size="sm" icon="plus" onClick={() => setEdit({ name: "", source: "manual", target: null, value: 0, unit: "", period: "", campaign_id: null })}>Novo indicador</Button> : undefined}>
        {d.kpis.length === 0 ? <EmptyState compact icon="chart" title="Nenhum indicador" /> : (
          <div className="obj-grid">
            {d.kpis.map((k) => (
              <button key={k.id} type="button" className="obj-card e-glass" disabled={!canEdit} onClick={() => setEdit({ ...k })}>
                <div className="e-row between" style={{ gap: 8 }}><span className="e-caption">{k.period ?? ""}{k.campaign_id ? ` · ${d.space.campaigns.find((c) => c.id === k.campaign_id)?.title ?? "campanha"}` : " · geral"}</span><Badge tone="glass">{label(SOURCES, k.source)}</Badge></div>
                <b>{k.name}</b>
                <span className="kpi-value tnum">{k.value.toLocaleString("pt-BR")}<small> {k.unit}</small></span>
                {k.target != null && <><div className="e-bar sm"><i style={{ ["--v" as string]: `${pct(k.value, k.target)}%` }} /></div><span className="e-caption tnum">meta {k.target.toLocaleString("pt-BR")} {k.unit} · {pct(k.value, k.target)}%</span></>}
              </button>
            ))}
          </div>
        )}
      </Panel>
      <Modal open={!!edit} onClose={() => setEdit(null)} icon="chart" title={edit?.id ? "Editar indicador" : "Novo indicador"}
        footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancelar</Button><Button disabled={!edit?.name.trim()} onClick={async () => { if (!edit) return; const { id, ...rest } = edit; await saveKpi(brandSlug, d.space.brand.id, id ?? null, { ...rest, name: rest.name.trim(), unit: rest.unit || null, period: rest.period || null }); toast.success("Indicador salvo"); setEdit(null); qc.invalidateQueries({ queryKey: ["space-results", brandSlug] }); }}>Salvar</Button></>}>
        {edit && <div className="e-stack" style={{ gap: 10 }}>
          <Field label="Indicador" autoFocus value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
          <div className="grid-2" style={{ gap: 10 }}>
            <Select label="Fonte" value={edit.source} onChange={(v) => setEdit({ ...edit, source: v })} options={SOURCES.map((s) => ({ value: s.key, label: s.label }))} />
            <Select label="Campanha" value={edit.campaign_id ?? ""} placeholder="Geral" onChange={(v) => setEdit({ ...edit, campaign_id: v || null })} options={[{ value: "", label: "Geral" }, ...d.space.campaigns.map((c) => ({ value: c.id, label: c.title }))]} />
            <Field label="Valor" type="number" value={edit.value} onChange={(e) => setEdit({ ...edit, value: Number(e.target.value) || 0 })} />
            <Field label="Meta" type="number" optional value={edit.target ?? ""} onChange={(e) => setEdit({ ...edit, target: e.target.value === "" ? null : Number(e.target.value) })} />
            <Field label="Unidade" optional value={edit.unit ?? ""} onChange={(e) => setEdit({ ...edit, unit: e.target.value })} />
            <Field label="Período" optional value={edit.period ?? ""} placeholder="Ex.: Setembro" onChange={(e) => setEdit({ ...edit, period: e.target.value })} />
          </div>
        </div>}
      </Modal>
    </div>,
  );
}
