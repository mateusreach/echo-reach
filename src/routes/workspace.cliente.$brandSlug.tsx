import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Avatar, Badge, Button, ClientLogo, EmptyState, Skeleton, type Tone } from "@/components/echo/primitives";
import { Chip, Field, LineTabs, Menu, Select } from "@/components/echo/controls";
import { Drawer, Modal } from "@/components/echo/overlays";
import { Icon } from "@/components/echo/icon";
import { StatusMenu, TaskDrawer } from "@/components/echo/task-drawer";
import { CHANNEL_STATUSES } from "@/lib/reach-data";
import { RECURRENCES, RISK_LABELS, type FrontWithRisk, type RiskLevel } from "@/lib/workspace-data";
import { WORK_ORDER_KINDS } from "@/lib/work-orders";
import { isLateTask, type OpsTask } from "@/lib/ops-data";
import { listPickable } from "@/lib/team-data";
import { setClientContext } from "@/lib/ecosystem";
import { addTask, applyExecTemplate, createOrder, loadClientOps, previewTemplate, saveChannel, saveFront, saveOwners, type ClientOps, type FrontInput, type Order, type Owner } from "@/lib/client-ops-data";

type Tab = "entregas" | "frentes" | "responsaveis" | "avulsas";
export const Route = createFileRoute("/workspace/cliente/$brandSlug")({
  head: () => ({ meta: [{ title: "Operação do cliente · Workspace · Echo" }] }),
  component: ClientOpsPage,
  validateSearch: (s: Record<string, unknown>): { tab?: string } => (typeof s.tab === "string" ? { tab: s.tab } : {}),
});

const EXT_TONE: Record<string, Tone> = { Recebido: "todo", "Em execução": "doing", "Em aprovação": "review", "Concluído": "done" };
const RISK_TONE: Record<RiskLevel, Tone> = { red: "late", orange: "adjust", yellow: "review", green: "done" };
const RISK_COLOR: Record<RiskLevel, string> = { red: "var(--danger)", orange: "var(--warn)", yellow: "var(--review)", green: "var(--ok)" };
const ddmm = (d?: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "—");
const MODULE_LABEL: Record<string, string> = { biblioteca: "Biblioteca", plano: "Plano", workspace: "Workspace", espaco360: "Espaço 360", like: "Like" };

