import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SpaceShell } from "@/components/reach/space-shell";
import { Avatar, Badge, Button, EmptyState, ProgressRing, Skeleton, type Tone } from "@/components/echo/primitives";
import { Chip, Field, LineTabs, Menu, Select, Switch, TextArea } from "@/components/echo/controls";
import { Drawer, Modal } from "@/components/echo/overlays";
import { Icon, type IconName } from "@/components/echo/icon";
import { Panel, StatTile } from "@/components/echo/blocks";
import { CAMPAIGN_STAGES, CHANNEL_STATUSES, HORIZONS, INITIATIVE_STATUSES, NOTE_KINDS, SOLICITACAO_STATUSES, TASK_SCOPES, TASK_STATUSES, strategyProgress } from "@/lib/reach-data";
import { relDay } from "@/lib/home-data";
import { toISO, today } from "@/lib/workspace-data";
import {
  INTERNAL_NOTE_KIND, addMeetingTask, createCampaignS, createMeetingS, createRequest, loadSpace, removeNote, saveChannelS, saveInitiativeS, saveMonthly, saveNote, saveTaskS, sendDraft, setMeetingTaskStatus, setRequestStatus,
  type SRequest, type STask, type Space,
} from "@/lib/space-data";

export const Route = createFileRoute("/e360/$brandSlug")({
  head: () => ({ meta: [{ title: "Espaço 360 · Echo" }] }),
  component: SpaceRoute,
  validateSearch: (search: Record<string, unknown>) => ({
    tab: (search.tab as string) || undefined,
    filtro: (search.filtro as string) || undefined,
  }),
});

type Tab = "visao" | "estrategias" | "campanhas" | "tarefas" | "solicitacoes" | "entregas" | "reunioes" | "notas" | "revisoes" | "canais";
const TABS: { value: Tab; label: string; icon: IconName }[] = [
  { value: "visao", label: "Visão geral", icon: "grid" }, { value: "estrategias", label: "Estratégias", icon: "compass" }, { value: "campanhas", label: "Campanhas", icon: "megaphone" },
  { value: "tarefas", label: "Tarefas", icon: "checks" }, { value: "solicitacoes", label: "Solicitações", icon: "inbox" }, { value: "entregas", label: "Entregas", icon: "checkCircle" },
  { value: "reunioes", label: "Reuniões", icon: "users" }, { value: "notas", label: "Notas", icon: "pin" }, { value: "revisoes", label: "Revisões mensais", icon: "chart" }, { value: "canais", label: "Canais", icon: "feed" },
];
const LEGACY: Record<string, Tab> = { "Visão Geral": "visao", "Estratégias": "estrategias", Campanhas: "campanhas", Tarefas: "tarefas", "Solicitações": "solicitacoes", Entregas: "entregas", "Reuniões": "reunioes", Notas: "notas", "Revisões Mensais": "revisoes", Canais: "canais" };
const label = (list: readonly { key: string; label: string }[], k?: string | null) => list.find((x) => x.key === k)?.label ?? k ?? "";
const ddmm = (d?: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "—");
const TASK_TONE: Record<string, Tone> = { a_fazer: "todo", em_andamento: "doing", concluida: "done" };
const REQ_TONE: Record<string, Tone> = { rascunho: "draft", nova: "todo", em_analise: "review", aprovada: "approved", em_execucao: "doing", aguardando_cliente: "adjust", concluida: "done", cancelada: "blocked" };

function SpaceRoute() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { brandSlug } = Route.useParams();
  if (pathname !== `/e360/${brandSlug}` && pathname !== `/e360/${brandSlug}/`) return <Outlet />;
  return <SpaceCenter />;
}

function SpaceCenter() {
  const { brandSlug } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const q = useQuery({ queryKey: ["space", brandSlug], queryFn: () => loadSpace(brandSlug), enabled: ready });
  const refresh = () => qc.invalidateQueries({ queryKey: ["space", brandSlug] });
  const raw = LEGACY[search.tab ?? ""] ?? search.tab;
  const tab: Tab = TABS.some((t) => t.value === raw) ? (raw as Tab) : "visao";
  const go = (t: Tab, filtro?: string) => navigate({ to: "/e360/$brandSlug", params: { brandSlug }, search: { tab: t, filtro }, replace: true });
  const s = q.data;
  const shell = (c: React.ReactNode) => <SpaceShell demoData brandSlug={brandSlug} brandName={s?.brand.name ?? ""} primaryColor={s?.brand.primary} accentColor={s?.brand.accent}>{c}</SpaceShell>;
  if (!ready || q.isLoading) return shell(<div className="stack-lg"><Skeleton h={44} r={14} /><div className="stat-row">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} h={96} r={20} />)}</div><Skeleton h={320} r={24} /></div>);
  if (q.isError) return shell(<div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState kind="error" title="Não foi possível abrir o espaço" actions={<Button variant="secondary" icon="refresh" onClick={() => q.refetch()}>Tentar novamente</Button>} /></div>);
  if (!s) return shell(<div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState icon="lock" title="Espaço 360 indisponível" text="Este cliente não tem o Espaço 360 ativo, ou você não tem acesso a ele." actions={<Link to="/e360" className="e-btn secondary">Ver espaços</Link>} /></div>);

  return shell(
    <div className="stack-lg">
      <LineTabs<Tab> value={tab} onChange={(t) => go(t)} items={TABS.map((t) => ({ ...t, label: t.value === "solicitacoes" ? `${t.label} · ${s.requests.filter((r) => !["concluida", "cancelada"].includes(r.status)).length}` : t.label }))} />
      {tab === "visao" && <Overview s={s} go={go} />}
      {tab === "estrategias" && <Strategies s={s} onChanged={refresh} />}
      {tab === "campanhas" && <Campaigns s={s} onChanged={refresh} />}
      {tab === "tarefas" && <Tasks s={s} filtro={search.filtro} onChanged={refresh} />}
      {tab === "solicitacoes" && <Requests s={s} onChanged={refresh} />}
      {tab === "entregas" && <Deliveries s={s} />}
      {tab === "reunioes" && <Meetings s={s} onChanged={refresh} />}
      {tab === "notas" && <Notes s={s} onChanged={refresh} />}
      {tab === "revisoes" && <Monthly s={s} onChanged={refresh} />}
      {tab === "canais" && <Channels s={s} onChanged={refresh} />}
    </div>,
  );
}

