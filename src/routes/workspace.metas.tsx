import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Avatar, Badge, Button, EmptyState, ProgressRing, Skeleton } from "@/components/echo/primitives";
import { Field, Segmented, Select, Switch } from "@/components/echo/controls";
import { Drawer } from "@/components/echo/overlays";
import { Icon } from "@/components/echo/icon";
import { PeriodNavigator } from "@/components/echo/operations";
import { addDays, toISO } from "@/lib/workspace-data";
import { DONE, goalApplies, listOpsTasks, listWeeklyGoals, removeWeeklyGoal, saveWeeklyGoal, weekOf, weeklyProgress, type Goal } from "@/lib/ops-data";
import { listPickable } from "@/lib/team-data";
import { listPortfolio } from "@/lib/clients-data";

export const Route = createFileRoute("/workspace/metas")({
  head: () => ({ meta: [{ title: "Metas · Workspace · Echo" }, { name: "description", content: "Metas semanais da equipe e o que foi concluído." }] }),
  component: Goals,
});

const shiftWeek = (w: string, n: number) => toISO(addDays(new Date(`${w}T00:00:00`), n * 7));
const fmt = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "short" }).replace(".", "");

function Goals() {
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const [week, setWeek] = useState(weekOf());
  const [edit, setEdit] = useState<(Omit<Goal, "id"> & { id?: string }) | null>(null);
  useEffect(() => setReady(true), []);
  const goals = useQuery({ queryKey: ["weekly-goals"], queryFn: listWeeklyGoals, enabled: ready });
  const tasks = useQuery({ queryKey: ["ops-tasks"], queryFn: listOpsTasks, enabled: ready });
  const refresh = () => qc.invalidateQueries({ queryKey: ["weekly-goals"] });
  if (!ready || goals.isLoading || tasks.isLoading) return <div className="stack-lg"><Skeleton h={56} r={18} /><div className="obj-grid">{[0, 1, 2].map((i) => <Skeleton key={i} h={180} r={22} />)}</div></div>;
  const list = (goals.data ?? []).filter((g) => goalApplies(g, week));
  const end = shiftWeek(week, 1);
  const doneWeek = (tasks.data ?? []).filter((t) => t.status === DONE && t.completedAt && t.completedAt.slice(0, 10) >= week && t.completedAt.slice(0, 10) < end);
  const byPerson = new Map<string, number>();
  for (const t of doneWeek) byPerson.set(t.owner ?? "Sem responsável", (byPerson.get(t.owner ?? "Sem responsável") ?? 0) + 1);
  const max = Math.max(1, ...byPerson.values());
  const current = week === weekOf();

  return (
    <div className="stack-lg">
      <div className="e-row between wrap" style={{ gap: 10 }}>
        <PeriodNavigator unit="semana" label={`${fmt(week)} – ${fmt(toISO(addDays(new Date(`${week}T00:00:00`), 6)))}`} onPrevious={() => setWeek(shiftWeek(week, -1))} onNext={() => setWeek(shiftWeek(week, 1))} onToday={() => setWeek(weekOf())} current={current} />
        <Button icon="plus" onClick={() => setEdit({ title: "", scope: "geral", metric: "tarefas", taskTitle: null, memberName: null, brandId: null, target: 5, weekStart: week, recurring: true, reward: null })}>Nova meta</Button>
      </div>
      {list.length === 0 ? <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState icon="target" title="Nenhuma meta nesta semana" text="Metas recorrentes aparecem em todas as semanas a partir da inicial." /></div> : (
        <div className="obj-grid">
          {list.map((g) => {
            const p = weeklyProgress(g, week, tasks.data ?? []);
            return (
              <button key={g.id} type="button" className={`goal-card e-glass${p.reached ? " reached" : ""}`} onClick={() => setEdit({ ...g })}>
                <ProgressRing value={p.percent} size={64} label="" />
                <span className="e-grow" style={{ minWidth: 0 }}>
                  <b style={{ display: "block" }}>{g.title}</b>
                  <span className="e-caption tnum" style={{ display: "block" }}>{p.done} de {p.target} {g.metric === "entregas" ? "entregas" : g.scope === "tarefa" ? `“${g.taskTitle}”` : "tarefas"} concluídas</span>
                  <span className="e-row wrap" style={{ gap: 4, marginTop: 6 }}>
                    {g.memberName && <Badge tone="glass" icon="user">{g.memberName}</Badge>}
                    {g.recurring && <Badge tone="glass" icon="refresh">Toda semana</Badge>}
                    {p.reached && <Badge tone="done" icon="checkCircle">Meta batida</Badge>}
                  </span>
                  {g.reward && <span className="goal-reward"><Icon name="star" size="sm" /> {g.reward}</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <section className="now-panel e-glass" style={{ ["--c" as string]: "var(--env-workspace)" }}>
        <header><span className="now-ic"><Icon name="checks" size="sm" /></span><h3>Concluído na semana</h3><span className="e-badge glass tnum">{doneWeek.length}</span></header>
        <div className="now-body stack" style={{ gap: 6 }}>
          {byPerson.size === 0 ? <EmptyState compact icon="checks" title="Nada concluído nesta semana ainda" /> : [...byPerson.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR")).map(([name, n]) => (
            <div key={name} className="week-row"><Avatar name={name} size="xs" /><span className="e-ellipsis">{name}</span><span className="week-bar"><i style={{ width: `${(n / max) * 100}%` }} /></span><b className="tnum">{n}</b></div>
          ))}
          <span className="e-caption">Em ordem alfabética: o objetivo é acompanhar o ritmo, não comparar pessoas.</span>
        </div>
      </section>
      <GoalDrawer goal={edit} onClose={() => setEdit(null)} onDone={refresh} />
    </div>
  );
}

function GoalDrawer({ goal, onClose, onDone }: { goal: (Omit<Goal, "id"> & { id?: string }) | null; onClose: () => void; onDone: () => void }) {
  const [g, setG] = useState(goal);
  const people = useQuery({ queryKey: ["people-pickable"], queryFn: listPickable, enabled: !!goal });
  const clients = useQuery({ queryKey: ["portfolio"], queryFn: listPortfolio, enabled: !!goal });
  useEffect(() => setG(goal), [goal]);
  if (!g) return <Drawer open={false} onClose={onClose} title="" />;
  return (
    <Drawer open={!!goal} onClose={onClose} eyebrow="Meta semanal" title={g.id ? g.title : "Nova meta"}
      footer={<>{g.id && <Button variant="ghost" icon="trash" onClick={async () => { await removeWeeklyGoal(g.id!); toast.success("Meta removida"); onDone(); onClose(); }}>Remover</Button>}<span style={{ flex: 1 }} /><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="check" disabled={!g.title.trim() || g.target < 1 || (g.scope === "tarefa" && !g.taskTitle?.trim())} onClick={async () => { await saveWeeklyGoal({ ...g, title: g.title.trim() }); toast.success("Meta salva"); onDone(); onClose(); }}>Salvar</Button></>}>
      <Field label="Meta" autoFocus value={g.title} placeholder="Ex.: Artes sem atraso" onChange={(e) => setG({ ...g, title: e.target.value })} />
      <div className="e-field"><span className="e-field-label">Tipo</span><Segmented label="Tipo" value={g.scope} onChange={(v) => setG({ ...g, scope: v })} items={[{ value: "geral", label: "Geral" }, { value: "tarefa", label: "Tarefa específica" }]} /></div>
      {g.scope === "tarefa" && <Field label="Tarefa" value={g.taskTitle ?? ""} placeholder="Ex.: Artes" help="Conta as tarefas com esse nome." onChange={(e) => setG({ ...g, taskTitle: e.target.value })} />}
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Alvo na semana" type="number" value={g.target} onChange={(e) => setG({ ...g, target: Math.max(1, Number(e.target.value) || 1) })} />
        <Select label="Métrica" value={g.metric} onChange={(v) => setG({ ...g, metric: v as Goal["metric"] })} options={[{ value: "tarefas", label: "Tarefas concluídas" }, { value: "entregas", label: "Entregas concluídas" }]} />
        <Select label="Pessoa" value={g.memberName ?? ""} placeholder="Toda a equipe" onChange={(v) => setG({ ...g, memberName: v || null })} options={[{ value: "", label: "Toda a equipe" }, ...(people.data ?? []).map((p) => ({ value: p.name, label: p.name }))]} />
        <Select label="Cliente" value={g.brandId ?? ""} placeholder="Todos" onChange={(v) => setG({ ...g, brandId: v || null })} options={[{ value: "", label: "Todos os clientes" }, ...(clients.data ?? []).map((c) => ({ value: c.id, label: c.name }))]} />
      </div>
      <Field label="Benefício ao bater a meta" optional value={g.reward ?? ""} placeholder="Ex.: Sexta à tarde livre" onChange={(e) => setG({ ...g, reward: e.target.value || null })} />
      <Switch checked={g.recurring} onChange={(v) => setG({ ...g, recurring: v })} label={<span><b>Repetir toda semana</b><br /><span className="e-caption">A partir da semana de {fmt(g.weekStart)}.</span></span>} />
    </Drawer>
  );
}
