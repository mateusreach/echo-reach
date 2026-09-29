import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AgendaRow, Panel, PersonLoad, StatTile, WORK_TONE, STATUS_LABEL, entryTone } from "@/components/echo/blocks";
import { Badge, Button, EmptyState, Skeleton } from "@/components/echo/primitives";
import { Icon } from "@/components/echo/icon";
import { stagger } from "@/components/echo/motion";
import { EVENT_CATEGORIES, POST_KINDS } from "@/lib/agency-data";
import { loadAgencyHome, toggleAck, type AgendaEntry, type AgencyHome as HomeData } from "@/lib/agency-page-data";
import { relDay } from "@/lib/home-data";

export const Route = createFileRoute("/agencia/")({
  head: () => ({ meta: [{ title: "Agência · Echo" }, { name: "description", content: "O que está acontecendo hoje na operação da Reach." }] }),
  component: AgencyHome,
});

function AgencyHome() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["agency-home"], queryFn: loadAgencyHome, enabled: ready, staleTime: 20_000 });
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!q.data || !root.current) return;
    stagger(root.current.querySelectorAll(".stat-tile"), { y: 12, dur: 480 }, 50);
    stagger(root.current.querySelectorAll(".now-panel"), { y: 14, dur: 520, delay: 200 }, 60);
  }, [!!q.data]);

  if (!ready || q.isLoading) return <HomeSkeleton />;
  if (q.isError || !q.data)
    return (
      <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}>
        <EmptyState kind="error" title="Não foi possível carregar o Início da Agência" text="A consulta ao banco falhou. Tente de novo em instantes." actions={<Button variant="secondary" icon="refresh" onClick={() => q.refetch()}>Tentar novamente</Button>} />
      </div>
    );
  const d: HomeData = q.data;
  const brandName = (id?: string | null) => (id ? d.brands.find((b) => b.id === id)?.name ?? "Cliente" : "Reach (interno)");
  const maxLoad = Math.max(1, ...d.team.map((t) => t.open));

  const ack = async (id: string, on: boolean) => {
    try {
      await toggleAck(id, on);
      toast.success(on ? "Leitura confirmada" : "Confirmação removida");
      qc.invalidateQueries({ queryKey: ["agency-home"] });
      qc.invalidateQueries({ queryKey: ["agency-posts"] });
    } catch {
      toast.error("Não foi possível registrar. Tente de novo.");
    }
  };

  const row = (e: AgendaEntry) => (
    <AgendaRow
      key={`${e.layer}-${e.id}`}
      date={e.date}
      tone={entryTone(e.date)}
      title={e.title}
      meta={[brandName(e.brandId), e.who, relDay(e.date)].filter(Boolean).join(" · ")}
      badge={e.status && WORK_TONE[e.status] ? { label: STATUS_LABEL[e.status] ?? e.status, tone: WORK_TONE[e.status] } : undefined}
      to={e.brandId ? `/workspace/cliente/${d.brands.find((b) => b.id === e.brandId)?.slug ?? ""}` : "/workspace"}
    />
  );

  return (
    <div ref={root} className="stack-lg">
      <p className="e-small" style={{ margin: "-4px 4px 0" }}>O que está acontecendo hoje na operação da Reach.</p>
      <div className="stat-row">
        <StatTile label="Clientes ativos" value={d.kpis.clients} icon="briefcase" to="/clientes" tone="var(--env-brand)" />
        <StatTile label="Solicitações abertas" value={d.kpis.requests} icon="message" to="/e360" tone="var(--env-360)" />
        <StatTile label="Itens atrasados" value={d.kpis.late} icon="alert" tone="var(--danger)" hint="tarefas e solicitações" />
        <StatTile label="Aguardando o cliente" value={d.kpis.awaitingClient} icon="heart" to="/workspace/avaliacoes" tone="var(--env-like)" hint="em avaliação externa" />
        <StatTile label="Frentes sem cobertura" value={d.kpis.uncovered} icon="feed" to="/workspace/controle" tone="var(--warn)" />
      </div>

      <div className="grid-2">
        <Panel title="Atrasados" icon="alert" count={d.late.length} tone="var(--danger)">
          {d.late.length ? <div className="now-list">{d.late.map(row)}</div> : <EmptyState compact kind="ok" title="Nada atrasado" text="Todas as tarefas e solicitações estão dentro do prazo." />}
        </Panel>
        <Panel title="Próximos 7 dias" icon="calendar" count={d.soon.length} tone="var(--env-workspace)">
          {d.soon.length ? <div className="now-list">{d.soon.map(row)}</div> : <EmptyState compact title="Semana livre" text="Nenhum prazo nos próximos 7 dias." />}
        </Panel>
      </div>

      <div className="grid-2">
        <Panel title="Próximos marcos" icon="flag" count={d.upcoming.length} tone="var(--env-brand)" action={<Link to="/agencia/calendario" className="e-link" style={{ fontSize: 13 }}>Calendário <Icon name="arrowRight" size="sm" /></Link>}>
          {d.upcoming.length ? (
            <div className="now-list">
              {d.upcoming.map((e) => {
                const cat = EVENT_CATEGORIES.find((c) => c.key === e.category);
                return <AgendaRow key={e.id} date={e.date} tone={entryTone(e.date)} title={e.title} color={cat?.color} meta={[cat?.label, brandName(e.brandId), e.time?.slice(0, 5)].filter(Boolean).join(" · ")} to="/agencia/calendario" />;
              })}
            </div>
          ) : <EmptyState compact icon="calendar" title="Nenhum marco agendado" text="Cadastre marcos no Calendário da agência." />}
        </Panel>
        <Panel title="Mural" icon="megaphone" count={d.posts.length} tone="var(--env-360)" action={<Link to="/agencia/comunicacao" className="e-link" style={{ fontSize: 13 }}>Ver mural <Icon name="arrowRight" size="sm" /></Link>}>
          {d.posts.length ? (
            <div className="now-list">
              {d.posts.slice(0, 4).map((p) => (
                <div key={p.id} className="post-mini">
                  <div className="e-row" style={{ gap: 6 }}>
                    {p.pinned && <Icon name="pin" size="sm" />}
                    <Badge tone="glass">{POST_KINDS.find((k) => k.key === p.kind)?.label ?? p.kind}</Badge>
                    <span className="e-caption">{relDay(p.created_at.slice(0, 10))}</span>
                  </div>
                  <b>{p.title}</b>
                  {p.content && <p className="e-clamp2">{p.content}</p>}
                  <div className="e-row" style={{ gap: 8 }}>
                    <Button size="sm" variant={p.mine ? "tonal" : "secondary"} icon={p.mine ? "check" : undefined} onClick={() => ack(p.id, !p.mine)}>{p.mine ? "Ciente" : "Marcar como ciente"}</Button>
                    <span className="e-caption">{p.acks.length} {p.acks.length === 1 ? "confirmação" : "confirmações"}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : <EmptyState compact icon="megaphone" title="Nenhum comunicado" text="Publique avisos e atualizações para a equipe." />}
        </Panel>
      </div>

      <Panel title="Carga da equipe" icon="users" count={d.team.length} tone="var(--env-workspace)" action={<Link to="/agencia/equipe" className="e-link" style={{ fontSize: 13 }}>Equipe <Icon name="arrowRight" size="sm" /></Link>}>
        {d.team.length ? (
          <div className="team-grid">{d.team.map((t) => <PersonLoad key={t.id} name={t.name} role={t.role} open={t.open} late={t.late} max={maxLoad} leader={t.leader} />)}</div>
        ) : <EmptyState compact icon="users" title="Nenhuma pessoa na equipe" text="Cadastre a equipe em Agência › Equipe." />}
      </Panel>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="stack-lg" aria-busy="true" aria-label="Carregando o Início da Agência">
      <div className="stat-row">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="stat-tile e-glass"><Skeleton w={30} h={30} r={10} /><Skeleton w="50%" h={28} r={8} /><Skeleton w="70%" h={11} /></div>)}</div>
      <div className="grid-2">{[0, 1].map((i) => <div key={i} className="now-panel e-glass"><Skeleton w="35%" h={14} />{[0, 1, 2].map((k) => <Skeleton key={k} h={50} r={14} />)}</div>)}</div>
    </div>
  );
}