// ----- Visão geral ---------------------------------------------------------------------

function Overview({ s, go }: { s: Space; go: (t: Tab, f?: string) => void }) {
  const sp = strategyProgress(s.initiatives);
  const todayISO = toISO(today());
  const open = s.tasks.filter((t) => t.status !== "concluida");
  const reqs = s.requests.filter((r) => !["concluida", "cancelada", "rascunho"].includes(r.status));
  const running = s.campaigns.filter((c) => c.status === "em_andamento");
  const upcoming = [
    ...open.filter((t) => t.due_date && t.due_date >= todayISO).map((t) => ({ d: t.due_date!, t: t.title, k: "Tarefa" })),
    ...s.campaigns.filter((c) => c.end_date && c.end_date >= todayISO).map((c) => ({ d: c.end_date!, t: `Fim: ${c.title}`, k: "Campanha" })),
    ...s.notes.filter((n) => n.kind === "data_importante" && n.note_date && n.note_date >= todayISO).map((n) => ({ d: n.note_date!, t: n.title, k: "Data" })),
  ].sort((a, b) => a.d.localeCompare(b.d)).slice(0, 6);
  return (
    <div className="stack-lg">
      <div className="space-hero e-glass">
        <ProgressRing value={sp.percent} size={84} label="Plano" />
        <div className="e-grow"><b>Progresso do plano</b><p className="e-small" style={{ margin: "4px 0 0" }}>{sp.done} de {sp.total} estratégias concluídas · {sp.running} em andamento</p></div>
        <button type="button" className="like-cta" onClick={() => toast("O Like abre com o módulo de aprovação.")}>
          <Icon name="heart" /><span><b className="tnum">{s.likePending}</b> para decidir no Like</span><Icon name="arrowRight" size="sm" />
        </button>
      </div>
      <div className="stat-row">
        <StatTile label="Campanhas em andamento" value={running.length} icon="megaphone" tone="var(--env-360)" />
        <StatTile label="Tarefas em aberto" value={open.length} icon="checks" tone="var(--env-workspace)" />
        <StatTile label="Atrasadas" value={open.filter((t) => t.due_date && t.due_date < todayISO).length} icon="alert" tone="var(--danger)" />
        <StatTile label="Com o cliente" value={open.filter((t) => t.owner_scope === "cliente").length} icon="user" tone="var(--review)" />
        <StatTile label="Solicitações abertas" value={reqs.length} icon="inbox" tone="var(--warn-fill)" />
      </div>
      <div className="grid-2">
        <Panel title="Campanhas em andamento" icon="megaphone" count={running.length} tone="var(--env-360)" action={<button type="button" className="e-link" onClick={() => go("campanhas")}>Ver todas</button>}>
          {running.length ? <div className="now-list">{running.map((c) => <CampaignRow key={c.id} c={c} slug={s.brand.slug} />)}</div> : <EmptyState compact icon="megaphone" title="Nenhuma campanha em andamento" />}
        </Panel>
        <Panel title="Próximas datas" icon="calendar" count={upcoming.length} tone="var(--env-workspace)">
          {upcoming.length ? <div className="now-list">{upcoming.map((u, i) => <div key={i} className="ops-row" style={{ cursor: "default" }}><span className="date-chip tnum">{ddmm(u.d)}</span><span className="e-grow e-ellipsis">{u.t}</span><Badge tone="glass">{u.k}</Badge></div>)}</div> : <EmptyState compact icon="calendar" title="Nada nos próximos dias" />}
        </Panel>
        <Panel title="Tarefas do cliente" icon="user" count={open.filter((t) => t.owner_scope === "cliente").length} tone="var(--review)" action={<button type="button" className="e-link" onClick={() => go("tarefas", "cliente")}>Abrir</button>}>
          {open.filter((t) => t.owner_scope === "cliente").slice(0, 5).map((t) => <div key={t.id} className="ops-row" style={{ cursor: "default" }}><span className="e-grow e-ellipsis">{t.title}</span><span className={`team-due tnum${t.due_date && t.due_date < todayISO ? " late" : ""}`}>{ddmm(t.due_date)}</span></div>)}
          {open.filter((t) => t.owner_scope === "cliente").length === 0 && <EmptyState compact icon="checkCircle" title="Nada pendente com o cliente" />}
        </Panel>
        <Panel title="Solicitações abertas" icon="inbox" count={reqs.length} tone="var(--warn-fill)" action={<button type="button" className="e-link" onClick={() => go("solicitacoes")}>Abrir</button>}>
          {reqs.slice(0, 5).map((r) => <div key={r.id} className="ops-row" style={{ cursor: "default" }}><span className="e-grow e-ellipsis">{r.title}</span><Badge tone={REQ_TONE[r.status] ?? "todo"}>{label(SOLICITACAO_STATUSES, r.status)}</Badge></div>)}
          {reqs.length === 0 && <EmptyState compact icon="inbox" title="Nenhuma solicitação aberta" />}
        </Panel>
      </div>
    </div>
  );
}

function CampaignRow({ c, slug }: { c: Space["campaigns"][number]; slug: string }) {
  const idx = CAMPAIGN_STAGES.findIndex((x) => x.key === c.stage);
  return (
    <Link to="/e360/$brandSlug/campanha/$campaignId" params={{ brandSlug: slug, campaignId: c.id }} search={{ tab: undefined, filtro: undefined } as never} className="ops-row">
      <span className="e-grow" style={{ minWidth: 0 }}>
        <b className="e-ellipsis" style={{ display: "block" }}>{c.title}</b>
        <span className="stage-dots" aria-label={`Etapa ${idx + 1} de ${CAMPAIGN_STAGES.length}: ${label(CAMPAIGN_STAGES, c.stage)}`}>{CAMPAIGN_STAGES.map((st, i) => <i key={st.key} className={i < idx ? "done" : i === idx ? "now" : ""} />)}<small>{label(CAMPAIGN_STAGES, c.stage)}</small></span>
      </span>
      <span className="e-caption tnum">{ddmm(c.start_date)}–{ddmm(c.end_date)}</span>
      <Icon name="chevRight" size="sm" />
    </Link>
  );
}

// ----- Estratégias --------------------------------------------------------------------