function ClientOpsPage() {
  const { brandSlug } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const [openTask, setOpenTask] = useState<string | null>(null);
  useEffect(() => { setReady(true); setClientContext(brandSlug); }, [brandSlug]);
  const q = useQuery({ queryKey: ["client-ops", brandSlug], queryFn: () => loadClientOps(brandSlug), enabled: ready });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["client-ops", brandSlug] }); qc.invalidateQueries({ queryKey: ["ops-tasks"] }); qc.invalidateQueries({ queryKey: ["ops-fronts"] }); };
  const tab: Tab = (["entregas", "frentes", "responsaveis", "avulsas"] as Tab[]).includes(search.tab as Tab) ? (search.tab as Tab) : "entregas";
  const setTab = (t: Tab) => navigate({ to: "/workspace/cliente/$brandSlug", params: { brandSlug }, search: { tab: t }, replace: true });

  if (!ready || q.isLoading) return <div className="stack-lg" aria-busy="true"><Skeleton h={130} r={24} /><Skeleton h={44} r={14} /><Skeleton h={300} r={24} /></div>;
  if (q.isError) return <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState kind="error" title="Não foi possível carregar a operação" actions={<Button variant="secondary" icon="refresh" onClick={() => q.refetch()}>Tentar novamente</Button>} /></div>;
  if (!q.data) return <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState kind="search" title="Cliente não encontrado" actions={<Link to="/clientes" className="e-btn secondary">Ver clientes</Link>} /></div>;
  const d = q.data;
  const allTasks = [...d.orders.flatMap((o) => o.tasks), ...d.loose];
  const task = allTasks.find((t) => t.id === openTask) ?? null;
  const openOrders = d.orders.filter((o) => o.external !== "Concluído" || o.tasks.length === 0);

  return (
    <div className="stack-lg">
      <section className="ops-head e-glass">
        <ClientLogo name={d.brand.name} logoUrl={d.brand.logoUrl} size="lg" />
        <div className="e-grow" style={{ minWidth: 0 }}>
          <h1 className="e-h2" style={{ margin: 0 }}>{d.brand.name}</h1>
          <div className="e-row wrap" style={{ gap: 6, marginTop: 6 }}>
            {Object.entries(d.modules).filter(([, on]) => on).map(([k]) => <Badge key={k} tone="glass">{MODULE_LABEL[k] ?? k}</Badge>)}
          </div>
        </div>
        <div className="e-row wrap" style={{ gap: 6 }}>
          <Link to={`/b/${d.brand.slug}/biblioteca` as never} className="e-btn secondary sm"><Icon name="layers" size="sm" /> Consultar Brand</Link>
          <Link to={`/clientes/${d.brand.slug}` as never} className="e-btn ghost sm"><Icon name="briefcase" size="sm" /> Hub</Link>
        </div>
        <Channels d={d} onChanged={refresh} />
      </section>

      <div className="ops-kpis">
        <span><b className="tnum">{openOrders.length}</b>entregas abertas</span>
        <span><b className="tnum">{allTasks.filter((t) => t.status !== "Concluído").length}</b>tarefas abertas</span>
        <span><b className="tnum" style={{ color: allTasks.some(isLateTask) ? "var(--danger)" : undefined }}>{allTasks.filter(isLateTask).length}</b>atrasadas</span>
        <span><b className="tnum">{d.fronts.length}</b>frentes</span>
      </div>

      <LineTabs<Tab> value={tab} onChange={setTab} items={[
        { value: "entregas", label: `Entregas · ${d.orders.length}`, icon: "kanban" },
        { value: "frentes", label: `Frentes · ${d.fronts.length}`, icon: "feed" },
        { value: "responsaveis", label: "Responsáveis", icon: "users" },
        { value: "avulsas", label: `Tarefas avulsas · ${d.loose.length}`, icon: "inbox" },
      ]} />
      {tab === "entregas" && <Orders d={d} onOpenTask={setOpenTask} onChanged={refresh} />}
      {tab === "frentes" && <Fronts d={d} onChanged={refresh} />}
      {tab === "responsaveis" && <Owners d={d} onChanged={refresh} />}
      {tab === "avulsas" && <Loose d={d} onOpenTask={setOpenTask} onChanged={refresh} />}
      <TaskDrawer task={task} onClose={() => setOpenTask(null)} onChanged={refresh} />
    </div>
  );
}

// ----- Canais -------------------------------------------------------------------------

function Channels({ d, onChanged }: { d: ClientOps; onChanged: () => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  return (
    <div className="ops-channels">
      <span className="e-label">Canais</span>
      {d.channels.map((c) => (
        <Menu key={c.id} trigger={({ toggle }) => <button type="button" className={`chan-chip ${c.status}`} onClick={toggle}>{c.name}<small>{CHANNEL_STATUSES.find((s) => s.key === c.status)?.label ?? c.status}</small></button>} items={[
          { title: "Situação do canal" },
          ...CHANNEL_STATUSES.map((s) => ({ label: s.label, icon: s.key === c.status ? ("check" as const) : undefined, onSelect: async () => { await saveChannel(d, c.id, { status: s.key }); toast.success("Canal atualizado", { description: "Também muda no Espaço 360." }); onChanged(); } })),
        ]} />
      ))}
      {adding ? (
        <form className="e-row" style={{ gap: 4 }} onSubmit={async (e) => { e.preventDefault(); if (!name.trim()) return; await saveChannel(d, null, { name: name.trim() }); setName(""); setAdding(false); onChanged(); }}>
          <input className="e-input sm" autoFocus value={name} placeholder="Nome do canal" aria-label="Nome do canal" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setAdding(false)} />
          <Button size="sm" type="submit" icon="check" aria-label="Adicionar canal" />
        </form>
      ) : <button type="button" className="chan-chip add" onClick={() => setAdding(true)}><Icon name="plus" size="sm" /> Canal</button>}
    </div>
  );
}

