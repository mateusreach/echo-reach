import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar, Badge, Button, ClientLogo, EmptyState, Skeleton } from "@/components/echo/primitives";
import { Switch } from "@/components/echo/controls";
import { Modal } from "@/components/echo/overlays";
import { Icon, type IconName } from "@/components/echo/icon";
import { Panel } from "@/components/echo/blocks";
import { stagger, useCountUp } from "@/components/echo/motion";
import { useAccess } from "@/components/echo/session";
import { ClientForm, MODULE_ROWS } from "@/components/echo/client-form";
import { clientGradient, loadClientHub, saveModules } from "@/lib/clients-data";
import { CLIENT_STATUSES, CONTRACT_TYPES, type BrandModules } from "@/lib/reach-data";
import { RISK_LABELS, type RiskLevel } from "@/lib/workspace-data";
import { relDay } from "@/lib/home-data";
import { setClientContext } from "@/lib/ecosystem";
import { startViewAsClient } from "@/lib/view-as";

export const Route = createFileRoute("/clientes/$brandSlug")({
  head: () => ({ meta: [{ title: "Cliente · Echo" }] }),
  component: ClientHub,
});

const RISK_TONE: Record<RiskLevel, "late" | "adjust" | "review" | "done"> = { red: "late", orange: "adjust", yellow: "review", green: "done" };
const RISK_COLOR: Record<RiskLevel, string> = { red: "var(--danger)", orange: "var(--warn)", yellow: "var(--review)", green: "var(--ok)" };
const ENV_ICON: Record<string, IconName> = { brand: "layers", workspace: "grid", like: "heart", e360: "orbit" };
const ENV_COLOR: Record<string, string> = { brand: "var(--env-brand)", workspace: "var(--env-workspace)", like: "var(--env-like)", e360: "var(--env-360)" };

function Metric({ n, label, tone }: { n: number; label: string; tone?: string }) {
  const v = useCountUp(n);
  return <span className="hub-metric"><b className="tnum" style={tone ? { color: tone } : undefined}>{v}</b>{label}</span>;
}