function Strategies({ s, onChanged }: { s: Space; onChanged: () => void }) {
  const [obj, setObj] = useState("");
  const [edit, setEdit] = useState<{ id: string | null; title: string; description: string; priority: string; status: string; objective_id: string } | null>(null);
  const list = s.initiatives.filter((i) => !obj || i.objective_id === obj);
  return (
    <div className="stack">
      <div className="e-row between wrap" style={{ gap: 8 }}>
        <div style={{ width: 280 }}><Select value={obj} onChange={setObj} options={[{ value: "", label: "Todos os objetivos" }, ...s.objectives.map((o) => ({ value: o.id, label: o.title }))]} icon="target" /></div>
        {s.canEdit && s.isTeam && <Button icon="plus" onClick={() => setEdit({ id: null, title: "", description: "", priority: "curto_prazo", status: "em_andamento", objective_id: obj })}>Nova estratégia</Button>}
      </div>
      {list.map((i) => {
        const tasks = s.tasks.filter((t) => t.initiative_id === i.id && t.is_required);
        const pct = tasks.length ? Math.round((tasks.filter((t) => t.status === "concluida").length / tasks.length) * 100) : 0;
        return (
          <article key={i.id} className="ini-card e-glass">
            <ProgressRing value={pct} size={48} label="" />
            <div className="e-grow" style={{ minWidth: 0 }}>
              <div className="e-row wrap" style={{ gap: 6 }}><b>{i.title}</b><Badge tone={i.status === "concluida" ? "done" : i.status === "nao_concluida" ? "late" : "doing"}>{label(INITIATIVE_STATUSES, i.status)}</Badge><Badge tone="glass">{label(HORIZONS, i.priority)}</Badge></div>
              {i.description && <p className="e-small" style={{ margin: "4px 0 0" }}>{i.description}</p>}
              <span className="e-caption">{s.objectives.find((o) => o.id === i.objective_id)?.title ?? "Sem objetivo"} · {tasks.length} tarefas obrigatórias · {s.campaigns.filter((c) => c.initiative_id === i.id).length} campanhas</span>
            </div>
            {s.canEdit && s.isTeam && <Button size="sm" variant="ghost" icon="edit" aria-label={`Editar ${i.title}`} onClick={() => setEdit({ id: i.id, title: i.title, description: i.description ?? "", priority: i.priority, status: i.status, objective_id: i.objective_id ?? "" })} />}
          </article>
        );
      })}
      {list.length === 0 && <div className="e-glass" style={{ borderRadius: "var(--r-xl)" }}><EmptyState compact icon="compass" title="Nenhuma estratégia" /></div>}
      <Modal open={!!edit} onClose={() => setEdit(null)} icon="compass" title={edit?.id ? "Editar estratégia" : "Nova estratégia"}
        footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancelar</Button><Button disabled={!edit?.title.trim()} onClick={async () => { if (!edit) return; await saveInitiativeS(s.brand.slug, s.brand.id, edit.id, { title: edit.title.trim(), description: edit.description || null, priority: edit.priority, status: edit.status, objective_id: edit.objective_id || null }); toast.success("Estratégia salva"); setEdit(null); onChanged(); }}>Salvar</Button></>}>
        {edit && <div className="e-stack" style={{ gap: 10 }}>
          <Field label="Estratégia" autoFocus value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
          <TextArea label="Descrição" optional rows={2} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
          <div className="grid-2" style={{ gap: 10 }}>
            <Select label="Horizonte" value={edit.priority} onChange={(v) => setEdit({ ...edit, priority: v })} options={HORIZONS.map((h) => ({ value: h.key, label: h.label }))} />
            <Select label="Status" value={edit.status} onChange={(v) => setEdit({ ...edit, status: v })} options={INITIATIVE_STATUSES.map((h) => ({ value: h.key, label: h.label }))} />
          </div>
          <Select label="Objetivo" value={edit.objective_id} placeholder="Nenhum" onChange={(v) => setEdit({ ...edit, objective_id: v })} options={[{ value: "", label: "Nenhum" }, ...s.objectives.map((o) => ({ value: o.id, label: o.title }))]} />
        </div>}
      </Modal>
    </div>
  );
}

// ----- Campanhas ------------------------------------------------------------------------

function Campaigns({ s, onChanged }: { s: Space; onChanged: () => void }) {
  const [edit, setEdit] = useState<{ title: string; initiative_id: string; start_date: string; end_date: string; description: string } | null>(null);
  return (
    <div className="stack">
      {s.canEdit && s.isTeam && <div><Button icon="plus" onClick={() => setEdit({ title: "", initiative_id: "", start_date: "", end_date: "", description: "" })}>Nova campanha</Button></div>}
      <div className="camp-grid">
        {s.campaigns.map((c) => {
          const idx = CAMPAIGN_STAGES.findIndex((x) => x.key === c.stage);
          return (
            <Link key={c.id} to="/e360/$brandSlug/campanha/$campaignId" params={{ brandSlug: s.brand.slug, campaignId: c.id }} search={{ tab: undefined, filtro: undefined } as never} className="camp-card e-glass">
              <div className="e-row between" style={{ gap: 8 }}><Badge tone={c.status === "em_andamento" ? "doing" : c.status === "concluida" ? "done" : "todo"}>{label(CAMPAIGN_STAGES, c.stage)}</Badge><span className="e-caption tnum">{idx + 1}/{CAMPAIGN_STAGES.length}</span></div>
              <b>{c.title}</b>
              {c.description && <span className="e-small idea-desc">{c.description}</span>}
              <span className="stage-dots">{CAMPAIGN_STAGES.map((st, i) => <i key={st.key} className={i < idx ? "done" : i === idx ? "now" : ""} />)}</span>
              <span className="e-caption tnum">{ddmm(c.start_date)} – {ddmm(c.end_date)}{c.responsible ? ` · ${c.responsible}` : ""}</span>
            </Link>
          );
        })}
      </div>
      {s.campaigns.length === 0 && <div className="e-glass" style={{ borderRadius: "var(--r-xl)" }}><EmptyState compact icon="megaphone" title="Nenhuma campanha" /></div>}
      <Modal open={!!edit} onClose={() => setEdit(null)} icon="megaphone" title="Nova campanha"
        footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancelar</Button><Button disabled={!edit?.title.trim()} onClick={async () => { if (!edit) return; await createCampaignS(s.brand.slug, s.brand.id, { title: edit.title.trim(), initiative_id: edit.initiative_id || null, start_date: edit.start_date || null, end_date: edit.end_date || null, description: edit.description || null }); toast.success("Campanha criada", { description: "Começa em Planejamento." }); setEdit(null); onChanged(); }}>Criar</Button></>}>
        {edit && <div className="e-stack" style={{ gap: 10 }}>
          <Field label="Campanha" autoFocus value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
          <Select label="Estratégia" value={edit.initiative_id} placeholder="Nenhuma" onChange={(v) => setEdit({ ...edit, initiative_id: v })} options={[{ value: "", label: "Nenhuma" }, ...s.initiatives.map((i) => ({ value: i.id, label: i.title }))]} />
          <div className="grid-2" style={{ gap: 10 }}>
            <Field label="Início" type="date" optional value={edit.start_date} onChange={(e) => setEdit({ ...edit, start_date: e.target.value })} />
            <Field label="Fim" type="date" optional value={edit.end_date} onChange={(e) => setEdit({ ...edit, end_date: e.target.value })} />
          </div>
          <TextArea label="Descrição" optional rows={2} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
        </div>}
      </Modal>
    </div>
  );
}