// ----- Entregas -------------------------------------------------------------------------

function Orders({ d, onOpenTask, onChanged }: { d: ClientOps; onOpenTask: (id: string) => void; onChanged: () => void }) {
  const [filter, setFilter] = useState<"abertas" | "concluidas" | "todas">("abertas");
  const [open, setOpen] = useState<string[]>([]);
  const [applying, setApplying] = useState<Order | null>(null);
  const [creating, setCreating] = useState(false);
  const list = d.orders.filter((o) => filter === "todas" || (filter === "concluidas" ? o.external === "Concluído" && o.tasks.length > 0 : !(o.external === "Concluído" && o.tasks.length > 0)));
  const toggle = (id: string) => setOpen((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));
  useEffect(() => { if (!open.length && list[0]) setOpen([list[0].id]); }, []);
  return (
    <div className="stack">
      <div className="e-row between wrap" style={{ gap: 8 }}>
        <div className="e-row" style={{ gap: 6 }}>
          {(["abertas", "concluidas", "todas"] as const).map((f) => <Chip key={f} pressed={filter === f} onClick={() => setFilter(f)}>{f === "abertas" ? "Abertas" : f === "concluidas" ? "Concluídas" : "Todas"}</Chip>)}
        </div>
        <Button icon="plus" onClick={() => setCreating(true)}>Nova entrega</Button>
      </div>
      {list.length === 0 && <div className="e-glass" style={{ borderRadius: "var(--r-xl)" }}><EmptyState compact icon="kanban" title="Nenhuma entrega aqui" text="Crie uma entrega avulsa ou gere o ciclo de uma frente no Controle." /></div>}
      {list.map((o) => {
        const expanded = open.includes(o.id);
        const late = o.tasks.filter(isLateTask).length;
        return (
          <article key={o.id} className={`delivery e-glass${expanded ? " open" : ""}`}>
            <button type="button" className="delivery-head" aria-expanded={expanded} onClick={() => toggle(o.id)}>
              <span className="delivery-ring" style={{ ["--v" as string]: `${o.progress.percent * 3.6}deg` }}><i className="tnum">{o.progress.percent}%</i></span>
              <span className="e-grow" style={{ minWidth: 0 }}>
                <span className="e-row wrap" style={{ gap: 6 }}><b className="e-ellipsis">{o.title}</b><Badge tone="glass">{o.kindLabel}</Badge></span>
                <span className="e-caption tnum" style={{ display: "block" }}>{o.periodStart ? `${ddmm(o.periodStart)}–${ddmm(o.periodEnd)} · ` : ""}prazo final {ddmm(o.due)} · {o.progress.done}/{o.progress.total} etapas{late ? ` · ${late} atrasada${late > 1 ? "s" : ""}` : ""}</span>
              </span>
              <Badge tone={EXT_TONE[o.external] ?? "todo"} dot>{o.external}</Badge>
              <Icon name={expanded ? "chevUp" : "chevDown"} size="sm" />
            </button>
            {o.source && (
              <div className="delivery-source">
                <Icon name="link" size="sm" /> Origem: {o.source.module === "espaco360" ? "Espaço 360" : o.source.module === "biblioteca" ? "Brand · Biblioteca" : o.source.module} · {o.source.type === "solicitacao" ? "solicitação" : o.source.type}
                <Badge tone={o.source.status === "Concluída" ? "done" : "doing"}>{o.source.status}</Badge>
                {o.source.url && <Link to={o.source.url as never} className="e-link">abrir item original</Link>}
              </div>
            )}
            {expanded && (
              <div className="delivery-body">
                {o.tasks.length === 0 ? <EmptyState compact icon="kanban" title="Sem etapas ainda" text="Aplique um modelo de execução para criar as etapas com responsáveis e prazos." /> : (
                  <ol className="step-list">
                    {o.tasks.map((t, i) => <TaskStep key={t.id} t={t} n={i + 1} onOpen={() => onOpenTask(t.id)} onChanged={onChanged} />)}
                  </ol>
                )}
                <div className="e-row wrap" style={{ gap: 6 }}>
                  <Button size="sm" variant="secondary" icon="layers" onClick={() => setApplying(o)}>Aplicar modelo</Button>
                  <AddTaskInline onAdd={async (title) => { await addTask(d, o.id, title); onChanged(); }} />
                </div>
              </div>
            )}
          </article>
        );
      })}
      <ApplyModal d={d} order={applying} onClose={() => setApplying(null)} onDone={onChanged} />
      <NewOrderModal open={creating} d={d} onClose={() => setCreating(false)} onDone={onChanged} />
    </div>
  );
}

