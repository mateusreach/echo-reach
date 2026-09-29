import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge, Button, ClientLogo, EmptyState, Skeleton } from "@/components/echo/primitives";
import { Menu, Select } from "@/components/echo/controls";
import { Icon } from "@/components/echo/icon";
import { addDays, localDate, RECURRENCES, RISK_LABELS, toISO, today, type FrontWithRisk, type RiskLevel } from "@/lib/workspace-data";
import { demoApprove, ensureCycle, listOpsFronts, subscribeFronts } from "@/lib/ops-data";
import { isDemoMode } from "@/lib/home-data";

export const Route = createFileRoute("/workspace/controle")({
  head: () => ({ meta: [{ title: "Controle · Workspace · Echo" }, { name: "description", content: "Nenhum cliente sem post: cobertura mensal por frente." }] }),
  component: CoverageControl,
});

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const LEVELS: RiskLevel[] = ["red", "orange", "yellow", "green"];
const RISK_TONE: Record<RiskLevel, "late" | "adjust" | "review" | "done"> = { red: "late", orange: "adjust", yellow: "review", green: "done" };
const RISK_COLOR: Record<RiskLevel, string> = { red: "var(--danger)", orange: "var(--warn)", yellow: "var(--review)", green: "var(--ok)" };
const ddmm = (d?: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "—");
const recLabel = (k: string) => (RECURRENCES as Record<string, string>)[k] ?? k;
const prefersReduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function CoverageControl() {
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const now = today();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [dir, setDir] = useState<1 | -1 | 0>(0);
  const [f, setF] = useState({ brand: "", front: "", rec: "", level: "" as RiskLevel | "" });
  const [flash, setFlash] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  useEffect(() => setReady(true), []);
  const q = useQuery({ queryKey: ["ops-fronts"], queryFn: listOpsFronts, enabled: ready });

  // Tempo real: uma aprovação no Like que avança a cobertura faz a linha piscar.
  useEffect(() => subscribeFronts((id) => { qc.invalidateQueries({ queryKey: ["ops-fronts"] }); pulse(id); }), []);
  const pulse = (id: string) => { setFlash((x) => [...x, id]); window.setTimeout(() => setFlash((x) => x.filter((y) => y !== id)), 1800); };

  const all = q.data ?? [];
  const brands = useMemo(() => [...new Map(all.map((x) => [x.brand.id, x.brand])).values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")), [all]);
  const frontNames = useMemo(() => [...new Set(all.map((x) => x.front.name))].sort(), [all]);
  const visible = all.filter((x) => (!f.brand || x.brand.id === f.brand) && (!f.front || x.front.name === f.front) && (!f.rec || x.front.recurrence === f.rec) && (!f.level || x.level === f.level));
  const count = (l: RiskLevel) => all.filter((x) => x.level === l).length;

  const days = new Date(ym.y, ym.m + 1, 0).getDate();
  const first = new Date(ym.y, ym.m, 1);
  const isNow = ym.y === now.getFullYear() && ym.m === now.getMonth();
  const shift = (by: 1 | -1) => { setDir(by); const d = new Date(ym.y, ym.m + by, 1); setYm({ y: d.getFullYear(), m: d.getMonth() }); };
  /** Posição (0..days) de uma data dentro do mês exibido, recortada nas bordas. */
  const pos = (isoDate: string | null | undefined, end = true) => {
    if (!isoDate) return null;
    const d = localDate(isoDate);
    if (d < first) return 0;
    if (d.getFullYear() > ym.y || (d.getFullYear() === ym.y && d.getMonth() > ym.m)) return days;
    return end ? d.getDate() : d.getDate() - 1;
  };
  useEffect(() => {
    if (!gridRef.current || prefersReduced() || !dir) return;
    gridRef.current.animate([{ transform: `translateX(${dir * 24}px)`, opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 320, easing: "cubic-bezier(.23,1,.32,1)" });
  }, [ym.y, ym.m]);

  const createCycle = async (x: FrontWithRisk) => {
    setBusy(x.front.id);
    try { const r = await ensureCycle(x); toast.success(r.created ? "Entrega do ciclo criada" : "A entrega deste ciclo já existe", { description: `${x.brand.name} · ${x.front.name} · ${ddmm(x.period.start)}–${ddmm(x.period.end)}` }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível criar a entrega."); } finally { setBusy(null); }
  };

  if (!ready || q.isLoading) return <div className="stack-lg" aria-busy="true"><div className="stat-row four">{LEVELS.map((l) => <Skeleton key={l} h={88} r={20} />)}</div><Skeleton h={420} r={24} /></div>;
  if (q.isError) return <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState kind="error" title="Não foi possível carregar o controle" actions={<Button variant="secondary" icon="refresh" onClick={() => q.refetch()}>Tentar novamente</Button>} /></div>;

  return (
    <div className="stack-lg">
      <div className="risk-row" role="group" aria-label="Filtrar por situação">
        {LEVELS.map((l) => (
          <button key={l} type="button" className={`risk-tile e-glass${f.level === l ? " on" : ""}`} aria-pressed={f.level === l} style={{ ["--c" as string]: RISK_COLOR[l] }} onClick={() => setF({ ...f, level: f.level === l ? "" : l })}>
            <span className="risk-n tnum">{count(l)}</span>
            <span>{RISK_LABELS[l]}</span>
            <small>{l === "red" ? "aprovação vencida" : l === "orange" ? "dentro da antecedência" : l === "yellow" ? "perto da antecedência" : "cobertura em dia"}</small>
          </button>
        ))}
      </div>

      <div className="ctl-bar">
        <div className="month-nav">
          <Button size="sm" variant="ghost" icon="chevLeft" aria-label="Mês anterior" onClick={() => shift(-1)} />
          <span className="month-label">{MONTHS[ym.m][0].toUpperCase() + MONTHS[ym.m].slice(1)} de {ym.y}</span>
          <Button size="sm" variant="ghost" icon="chevRight" aria-label="Próximo mês" onClick={() => shift(1)} />
          {!isNow && <Button size="sm" variant="ghost" onClick={() => { setDir(0); setYm({ y: now.getFullYear(), m: now.getMonth() }); }}>Hoje</Button>}
        </div>
        <div className="ctl-filters">
          <Select value={f.brand} onChange={(v) => setF({ ...f, brand: v })} options={[{ value: "", label: "Todos os clientes" }, ...brands.map((b) => ({ value: b.id, label: b.name }))]} />
          <Select value={f.front} onChange={(v) => setF({ ...f, front: v })} options={[{ value: "", label: "Todas as frentes" }, ...frontNames.map((n) => ({ value: n, label: n }))]} />
          <Select value={f.rec} onChange={(v) => setF({ ...f, rec: v })} options={[{ value: "", label: "Toda recorrência" }, ...Object.entries(RECURRENCES).map(([value, label]) => ({ value, label }))]} />
        </div>
        <span className="e-caption tnum">{visible.length} de {all.length} frentes</span>
      </div>

      {visible.length === 0 ? (
        <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState kind="search" title="Nenhuma frente com esses filtros" actions={<Button variant="secondary" onClick={() => setF({ brand: "", front: "", rec: "", level: "" })}>Limpar filtros</Button>} /></div>
      ) : (
        <div className="ctl e-glass" ref={gridRef} style={{ ["--days" as string]: days }}>
          <div className="ctl-head">
            <span className="ctl-label-h">Cliente · frente</span>
            <div className="ctl-days">
              {Array.from({ length: days }, (_, i) => {
                const d = new Date(ym.y, ym.m, i + 1);
                const wk = d.getDay() === 0 || d.getDay() === 6;
                return <span key={i} className={`${wk ? "wk" : ""}${isNow && i + 1 === now.getDate() ? " today" : ""}`}>{i + 1}</span>;
              })}
            </div>
          </div>
          {visible.map((x, row) => {
            const cov = pos(x.front.approved_until);
            const produce = x.front.approved_until ? toISO(addDays(localDate(x.front.approved_until), -x.front.lead_days)) : null;
            const pp = pos(produce);
            const ps = pos(x.period.start, false);
            const pe = pos(x.period.end);
            return (
              <div key={x.front.id} className={`ctl-row${flash.includes(x.front.id) ? " flash" : ""}`} style={{ ["--c" as string]: RISK_COLOR[x.level], ["--i" as string]: row }}>
                <div className="ctl-label">
                  <ClientLogo name={x.brand.name} logoUrl={x.brand.logo_url} size="sm" />
                  <div style={{ minWidth: 0 }}>
                    <b className="e-ellipsis" style={{ display: "block" }}>{x.brand.name}</b>
                    <span className="e-caption">{x.front.name} · {recLabel(x.front.recurrence)}</span>
                  </div>
                  <Badge tone={RISK_TONE[x.level]} dot>{RISK_LABELS[x.level]}</Badge>
                </div>
                <div className="ctl-track" role="img" aria-label={`${x.brand.name} ${x.front.name}: aprovado até ${ddmm(x.front.approved_until)}`}>
                  {Array.from({ length: days }, (_, i) => { const d = new Date(ym.y, ym.m, i + 1).getDay(); return d === 0 || d === 6 ? <i key={i} className="wk" style={{ gridColumn: i + 1 }} /> : null; })}
                  {cov !== null && cov > 0 && <span className="cov" style={{ gridColumn: `1 / ${cov + 1}` }} />}
                  {ps !== null && pe !== null && pe > ps && <span className="pending" style={{ gridColumn: `${ps + 1} / ${pe + 1}` }} title={`Próxima pauta ${ddmm(x.period.start)}–${ddmm(x.period.end)}`} />}
                  {pp !== null && pp > 0 && pp <= days && produce && localDate(produce) >= first && <span className="mark produce" style={{ gridColumn: pp }} title={`Começar a produzir em ${ddmm(produce)}`}><i /></span>}
                  {isNow && <span className="mark now" style={{ gridColumn: now.getDate() }} title="Hoje"><i /></span>}
                </div>
                <div className="ctl-detail">
                  <span className="e-caption tnum">aprovado até <b>{ddmm(x.front.approved_until)}</b> · antecedência {x.front.lead_days}d · próxima pauta {ddmm(x.period.start)}–{ddmm(x.period.end)}</span>
                  <span className="e-row" style={{ gap: 4 }}>
                    <Button size="sm" variant="secondary" icon="plus" loading={busy === x.front.id} onClick={() => createCycle(x)}>Criar entrega do ciclo</Button>
                    {isDemoMode() && <Menu align="right" trigger={({ toggle }) => <Button size="sm" variant="ghost" icon="more" aria-label="Mais ações" onClick={toggle} />} items={[
                      { title: "Demonstração" },
                      { label: "Simular aprovação no Like (+7 dias)", icon: "heart", onSelect: () => { const base = x.front.approved_until ? localDate(x.front.approved_until) : today(); demoApprove(x.front.id, toISO(addDays(base, 7))); qc.invalidateQueries({ queryKey: ["ops-fronts"] }); pulse(x.front.id); toast.success("Aprovado no Like", { description: `${x.brand.name} · ${x.front.name} coberto até ${ddmm(toISO(addDays(base, 7)))}` }); } },
                    ]} />}
                  </span>
                </div>
              </div>
            );
          })}
          <div className="ctl-legend">
            <span><i className="lg cov" /> Coberto (aprovado)</span>
            <span><i className="lg produce" /> Começar a produzir</span>
            <span><i className="lg pending" /> Próxima pauta</span>
            <span><i className="lg now" /> Hoje</span>
          </div>
        </div>
      )}
      <p className="e-caption" style={{ margin: 0 }}><Icon name="info" size="sm" /> A cobertura avança sozinha quando o cliente aprova no Like um material com data de publicação.</p>
    </div>
  );
}
