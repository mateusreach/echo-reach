import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar, Badge, Button, ClientLogo, EmptyState, Skeleton } from "@/components/echo/primitives";
import { Icon, type IconName } from "@/components/echo/icon";
import { Panel, StatTile } from "@/components/echo/blocks";
import { stagger } from "@/components/echo/motion";
import { StatusMenu, TaskDrawer } from "@/components/echo/task-drawer";
import { RISK_LABELS, toISO, today, type RiskLevel } from "@/lib/workspace-data";
import { DONE, daysSince, isLateTask, listOpsFronts, listOpsTasks, myName, remindClient, type OpsTask } from "@/lib/ops-data";
import { loadAgencySettings } from "@/lib/settings-data";

export const Route = createFileRoute("/workspace/")({
  head: () => ({ meta: [{ title: "Visão geral · Workspace · Echo" }, { name: "description", content: "O que precisa de atenção hoje na operação." }] }),
  component: Overview,
});

const RISK_TONE: Record<RiskLevel, "late" | "adjust" | "review" | "done"> = { red: "late", orange: "adjust", yellow: "review", green: "done" };
const ddmm = (d?: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "");

function Overview() {
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => setReady(true), []);
  const tasks = useQuery({ queryKey: ["ops-tasks"], queryFn: listOpsTasks, enabled: ready });
  const fronts = useQuery({ queryKey: ["ops-fronts"], queryFn: listOpsFronts, enabled: ready });
  const me = useQuery({ queryKey: ["ops-me"], queryFn: myName, enabled: ready, staleTime: Infinity });
  const settings = useQuery({ queryKey: ["agency-settings"], queryFn: loadAgencySettings, enabled: ready, staleTime: 60_000 });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["ops-tasks"] }); qc.invalidateQueries({ queryKey: ["ops-fronts"] }); };
  useEffect(() => { if (root.current && tasks.data) stagger(root.current.querySelectorAll(".now-panel, .stat-tile"), { y: 10, dur: 420 }, 35); }, [!!tasks.data]);

  if (!ready || tasks.isLoading || fronts.isLoading) return <div className="stack-lg" aria-busy="true"><div className="stat-row">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} h={96} r={20} />)}</div><div className="grid-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={260} r={24} />)}</div></div>;
  if (tasks.isError || fronts.isError) return <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState kind="error" title="Não foi possível carregar a operação" actions={<Button variant="secondary" icon="refresh" onClick={refresh}>Tentar novamente</Button>} /></div>;

  const all = (tasks.data ?? []).filter((t) => t.status !== DONE);
  const todayISO = toISO(today());
  const mine = all.filter((t) => t.owner === me.data && t.due && t.due <= todayISO).sort((a, b) => (a.due ?? "").localeCompare(b.due ?? ""));
  const late = all.filter(isLateTask).sort((a, b) => (a.due ?? "").localeCompare(b.due ?? ""));
  const review = all.filter((t) => t.status === "Avaliação interna" || t.status === "Avaliação externa");
  const unassigned = all.filter((t) => !t.owner);
  const threshold = settings.data?.like_defaults.decisionDays ?? 2;
  const waiting = all.filter((t) => t.status === "Avaliação externa" && daysSince(t.since) >= threshold).sort((a, b) => daysSince(b.since) - daysSince(a.since));
  const attention = (fronts.data ?? []).filter((f) => f.level === "red" || f.level === "orange");
  const task = (tasks.data ?? []).find((t) => t.id === open) ?? null;

  const row = (t: OpsTask, extra?: React.ReactNode) => (
    <div key={t.id} className="ops-row" role="button" tabIndex={0} onClick={() => setOpen(t.id)} onKeyDown={(e) => { if (e.key === "Enter") setOpen(t.id); }}>
      <ClientLogo name={t.brand.name} size="sm" />
      <span className="e-grow" style={{ minWidth: 0 }}>
        <b className="e-ellipsis" style={{ display: "block" }}>{t.title}</b>
        <span className="e-caption e-ellipsis" style={{ display: "block" }}>{t.brand.name}{t.owner ? ` · ${t.owner}` : " · sem responsável"}</span>
      </span>
      {extra}
      {t.due && <span className={`team-due tnum${isLateTask(t) ? " late" : ""}`}>{ddmm(t.due)}</span>}
      <StatusMenu task={t} onChanged={refresh} />
    </div>
  );
  const list = (items: OpsTask[], emptyIcon: IconName, empty: string, extra?: (t: OpsTask) => React.ReactNode) =>
    items.length ? <div className="now-list">{items.slice(0, 8).map((t) => row(t, extra?.(t)))}{items.length > 8 && <span className="e-caption" style={{ padding: "4px 8px" }}>+{items.length - 8} {items.length - 8 === 1 ? "outra" : "outras"}</span>}</div> : <EmptyState compact icon={emptyIcon} title={empty} />;

  return (
    <div className="stack-lg" ref={root}>
      <div className="stat-row">
        <StatTile label="Minhas para hoje" value={mine.length} icon="user" tone="var(--env-workspace)" />
        <StatTile label="Atrasadas" value={late.length} icon="alert" tone="var(--danger)" />
        <StatTile label="Em avaliação" value={review.length} icon="eye" tone="var(--review)" />
        <StatTile label="Sem responsável" value={unassigned.length} icon="users" tone="var(--warn)" />
        <StatTile label="Frentes em risco" value={attention.length} icon="flag" tone="var(--danger)" to="/workspace/controle" />
      </div>

      <div className="grid-2">
        <Panel title="Minhas de hoje" icon="user" count={mine.length} tone="var(--env-workspace)">{list(mine, "checkCircle", "Nada seu vence hoje.")}</Panel>
        <Panel title="Atrasadas" icon="alert" count={late.length} tone="var(--danger)">{list(late, "checkCircle", "Nenhuma tarefa atrasada.", (t) => <Badge tone="late">{daysSince(t.due!)}d</Badge>)}</Panel>
        <Panel title="Aguardando o cliente" icon="heart" count={waiting.length} tone="var(--env-like)">
          {waiting.length ? <div className="now-list">{waiting.slice(0, 8).map((t) => row(t, (
            <span className="e-row" style={{ gap: 6 }} onClick={(e) => e.stopPropagation()}>
              <Badge tone="glass">há {daysSince(t.since)}d</Badge>
              <Button size="sm" variant={t.remindedAt ? "ghost" : "secondary"} icon={t.remindedAt ? "check" : "bell"} disabled={!!t.remindedAt} onClick={async () => { await remindClient(t); toast.success("Lembrete enviado", { description: `${t.brand.name} · ${t.title}` }); refresh(); }}>{t.remindedAt ? "Lembrado" : "Lembrar"}</Button>
            </span>
          )))}</div> : <EmptyState compact icon="heart" title={`Nada com o cliente há ${threshold} dias ou mais`} />}
        </Panel>
        <Panel title="Em avaliação" icon="eye" count={review.length} tone="var(--review)">{list(review, "eye", "Nada em avaliação.", (t) => <Badge tone="glass">{t.status === "Avaliação interna" ? "Interna" : "Cliente"}</Badge>)}</Panel>
        <Panel title="Sem responsável" icon="users" count={unassigned.length} tone="var(--warn)">{list(unassigned, "checkCircle", "Tudo tem dono.")}</Panel>
        <Panel title="Clientes que precisam de atenção" icon="flag" count={attention.length} tone="var(--danger)" action={<Link to="/workspace/controle" className="e-link" style={{ fontSize: 13 }}>Controle <Icon name="arrowRight" size="sm" /></Link>}>
          {attention.length ? <div className="now-list">{attention.slice(0, 8).map((f) => (
            <Link key={f.front.id} to="/workspace/controle" className="ops-row">
              <ClientLogo name={f.brand.name} logoUrl={f.brand.logo_url} size="sm" />
              <span className="e-grow" style={{ minWidth: 0 }}><b className="e-ellipsis" style={{ display: "block" }}>{f.brand.name} · {f.front.name}</b><span className="e-caption">{f.front.approved_until ? `aprovado até ${ddmm(f.front.approved_until)}` : "sem aprovação"} · antecedência {f.front.lead_days}d</span></span>
              <Badge tone={RISK_TONE[f.level]} dot>{RISK_LABELS[f.level]}</Badge>
            </Link>
          ))}</div> : <EmptyState compact icon="checkCircle" title="Todos os clientes cobertos" />}
        </Panel>
      </div>
      {me.data && <p className="e-caption" style={{ margin: 0 }}><Avatar name={me.data} size="xs" /> Visão de {me.data}. “Aguardando o cliente” mostra materiais em Avaliação externa há {threshold} dias úteis ou mais (padrão do Like).</p>}
      <TaskDrawer task={task} onClose={() => setOpen(null)} onChanged={refresh} />
    </div>
  );
}