function TaskStep({ t, n, onOpen, onChanged }: { t: OpsTask; n: number; onOpen: () => void; onChanged: () => void }) {
  return (
    <li className={`step${t.status === "Concluído" ? " done" : ""}${t.highlighted ? " hl" : ""}`} onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onOpen()}>
      <span className="step-n tnum">{t.status === "Concluído" ? <Icon name="check" size="sm" /> : n}</span>
      <span className="e-grow" style={{ minWidth: 0 }}>
        <b className="e-ellipsis" style={{ display: "block" }}>{t.pinned && <Icon name="pin" size="sm" />} {t.title}</b>
        <span className="e-caption e-ellipsis" style={{ display: "block" }}>{[t.sector, t.due ? `prazo ${ddmm(t.due)}` : "sem prazo", t.time].filter(Boolean).join(" · ")}</span>
      </span>
      {t.likeMaterial && <Badge tone="glass" icon="heart">Like</Badge>}
      {t.requiresReview && <Badge tone="glass" icon="eye">Avaliação</Badge>}
      {isLateTask(t) && <Badge tone="late">Atrasada</Badge>}
      {t.owner ? <Avatar name={t.owner} size="xs" /> : <span className="e-caption">sem dono</span>}
      <span onClick={(e) => e.stopPropagation()}><StatusMenu task={t} onChanged={onChanged} /></span>
    </li>
  );
}

function AddTaskInline({ onAdd }: { onAdd: (title: string) => Promise<void> }) {
  const [v, setV] = useState("");
  return (
    <form className="e-row" style={{ gap: 4, flex: 1, minWidth: 220 }} onSubmit={async (e) => { e.preventDefault(); if (!v.trim()) return; await onAdd(v.trim()); setV(""); toast.success("Tarefa adicionada"); }}>
      <input className="e-input sm e-grow" value={v} placeholder="Nova etapa" aria-label="Nova etapa" onChange={(e) => setV(e.target.value)} />
      <Button size="sm" variant="ghost" icon="plus" type="submit" disabled={!v.trim()} aria-label="Adicionar etapa" />
    </form>
  );
}

