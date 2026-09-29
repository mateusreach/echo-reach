import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Avatar, Badge, Button, ClientLogo, EmptyState, Skeleton } from "@/components/echo/primitives";
import { Chip, Segmented, Select } from "@/components/echo/controls";
import { Drawer } from "@/components/echo/overlays";
import { Icon } from "@/components/echo/icon";
import { PeriodNavigator } from "@/components/echo/operations";
import { StatusMenu, TaskDrawer } from "@/components/echo/task-drawer";
import { toISO, today } from "@/lib/workspace-data";
import { DONE, isLateTask, listCalendarLayers, listOpsTasks, type CalendarLayerItem, type OpsTask } from "@/lib/ops-data";

export const Route = createFileRoute("/workspace/cronograma")({
  head: () => ({ meta: [{ title: "Calendário · Workspace · Echo" }, { name: "description", content: "Entregas, tarefas, publicações e reuniões no mês." }] }),
  component: Schedule,
});

type Entry = { kind: "tarefa"; date: string; task: OpsTask } | { kind: "camada"; date: string; item: CalendarLayerItem };
const STATUS_FILL: Record<string, string> = { Parada: "var(--ink-3)", Iniciada: "var(--info-fill)", "Avaliação interna": "var(--review-fill)", "Aguardando retorno externo": "var(--warn-fill)", Ajuste: "var(--warn-fill)", "Avaliação externa": "var(--env-like)", "Concluído": "var(--ok-fill)" };
const WEEK = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function Schedule() {
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const now = today();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [view, setView] = useState<"grade" | "lista">("grade");
  const [brand, setBrand] = useState("");
  const [person, setPerson] = useState("");
  const [layers, setLayers] = useState({ tarefas: true, publicacoes: true, reunioes: true });
  const [day, setDay] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => setReady(true), []);
  const tasks = useQuery({ queryKey: ["ops-tasks"], queryFn: listOpsTasks, enabled: ready });
  const layerQ = useQuery({ queryKey: ["calendar-layers"], queryFn: listCalendarLayers, enabled: ready });
  const refresh = () => qc.invalidateQueries({ queryKey: ["ops-tasks"] });
  const todayISO = toISO(now);

  const all = tasks.data ?? [];
  const brands = useMemo(() => [...new Map(all.map((t) => [t.brand.slug, t.brand.name])).entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR")), [all]);
  const people = [...new Set(all.map((t) => t.owner).filter(Boolean) as string[])].sort();
  const entries: Entry[] = [
    ...(layers.tarefas ? all.filter((t) => t.due && t.status !== DONE && (!brand || t.brand.slug === brand) && (!person || t.owner === person)).map((t) => ({ kind: "tarefa" as const, date: t.due!, task: t })) : []),
    ...(layerQ.data ?? []).filter((i) => (i.kind === "publicacao" ? layers.publicacoes : layers.reunioes) && (!brand || i.brand.slug === brand) && !person).map((i) => ({ kind: "camada" as const, date: i.date, item: i })),
  ];
  const byDay = new Map<string, Entry[]>();
  for (const e of entries) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
  byDay.forEach((list) => list.sort((a, b) => (a.kind === "camada" ? 0 : 1) - (b.kind === "camada" ? 0 : 1)));

  const first = new Date(ym.y, ym.m, 1);
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(ym.y, ym.m + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((offset + daysInMonth) / 7) * 7 }, (_, i) => { const d = new Date(ym.y, ym.m, i - offset + 1); return { iso: toISO(d), inMonth: d.getMonth() === ym.m, n: d.getDate() }; });
  const monthLabel = first.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const monthEntries = [...byDay.entries()].filter(([d]) => d.slice(0, 7) === toISO(first).slice(0, 7)).sort((a, b) => a[0].localeCompare(b[0]));

  const chip = (e: Entry, compact = true) => e.kind === "tarefa" ? (
    <button key={e.task.id} type="button" className={`cal-chip task${isLateTask(e.task) ? " late" : ""}`} style={{ ["--c" as string]: STATUS_FILL[e.task.status] ?? "var(--e-accent)" }} onClick={(ev) => { ev.stopPropagation(); setOpen(e.task.id); }} title={`${e.task.title} · ${e.task.brand.name} · ${e.task.status}`}>
      <i />{compact ? e.task.title : <><b>{e.task.title}</b><small>{e.task.brand.name} · {e.task.owner ?? "sem responsável"}</small></>}
    </button>
  ) : (
    <span key={e.item.id} className={`cal-chip ${e.item.kind}`} title={`${e.item.kind === "publicacao" ? "Publicação aprovada" : "Reunião"} · ${e.item.title} · ${e.item.brand.name}`}>
      <Icon name={e.item.kind === "publicacao" ? "heart" : "users"} size="sm" />{compact ? e.item.title : <><b>{e.item.title}</b><small>{e.item.brand.name} · {e.item.kind === "publicacao" ? "publicação aprovada no Like" : "reunião do 360"}</small></>}
    </span>
  );

  if (!ready || tasks.isLoading) return <div className="stack-lg"><Skeleton h={56} r={18} /><Skeleton h={560} r={24} /></div>;
  if (tasks.isError) return <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState kind="error" title="Não foi possível carregar o calendário" actions={<Button variant="secondary" icon="refresh" onClick={() => tasks.refetch()}>Tentar novamente</Button>} /></div>;

  return (
    <div className="stack-lg">
      <div className="cal-bar">
        <PeriodNavigator label={monthLabel[0].toUpperCase() + monthLabel.slice(1)} onPrevious={() => { const d = new Date(ym.y, ym.m - 1, 1); setYm({ y: d.getFullYear(), m: d.getMonth() }); }} onNext={() => { const d = new Date(ym.y, ym.m + 1, 1); setYm({ y: d.getFullYear(), m: d.getMonth() }); }} onToday={() => setYm({ y: now.getFullYear(), m: now.getMonth() })} current={ym.y === now.getFullYear() && ym.m === now.getMonth()} />
        <div className="cal-filters">
          <Select value={brand} onChange={setBrand} options={[{ value: "", label: "Todos os clientes" }, ...brands.map(([slug, name]) => ({ value: slug, label: name }))]} icon="briefcase" />
          <Select value={person} onChange={setPerson} options={[{ value: "", label: "Todas as pessoas" }, ...people.map((p) => ({ value: p, label: p }))]} icon="user" />
        </div>
        <Segmented value={view} onChange={setView} label="Visualização" items={[{ value: "grade", label: "Grade", icon: "grid" }, { value: "lista", label: "Lista", icon: "list" }]} />
      </div>
      <div className="e-row wrap" style={{ gap: 6 }} role="group" aria-label="Camadas">
        <Chip pressed={layers.tarefas} color="var(--e-accent)" onClick={() => setLayers({ ...layers, tarefas: !layers.tarefas })}>Tarefas e entregas</Chip>
        <Chip pressed={layers.publicacoes} color="var(--env-like)" onClick={() => setLayers({ ...layers, publicacoes: !layers.publicacoes })}>Publicações aprovadas</Chip>
        <Chip pressed={layers.reunioes} color="var(--env-360)" onClick={() => setLayers({ ...layers, reunioes: !layers.reunioes })}>Reuniões do 360</Chip>
        {person && <span className="e-caption">Camadas de publicação e reunião ficam ocultas ao filtrar por pessoa.</span>}
      </div>

      {view === "grade" ? (
        <div className="cal-month e-glass">
          {WEEK.map((w) => <span key={w} className="cal-wd">{w}</span>)}
          {cells.map((c) => {
            const list = byDay.get(c.iso) ?? [];
            return (
              <div key={c.iso} className={`cal-cell${c.inMonth ? "" : " out"}${c.iso === todayISO ? " today" : ""}${c.iso < todayISO ? " past" : ""}`} role="button" tabIndex={0} onClick={() => list.length && setDay(c.iso)} onKeyDown={(e) => e.key === "Enter" && list.length && setDay(c.iso)} aria-label={`${c.n}: ${list.length} itens`}>
                <span className="cal-n tnum">{c.n}</span>
                <div className="cal-items">{list.slice(0, 3).map((e) => chip(e))}{list.length > 3 && <span className="cal-more">+{list.length - 3}</span>}</div>
              </div>
            );
          })}
        </div>
      ) : monthEntries.length === 0 ? <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState icon="calendar" title="Nada neste mês" /></div> : (
        <div className="stack">
          {monthEntries.map(([d, list]) => (
            <section key={d} className="cal-listday e-glass">
              <span className={`cal-listdate${d === todayISO ? " today" : ""}`}><b className="tnum">{d.slice(8, 10)}</b><small>{new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</small></span>
              <div className="stack" style={{ gap: 4, flex: 1, minWidth: 0 }}>{list.map((e) => chip(e, false))}</div>
            </section>
          ))}
        </div>
      )}

      <Drawer open={!!day} onClose={() => setDay(null)} eyebrow="Calendário" title={day ? new Date(`${day}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }) : ""}>
        {day && (byDay.get(day) ?? []).map((e) => e.kind === "tarefa" ? (
          <div key={e.task.id} className="ops-row" onClick={() => { setOpen(e.task.id); setDay(null); }} role="button" tabIndex={0}>
            <ClientLogo name={e.task.brand.name} size="sm" />
            <span className="e-grow" style={{ minWidth: 0 }}><b className="e-ellipsis" style={{ display: "block" }}>{e.task.title}</b><span className="e-caption">{e.task.brand.name}</span></span>
            {e.task.owner && <Avatar name={e.task.owner} size="xs" />}
            <span onClick={(ev) => ev.stopPropagation()}><StatusMenu task={e.task} onChanged={refresh} /></span>
          </div>
        ) : (
          <div key={e.item.id} className="ops-row">
            <Icon name={e.item.kind === "publicacao" ? "heart" : "users"} />
            <span className="e-grow"><b style={{ display: "block" }}>{e.item.title}</b><span className="e-caption">{e.item.brand.name}</span></span>
            <Badge tone="glass">{e.item.kind === "publicacao" ? "Publicação" : "Reunião"}</Badge>
            <Link to={`/workspace/cliente/${e.item.brand.slug}` as never} className="e-btn ghost sm">Cliente</Link>
          </div>
        ))}
      </Drawer>
      <TaskDrawer task={all.find((t) => t.id === open) ?? null} onClose={() => setOpen(null)} onChanged={refresh} />
    </div>
  );
}