// ----- Tarefas --------------------------------------------------------------------------

const NEXT: Record<string, string> = { a_fazer: "em_andamento", em_andamento: "concluida" };
function Tasks({ s, filtro, onChanged }: { s: Space; filtro?: string; onChanged: () => void }) {
  const [f, setF] = useState<"todas" | "pendentes" | "atrasadas">(filtro === "atrasadas" ? "atrasadas" : filtro === "todas" ? "todas" : "pendentes");
  const [scope, setScope] = useState<string>(filtro === "cliente" ? "cliente" : "");
  const [adding, setAdding] = useState(false);
  const todayISO = toISO(today());
  const list = s.tasks.filter((t) => (f === "todas" || t.status !== "concluida") && (f !== "atrasadas" || (t.due_date && t.due_date < todayISO && t.status !== "concluida")) && (!scope || t.owner_scope === scope))
    .sort((a, b) => (a.due_date ?? "9").localeCompare(b.due_date ?? "9"));
  const canAdvance = (t: STask) => s.canEdit && (s.isTeam || t.owner_scope !== "agencia");
  return (
    <div className="stack">
      <div className="e-row between wrap" style={{ gap: 8 }}>
        <div className="e-row wrap" style={{ gap: 6 }}>
          {(["pendentes", "atrasadas", "todas"] as const).map((x) => <Chip key={x} pressed={f === x} onClick={() => setF(x)}>{x === "pendentes" ? "Pendentes" : x === "atrasadas" ? "Atrasadas" : "Todas"}</Chip>)}
          <span className="team-sep" />
          <Chip pressed={!scope} onClick={() => setScope("")}>Todos os escopos</Chip>
          {TASK_SCOPES.map((x) => <Chip key={x.key} pressed={scope === x.key} onClick={() => setScope(scope === x.key ? "" : x.key)}>{x.label}</Chip>)}
        </div>
        {s.canEdit && <Button icon="plus" onClick={() => setAdding(true)}>Nova tarefa</Button>}
      </div>
      {list.length === 0 ? <div className="e-glass" style={{ borderRadius: "var(--r-xl)" }}><EmptyState compact icon="checkCircle" title="Nenhuma tarefa com esse filtro" /></div> : (
        <div className="now-list">
          {list.map((t) => {
            const late = t.due_date && t.due_date < todayISO && t.status !== "concluida";
            const req = s.requests.find((r) => r.task_id === t.id);
            return (
              <div key={t.id} className={`ops-row${t.status === "concluida" ? " is-done" : ""}`} style={{ cursor: "default" }}>
                <Badge tone={TASK_TONE[t.status]} dot>{label(TASK_STATUSES, t.status)}</Badge>
                <span className="e-grow" style={{ minWidth: 0 }}>
                  <b className="e-ellipsis" style={{ display: "block" }}>{t.title}{t.is_required && <span className="req-mark" title="Obrigatória para concluir a campanha">•</span>}</b>
                  <span className="e-caption e-ellipsis" style={{ display: "block" }}>{label(TASK_SCOPES, t.owner_scope)}{t.campaign_id ? ` · ${s.campaigns.find((c) => c.id === t.campaign_id)?.title ?? ""}` : ""}{req ? " · veio de uma solicitação" : ""}</span>
                </span>
                <span className={`team-due tnum${late ? " late" : ""}`}>{ddmm(t.due_date)}</span>
                {NEXT[t.status] && canAdvance(t) && <Button size="sm" variant="secondary" onClick={async () => { await saveTaskS(s.brand.slug, s.brand.id, t.id, { status: NEXT[t.status] }); toast.success(NEXT[t.status] === "concluida" ? "Tarefa concluída" : "Tarefa em andamento", { description: NEXT[t.status] === "concluida" ? "Registrada nas entregas." : undefined }); onChanged(); }}>{t.status === "a_fazer" ? "Começar" : "Concluir"}</Button>}
                {s.isTeam && s.canEdit && t.status !== "concluida" && <Button size="sm" variant="ghost" onClick={() => toast.success("Enviada para execução", { description: "A tarefa entra na triagem do Workspace." })}>🚀</Button>}
              </div>
            );
          })}
        </div>
      )}
      <NewTask open={adding} s={s} onClose={() => setAdding(false)} onDone={onChanged} />
    </div>
  );
}