function ApplyModal({ d, order, onClose, onDone }: { d: ClientOps; order: Order | null; onClose: () => void; onDone: () => void }) {
  const [id, setId] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (order) setId(d.templates.find((t) => t.name === "Feed")?.id ?? d.templates[0]?.id ?? ""); }, [order?.id]);
  const t = d.templates.find((x) => x.id === id);
  const rows = t && order ? previewTemplate(t, d.owners, order.due) : [];
  return (
    <Modal open={!!order} onClose={onClose} icon="layers" title="Aplicar modelo de execução" sub={order?.title}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={busy} disabled={!t} onClick={async () => { if (!t || !order) return; setBusy(true); try { const n = await applyExecTemplate(d, order, t); toast.success(`${n} ${n === 1 ? "etapa criada" : "etapas criadas"}`, { description: `${t.name} em ${order.title}` }); onDone(); onClose(); } catch { toast.error("Não foi possível aplicar."); } finally { setBusy(false); } }}>Criar {rows.length} etapas</Button></>}>
      <div className="e-stack" style={{ gap: 10 }}>
        <Select label="Modelo" value={id} onChange={setId} options={d.templates.map((x) => ({ value: x.id, label: `${x.name} · ${x.tasks.length} etapas` }))} />
        {order?.tasks.length ? <p className="e-caption" style={{ margin: 0 }}>Esta entrega já tem {order.tasks.length} etapas; as novas entram depois delas.</p> : null}
        <span className="e-label">Serão criadas</span>
        <ol className="preview-list">
          {rows.map((r, i) => (
            <li key={i}><span className="tnum sector-n">{i + 1}</span><span className="e-grow"><b>{r.title}</b><span className="e-caption" style={{ display: "block" }}>{r.sector ?? "Sem setor"} · {r.owner ?? "sem responsável"} · {r.due ? `prazo ${ddmm(r.due)}` : "sem prazo"}</span></span>{r.like && <Badge tone="glass" icon="heart">Vai para o Like</Badge>}</li>
          ))}
        </ol>
        <Link to={"/workspace/cliente/$brandSlug" as never} params={{ brandSlug: d.brand.slug } as never} search={{ tab: "responsaveis" } as never} className="e-link" onClick={onClose}>Ajustar responsáveis deste cliente</Link>
      </div>
    </Modal>
  );
}

function NewOrderModal({ open, d, onClose, onDone }: { open: boolean; d: ClientOps; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ title: "", due: "", kind: "manual" });
  useEffect(() => { if (open) setF({ title: "", due: "", kind: "manual" }); }, [open]);
  return (
    <Modal open={open} onClose={onClose} icon="kanban" title="Nova entrega"
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button disabled={!f.title.trim()} onClick={async () => { await createOrder(d, { title: f.title.trim(), due: f.due || null, kind: f.kind }); toast.success("Entrega criada"); onDone(); onClose(); }}>Criar</Button></>}>
      <div className="e-stack" style={{ gap: 10 }}>
        <Field label="Título" autoFocus value={f.title} placeholder="Ex.: Cartão de fim de ano" onChange={(e) => setF({ ...f, title: e.target.value })} />
        <div className="grid-2" style={{ gap: 10 }}>
          <Select label="Origem" value={f.kind} onChange={(v) => setF({ ...f, kind: v })} options={Object.entries(WORK_ORDER_KINDS).filter(([k]) => k !== "content_cycle").map(([value, label]) => ({ value, label }))} />
          <Field label="Prazo final" type="date" optional value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} />
        </div>
      </div>
    </Modal>
  );
}

// ----- Frentes --------------------------------------------------------------------------

