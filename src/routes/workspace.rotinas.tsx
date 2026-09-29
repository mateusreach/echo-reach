import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Avatar, Badge, Button, ClientLogo, EmptyState, Skeleton } from "@/components/echo/primitives";
import { Segmented } from "@/components/echo/controls";
import { Icon } from "@/components/echo/icon";
import { StatusMenu, TaskDrawer } from "@/components/echo/task-drawer";
import { WORK_TONE } from "@/components/echo/blocks";
import { addDays, toISO, today, WORK_STATUSES } from "@/lib/workspace-data";
import { DONE, isLateTask, listOpsTasks, type OpsTask } from "@/lib/ops-data";

export const Route = createFileRoute("/workspace/rotinas")({
  head: () => ({ meta: [{ title: "Rotinas · Workspace · Echo" }, { name: "description", content: "O trabalho aberto da equipe, agrupado como você precisar." }] }),
  component: Routines,
});

type Group = "status" | "pessoa" | "setor" | "cliente";
type Period = "semana" | "quinzena" | "mes";
const DAYS: Record<Period, number> = { semana: 7, quinzena: 14, mes: 31 };
const ddmm = (d?: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "sem prazo");

function Routines() {
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const [group, setGroup] = useState<Group>("status");
  const [period, setPeriod] = useState<Period>("semana");
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => setReady(true), []);
  const q = useQuery({ queryKey: ["ops-tasks"], queryFn: listOpsTasks, enabled: ready });
  const refresh = () => qc.invalidateQueries({ queryKey: ["ops-tasks"] });
  if (!ready || q.isLoading) return <div className="routine-cols">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={320} r={22} />)}</div>;
  if (q.isError) return <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState kind="error" title="Não foi possível carregar as rotinas" actions={<Button variant="secondary" icon="refresh" onClick={() => q.refetch()}>Tentar novamente</Button>} /></div>;

  const limit = toISO(addDays(today(), DAYS[period]));
  // Trabalho aberto no período: atrasadas + prazo até o fim do período + sem prazo. Cada tarefa aparece uma vez.
  const open_ = (q.data ?? []).filter((t) => t.status !== DONE && (!t.due || t.due <= limit));
  const keyOf = (t: OpsTask) => group === "status" ? t.status : group === "pessoa" ? t.owner ?? "Sem responsável" : group === "setor" ? t.sector ?? "Sem setor" : t.brand.name;
  const groups = new Map<string, OpsTask[]>();
  if (group === "status") WORK_STATUSES.filter((s) => s !== DONE).forEach((s) => groups.set(s, []));
  for (const t of open_) groups.set(keyOf(t), [...(groups.get(keyOf(t)) ?? []), t]);
  const entries = [...groups.entries()].sort((a, b) => group === "status" ? 0 : a[0].startsWith("Sem") ? 1 : b[0].startsWith("Sem") ? -1 : b[1].length - a[1].length);

  return (
    <div className="stack-lg">
      <div className="e-row between wrap" style={{ gap: 10 }}>
        <div className="e-row wrap" style={{ gap: 10 }}>
          <Segmented label="Agrupar por" value={group} onChange={setGroup} items={[{ value: "status", label: "Etapa" }, { value: "pessoa", label: "Pessoa" }, { value: "setor", label: "Setor" }, { value: "cliente", label: "Cliente" }]} />
          <Segmented label="Período" value={period} onChange={setPeriod} items={[{ value: "semana", label: "Semana" }, { value: "quinzena", label: "Quinzena" }, { value: "mes", label: "Mês" }]} />
        </div>
        <span className="e-caption tnum">{open_.length} tarefas abertas até {ddmm(limit)} · cada uma aparece uma vez</span>
      </div>
      {open_.length === 0 ? <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState icon="checkCircle" title="Nada aberto neste período" /></div> : (
        <div className="routine-cols">
          {entries.map(([name, items]) => (
            <section key={name} className="routine-col">
              <header>
                {group === "status" ? <Badge tone={WORK_TONE[name] ?? "todo"} dot>{name}</Badge> : group === "pessoa" ? <span className="e-row" style={{ gap: 8 }}><Avatar name={name} size="xs" /><b>{name}</b></span> : group === "cliente" ? <span className="e-row" style={{ gap: 8 }}><ClientLogo name={name} size="sm" /><b>{name}</b></span> : <b>{name}</b>}
                <span className="e-caption tnum">{items.length}</span>
              </header>
              {items.sort((a, b) => (a.due ?? "9").localeCompare(b.due ?? "9")).map((t) => (
                <article key={t.id} className="routine-card e-glass" onClick={() => setOpen(t.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setOpen(t.id)}>
                  <b>{t.title}</b>
                  <span className="e-caption e-ellipsis">{t.brand.name}{t.frontName ? ` · ${t.frontName}` : ""}</span>
                  <span className="routine-foot">
                    <span className={`tnum team-due${isLateTask(t) ? " late" : ""}`}><Icon name="calendar" size="sm" /> {ddmm(t.due)}</span>
                    <span style={{ flex: 1 }} />
                    {group !== "pessoa" && (t.owner ? <Avatar name={t.owner} size="xs" /> : <span className="e-caption">sem dono</span>)}
                    {group !== "status" && <span onClick={(e) => e.stopPropagation()}><StatusMenu task={t} onChanged={refresh} /></span>}
                  </span>
                </article>
              ))}
              {items.length === 0 && <span className="e-caption kempty">Nada aqui</span>}
            </section>
          ))}
        </div>
      )}
      <TaskDrawer task={(q.data ?? []).find((t) => t.id === open) ?? null} onClose={() => setOpen(null)} onChanged={refresh} />
    </div>
  );
}