function NewTask({ open, s, onClose, onDone }: { open: boolean; s: Space; onClose: () => void; onDone: () => void }) {
  const [d, setD] = useState({ title: "", owner_scope: "agencia", due_date: "", campaign_id: "", is_required: false });
  useEffect(() => { if (open) setD({ title: "", owner_scope: s.isTeam ? "agencia" : "cliente", due_date: "", campaign_id: "", is_required: false }); }, [open]);
  return (
    <Modal open={open} onClose={onClose} icon="checks" title="Nova tarefa"
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button disabled={!d.title.trim()} onClick={async () => { await saveTaskS(s.brand.slug, s.brand.id, null, { title: d.title.trim(), owner_scope: d.owner_scope, due_date: d.due_date || null, campaign_id: d.campaign_id || null, is_required: d.is_required }); toast.success("Tarefa criada"); onDone(); onClose(); }}>Criar</Button></>}>
      <div className="e-stack" style={{ gap: 10 }}>
        <Field label="Tarefa" autoFocus value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
        <div className="grid-2" style={{ gap: 10 }}>
          <Select label="Quem faz" value={d.owner_scope} onChange={(v) => setD({ ...d, owner_scope: v })} options={TASK_SCOPES.map((x) => ({ value: x.key, label: x.label }))} />
          <Field label="Prazo" type="date" optional value={d.due_date} onChange={(e) => setD({ ...d, due_date: e.target.value })} />
        </div>
        <Select label="Campanha" value={d.campaign_id} placeholder="Nenhuma" onChange={(v) => setD({ ...d, campaign_id: v })} options={[{ value: "", label: "Nenhuma" }, ...s.campaigns.map((c) => ({ value: c.id, label: c.title }))]} />
        {d.campaign_id && <Switch checked={d.is_required} onChange={(v) => setD({ ...d, is_required: v })} label="Obrigatória para concluir a campanha" />}
      </div>
    </Modal>
  );
}

// ----- Solicitações ---------------------------------------------------------------------

function Requests({ s, onChanged }: { s: Space; onChanged: () => void }) {
  const [composing, setComposing] = useState(false);
  const deliveryOf = (r: SRequest) => s.deliveries.find((d) => d.task_id && d.task_id === r.task_id);
  const taskOf = (r: SRequest) => s.tasks.find((t) => t.id === r.task_id);
  return (
    <div className="stack">
      <div className="e-row between wrap" style={{ gap: 8 }}>
        <p className="e-small" style={{ margin: 0 }}>Cada solicitação vira uma tarefa e, quando concluída, uma entrega.</p>
        <Button icon="send" onClick={() => setComposing(true)}>{s.isTeam ? "Nova solicitação" : "Enviar para a Reach"}</Button>
      </div>
      {s.requests.length === 0 && <div className="e-glass" style={{ borderRadius: "var(--r-xl)" }}><EmptyState compact icon="inbox" title="Nenhuma solicitação" text="Peça conteúdos, ajustes ou novas ideias por aqui." /></div>}
      {s.requests.map((r) => {
        const t = taskOf(r);
        const d = deliveryOf(r);
        return (
          <article key={r.id} className="req-card e-glass">
            <div className="e-row between wrap" style={{ gap: 8 }}>
              <span style={{ minWidth: 0 }}><b>{r.title}</b><span className="e-caption" style={{ display: "block" }}>{r.tipo ?? "Solicitação"} · enviada {relDay(r.created_at.slice(0, 10)).toLowerCase()}{r.due_date ? ` · prazo ${ddmm(r.due_date)}` : ""}</span></span>
              <span className="e-row" style={{ gap: 6 }}>
                <Badge tone={REQ_TONE[r.status] ?? "todo"} dot>{r.status === "rascunho" ? "Rascunho" : label(SOLICITACAO_STATUSES, r.status)}</Badge>
                {r.status === "rascunho" && <Button size="sm" icon="send" onClick={async () => { await sendDraft(s.brand.slug, r.id); toast.success("Solicitação enviada"); onChanged(); }}>Enviar</Button>}
                {s.isTeam && s.canEdit && r.status !== "rascunho" && <Menu align="right" trigger={({ toggle }) => <Button size="sm" variant="secondary" onClick={toggle}>Triagem</Button>} items={[
                  { label: "Aprovar", icon: "check", onSelect: async () => { await setRequestStatus(s.brand.slug, r.id, "aprovada"); onChanged(); } },
                  { label: "Pôr em execução", icon: "zap", onSelect: async () => { await setRequestStatus(s.brand.slug, r.id, "em_execucao"); onChanged(); } },
                  { label: "Aguardar cliente", icon: "clock", onSelect: async () => { await setRequestStatus(s.brand.slug, r.id, "aguardando_cliente"); onChanged(); } },
                  "-",
                  { label: "Cancelar", icon: "x", danger: true, onSelect: async () => { await setRequestStatus(s.brand.slug, r.id, "cancelada"); onChanged(); } },
                ]} />}
              </span>
            </div>
            {r.description && <p className="e-small" style={{ margin: 0 }}>{r.description}</p>}
            {r.status !== "rascunho" && (
              <ol className="req-path" aria-label="Caminho da solicitação">
                <li className="done"><i /><b>Solicitação</b><small>{label(SOLICITACAO_STATUSES, r.status)}</small></li>
                <li className={t ? (t.status === "concluida" ? "done" : "now") : ""}><i /><b>Tarefa</b><small>{t ? label(TASK_STATUSES, t.status) : "aguardando"}</small></li>
                <li className={d ? "done" : ""}><i /><b>Entrega</b><small>{d ? `entregue ${ddmm(d.delivered_at)}` : "ainda não"}</small></li>
              </ol>
            )}
          </article>
        );
      })}
      <Composer open={composing} s={s} onClose={() => setComposing(false)} onDone={onChanged} />
    </div>
  );
}