function Fronts({ d, onChanged }: { d: ClientOps; onChanged: () => void }) {
  const [edit, setEdit] = useState<{ id: string | null; f: FrontInput } | null>(null);
  const empty: FrontInput = { name: "", recurrence: "weekly", lead_days: 3, approved_until: null, pending_start: null, pending_end: null, one_off_date: null, template_id: null };
  return (
    <div className="stack">
      <div><Button icon="plus" onClick={() => setEdit({ id: null, f: empty })}>Nova frente</Button></div>
      <div className="front-grid">
        {d.fronts.map((x: FrontWithRisk) => {
          const cover = Math.max(0, Math.min(100, ((x.diff + 1) / 14) * 100));
          return (
            <button key={x.front.id} type="button" className="front-card e-glass" onClick={() => setEdit({ id: x.front.id, f: { name: x.front.name, recurrence: x.front.recurrence, lead_days: x.front.lead_days, approved_until: x.front.approved_until, pending_start: x.front.pending_start, pending_end: x.front.pending_end, one_off_date: x.front.one_off_date, template_id: x.front.template_id } })}>
              <div className="e-row between" style={{ gap: 8 }}><b>{x.front.name}</b><Badge tone={RISK_TONE[x.level]} dot>{RISK_LABELS[x.level]}</Badge></div>
              <div className="e-bar sm"><i style={{ ["--v" as string]: `${cover}%`, background: RISK_COLOR[x.level] }} /></div>
              <span className="e-caption tnum">{(RECURRENCES as Record<string, string>)[x.front.recurrence] ?? x.front.recurrence} · aprovado até {ddmm(x.front.approved_until)} · antecedência {x.front.lead_days}d</span>
              <span className="e-caption tnum">Próxima pauta {ddmm(x.period.start)}–{ddmm(x.period.end)}{x.front.template_id ? ` · modelo ${d.templates.find((t) => t.id === x.front.template_id)?.name ?? ""}` : ""}</span>
            </button>
          );
        })}
      </div>
      {d.fronts.length === 0 && <div className="e-glass" style={{ borderRadius: "var(--r-xl)" }}><EmptyState compact icon="feed" title="Nenhuma frente" text="Frentes são as pautas recorrentes: Feed, Stories, TikTok…" /></div>}
      <Drawer open={!!edit} onClose={() => setEdit(null)} eyebrow="Frente" title={edit?.id ? edit.f.name : "Nova frente"}
        footer={<><Button variant="ghost" onClick={() => setEdit(null)}>Cancelar</Button><Button icon="check" disabled={!edit?.f.name.trim()} onClick={async () => { if (!edit) return; await saveFront(d, edit.id, { ...edit.f, name: edit.f.name.trim() }); toast.success("Frente salva"); setEdit(null); onChanged(); }}>Salvar</Button></>}>
        {edit && <>
          <Field label="Nome" autoFocus value={edit.f.name} placeholder="Feed, Stories, TikTok…" onChange={(e) => setEdit({ ...edit, f: { ...edit.f, name: e.target.value } })} />
          <div className="grid-2" style={{ gap: 12 }}>
            <Select label="Recorrência" value={edit.f.recurrence} onChange={(v) => setEdit({ ...edit, f: { ...edit.f, recurrence: v } })} options={Object.entries(RECURRENCES).map(([value, label]) => ({ value, label }))} />
            <Field label="Antecedência (dias)" type="number" value={edit.f.lead_days} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, lead_days: Math.max(0, Number(e.target.value) || 0) } })} />
            <Field label="Aprovado até" type="date" optional value={edit.f.approved_until ?? ""} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, approved_until: e.target.value || null } })} />
            {edit.f.recurrence === "oneoff" ? <Field label="Data avulsa" type="date" value={edit.f.one_off_date ?? ""} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, one_off_date: e.target.value || null } })} /> : <span />}
            <Field label="Período pendente · início" type="date" optional value={edit.f.pending_start ?? ""} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, pending_start: e.target.value || null } })} />
            <Field label="Período pendente · fim" type="date" optional value={edit.f.pending_end ?? ""} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, pending_end: e.target.value || null } })} />
          </div>
          <Select label="Modelo de execução" value={edit.f.template_id ?? ""} placeholder="Nenhum" onChange={(v) => setEdit({ ...edit, f: { ...edit.f, template_id: v || null } })} options={[{ value: "", label: "Nenhum" }, ...d.templates.map((t) => ({ value: t.id, label: t.name }))]} />
          <p className="e-caption" style={{ margin: 0 }}>A cobertura avança sozinha quando um material desta frente é aprovado no Like com data de publicação.</p>
        </>}
      </Drawer>
    </div>
  );
}

