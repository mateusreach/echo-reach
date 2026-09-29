import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge, Button, EmptyState, Skeleton } from "@/components/echo/primitives";
import { Field, Segmented, Select } from "@/components/echo/controls";
import { Drawer } from "@/components/echo/overlays";
import {
  ActiveFilters,
  CoverageGantt,
  CoverageHorizon,
  CoverageLegend,
  CoverageTimeline,
  DetailFacts,
  MetricFilters,
  PeriodNavigator,
  shortDate,
  type CoverageRow,
} from "@/components/echo/operations";
import { Icon } from "@/components/echo/icon";
import {
  addDays,
  frontPeriod,
  frontRisk,
  localDate,
  RECURRENCES,
  RISK_LABELS,
  toISO,
  today,
  type FrontWithRisk,
  type RiskLevel,
} from "@/lib/workspace-data";
import { demoApprove, ensureCycle, listOpsFronts, subscribeFronts } from "@/lib/ops-data";
import { isDemoMode } from "@/lib/home-data";
import { addDaysISO } from "@/lib/coverage-scale";

const CYCLE_DAYS: Record<string, number> = { weekly: 7, biweekly: 14, monthly: 30, oneoff: 1 };
const WINDOW = 35;

export const Route = createFileRoute("/workspace/controle")({
  head: () => ({
    meta: [
      { title: "Controle · Workspace · Echo" },
      {
        name: "description",
        content: "Cobertura de conteúdo: datas, antecedência e próximos ciclos por cliente.",
      },
    ],
  }),
  component: CoverageControl,
});

const LEVELS: RiskLevel[] = ["red", "orange", "yellow", "green"];
const COLORS: Record<RiskLevel, string> = {
  red: "var(--danger)",
  orange: "var(--warn)",
  yellow: "var(--review)",
  green: "var(--ok)",
};
const FILLS: Record<RiskLevel, string> = {
  red: "var(--danger-fill)",
  orange: "var(--warn-fill)",
  yellow: "var(--review-fill)",
  green: "var(--ok-fill)",
};
const TONES = { red: "late", orange: "adjust", yellow: "review", green: "done" } as const;
const ICONS = { red: "alert", orange: "clock", yellow: "eye", green: "checkCircle" };
const HINTS = {
  red: "aprovação vencida",
  orange: "hora de produzir",
  yellow: "planejar o ciclo",
  green: "cobertura em dia",
};
const EMPTY_FILTERS = { brand: "", front: "", rec: "", level: "" as RiskLevel | "", search: "" };
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
const recurrence = (key: string) => (RECURRENCES as Record<string, string>)[key] ?? key;
const riskHint = (x: FrontWithRisk) =>
  !x.front.approved_until
    ? "Sem data aprovada"
    : x.diff < 0
      ? `Venceu há ${-x.diff} ${x.diff === -1 ? "dia" : "dias"}`
      : x.diff === 0
        ? "Cobertura até hoje"
        : `${x.diff} ${x.diff === 1 ? "dia" : "dias"} de cobertura`;
const productionDate = (x: FrontWithRisk) =>
  x.front.approved_until
    ? toISO(addDays(localDate(x.front.approved_until), -x.front.lead_days))
    : null;
const cycleKey = (x: FrontWithRisk) => `${x.front.id}:${x.period.start}:${x.period.end}`;