function ClientHub() {
  const { brandSlug } = useParams({ from: "/clientes/$brandSlug" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { can, session } = useAccess();
  const [ready, setReady] = useState(false);
  const [edit, setEdit] = useState(false);
  const [pending, setPending] = useState<{ key: keyof BrandModules; on: boolean } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => { setReady(true); setClientContext(brandSlug); }, [brandSlug]);
  const q = useQuery({ queryKey: ["client-hub", brandSlug], queryFn: () => loadClientHub(brandSlug), enabled: ready });
  useEffect(() => { if (root.current && q.data) stagger(root.current.querySelectorAll(".env-block, .now-panel"), { y: 12, dur: 460 }, 45); }, [!!q.data]);

  if (!ready || q.isLoading)
    return <div className="stack-lg" aria-busy="true"><Skeleton h={180} r={28} /><div className="hub-envs">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={150} r={22} />)}</div></div>;
  if (q.isError) return <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState kind="error" title="Não foi possível carregar o cliente" text="Tente de novo em instantes." actions={<Button variant="secondary" icon="refresh" onClick={() => q.refetch()}>Tentar novamente</Button>} /></div>;
  if (!q.data) return <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState kind="search" title="Cliente não encontrado" text="O endereço não existe ou você não tem acesso a este cliente." actions={<Link to="/clientes" className="e-btn secondary">Ver todos os clientes</Link>} /></div>;

  const { client: c, counts, users, activity } = q.data;
  const isAdmin = !!session?.isAdmin || can("clientes.administrar");

  const applyModule = async () => {
    if (!pending) return;
    try {
      await saveModules(c.id, { ...c.modules, [pending.key]: pending.on });
      toast.success(pending.on ? "Ambiente ligado" : "Ambiente desligado", { description: MODULE_ROWS.find((m) => m.key === pending.key)?.label });
      setPending(null);
      qc.invalidateQueries({ queryKey: ["client-hub", brandSlug] });
      qc.invalidateQueries({ queryKey: ["portfolio"] });
    } catch {
      toast.error("Não foi possível alterar o ambiente.");
    }
  };

  const envBlocks = [
    { id: "brand", name: "Brand", on: c.modules.biblioteca || c.modules.plano, to: `/b/${c.slug}/biblioteca`, metrics: [{ n: counts.ideias, label: "ideias" }, { n: counts.conteudos, label: "conteúdos" }], note: c.modules.plano ? "Plano estratégico ativo" : "Biblioteca de conteúdo" },
    { id: "workspace", name: "Workspace", on: c.modules.workspace, to: `/workspace/cliente/${c.slug}`, metrics: [{ n: c.openTasks, label: "tarefas abertas" }, { n: c.lateTasks, label: "atrasadas", tone: c.lateTasks ? "var(--danger)" : undefined }, { n: counts.entregas, label: "entregas em aberto" }], note: c.nextDue ? `Próximo prazo ${relDay(c.nextDue).toLowerCase()}` : "Sem prazos abertos" },
    { id: "like", name: "Like", on: c.modules.like, to: null, metrics: [{ n: c.awaitingClient, label: "aguardando decisão" }], note: "Em construção: a aprovação passa para o cliente" },
    { id: "e360", name: "Espaço 360", on: c.modules.espaco360, to: `/e360/${c.slug}`, metrics: [{ n: counts.campanhas, label: "campanhas" }, { n: counts.solicitacoes, label: "solicitações abertas" }], note: "Plano, campanhas e solicitações" },
  ];

  return (
    <div className="stack-lg" ref={root}>
      <Link to="/clientes" className="e-link" style={{ fontSize: 13, fontWeight: 500, marginTop: 4 }}><Icon name="chevLeft" size="sm" /> Todos os clientes</Link>
      <section className="hub-head e-glass">
        <div className="hub-cover" style={{ background: clientGradient(c) }} />
        <div className="hub-id">
          <span className="client-logo-wrap"><ClientLogo name={c.name} logoUrl={c.logoUrl} gradient={clientGradient(c)} size="lg" /></span>
          <div style={{ minWidth: 0 }}>
            <h1 className="e-h2" style={{ margin: 0 }}>{c.name}</h1>
            <div className="e-row wrap" style={{ gap: 6, marginTop: 6 }}>
              {c.segment && <span className="e-small">{c.segment}</span>}
              <Badge tone="glass">{CLIENT_STATUSES.find((x) => x.key === c.status)?.label ?? c.status}</Badge>
              {c.contract && <Badge tone="glass">{CONTRACT_TYPES.find((x) => x.key === c.contract)?.label ?? c.contract}</Badge>}
              {c.contactName && <span className="e-caption"><Icon name="user" size="sm" /> {c.contactName}{c.contactEmail ? ` · ${c.contactEmail}` : ""}</span>}
            </div>
          </div>
          <span style={{ flex: 1 }} />
          <div className="e-row wrap" style={{ gap: 8 }}>
            <Button variant="secondary" icon="eye" disabled={!c.modules.espaco360} title={c.modules.espaco360 ? undefined : "O cliente não tem Espaço 360"} onClick={() => { startViewAsClient(c.name); navigate({ to: `/e360/${c.slug}` as never }); }}>Ver como cliente</Button>
            <Button variant="secondary" icon="edit" onClick={() => setEdit(true)}>Editar cadastro</Button>
          </div>
        </div>
      </section>

      <div className="hub-envs">
        {envBlocks.map((e) => {
          const body = (
            <>
              <div className="e-row between">
                <span className="env-ic" style={{ ["--c" as string]: ENV_COLOR[e.id], width: 38, height: 38, borderRadius: 12 }}><Icon name={ENV_ICON[e.id]} size="sm" /></span>
                {e.on ? (e.to ? <Icon name="arrowUpRight" className="env-arrow" /> : <Badge tone="glass" icon="lock">Em breve</Badge>) : <Badge tone="glass">Não contratado</Badge>}
              </div>
              <b className="env-name" style={{ fontSize: 16 }}>{e.name}</b>
              <div className="hub-metrics">{e.metrics.map((m) => <Metric key={m.label} {...m} />)}</div>
              <span className="e-caption">{e.note}</span>
            </>
          );
          const style = { ["--c" as string]: ENV_COLOR[e.id] } as React.CSSProperties;
          return e.on && e.to ? (
            <Link key={e.id} to={e.to as never} className="env-block e-glass" style={style} onClick={() => setClientContext(c.slug)}>{body}</Link>
          ) : (
            <div key={e.id} className={`env-block e-glass${e.on ? "" : " off"}`} style={style}>{body}</div>
          );
        })}
      </div>

      <div className="grid-2">
        <Panel title="Cobertura de conteúdo" icon="feed" count={c.fronts.length} tone="var(--env-workspace)" action={<Link to="/workspace/controle" className="e-link" style={{ fontSize: 13 }}>Controle <Icon name="arrowRight" size="sm" /></Link>}>
          {c.fronts.length === 0 ? (
            <EmptyState compact icon="feed" title="Nenhuma frente cadastrada" text="Cadastre Feed, Stories ou TikTok na operação do cliente para acompanhar a cobertura." />
          ) : (
            <div className="now-list">
              {c.fronts.map((f) => {
                const cover = Math.max(0, Math.min(100, ((f.diff + 1) / 14) * 100));
                return (
                  <div key={f.id} className="cov-line">
                    <div className="e-row between" style={{ gap: 8 }}>
                      <span><b>{f.name}</b> <span className="e-caption">{f.recurrence ?? ""}</span></span>
                      <Badge tone={RISK_TONE[f.level]} dot>{RISK_LABELS[f.level]}</Badge>
                    </div>
                    <div className="e-bar sm" role="img" aria-label={`Coberto por ${Math.max(0, f.diff)} dias`}><i style={{ ["--v" as string]: `${cover}%`, background: RISK_COLOR[f.level] }} /></div>
                    <span className="e-caption tnum">
                      {f.approvedUntil ? `Aprovado até ${f.approvedUntil.slice(8, 10)}/${f.approvedUntil.slice(5, 7)}` : "Sem data de aprovação"} · {f.diff >= 0 ? `${f.diff} ${f.diff === 1 ? "dia" : "dias"} de conteúdo` : `sem conteúdo há ${-f.diff} ${f.diff === -1 ? "dia" : "dias"}`} · antecedência {f.leadDays}d
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title="Ambientes contratados" icon="sliders" tone="var(--env-brand)">
          <div className="e-stack" style={{ gap: 6 }}>
            {MODULE_ROWS.map((m) => (
              <div key={m.key} className="module-row">
                <span className="dot" style={{ background: m.color }} />
                <span className="e-grow"><b>{m.label}</b><small>{m.desc}</small></span>
                <Switch checked={c.modules[m.key]} disabled={!isAdmin} onChange={(v) => setPending({ key: m.key, on: v })} label={<span className="e-sr">{m.label}</span>} />
              </div>
            ))}
            {!isAdmin && <p className="e-caption" style={{ margin: 0 }}>Só administradores ligam ou desligam ambientes.</p>}
          </div>
        </Panel>
      </div>

      <div className="grid-2">
        <Panel title="Pessoas" icon="users" count={c.members.length + users.length} tone="var(--env-360)" action={<Link to={`/b/${c.slug}/configuracoes?tab=acessos` as never} className="e-link" style={{ fontSize: 13 }}>Gerenciar acessos <Icon name="arrowRight" size="sm" /></Link>}>
          <div className="e-stack" style={{ gap: 12 }}>
            <div className="e-stack" style={{ gap: 4 }}>
              <span className="e-label">Equipe Reach</span>
              {c.members.length ? c.members.map((m) => <div key={m} className="e-row" style={{ gap: 10, padding: "5px 2px" }}><Avatar name={m} size="sm" /><span>{m}</span></div>) : <span className="e-caption">Ninguém com tarefas abertas neste cliente.</span>}
            </div>
            <div className="e-stack" style={{ gap: 4 }}>
              <span className="e-label">Usuários do cliente</span>
              {users.length ? users.map((u) => (
                <div key={u.email ?? u.name} className="e-row" style={{ gap: 10, padding: "5px 2px" }}>
                  <Avatar name={u.name} size="sm" />
                  <span className="e-grow" style={{ minWidth: 0 }}><span style={{ display: "block" }} className="e-ellipsis">{u.name}{u.admin &&  <Badge tone="glass">Admin</Badge>}</span><span className="e-caption e-ellipsis">{u.email}</span></span>
                  <span className="e-caption">{u.lastAccess ? `acessou ${relDay(u.lastAccess).toLowerCase()}` : "nunca acessou"}</span>
                </div>
              )) : <span className="e-caption">Nenhum usuário do cliente ainda. Convide pelo Brand › Configurações › Usuários e acessos.</span>}
            </div>
          </div>
        </Panel>

        <Panel title="Atividade recente" icon="history" count={activity.length} tone="var(--env-workspace)">
          {activity.length ? (
            <ol className="hub-activity">
              {activity.map((a, i) => (
                <li key={i}>
                  <span className="node" style={{ ["--c" as string]: ENV_COLOR[a.env] }}><Icon name={ENV_ICON[a.env]} size="sm" /></span>
                  <div><b>{a.who}</b> <span>{a.text}</span><div className="e-caption">{relDay(a.at)}</div></div>
                </li>
              ))}
            </ol>
          ) : <EmptyState compact icon="history" title="Sem atividade recente" text="As movimentações do cliente em todos os ambientes aparecem aqui." />}
        </Panel>
      </div>

      <ClientForm open={edit} client={c} onClose={() => setEdit(false)} onSaved={(slug) => { setEdit(false); qc.invalidateQueries({ queryKey: ["client-hub"] }); qc.invalidateQueries({ queryKey: ["portfolio"] }); if (slug !== c.slug) navigate({ to: `/clientes/${slug}` as never }); }} />
      <Modal
        open={!!pending}
        onClose={() => setPending(null)}
        icon={pending?.on ? "check" : "lock"}
        tone="soft"
        title={pending?.on ? "Ligar este ambiente?" : "Desligar este ambiente?"}
        sub={MODULE_ROWS.find((m) => m.key === pending?.key)?.label}
        footer={<><Button variant="secondary" onClick={() => setPending(null)}>Cancelar</Button><Button onClick={applyModule}>{pending?.on ? "Ligar" : "Desligar"}</Button></>}
      >
        <p className="e-small" style={{ margin: 0 }}>{pending?.on ? `O ambiente passa a aparecer para a equipe e, quando aplicável, para os usuários de ${c.name}.` : `A equipe e o cliente deixam de ver este ambiente. Nada é apagado; os registros voltam a aparecer se você religar.`}</p>
      </Modal>
    </div>
  );
}