// ----- Responsáveis ------------------------------------------------------------------

function Owners({ d, onChanged }: { d: ClientOps; onChanged: () => void }) {
  const people = useQuery({ queryKey: ["people-pickable"], queryFn: listPickable, staleTime: 60_000 });
  const titles = useMemo(() => [...new Set([...d.templates.flatMap((t) => t.tasks.map((x) => x.title)), ...d.owners.map((o) => o.task_title)])], [d]);
  const init = () => titles.map((t) => d.owners.find((o) => o.task_title.toLowerCase() === t.toLowerCase()) ?? { task_title: t, owner_name: null, days_before: d.templates.flatMap((x) => x.tasks).find((x) => x.title === t)?.days_before ?? null });
  const [rows, setRows] = useState<Owner[]>(init);
  useEffect(() => setRows(init()), [d]);
  const dirty = JSON.stringify(rows) !== JSON.stringify(init());
  const names = [...new Set([...(people.data ?? []).map((p) => p.name), ...rows.map((r) => r.owner_name).filter(Boolean) as string[]])];
  return (
    <section className="settings-section e-glass">
      <header><h2 className="e-h3" style={{ margin: 0 }}>Responsáveis de {d.brand.name}</h2><p className="e-small" style={{ margin: "4px 0 0" }}>Quem faz cada etapa dos modelos neste cliente e com quantos dias de antecedência do prazo final. Vale ao aplicar um modelo.</p></header>
      <div className="owner-table" role="table">
        <div className="owner-row head" role="row"><span role="columnheader">Etapa</span><span role="columnheader">Responsável</span><span role="columnheader">Dias antes</span></div>
        {rows.map((r, i) => (
          <div key={r.task_title} className="owner-row" role="row">
            <b role="cell">{r.task_title}</b>
            <div role="cell"><Select value={r.owner_name ?? ""} placeholder="Sem responsável" onChange={(v) => setRows(rows.map((x, j) => (j === i ? { ...x, owner_name: v || null } : x)))} options={[{ value: "", label: "Sem responsável" }, ...names.map((n) => ({ value: n, label: n }))]} /></div>
            <div role="cell"><input className="e-input sm tnum" type="number" min={0} max={60} value={r.days_before ?? ""} aria-label={`Dias antes para ${r.task_title}`} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, days_before: e.target.value === "" ? null : Number(e.target.value) } : x)))} /></div>
          </div>
        ))}
      </div>
      <div className="e-row" style={{ gap: 8, justifyContent: "flex-end" }}>
        <Button variant="ghost" disabled={!dirty} onClick={() => setRows(init())}>Desfazer</Button>
        <Button icon="check" disabled={!dirty} onClick={async () => { await saveOwners(d, rows); toast.success("Responsáveis salvos"); onChanged(); }}>Salvar</Button>
      </div>
    </section>
  );
}

// ----- Avulsas --------------------------------------------------------------------------

function Loose({ d, onOpenTask, onChanged }: { d: ClientOps; onOpenTask: (id: string) => void; onChanged: () => void }) {
  const sorted = [...d.loose].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || (a.due ?? "9").localeCompare(b.due ?? "9"));
  return (
    <div className="stack">
      <p className="e-small" style={{ margin: 0 }}>Tarefas que não pertencem a nenhuma entrega: pedidos rápidos, retornos e ajustes pontuais.</p>
      {sorted.length ? <ol className="step-list">{sorted.map((t, i) => <TaskStep key={t.id} t={t} n={i + 1} onOpen={() => onOpenTask(t.id)} onChanged={onChanged} />)}</ol> : <div className="e-glass" style={{ borderRadius: "var(--r-xl)" }}><EmptyState compact icon="inbox" title="Nenhuma tarefa avulsa" /></div>}
      <AddTaskInline onAdd={async (title) => { await addTask(d, null, title); onChanged(); }} />
    </div>
  );
}