function Composer({ open, s, onClose, onDone }: { open: boolean; s: Space; onClose: () => void; onDone: () => void }) {
  const empty = { title: "", tipo: "Conteúdo", description: "", campaign_id: "", initiative_id: "", due_date: "", priority: "media", attachments: "" };
  const [d, setD] = useState(empty);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (open) { setD(empty); setErr(null); } }, [open]);
  const submit = async (draft: boolean) => {
    if (!d.title.trim()) { setErr("Dê um título à solicitação."); return; }
    await createRequest(s.brand.slug, s.brand.id, { title: d.title.trim(), tipo: d.tipo, description: d.description || null, campaign_id: d.campaign_id || null, initiative_id: d.initiative_id || null, due_date: d.due_date || null, priority: d.priority, attachments: d.attachments.split("\n").filter(Boolean), draft });
    toast.success(draft ? "Rascunho salvo" : "Solicitação enviada", { description: draft ? undefined : "A tarefa foi criada para a equipe." });
    onDone(); onClose();
  };
  return (
    <Drawer open={open} onClose={onClose} eyebrow={s.brand.name} title={s.isTeam ? "Nova solicitação" : "Enviar para a Reach"}
      footer={<><Button variant="ghost" onClick={() => submit(true)}>Salvar rascunho</Button><span style={{ flex: 1 }} /><Button icon="send" onClick={() => submit(false)}>Enviar</Button></>}>
      <Field label="O que você precisa?" autoFocus value={d.title} error={err ?? undefined} placeholder="Ex.: Post sobre o evento de sábado" onChange={(e) => { setD({ ...d, title: e.target.value }); setErr(null); }} />
      <div className="grid-2" style={{ gap: 12 }}>
        <Select label="Tipo" value={d.tipo} onChange={(v) => setD({ ...d, tipo: v })} options={["Conteúdo", "Campanha", "Ajuste", "Material impresso", "Dúvida", "Outro"].map((x) => ({ value: x, label: x }))} />
        <Select label="Prioridade" value={d.priority} onChange={(v) => setD({ ...d, priority: v })} options={[{ value: "baixa", label: "Baixa" }, { value: "media", label: "Média" }, { value: "alta", label: "Alta" }]} />
        <Select label="Campanha" value={d.campaign_id} placeholder="Nenhuma" onChange={(v) => setD({ ...d, campaign_id: v })} options={[{ value: "", label: "Nenhuma" }, ...s.campaigns.map((c) => ({ value: c.id, label: c.title }))]} />
        <Select label="Estratégia" value={d.initiative_id} placeholder="Nenhuma" onChange={(v) => setD({ ...d, initiative_id: v })} options={[{ value: "", label: "Nenhuma" }, ...s.initiatives.map((i) => ({ value: i.id, label: i.title }))]} />
        <Field label="Prazo desejado" type="date" optional value={d.due_date} onChange={(e) => setD({ ...d, due_date: e.target.value })} />
      </div>
      <TextArea label="Detalhes" optional rows={5} max={2000} value={d.description} placeholder="Contexto, referências, onde será publicado…" onChange={(e) => setD({ ...d, description: e.target.value })} />
      <TextArea label="Links e anexos" optional rows={2} help="Um link por linha." value={d.attachments} onChange={(e) => setD({ ...d, attachments: e.target.value })} />
    </Drawer>
  );
}

// ----- Entregas ------------------------------------------------------------------------

function Deliveries({ s }: { s: Space }) {
  const list = [...s.deliveries].sort((a, b) => (b.delivered_at ?? "").localeCompare(a.delivered_at ?? ""));
  if (list.length === 0) return <div className="e-glass" style={{ borderRadius: "var(--r-xl)" }}><EmptyState compact icon="checkCircle" title="Nenhuma entrega ainda" text="O que for concluído aparece aqui, com a origem." /></div>;
  return (
    <div className="now-list">
      {list.map((d) => {
        const req = s.requests.find((r) => r.task_id && r.task_id === d.task_id);
        const camp = s.campaigns.find((c) => c.id === d.campaign_id);
        return (
          <div key={d.id} className="ops-row" style={{ cursor: "default" }}>
            <span className="date-chip tnum">{ddmm(d.delivered_at)}</span>
            <span className="e-grow" style={{ minWidth: 0 }}><b className="e-ellipsis" style={{ display: "block" }}>{d.title}</b><span className="e-caption">{req ? `Solicitação: ${req.title}` : camp ? `Campanha: ${camp.title}` : "Rotina"}{d.delivery_type ? ` · ${d.delivery_type}` : ""}</span></span>
            {d.like && <Badge tone="approved" icon="heart">Aprovado no Like</Badge>}
            {d.file_url && <a className="e-btn ghost sm" href={d.file_url} target="_blank" rel="noreferrer"><Icon name="external" size="sm" /> Material</a>}
          </div>
        );
      })}
    </div>
  );
}

// ----- Reuniões -------------------------------------------------------------------------

