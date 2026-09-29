import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Avatar, Button, ClientLogo, EmptyState, Skeleton } from "@/components/echo/primitives";
import { Icon } from "@/components/echo/icon";
import { StatusMenu, TaskDrawer } from "@/components/echo/task-drawer";
import { toISO, today } from "@/lib/workspace-data";
import { DONE, googleCalendarLink, isLateTask, listOpsTasks, myName, type OpsTask } from "@/lib/ops-data";

export const Route = createFileRoute("/workspace/agenda")({
  head: () => ({ meta: [{ title: "Minha agenda · Workspace · Echo" }, { name: "description", content: "Tudo o que está sob a sua responsabilidade." }] }),
  component: MyAgenda,
});

const dayLabel = (iso: string, todayISO: string) => {
  const d = new Date(`${iso}T12:00:00`);
  const diff = Math.round((d.getTime() - new Date(`${todayISO}T12:00:00`).getTime()) / 86400000);
  const base = d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  return diff === 0 ? `Hoje · ${base}` : diff === 1 ? `Amanhã · ${base}` : diff < 0 ? `Atrasado · ${base}` : base[0].toUpperCase() + base.slice(1);
};

function MyAgenda() {
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => setReady(true), []);
  const me = useQuery({ queryKey: ["ops-me"], queryFn: myName, enabled: ready, staleTime: Infinity });
  const q = useQuery({ queryKey: ["ops-tasks"], queryFn: listOpsTasks, enabled: ready });
  const refresh = () => qc.invalidateQueries({ queryKey: ["ops-tasks"] });
  if (!ready || q.isLoading || me.isLoading) return <div className="stack-lg"><Skeleton h={60} r={18} /><Skeleton h={320} r={22} /></div>;
  const todayISO = toISO(today());
  // Só o que é de quem está logado e ainda não terminou.
  const mine = (q.data ?? []).filter((t) => t.owner && t.owner === me.data && t.status !== DONE);
  const dated = mine.filter((t) => t.due).sort((a, b) => a.due!.localeCompare(b.due!));
  const undated = mine.filter((t) => !t.due);
  const days = new Map<string, OpsTask[]>();
  for (const t of dated) { const k = t.due! < todayISO ? "atrasadas" : t.due!; days.set(k, [...(days.get(k) ?? []), t]); }

  const item = (t: OpsTask) => {
    const g = googleCalendarLink(t);
    return (
      <div key={t.id} className="ops-row" role="button" tabIndex={0} onClick={() => setOpen(t.id)} onKeyDown={(e) => e.key === "Enter" && setOpen(t.id)}>
        <ClientLogo name={t.brand.name} size="sm" />
        <span className="e-grow" style={{ minWidth: 0 }}>
          <b className="e-ellipsis" style={{ display: "block" }}>{t.title}</b>
          <span className="e-caption e-ellipsis" style={{ display: "block" }}>{t.brand.name}{t.frontName ? ` · ${t.frontName}` : ""}{t.time ? ` · ${t.time}` : ""}{isLateTask(t) ? ` · venceu em ${t.due!.slice(8, 10)}/${t.due!.slice(5, 7)}` : ""}</span>
        </span>
        {g && <a className="e-btn ghost sm" href={g} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title="Adicionar ao Google Agenda"><Icon name="calendar" size="sm" /> Google Agenda</a>}
        <span onClick={(e) => e.stopPropagation()}><StatusMenu task={t} onChanged={refresh} /></span>
      </div>
    );
  };

  return (
    <div className="stack-lg">
      <div className="e-row wrap" style={{ gap: 12 }}>
        {me.data && <Avatar name={me.data} size="lg" />}
        <div><h2 className="e-h3" style={{ margin: 0 }}>Agenda de {me.data || "você"}</h2><span className="e-caption">{mine.length} {mine.length === 1 ? "item" : "itens"} sob sua responsabilidade · {dated.filter((t) => t.due! < todayISO).length} atrasados</span></div>
      </div>
      {mine.length === 0 ? <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState icon="checkCircle" title="Nada com você agora" text="Quando alguém atribuir uma tarefa a você, ela aparece aqui." /></div> : (
        <div className="grid-2" style={{ alignItems: "start" }}>
          <section className="now-panel e-glass" style={{ ["--c" as string]: "var(--env-workspace)" }}>
            <header><span className="now-ic"><Icon name="calendar" size="sm" /></span><h3>Com prazo</h3><span className="e-badge glass tnum">{dated.length}</span></header>
            <div className="now-body stack">
              {[...days.entries()].map(([k, list]) => (
                <div key={k} className="stack" style={{ gap: 6 }}>
                  <span className={`e-label${k === "atrasadas" ? " late-label" : ""}`}>{k === "atrasadas" ? "Atrasadas" : dayLabel(k, todayISO)}</span>
                  {list.map(item)}
                </div>
              ))}
              {dated.length === 0 && <EmptyState compact icon="calendar" title="Nada com prazo" />}
            </div>
          </section>
          <section className="now-panel e-glass" style={{ ["--c" as string]: "var(--ink-3)" }}>
            <header><span className="now-ic"><Icon name="inbox" size="sm" /></span><h3>Sem prazo</h3><span className="e-badge glass tnum">{undated.length}</span></header>
            <div className="now-body stack">{undated.length ? undated.map(item) : <EmptyState compact icon="checkCircle" title="Tudo tem prazo" />}</div>
          </section>
        </div>
      )}
      <TaskDrawer task={(q.data ?? []).find((t) => t.id === open) ?? null} onClose={() => setOpen(null)} onChanged={refresh} />
      {q.isError && <Button variant="secondary" icon="refresh" onClick={() => q.refetch()}>Tentar novamente</Button>}
    </div>
  );
}