function CoverageControl() {
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const now = today();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [range, setRange] = useState<"janela" | "mes">("janela");
  const [weekShift, setWeekShift] = useState(0);
  const [f, setF] = useState(EMPTY_FILTERS);
  const [view, setView] = useState<"timeline" | "list">("timeline");
  const [selected, setSelected] = useState<string | null>(null);
  const [flash, setFlash] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [created, setCreated] = useState<string[]>([]);
  const inFlight = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    setReady(true);
    if (window.matchMedia("(max-width: 760px)").matches) setView("list");
    return () => timers.current.forEach(clearTimeout);
  }, []);
  const q = useQuery({ queryKey: ["ops-fronts"], queryFn: listOpsFronts, enabled: ready });
  const pulse = (id: string) => {
    setFlash((ids) => [...ids, id]);
    timers.current.push(setTimeout(() => setFlash((ids) => ids.filter((x) => x !== id)), 1800));
  };
  useEffect(
    () =>
      subscribeFronts((id) => {
        qc.invalidateQueries({ queryKey: ["ops-fronts"] });
        pulse(id);
      }),
    [qc],
  );
  // Recalculate after approvals (including demo); the next-cycle period must not remain stale.
  const all = useMemo(
    () =>
      (q.data ?? []).map((x) => ({ ...x, ...frontRisk(x.front), period: frontPeriod(x.front) })),
    [q.data],
  );
  const brands = useMemo(
    () =>
      [...new Map(all.map((x) => [x.brand.id, x.brand])).values()].sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR"),
      ),
    [all],
  );
  const frontNames = useMemo(() => [...new Set(all.map((x) => x.front.name))].sort(), [all]);
  const scoped = all.filter(
    (x) =>
      (!f.brand || x.brand.id === f.brand) &&
      (!f.front || x.front.name === f.front) &&
      (!f.rec || x.front.recurrence === f.rec) &&
      (!f.search ||
        normalize(`${x.brand.name} ${x.front.name}`).includes(normalize(f.search.trim()))),
  );
  const visible = scoped
    .filter((x) => !f.level || x.level === f.level)
    .sort(
      (a, b) =>
        LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) ||
        a.diff - b.diff ||
        a.brand.name.localeCompare(b.brand.name, "pt-BR"),
    );
  const active = all.find((x) => x.front.id === selected);
  const todayISO = toISO(now);
  const winStart = range === "janela" ? addDaysISO(todayISO, -7 + weekShift * 7) : toISO(new Date(ym.y, ym.m, 1));
  const winDays = range === "janela" ? WINDOW : new Date(ym.y, ym.m + 1, 0).getDate();
  const winEnd = addDaysISO(winStart, winDays - 1);
  const isNow = range === "janela" ? weekShift === 0 : ym.y === now.getFullYear() && ym.m === now.getMonth();
  const fmt = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "short" }).replace(".", "");
  const monthLabel = range === "janela"
    ? `${fmt(winStart)} – ${fmt(winEnd)}`
    : new Date(ym.y, ym.m, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const shift = (by: number) => {
    if (range === "janela") { setWeekShift((w) => w + by); return; }
    const d = new Date(ym.y, ym.m + by, 1);
    setYm({ y: d.getFullYear(), m: d.getMonth() });
  };
  const createCycle = async (id: string) => {
    const x = all.find((item) => item.front.id === id);
    if (!x || inFlight.current) return;
    inFlight.current = true;
    setBusy(id);
    try {
      const r = await ensureCycle(x);
      setCreated((items) => [...new Set([...items, cycleKey(x)])]);
      qc.invalidateQueries({ queryKey: ["ops-fronts"] });
      toast.success(r.created ? "Entrega do ciclo criada" : "A entrega deste ciclo já existe", {
        description: `${x.brand.name} · ${x.front.name} · ${shortDate(x.period.start)}–${shortDate(x.period.end)}`,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar a entrega.");
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  };
  const rows: CoverageRow[] = visible.map((x) => ({
    id: x.front.id,
    name: x.brand.name,
    logo: x.brand.logo_url,
    front: x.front.name,
    recurrence: recurrence(x.front.recurrence),
    approved: x.front.approved_until,
    produce: productionDate(x),
    nextStart: x.period.start,
    nextEnd: x.period.end,
    status: RISK_LABELS[x.level],
    color: COLORS[x.level],
    fill: FILLS[x.level],
    hint: riskHint(x),
    lead: x.front.lead_days,
    updated: flash.includes(x.front.id),
    cycleDays: CYCLE_DAYS[x.front.recurrence] ?? 7,
    diff: x.diff,
  }));
  const activeFilters = [
    { id: "search", label: `Busca: ${f.search}`, value: f.search },
    { id: "brand", label: brands.find((b) => b.id === f.brand)?.name ?? "", value: f.brand },
    { id: "front", label: f.front, value: f.front },
    { id: "rec", label: recurrence(f.rec), value: f.rec },
    { id: "level", label: f.level ? RISK_LABELS[f.level] : "", value: f.level },
  ]
    .filter((x) => x.value)
    .map((x) => ({
      id: x.id,
      label: x.label,
      onRemove: () => setF((prev) => ({ ...prev, [x.id]: "" })),
    }));

  if (!ready || q.isLoading)
    return (
      <div className="coverage-page" aria-busy="true">
        <Skeleton h={70} r={16} />
        <div className="e-metric-filters">
          {LEVELS.map((l) => (
            <Skeleton key={l} h={108} r={22} />
          ))}
        </div>
        <Skeleton h={520} r={24} />
      </div>
    );
  if (q.isError)
    return (
      <EmptyState
        kind="error"
        title="Não foi possível carregar o controle"
        actions={
          <Button variant="secondary" icon="refresh" onClick={() => q.refetch()}>
            Tentar novamente
          </Button>
        }
      />
    );

  return (
    <div className="coverage-page">
      <header className="coverage-heading">
        <div>
          <span className="e-label">Workspace / Controle</span>
          <h1>Cobertura de conteúdo</h1>
          <p>O que já está aprovado. O que precisa entrar em produção.</p>
        </div>
        <span className="coverage-date">
          <Icon name="calendar" size="sm" />
          {now.toLocaleDateString("pt-BR", { day: "numeric", month: "long" })}
        </span>
      </header>
      <MetricFilters
        value={f.level}
        onChange={(level) => setF({ ...f, level: level as RiskLevel | "" })}
        items={LEVELS.map((level) => ({
          id: level,
          value: scoped.filter((x) => x.level === level).length,
          label: RISK_LABELS[level],
          hint: HINTS[level],
          color: COLORS[level],
          icon: ICONS[level],
        }))}
      />
      <section className="coverage-board" aria-label="Controle de cobertura">
        <div className="coverage-toolbar">
          <PeriodNavigator
            label={monthLabel[0].toUpperCase() + monthLabel.slice(1)}
            onPrevious={() => shift(-1)}
            onNext={() => shift(1)}
            onToday={() => { setWeekShift(0); setYm({ y: now.getFullYear(), m: now.getMonth() }); }}
            current={isNow}
          />
          <Segmented
            label="Período"
            value={range}
            onChange={(v) => { setRange(v); setWeekShift(0); }}
            items={[
              { value: "janela", label: "5 semanas" },
              { value: "mes", label: "Mês" },
            ]}
          />
          <span style={{ flex: 1 }} />
          <Segmented
            label="Visualização da cobertura"
            value={view}
            onChange={setView}
            items={[
              { value: "timeline", label: "Linha do tempo", icon: "calendar" },
              { value: "list", label: "Resumo", icon: "list" },
            ]}
          />
        </div>
        <div className="coverage-filters">
          <Field
            type="search"
            aria-label="Buscar cliente ou frente"
            placeholder="Buscar cliente ou frente"
            value={f.search}
            onChange={(e) => setF({ ...f, search: e.target.value })}
          />
          <Select
            value={f.brand}
            icon="briefcase"
            onChange={(brand) => setF({ ...f, brand })}
            options={[
              { value: "", label: "Todos os clientes" },
              ...brands.map((b) => ({ value: b.id, label: b.name })),
            ]}
          />
          <Select
            value={f.front}
            onChange={(front) => setF({ ...f, front })}
            options={[
              { value: "", label: "Todas as frentes" },
              ...frontNames.map((name) => ({ value: name, label: name })),
            ]}
          />
          <Select
            value={f.rec}
            onChange={(rec) => setF({ ...f, rec })}
            options={[
              { value: "", label: "Toda recorrência" },
              ...Object.entries(RECURRENCES).map(([value, label]) => ({ value, label })),
            ]}
          />
        </div>
        <ActiveFilters items={activeFilters} onClear={() => setF(EMPTY_FILTERS)}>
          {visible.length} de {all.length} frentes · prioridade por risco
        </ActiveFilters>
        {!all.length ? (
          <EmptyState
            title="Nenhuma frente cadastrada"
            text="Cadastre as frentes de conteúdo na operação de um cliente para acompanhar a cobertura."
            actions={
              <Link to="/clientes" className="e-btn secondary">
                Ver clientes
              </Link>
            }
          />
        ) : !visible.length ? (
          <EmptyState
            kind="search"
            title="Nenhuma frente com esses filtros"
            actions={
              <Button variant="secondary" onClick={() => setF(EMPTY_FILTERS)}>
                Limpar filtros
              </Button>
            }
          />
        ) : view === "timeline" ? (
          <>
            <CoverageHorizon rows={rows} start={winStart} days={winDays} today={todayISO} />
            <CoverageGantt
              rows={rows}
              start={winStart}
              days={winDays}
              today={todayISO}
              busyId={busy}
              createdIds={all.filter((x) => created.includes(cycleKey(x))).map((x) => x.front.id)}
              onInspect={setSelected}
              onCreate={createCycle}
            />
          </>
        ) : (
          <CoverageTimeline
            rows={rows}
            year={ym.y}
            month={ym.m}
            today={toISO(now)}
            view={view}
            busyId={busy}
            createdIds={all.filter((x) => created.includes(cycleKey(x))).map((x) => x.front.id)}
            onInspect={setSelected}
            onCreate={createCycle}
          />
        )}
        <footer className="coverage-board-foot">
          <CoverageLegend />
          <small>Situação atual · {shortDate(toISO(now))} · detalhes ao tocar na frente</small>
        </footer>
      </section>
      <p className="coverage-note">
        <Icon name="info" size="sm" />A faixa indica até quando há conteúdo aprovado; o losango
        marca quando começar a produzir. As situações refletem hoje, mesmo ao consultar outro mês.
      </p>
      <Drawer
        open={!!active}
        onClose={() => setSelected(null)}
        title={active ? `${active.brand.name} · ${active.front.name}` : "Cobertura"}
        eyebrow="Controle de cobertura"
        footer={
          active && (
            <Link
              to="/workspace/cliente/$brandSlug"
              params={{ brandSlug: active.brand.slug }}
              className="e-btn secondary"
            >
              Abrir operação do cliente
              <Icon name="arrowUpRight" />
            </Link>
          )
        }
      >
        {active && (
          <>
            <div className="coverage-detail-summary">
              <Badge tone={TONES[active.level]} dot>
                {RISK_LABELS[active.level]}
              </Badge>
              <p>
                {riskHint(active)}.{" "}
                {active.level === "red"
                  ? "Priorize a próxima entrega para retomar a cobertura."
                  : active.level === "orange"
                    ? "A janela de produção já começou. Organize a próxima entrega."
                    : "Acompanhe o início da produção para manter o cliente coberto."}
              </p>
            </div>
            <DetailFacts
              items={[
                { label: "Aprovado até", value: shortDate(active.front.approved_until) },
                { label: "Começar a produzir", value: shortDate(productionDate(active)) },
                {
                  label: "Antecedência",
                  value: `${active.front.lead_days} dias`,
                  hint: "Antes de terminar a cobertura",
                },
                { label: "Recorrência", value: recurrence(active.front.recurrence) },
              ]}
            />
            <section className="coverage-cycle">
              <span className="e-label">Próximo ciclo</span>
              <h4>
                {shortDate(active.period.start)} — {shortDate(active.period.end)}
              </h4>
              <p>
                Crie a entrega para organizar as tarefas desse período. Se ela já existir, o sistema
                mantém a mesma entrega.
              </p>
              <Button
                variant="primary"
                icon={created.includes(cycleKey(active)) ? "check" : "plus"}
                loading={busy === active.front.id}
                disabled={!!busy || created.includes(cycleKey(active))}
                onClick={() => createCycle(active.front.id)}
              >
                {created.includes(cycleKey(active))
                  ? "Entrega do ciclo criada"
                  : "Criar entrega do ciclo"}
              </Button>
            </section>
            {isDemoMode() && (
              <Button
                variant="ghost"
                size="sm"
                icon="refresh"
                onClick={() => {
                  const base = active.front.approved_until
                    ? localDate(active.front.approved_until)
                    : today();
                  demoApprove(active.front.id, toISO(addDays(base, 7)));
                  qc.invalidateQueries({ queryKey: ["ops-fronts"] });
                  pulse(active.front.id);
                  toast.success("Cobertura de exemplo atualizada em 7 dias");
                }}
              >
                Simular aprovação (+7 dias)
              </Button>
            )}
          </>
        )}
      </Drawer>
    </div>
  );
}