function Meetings({ s, onChanged }: { s: Space; onChanged: () => void }) {
  const [creating, setCreating] = useState(false);
  const [d, setD] = useState({ title: "", date: "", notes: "", participants: "" });
  const [task, setTask] = useState<Record<string, { description: string; assignee: string; due: string }>>({});
  return (
    <div className="stack">
      {s.canEdit && <div><Button icon="plus" onClick={() => { setD({ title: "", date: toISO(today()), notes: "", participants: "" }); setCreating(true); }}>Registrar reunião</Button></div>}
      {s.meetings.length === 0 && <div className="e-glass" style={{ borderRadius: "var(--r-xl)" }}><EmptyState compact icon="users" title="Nenhuma reunião registrada" /></div>}
      {s.meetings.map((m) => {
        const nt = task[m.id] ?? { description: "", assignee: "", due: "" };
        return (
          <article key={m.id} className="req-card e-glass">
            <div className="e-row between wrap" style={{ gap: 8 }}>
              <span><b>{m.title}</b><span className="e-caption" style={{ display: "block" }}>{new Date(`${m.meeting_date.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</span></span>
              <span className="e-avs">{m.participants.map((p) => <Avatar key={p} name={p} size="xs" />)}</span>
            </div>
            {m.notes && <p className="e-small" style={{ margin: 0 }}>{m.notes}</p>}
            <div className="e-stack" style={{ gap: 4 }}>
              <span className="e-label">Tarefas da reunião</span>
              {m.tasks.map((t) => (
                <div key={t.id} className={`ops-row${t.status === "concluida" ? " is-done" : ""}`} style={{ cursor: "default" }}>
                  <input type="checkbox" checked={t.status === "concluida"} disabled={!s.canEdit} aria-label={`Concluir ${t.description}`} onChange={async (e) => { await setMeetingTaskStatus(s.brand.slug, m.id, t.id, e.target.checked ? "concluida" : "a_fazer"); onChanged(); }} />
                  <span className="e-grow e-ellipsis">{t.description}</span>
                  {t.assignee && <span className="e-caption">{t.assignee}</span>}
                  <span className="team-due tnum">{ddmm(t.due_date)}</span>
                  {s.isTeam && t.status !== "concluida" && <Button size="sm" variant="ghost" onClick={() => toast.success("Enviada ao Workspace", { description: t.description })}>🚀</Button>}
                </div>
              ))}
              {s.canEdit && <form className="e-row wrap" style={{ gap: 6 }} onSubmit={async (e) => { e.preventDefault(); if (!nt.description.trim()) return; await addMeetingTask(s.brand.slug, s.brand.id, m.id, { description: nt.description.trim(), assignee: nt.assignee || null, due_date: nt.due || null }); setTask({ ...task, [m.id]: { description: "", assignee: "", due: "" } }); onChanged(); }}>
                <input className="e-input sm e-grow" placeholder="Nova tarefa da reunião" value={nt.description} aria-label="Nova tarefa da reunião" onChange={(e) => setTask({ ...task, [m.id]: { ...nt, description: e.target.value } })} />
                <input className="e-input sm" style={{ width: 150 }} placeholder="Responsável" value={nt.assignee} aria-label="Responsável" onChange={(e) => setTask({ ...task, [m.id]: { ...nt, assignee: e.target.value } })} />
                <input className="e-input sm" type="date" style={{ width: 150 }} value={nt.due} aria-label="Prazo" onChange={(e) => setTask({ ...task, [m.id]: { ...nt, due: e.target.value } })} />
                <Button size="sm" variant="secondary" icon="plus" type="submit" disabled={!nt.description.trim()}>Adicionar</Button>
              </form>}
            </div>
          </article>
        );
      })}
      <Modal open={creating} onClose={() => setCreating(false)} icon="users" title="Registrar reunião"
        footer={<><Button variant="secondary" onClick={() => setCreating(false)}>Cancelar</Button><Button disabled={!d.title.trim() || !d.date} onClick={async () => { await createMeetingS(s.brand.slug, s.brand.id, { title: d.title.trim(), meeting_date: d.date, notes: d.notes || null, participants: d.participants.split(",").map((x) => x.trim()).filter(Boolean) }); toast.success("Reunião registrada"); setCreating(false); onChanged(); }}>Registrar</Button></>}>
        <div className="e-stack" style={{ gap: 10 }}>
          <Field label="Assunto" autoFocus value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
          <Field label="Data" type="date" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} />
          <Field label="Participantes" optional help="Separe por vírgula." value={d.participants} onChange={(e) => setD({ ...d, participants: e.target.value })} />
          <TextArea label="Notas" optional rows={3} value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}

// ----- Notas ----------------------------------------------------------------------------

function Notes({ s, onChanged }: { s: Space; onChanged: () => void }) {
  const [kind, setKind] = useState("");
  const [edit, setEdit] = useState<{ id: string | null; title: string; content: string; kind: string; note_date: string; pinned: boolean } | null>(null);
  const list = s.notes.filter((n) => !kind || n.kind === kind).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.created_at.localeCompare(a.created_at));
  const kinds = NOTE_KINDS.filter((k) => s.isTeam || k.key !== INTERNAL_NOTE_KIND);
  return (
    <div className="stack">
      <div className="e-row between wrap" style={{ gap: 8 }}>
        <div className="e-row wrap" style={{ gap: 6 }}><Chip pressed={!kind} onClick={() => setKind("")}>Todas</Chip>{kinds.map((k) => <Chip key={k.key} pressed={kind === k.key} onClick={() => setKind(kind === k.key ? "" : k.key)}>{k.label}</Chip>)}</div>
        {s.canEdit && <Button icon="plus" onClick={() => setEdit({ id: null, title: "", content: "", kind: s.isTeam ? "nota" : "lembrete", note_date: "", pinned: false })}>Nova</Button>}
      </div>
      {s.isTeam && <p className="e-caption" style={{ margin: 0 }}><Icon name="lock" size="sm" /> Notas são internas da equipe. Lembretes, avisos e datas também aparecem para o cliente.</p>}
      <div className="note-grid">
        {list.map((n) => (
          <article key={n.id} className={`note-card e-glass ${n.kind}`}>
            <div className="e-row between" style={{ gap: 6 }}>
              <Badge tone="glass">{label(NOTE_KINDS, n.kind)}{n.kind === INTERNAL_NOTE_KIND ? " · interna" : ""}</Badge>
              <span className="e-row" style={{ gap: 2 }}>
                {s.canEdit && <Button size="sm" variant="ghost" icon="pin" aria-label={n.pinned ? "Desafixar" : "Fixar"} className={n.pinned ? "pinned" : ""} onClick={async () => { await saveNote(s.brand.slug, s.brand.id, n.id, { pinned: !n.pinned }); onChanged(); }} />}
                {s.canEdit && <Menu align="right" trigger={({ toggle }) => <Button size="sm" variant="ghost" icon="more" aria-label="Ações" onClick={toggle} />} items={[{ label: "Editar", icon: "edit", onSelect: () => setEdit({ id: n.id, title: n.title, content: n.content ?? "", kind: n.kind, note_date: n.note_date ?? "", pinned: n.pinned }) }, { label: "Excluir", icon: "trash", danger: true, onSelect: async () => { await removeNote(s.brand.slug, n.id); toast.success("Excluída"); onChanged(); } }]} />}
              </span>
            </div>
            <b>{n.pinned && <Icon name="pin" size="sm" />} {n.title}</b>
            {n.content && <p className="e-small" style={{ margin: 0 }}>{n.content}</p>}
            {n.note_date && <span className="e-caption tnum"><Icon name="calendar" size="sm" /> {ddmm(n.note_date)}</span>}
          </article>
        ))}
      </div>
      {list.length === 0 && <div className="e-glass" style={{ borderRadius: "var(--r-xl)" }}><EmptyState compact icon="pin" title="Nada por aqui" /></div>}
      <Modal open={!!edit} onClose={() => setEdit(null)} icon="pin" title={edit?.id ? "Editar" : "Nova nota"}
        footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancelar</Button><Button disabled={!edit?.title.trim()} onClick={async () => { if (!edit) return; await saveNote(s.brand.slug, s.brand.id, edit.id, { title: edit.title.trim(), content: edit.content || null, kind: edit.kind, note_date: edit.note_date || null, pinned: edit.pinned }); toast.success("Salvo"); setEdit(null); onChanged(); }}>Salvar</Button></>}>
        {edit && <div className="e-stack" style={{ gap: 10 }}>
          <Select label="Tipo" value={edit.kind} onChange={(v) => setEdit({ ...edit, kind: v })} options={kinds.map((k) => ({ value: k.key, label: k.label }))} />
          <Field label="Título" autoFocus value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
          <TextArea label="Texto" optional rows={3} value={edit.content} onChange={(e) => setEdit({ ...edit, content: e.target.value })} />
          <Field label="Data" type="date" optional value={edit.note_date} onChange={(e) => setEdit({ ...edit, note_date: e.target.value })} />
          <Switch checked={edit.pinned} onChange={(v) => setEdit({ ...edit, pinned: v })} label="Fixar no topo" />
        </div>}
      </Modal>
    </div>
  );
}

// ----- Revisões mensais ------------------------------------------------------------------

function Monthly({ s, onChanged }: { s: Space; onChanged: () => void }) {
  const month = toISO(today()).slice(0, 7);
  const [edit, setEdit] = useState<{ month_ref: string; resultados_internos: string; insights: string; ponto_atencao: string; decisoes_tomadas: string } | null>(null);
  const fmt = (m: string) => { const x = new Date(`${m}-01T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); return x[0].toUpperCase() + x.slice(1); };
  return (
    <div className="stack">
      {s.canEdit && <div><Button icon="plus" onClick={() => { const ex = s.monthly.find((m) => m.month_ref === month); setEdit({ month_ref: month, resultados_internos: ex?.resultados_internos ?? "", insights: ex?.insights ?? "", ponto_atencao: ex?.ponto_atencao ?? "", decisoes_tomadas: ex?.decisoes_tomadas ?? "" }); }}>Registrar mês</Button></div>}
      {s.monthly.length === 0 && <div className="e-glass" style={{ borderRadius: "var(--r-xl)" }}><EmptyState compact icon="chart" title="Nenhuma revisão registrada" /></div>}
      {s.monthly.map((m) => (
        <article key={m.id} className="req-card e-glass">
          <div className="e-row between" style={{ gap: 8 }}><b>{fmt(m.month_ref)}</b>{s.canEdit && <Button size="sm" variant="ghost" icon="edit" aria-label="Editar" onClick={() => setEdit({ month_ref: m.month_ref, resultados_internos: m.resultados_internos ?? "", insights: m.insights ?? "", ponto_atencao: m.ponto_atencao ?? "", decisoes_tomadas: m.decisoes_tomadas ?? "" })} />}</div>
          <dl className="monthly-grid">
            {s.isTeam && <div><dt>Resultados internos</dt><dd>{m.resultados_internos || "—"}</dd></div>}
            <div><dt>Insights</dt><dd>{m.insights || "—"}</dd></div>
            <div><dt>Pontos de atenção</dt><dd>{m.ponto_atencao || "—"}</dd></div>
            <div><dt>Decisões tomadas</dt><dd>{m.decisoes_tomadas || "—"}</dd></div>
          </dl>
        </article>
      ))}
      <Modal open={!!edit} onClose={() => setEdit(null)} icon="chart" title={edit ? fmt(edit.month_ref) : ""}
        footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancelar</Button><Button onClick={async () => { if (!edit) return; await saveMonthly(s.brand.slug, s.brand.id, { month_ref: edit.month_ref, resultados_internos: edit.resultados_internos || null, insights: edit.insights || null, ponto_atencao: edit.ponto_atencao || null, decisoes_tomadas: edit.decisoes_tomadas || null }); toast.success("Mês registrado"); setEdit(null); onChanged(); }}>Salvar</Button></>}>
        {edit && <div className="e-stack" style={{ gap: 10 }}>
          <Field label="Mês" type="month" value={edit.month_ref} onChange={(e) => setEdit({ ...edit, month_ref: e.target.value })} />
          {s.isTeam && <TextArea label="Resultados internos" optional rows={2} value={edit.resultados_internos} onChange={(e) => setEdit({ ...edit, resultados_internos: e.target.value })} />}
          <TextArea label="Insights" optional rows={2} value={edit.insights} onChange={(e) => setEdit({ ...edit, insights: e.target.value })} />
          <TextArea label="Pontos de atenção" optional rows={2} value={edit.ponto_atencao} onChange={(e) => setEdit({ ...edit, ponto_atencao: e.target.value })} />
          <TextArea label="Decisões tomadas" optional rows={2} value={edit.decisoes_tomadas} onChange={(e) => setEdit({ ...edit, decisoes_tomadas: e.target.value })} />
        </div>}
      </Modal>
    </div>
  );
}

// ----- Canais ---------------------------------------------------------------------------

function Channels({ s, onChanged }: { s: Space; onChanged: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("Rede social");
  const TONE: Record<string, Tone> = { ativo: "done", em_teste: "review", planejado: "todo", pausado: "blocked" };
  return (
    <div className="stack">
      <div className="front-grid">
        {s.channels.map((c) => (
          <div key={c.id} className="front-card e-glass" style={{ cursor: "default" }}>
            <div className="e-row between" style={{ gap: 8 }}><b>{c.name}</b>
              {s.canEdit && s.isTeam ? <Menu align="right" trigger={({ toggle }) => <button type="button" className="status-trigger" onClick={toggle}><Badge tone={TONE[c.status]} dot>{label(CHANNEL_STATUSES, c.status)}</Badge><Icon name="chevDown" size="sm" /></button>} items={CHANNEL_STATUSES.map((x) => ({ label: x.label, icon: x.key === c.status ? ("check" as const) : undefined, onSelect: async () => { await saveChannelS(s.brand.slug, s.brand.id, c.id, { status: x.key }); onChanged(); } }))} /> : <Badge tone={TONE[c.status]} dot>{label(CHANNEL_STATUSES, c.status)}</Badge>}
            </div>
            <span className="e-caption">{c.channel_type ?? "Canal"}</span>
          </div>
        ))}
      </div>
      {s.canEdit && s.isTeam && <form className="e-row wrap" style={{ gap: 6 }} onSubmit={async (e) => { e.preventDefault(); if (!name.trim()) return; await saveChannelS(s.brand.slug, s.brand.id, null, { name: name.trim(), channel_type: type }); setName(""); toast.success("Canal adicionado"); onChanged(); }}>
        <input className="e-input sm e-grow" value={name} placeholder="Novo canal (ex.: YouTube)" aria-label="Nome do canal" onChange={(e) => setName(e.target.value)} />
        <div style={{ width: 180 }}><Select value={type} onChange={setType} options={["Rede social", "Site", "Mensagens", "Offline", "Outro"].map((x) => ({ value: x, label: x }))} /></div>
        <Button size="sm" variant="secondary" icon="plus" type="submit" disabled={!name.trim()}>Adicionar</Button>
      </form>}
    </div>
  );
}
