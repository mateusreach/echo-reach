import { createFileRoute, useNavigate, useRouterState, Link, Outlet } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { ReachIconAnimation } from "@/components/reach/reach-icon-animation";
import { SpaceShell } from "@/components/reach/space-shell";
import { SendToExecution } from "@/components/reach/send-to-execution";
import { PageHeader } from "@/components/reach/page-header";
import { GlassCard } from "@/components/reach/glass-card";
import { Btn, StatusChip, EmptyState } from "@/components/ui-reach/primitives";
import { isViewingAsClient } from "@/lib/view-as";
import { getAccess, modulePermissionKey } from "@/lib/agency-data";
import { supabase } from "@/integrations/supabase/client";
import {
  CAMPAIGN_STAGES,
  CHANNEL_STATUSES,
  DELIVERY_STATUSES,
  HORIZONS,
  INITIATIVE_STATUSES,
  NOTE_KINDS,
  SOLICITACAO_STATUSES,
  createNota,
  deleteNota,
  listNotas,
  listTeamMembers,
  meetingParticipants,
  strategyProgress,
  updateMeeting,
  updateNota,
  type Nota,
  type TeamMember,
  TASK_SCOPES,
  TASK_STATUSES,
  brandModules,
  createCampaign,
  createChannel,
  createInitiative,
  createMeeting,
  createMeetingTask,
  createSolicitacao,
  createTask,
  getBrandBySlug,
  getBrandMembership,
  getProfile,
  listCampaigns,
  listChannels,
  listDeliveries,
  listInitiatives,
  listMeetingTasks,
  listMeetings,
  listMonthlyTracking,
  listObjectives,
  listSolicitacoes,
  listTasks,
  updateChannel,
  updateInitiative,
  updateMeetingTaskStatus,
  updateSolicitacao,
  updateTask,
  upsertMonthlyTracking,
  type Brand,
  type Campaign,
  type Channel,
  type Delivery,
  type Espaco360Task,
  type Initiative,
  type Meeting,
  type MeetingTask,
  type MonthlyTracking,
  type Objective,
  type Solicitacao,
} from "@/lib/reach-data";

export const Route = createFileRoute("/e360/$brandSlug")({
  component: SpaceRoute,
  validateSearch: (search: Record<string, unknown>) => ({
    tab: (search.tab as string) || undefined,
    filtro: (search.filtro as string) || undefined,
  }),
});

function SpaceRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { brandSlug } = Route.useParams();
  if (pathname !== `/e360/${brandSlug}` && pathname !== `/e360/${brandSlug}/`) return <Outlet />;
  return <Espaco360Page />;
}

const TABS = ["Visão Geral", "Estratégias", "Campanhas", "Tarefas", "Solicitações", "Entregas", "Reuniões", "Notas", "Revisões Mensais", "Canais"] as const;
type TabKey = (typeof TABS)[number];

function StatCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <GlassCard level={2} className="p-5">
      <div className="text-label">{label}</div>
      <div className={`mt-2 text-display ${tone}`}>{value}</div>
    </GlassCard>
  );
}

function Espaco360Page() {
  const { brandSlug } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [displayName, setDisplayName] = useState("Você");
  const [canEdit, setCanEdit] = useState(false);
  const [tab, setTab] = useState<TabKey>((search.tab as TabKey) || "Visão Geral");
  const [taskFilter, setTaskFilter] = useState<string | undefined>(search.filtro);

  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [tasks, setTasks] = useState<Espaco360Task[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [monthly, setMonthly] = useState<MonthlyTracking[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [meetingTasks, setMeetingTasks] = useState<Record<string, MeetingTask[]>>({});

  async function refresh() {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) {
      navigate({ to: "/auth" });
      return;
    }
    const b = await getBrandBySlug(brandSlug);
    if (!b) {
      setLoading(false);
      return;
    }
    if (!brandModules(b).espaco360) {
      setLoading(false);
      return;
    }
    const access = await getAccess();
    const membership = access.isAgency ? null : await getBrandMembership(b.id);
    if (!access.isAgency && !membership?.isAdmin && !membership?.permissions.includes(modulePermissionKey("espaco360", "visualizar"))) {
      setLoading(false);
      return;
    }
    setBrand(b);
    const [profile, objs, init, camp, tks, sols, dels, chs, mon, meets] = await Promise.all([
      getProfile(session.user.id),
      listObjectives(b.id),
      listInitiatives(b.id),
      listCampaigns(b.id),
      listTasks(b.id),
      listSolicitacoes(b.id),
      listDeliveries(b.id),
      listChannels(b.id),
      listMonthlyTracking(b.id),
      listMeetings(b.id),
    ]);
    setCanEdit(!isViewingAsClient() && (access.isAgency || !!membership?.isAdmin || !!membership?.permissions.includes(modulePermissionKey("espaco360", "editar"))));
    if (profile?.display_name) setDisplayName(profile.display_name);
    setObjectives(objs);
    setInitiatives(init);
    setCampaigns(camp);
    setTasks(tks);
    setSolicitacoes(sols);
    setDeliveries(dels);
    setChannels(chs);
    setMonthly(mon);
    setMeetings(meets);
    const taskLists = await Promise.all(meets.map((m) => listMeetingTasks(m.id)));
    const map: Record<string, MeetingTask[]> = {};
    meets.forEach((m, i) => (map[m.id] = taskLists[i]));
    setMeetingTasks(map);
    setLoading(false);
  }

  useEffect(() => {
    setLoading(true);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandSlug]);

  useEffect(() => {
    if (search.tab && TABS.includes(search.tab as TabKey)) setTab(search.tab as TabKey);
    setTaskFilter(search.filtro);
  }, [search.tab, search.filtro]);

  function initiativeProgress(initiativeId: string) {
    const linked = tasks.filter((t) => t.initiative_id === initiativeId);
    const required = linked.filter((t) => t.is_required);
    const done = required.filter((t) => t.status === "concluida");
    return { total: required.length, done: done.length, pct: required.length ? Math.round((done.length / required.length) * 100) : 0 };
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <ReachIconAnimation size={48} context="page-loading" />
        <p className="text-sm text-muted-foreground">Carregando Espaço 360…</p>
      </div>
    );
  }
  if (!brand) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <p className="text-lg font-semibold">Marca não encontrada</p>
      </div>
    );
  }

  return (
    <SpaceShell brandSlug={brandSlug} brandName={brand.name} primaryColor={(brand as any)?.primary_color} accentColor={(brand as any)?.accent_color}>
      <PageHeader eyebrow="Centro operacional" title="Espaço 360" description="O que precisa acontecer agora: estratégias, campanhas, tarefas, solicitações e entregas." coverUrl={brand.cover_url} coverFrame={(brand as any).cover_frame} />

      <GlassCard level={1} className="scrollbar-none mb-6 flex gap-1 overflow-x-auto p-1 sm:flex-wrap">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setTaskFilter(undefined);
              navigate({ to: ".", search: { tab: t } as any });
            }}
            className={tab === t ? "min-h-11 shrink-0 whitespace-nowrap rounded-xl bg-reach-coral px-4 text-[13px] font-medium text-primary-foreground sm:min-h-0 sm:px-3 sm:py-1.5 sm:text-[12.5px]" : "min-h-11 shrink-0 whitespace-nowrap rounded-xl px-4 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted sm:min-h-0 sm:px-3 sm:py-1.5 sm:text-[12.5px]"}
          >
            {t}
          </button>
        ))}
      </GlassCard>

      {tab === "Visão Geral" && <VisaoGeralTab initiatives={initiatives} campaigns={campaigns} tasks={tasks} solicitacoes={solicitacoes} />}
      {tab === "Campanhas" && <CampanhasTab brandId={brand.id} brandSlug={brandSlug} campaigns={campaigns} initiatives={initiatives} objectives={objectives} canEdit={canEdit} onChanged={refresh} />}
      {tab === "Estratégias" && (
        <IniciativasTab
          brandId={brand.id}
          brandSlug={brandSlug}
          initiatives={initiatives}
          objectives={objectives}
          progressOf={initiativeProgress}
          canEdit={canEdit}
          onChanged={refresh}
          initialObjectiveFilter={taskFilter}
        />
      )}
      {tab === "Notas" && <NotasTab brandId={brand.id} canEdit={canEdit} />}
      {tab === "Tarefas" && <TarefasTab brandId={brand.id} brandSlug={brandSlug} tasks={tasks} solicitacoes={solicitacoes} deliveries={deliveries} campaigns={campaigns} initiatives={initiatives} canEdit={canEdit} onChanged={refresh} initialFilter={taskFilter} />}
      {tab === "Solicitações" && <SolicitacoesTab brand={brand} brandId={brand.id} brandSlug={brandSlug} solicitacoes={solicitacoes} tasks={tasks} deliveries={deliveries} campaigns={campaigns} canEdit={canEdit} onChanged={refresh} />}
      {tab === "Entregas" && <EntregasTab deliveries={deliveries} campaigns={campaigns} solicitacoes={solicitacoes} />}
      {tab === "Reuniões" && <ReunioesTab brandId={brand.id} brandSlug={brandSlug} meetings={meetings} meetingTasks={meetingTasks} canEdit={canEdit} onChanged={refresh} />}
      {tab === "Revisões Mensais" && <MensalTab brandId={brand.id} monthly={monthly} canEdit={canEdit} onChanged={refresh} />}
      {tab === "Canais" && <CanaisTab brandId={brand.id} channels={channels} canEdit={canEdit} onChanged={refresh} />}
    </SpaceShell>
  );
}

function VisaoGeralTab({ initiatives, campaigns, tasks, solicitacoes }: { initiatives: Initiative[]; campaigns: Campaign[]; tasks: Espaco360Task[]; solicitacoes: Solicitacao[] }) {
  const prog = strategyProgress(initiatives);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard label="Campanhas em andamento" value={String(campaigns.filter((c) => c.status === "em_andamento").length)} tone="text-reach-coral" />
        <StatCard label="Tarefas em aberto" value={String(tasks.filter((t) => t.status !== "concluida").length)} tone="text-reach-blue" />
        <StatCard label="Solicitações abertas" value={String(solicitacoes.filter((s) => !["concluida", "cancelada"].includes(s.status)).length)} tone="text-reach-violet" />
        <StatCard label="Progresso do plano" value={`${prog.percent}%`} tone="text-reach-mint" />
      </div>

      <GlassCard level={2} className="p-6">
        <h2 className="text-title mb-1">Progresso geral do plano</h2>
        <p className="mb-4 text-[12.5px] text-muted-foreground">
          Calculado a partir das estratégias definidas no Plano — {prog.done} concluídas, {prog.running} em andamento e {prog.missed} não concluídas de {prog.total}.
        </p>
        <div className="h-2 overflow-hidden rounded-full bg-muted/60">
          <div className="h-full rounded-full bg-reach-coral transition-[width]" style={{ width: `${prog.percent}%` }} />
        </div>

        <div className="mt-5 space-y-2">
          {initiatives.map((i) => (
            <div key={i.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5">
              <StatusChip status={i.status} label={INITIATIVE_STATUSES.find((s) => s.key === i.status)?.label} />
              <span className="min-w-0 flex-1 truncate text-[13px]">{i.title}</span>
              <span className="text-[11px] text-muted-foreground">{HORIZONS.find((h) => h.key === i.priority)?.label ?? "Sem horizonte"}</span>
            </div>
          ))}
          {initiatives.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma estratégia definida no Plano ainda.</p>}
        </div>
      </GlassCard>
    </div>
  );
}

function CampanhasTab({
  brandId,
  brandSlug,
  campaigns,
  initiatives,
  objectives,
  canEdit,
  onChanged,
}: {
  brandId: string;
  brandSlug: string;
  campaigns: Campaign[];
  initiatives: Initiative[];
  objectives: Objective[];
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [quarter, setQuarter] = useState("");
  const [initiativeId, setInitiativeId] = useState("");

  async function add() {
    if (!title.trim()) return;
    const initiative = initiatives.find((i) => i.id === initiativeId);
    await createCampaign({
      brand_id: brandId,
      title: title.trim(),
      quarter,
      initiative_id: initiativeId || null,
      // O objetivo flui automaticamente da estratégia escolhida — mantém a
      // cadeia Objetivo → Estratégia → Campanha sem pedir o mesmo dado duas vezes.
      objective_id: initiative?.objective_id ?? null,
    });
    setTitle("");
    setQuarter("");
    setInitiativeId("");
    setAdding(false);
    onChanged();
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {campaigns.map((c) => {
          const initiative = initiatives.find((i) => i.id === c.initiative_id);
          const objective = objectives.find((o) => o.id === (c.objective_id ?? initiative?.objective_id));
          return (
            <Link key={c.id} to="/e360/$brandSlug/campanha/$campaignId" params={{ brandSlug, campaignId: c.id }} search={{ tab: undefined, filtro: undefined }}>
              <GlassCard level={2} className="h-full p-5 transition-colors hover:bg-muted">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-[13.5px] font-semibold">{c.title}</p>
                  <StatusChip status={c.status} />
                </div>
                <p className="text-[11.5px] text-muted-foreground">{c.quarter ?? "Sem período"} · {CAMPAIGN_STAGES.find((s) => s.key === c.stage)?.label}</p>
                {initiative && <p className="mt-2 text-[11.5px] text-reach-violet">Estratégia: {initiative.title}</p>}
                {objective && <p className="text-[11.5px] text-muted-foreground">Objetivo: {objective.title}</p>}
              </GlassCard>
            </Link>
          );
        })}
      </div>
      {campaigns.length === 0 && <EmptyState title="Nenhuma campanha" description="Cadastre a primeira campanha para começar a operação." />}
      {canEdit && (
        <GlassCard level={2} className="p-4">
          {adding ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <input autoFocus placeholder="Nome da campanha" value={title} onChange={(e) => setTitle(e.target.value)} className="input-reach sm:col-span-2" />
              <input placeholder="Período (ex.: Q3 2026)" value={quarter} onChange={(e) => setQuarter(e.target.value)} className="input-reach" />
              <select value={initiativeId} onChange={(e) => setInitiativeId(e.target.value)} className="input-reach">
                <option value="">Sem estratégia vinculada</option>
                {initiatives.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
              </select>
              <div className="flex gap-2 sm:col-span-2">
                <Btn size="sm" onClick={add}>Adicionar</Btn>
                <Btn size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancelar</Btn>
              </div>
            </div>
          ) : (
            <Btn variant="outline" size="sm" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" /> Nova campanha</Btn>
          )}
        </GlassCard>
      )}
    </div>
  );
}

function IniciativasTab({
  brandId,
  brandSlug,
  initiatives,
  objectives,
  progressOf,
  canEdit,
  onChanged,
  initialObjectiveFilter,
}: {
  brandId: string;
  brandSlug: string;
  initiatives: Initiative[];
  objectives: Objective[];
  progressOf: (id: string) => { total: number; done: number; pct: number };
  canEdit: boolean;
  onChanged: () => void;
  initialObjectiveFilter?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [horizon, setHorizon] = useState("imediato");
  const [objectiveId, setObjectiveId] = useState("");
  const [objectiveFilter, setObjectiveFilter] = useState(initialObjectiveFilter && initialObjectiveFilter !== "atrasadas" && initialObjectiveFilter !== "pendentes" ? initialObjectiveFilter : "");

  const visible = objectiveFilter ? initiatives.filter((i) => i.objective_id === objectiveFilter) : initiatives;

  // Estratégias organizadas por HORIZONTE de execução (Imediato → Longo prazo),
  // e não mais por semestre/ano.
  const byHorizon = useMemo(() => {
    return HORIZONS.map((h) => [h.label, visible.filter((i) => (i.priority || "sem_prioridade") === h.key)] as const).filter(
      ([, items]) => items.length > 0,
    );
  }, [visible]);

  async function add() {
    if (!title.trim()) return;
    await createInitiative({
      brand_id: brandId,
      title: title.trim(),
      priority: horizon,
      status: "em_andamento",
      order_index: initiatives.length,
      objective_id: objectiveId || null,
    });
    setTitle("");
    setObjectiveId("");
    setAdding(false);
    onChanged();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end">
        <Link to="/e360/$brandSlug/plano" params={{ brandSlug }} search={{ tab: "estrategia", filtro: undefined }} className="text-[11.5px] text-reach-coral hover:underline">
          Ver no Plano →
        </Link>
      </div>
      {objectives.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Filtrar por objetivo:</span>
          <select value={objectiveFilter} onChange={(e) => setObjectiveFilter(e.target.value)} className="input-reach h-9 w-auto min-w-[200px] rounded-full text-sm">
            <option value="">Todos os objetivos</option>
            {objectives.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
          </select>
        </div>
      )}
      {byHorizon.map(([sem, items]) => (
        <GlassCard key={sem} level={2} className="p-6">
          <h2 className="text-title mb-3">{sem}</h2>
          <div className="space-y-3">
            {items.map((i) => {
              const prog = progressOf(i.id);
              const objective = objectives.find((o) => o.id === i.objective_id);
              return (
                <div key={i.id} className="rounded-xl border border-border bg-card px-4 py-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-[13.5px] font-medium">{i.title}</span>
                    <div className="flex flex-wrap gap-2">
                      {canEdit ? (
                        <>
                          <select value={i.priority} onChange={(e) => updateInitiative(i.id, { priority: e.target.value }).then(onChanged)} className="input-reach !w-auto rounded-full py-1 text-[11px]">
                            {HORIZONS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                          </select>
                          <select value={i.status} onChange={(e) => updateInitiative(i.id, { status: e.target.value }).then(onChanged)} className="input-reach !w-auto rounded-full py-1 text-[11px]">
                            {INITIATIVE_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                          </select>
                        </>
                      ) : (
                        <StatusChip status={i.status} label={INITIATIVE_STATUSES.find((s) => s.key === i.status)?.label} />
                      )}
                    </div>
                  </div>
                  {objective && (
                    <p className="mb-2 text-[11.5px] text-reach-violet">Objetivo: {objective.title}</p>
                  )}
                  {canEdit && (
                    <select
                      value={i.objective_id ?? ""}
                      onChange={(e) => updateInitiative(i.id, { objective_id: e.target.value || null }).then(onChanged)}
                      className="input-reach mb-2 !w-auto rounded-full py-1 text-[11px] text-muted-foreground"
                    >
                      <option value="">Sem objetivo vinculado</option>
                      {objectives.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
                    </select>
                  )}
                  {prog.total > 0 ? (
                    <>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
                        <div className="h-full rounded-full bg-reach-violet" style={{ width: `${prog.pct}%` }} />
                      </div>
                      <p className="mt-1.5 text-[11.5px] text-muted-foreground">{prog.done}/{prog.total} tarefas concluídas — {prog.pct}%</p>
                    </>
                  ) : (
                    <p className="text-[11.5px] text-muted-foreground">Nenhuma tarefa vinculada ainda.</p>
                  )}
                </div>
              );
            })}
          </div>
        </GlassCard>
      ))}
      {visible.length === 0 && (
        <EmptyState
          title={objectiveFilter ? "Nenhuma estratégia para este objetivo" : "Nenhuma estratégia"}
          description="Cadastre a primeira estratégia do plano."
        />
      )}
      {canEdit && (
        <GlassCard level={2} className="p-4">
          {adding ? (
            <div className="flex flex-wrap items-center gap-2">
              <input autoFocus placeholder="Título da estratégia" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} className="input-reach min-w-[220px] flex-1" />
              <select value={horizon} onChange={(e) => setHorizon(e.target.value)} className="input-reach w-44">
                {HORIZONS.map((h) => <option key={h.key} value={h.key}>{h.label}</option>)}
              </select>
              <select value={objectiveId} onChange={(e) => setObjectiveId(e.target.value)} className="input-reach w-52">
                <option value="">Sem objetivo vinculado</option>
                {objectives.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
              </select>
              <Btn size="sm" onClick={add}>Adicionar</Btn>
              <Btn size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancelar</Btn>
            </div>
          ) : (
            <Btn variant="outline" size="sm" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" /> Nova estratégia</Btn>
          )}
        </GlassCard>
      )}
    </div>
  );
}

function TarefasTab({ brandId, brandSlug, tasks, solicitacoes, deliveries, campaigns, initiatives, canEdit, onChanged, initialFilter }: { brandId: string; brandSlug: string; tasks: Espaco360Task[]; solicitacoes: Solicitacao[]; deliveries: Delivery[]; campaigns: Campaign[]; initiatives: Initiative[]; canEdit: boolean; onChanged: () => void; initialFilter?: string }) {
  const [scope, setScope] = useState<string>("todas");
  const [statusFilter, setStatusFilter] = useState<string>(initialFilter === "atrasadas" ? "atrasadas" : initialFilter === "pendentes" ? "pendentes" : "todas");
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [ownerScope, setOwnerScope] = useState("compartilhada");
  const [campaignId, setCampaignId] = useState("");
  const [initiativeId, setInitiativeId] = useState("");

  useEffect(() => {
    if (initialFilter === "atrasadas") setStatusFilter("atrasadas");
    if (initialFilter === "pendentes") setStatusFilter("pendentes");
  }, [initialFilter]);

  const today = new Date().toISOString().slice(0, 10);
  let filtered = scope === "todas" ? tasks : tasks.filter((t) => t.owner_scope === scope);
  if (statusFilter === "pendentes") filtered = filtered.filter((t) => t.status !== "concluida");
  if (statusFilter === "atrasadas") filtered = filtered.filter((t) => t.status !== "concluida" && t.due_date && t.due_date < today);

  async function add() {
    if (!title.trim()) return;
    await createTask({ brand_id: brandId, title: title.trim(), owner_scope: ownerScope, campaign_id: campaignId || null, initiative_id: initiativeId || null });
    setTitle("");
    setAdding(false);
    onChanged();
  }
  async function cycleStatus(t: Espaco360Task) {
    const order = TASK_STATUSES.map((s) => s.key);
    const next = order[(order.indexOf(t.status as any) + 1) % order.length] as (typeof TASK_STATUSES)[number]["key"];
    await updateTask(t.id, { status: next });
    onChanged();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3">
        <GlassCard level={1} className="flex flex-wrap gap-2 p-2">
          {["todas", ...TASK_SCOPES.map((s) => s.key)].map((s) => (
            <button key={s} onClick={() => setScope(s)} className={scope === s ? "rounded-xl bg-reach-coral px-3 py-1.5 text-[12.5px] font-medium text-primary-foreground" : "rounded-xl px-3 py-1.5 text-[12.5px] text-muted-foreground hover:bg-muted"}>
              {s === "todas" ? "Todas" : TASK_SCOPES.find((x) => x.key === s)?.label}
            </button>
          ))}
        </GlassCard>
        <GlassCard level={1} className="flex flex-wrap gap-2 p-2">
          {[{ key: "todas", label: "Todas" }, { key: "pendentes", label: "Pendentes" }, { key: "atrasadas", label: "Atrasadas" }].map((s) => (
            <button key={s.key} onClick={() => setStatusFilter(s.key)} className={statusFilter === s.key ? "rounded-xl bg-reach-rose px-3 py-1.5 text-[12.5px] font-medium text-primary-foreground" : "rounded-xl px-3 py-1.5 text-[12.5px] text-muted-foreground hover:bg-muted"}>
              {s.label}
            </button>
          ))}
        </GlassCard>
      </div>

      <GlassCard level={2} className="p-6">
        <div className="space-y-2">
          {filtered.map((t) => {
            const campaign = campaigns.find((c) => c.id === t.campaign_id);
            const initiative = initiatives.find((i) => i.id === t.initiative_id);
            const request = solicitacoes.find((s) => s.task_id === t.id);
            const taskDeliveries = deliveries.filter((d) => d.task_id === t.id && (d.status === "entregue" || d.status === "publicado"));
            const late = t.status !== "concluida" && t.due_date && t.due_date < today;
            return (
              <div key={t.id} className="flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                {/* Celular: status (área de toque de 44 px), responsável e prazo numa linha; título embaixo, sem cortar. */}
                <div className="flex flex-wrap items-center gap-2 sm:contents">
                  <button className="max-sm:min-h-11 max-sm:min-w-11 max-sm:-ml-1" aria-label="Avançar status da tarefa" onClick={() => canEdit && cycleStatus(t)}>
                    <StatusChip status={t.status} label={TASK_STATUSES.find((s) => s.key === t.status)?.label} />
                  </button>
                  <span className="sm:hidden"><StatusChip status="coral" label={TASK_SCOPES.find((s) => s.key === t.owner_scope)?.label} /></span>
                  {t.due_date && <span className={`text-[11.5px] sm:hidden ${late ? "text-reach-rose" : "text-muted-foreground"}`}>{late ? "Atrasada · " : ""}{t.due_date}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="break-words text-[13.5px] sm:truncate sm:text-[13px]">{t.title}</p>
                  {(campaign || initiative) && (
                    <p className="truncate text-[11px] text-muted-foreground">
                      {campaign ? `Campanha: ${campaign.title}` : ""} {initiative ? `· Estratégia: ${initiative.title}` : ""}
                    </p>
                  )}
                  {request && <p className="mt-1 text-[11px] text-muted-foreground">Solicitação: {request.title} · {SOLICITACAO_STATUSES.find((s) => s.key === request.status)?.label ?? request.status}</p>}
                  {taskDeliveries.length > 0 && <p className="mt-1 text-[11px] text-reach-mint">{taskDeliveries.length} entrega(s): {taskDeliveries.map((d) => d.title).join(" · ")}</p>}
                </div>
                <span className="hidden sm:inline-flex"><StatusChip status="coral" label={TASK_SCOPES.find((s) => s.key === t.owner_scope)?.label} /></span>
                {t.due_date && <span className={`hidden shrink-0 text-[11px] sm:inline ${late ? "text-reach-rose" : "text-muted-foreground"}`}>{late ? "Atrasada · " : ""}{t.due_date}</span>}
                {!request && t.owner_scope !== "cliente" && t.status !== "concluida" && (
                  <SendToExecution source={{
                    brandId,
                    brandSlug,
                    sourceModule: "espaco360",
                    sourceType: "tarefa",
                    sourceId: t.id,
                    sourceUrl: `/e360/${brandSlug}?tab=Tarefas`,
                    title: t.title,
                    description: t.description,
                    requestedDueDate: t.due_date,
                  }} />
                )}
              </div>
            );
          })}
          {filtered.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma tarefa aqui.</p>}
        </div>
      </GlassCard>

      {canEdit && (
        <GlassCard level={2} className="p-4">
          {adding ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <input autoFocus placeholder="Título da tarefa" value={title} onChange={(e) => setTitle(e.target.value)} className="input-reach sm:col-span-2" />
              <select value={ownerScope} onChange={(e) => setOwnerScope(e.target.value)} className="input-reach">
                {TASK_SCOPES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
              <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className="input-reach">
                <option value="">Sem campanha</option>
                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
              <select value={initiativeId} onChange={(e) => setInitiativeId(e.target.value)} className="input-reach sm:col-span-2">
                <option value="">Sem estratégia</option>
                {initiatives.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
              </select>
              <div className="flex gap-2 sm:col-span-2">
                <Btn size="sm" onClick={add}>Adicionar</Btn>
                <Btn size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancelar</Btn>
              </div>
            </div>
          ) : (
            <Btn variant="outline" size="sm" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" /> Nova tarefa</Btn>
          )}
        </GlassCard>
      )}
    </div>
  );
}

function SolicitacoesTab({ brand, brandId, brandSlug, solicitacoes, tasks, deliveries, campaigns, canEdit, onChanged }: { brand: Brand; brandId: string; brandSlug: string; solicitacoes: Solicitacao[]; tasks: Espaco360Task[]; deliveries: Delivery[]; campaigns: Campaign[]; canEdit: boolean; onChanged: () => void }) {
  const wsEnabled = brandModules(brand).workspace;

  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tipo, setTipo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [campaignId, setCampaignId] = useState("");

  async function add() {
    if (!title.trim()) return;
    await createSolicitacao({ brand_id: brandId, title: title.trim(), description, tipo, due_date: dueDate || null, campaign_id: campaignId || null });
    setTitle("");
    setDescription("");
    setTipo("");
    setDueDate("");
    setCampaignId("");
    setAdding(false);
    onChanged();
  }

  return (
    <div className="space-y-5">
      <GlassCard level={2} className="p-6">
        <div className="space-y-2">
          {solicitacoes.map((s) => (
            <div key={s.id} className="rounded-xl border border-border bg-card px-4 py-3">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 truncate text-[13.5px] font-medium">{s.title}</span>
                {canEdit ? (
                  <select value={s.status} onChange={(e) => updateSolicitacao(s.id, { status: e.target.value }).then(onChanged)} className="input-reach !w-auto rounded-full py-1 text-[11px]">
                    {SOLICITACAO_STATUSES.map((st) => <option key={st.key} value={st.key}>{st.label}</option>)}
                  </select>
                ) : (
                  <StatusChip status={s.status} label={SOLICITACAO_STATUSES.find((st) => st.key === s.status)?.label} />
                )}
              </div>
              {s.description && <p className="text-[12.5px] text-muted-foreground">{s.description}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                {s.due_date && <span>Prazo: {s.due_date}</span>}
                {campaigns.find((c) => c.id === s.campaign_id) && <span>· Campanha: {campaigns.find((c) => c.id === s.campaign_id)?.title}</span>}
                <span>· Tarefa: {tasks.find((task) => task.id === s.task_id)?.title ?? "sincronização pendente"}</span>
                {s.task_id && <span>· {TASK_STATUSES.find((status) => status.key === tasks.find((task) => task.id === s.task_id)?.status)?.label ?? "A fazer"}</span>}
                {deliveries.some((delivery) => delivery.id === s.id && (delivery.status === "entregue" || delivery.status === "publicado")) && <span>· Entrega registrada</span>}
              </div>
              {wsEnabled && s.status !== "cancelada" && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <SendToExecution source={{
                    brandId,
                    brandSlug,
                    sourceModule: "espaco360",
                    sourceType: "solicitacao",
                    sourceId: s.id,
                    sourceUrl: `/e360/${brandSlug}?tab=Solicita%C3%A7%C3%B5es`,
                    title: s.title,
                    description: [s.description, s.tipo ? `Tipo: ${s.tipo}` : null].filter(Boolean).join("\n\n"),
                    requestedDueDate: s.due_date,
                  }} />
                </div>
              )}
            </div>
          ))}
          {solicitacoes.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma solicitação registrada ainda.</p>}
        </div>
      </GlassCard>

      {canEdit && (
        <GlassCard level={2} className="p-4">
          {adding ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <input autoFocus placeholder="Título da solicitação" value={title} onChange={(e) => setTitle(e.target.value)} className="input-reach sm:col-span-2" />
              <textarea placeholder="Descrição" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="input-reach resize-y sm:col-span-2" />
              <input placeholder="Tipo (ex.: arte, texto, vídeo)" value={tipo} onChange={(e) => setTipo(e.target.value)} className="input-reach" />
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input-reach" />
              <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className="input-reach sm:col-span-2">
                <option value="">Sem campanha vinculada</option>
                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
              <div className="flex gap-2 sm:col-span-2">
                <Btn size="sm" onClick={add}>Adicionar</Btn>
                <Btn size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancelar</Btn>
              </div>
            </div>
          ) : (
            <Btn variant="outline" size="sm" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" /> Nova solicitação</Btn>
          )}
        </GlassCard>
      )}
    </div>
  );
}

function EntregasTab({ deliveries, campaigns, solicitacoes }: { deliveries: Delivery[]; campaigns: Campaign[]; solicitacoes: Solicitacao[] }) {
  const completed = deliveries.filter((delivery) => delivery.status === "entregue" || delivery.status === "publicado");
  return (
    <div className="space-y-5">
      <GlassCard level={2} className="p-6">
        <p className="mb-4 text-[12.5px] text-muted-foreground">Entregas concluídas das solicitações e de outras execuções. Acompanhe o trabalho em Tarefas.</p>
        <div className="space-y-2">
          {completed.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <StatusChip status={d.status} label={DELIVERY_STATUSES.find((s) => s.key === d.status)?.label} />
              <p className="min-w-0 flex-1 truncate text-[13px]">{d.title}</p>
              {solicitacoes.some((s) => s.id === d.id) && <span className="text-[11px] text-muted-foreground">Solicitação</span>}
              {campaigns.find((c) => c.id === d.campaign_id) && <span className="text-[11px] text-muted-foreground">{campaigns.find((c) => c.id === d.campaign_id)?.title}</span>}
              {d.delivered_at
                ? <span className="shrink-0 text-[11px] text-muted-foreground">Entregue em {d.delivered_at.slice(0, 10)}</span>
                : d.due_date && <span className="shrink-0 text-[11px] text-muted-foreground">Prazo: {d.due_date.slice(0, 10)}</span>}
            </div>
          ))}
          {completed.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma entrega concluída ainda.</p>}
        </div>
      </GlassCard>
    </div>
  );
}

function ReunioesTab({ brandId, brandSlug, meetings, meetingTasks, canEdit, onChanged }: { brandId: string; brandSlug: string; meetings: Meeting[]; meetingTasks: Record<string, MeetingTask[]>; canEdit: boolean; onChanged: () => void }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [taskDraft, setTaskDraft] = useState<Record<string, string>>({});
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [newParticipants, setNewParticipants] = useState<string[]>([]);

  useEffect(() => {
    listTeamMembers(brandId).then(setTeam).catch(() => setTeam([]));
  }, [brandId]);

  async function addMeeting() {
    if (!title.trim() || !date) return;
    await createMeeting({
      brand_id: brandId,
      title: title.trim(),
      meeting_date: date,
      participants: newParticipants.map((n) => ({ name: n })) as any,
    } as any);
    setTitle("");
    setDate("");
    setNewParticipants([]);
    setAdding(false);
    onChanged();
  }
  async function addMeetingTask(meetingId: string) {
    const desc = taskDraft[meetingId]?.trim();
    if (!desc) return;
    await createMeetingTask({ meeting_id: meetingId, brand_id: brandId, description: desc });
    setTaskDraft((d) => ({ ...d, [meetingId]: "" }));
    onChanged();
  }
  async function toggleParticipant(m: Meeting, name: string) {
    const current = meetingParticipants(m);
    const next = current.some((p) => p.name === name) ? current.filter((p) => p.name !== name) : [...current, { name }];
    await updateMeeting(m.id, { participants: next });
    onChanged();
  }

  return (
    <div className="space-y-5">
      {meetings.map((m) => (
        <GlassCard key={m.id} level={2} className="p-6">
          <h2 className="text-title">{m.title} · {m.meeting_date}</h2>
          {m.notes && <p className="mt-1 text-sm text-muted-foreground">{m.notes}</p>}

          <div className="mt-3">
            <p className="text-label mb-1.5">Participantes</p>
            <div className="flex flex-wrap gap-1.5">
              {meetingParticipants(m).map((p) => (
                <span key={p.name} className="rounded-full border border-border bg-card px-3 py-1 text-[11.5px]">{p.name}</span>
              ))}
              {meetingParticipants(m).length === 0 && <span className="text-[12px] text-muted-foreground">Nenhum participante registrado.</span>}
            </div>
            {canEdit && team.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {team.map((t) => {
                  const on = meetingParticipants(m).some((p) => p.name === t.name);
                  return (
                    <button
                      key={t.id}
                      onClick={() => toggleParticipant(m, t.name)}
                      className={on ? "rounded-full bg-reach-violet px-3 py-1 text-[11.5px] text-primary-foreground" : "rounded-full border border-dashed border-border px-3 py-1 text-[11.5px] text-muted-foreground hover:text-foreground"}
                    >
                      {on ? "− " : "+ "}{t.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-3 space-y-2">
            {(meetingTasks[m.id] ?? []).map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
                <button onClick={() => canEdit && updateMeetingTaskStatus(t.id, t.status === "pendente" ? "concluida" : "pendente").then(onChanged)}>
                  <StatusChip status={t.status === "concluida" ? "concluída" : "a fazer"} label={t.status === "concluida" ? "Concluída" : "Pendente"} />
                </button>
                <p className="min-w-0 flex-1 truncate text-[13px]">{t.description}</p>
                {t.status !== "concluida" && (
                  <SendToExecution source={{
                    brandId,
                    brandSlug,
                    sourceModule: "espaco360",
                    sourceType: "reuniao_tarefa",
                    sourceId: t.id,
                    sourceUrl: `/e360/${brandSlug}?tab=Reuni%C3%B5es`,
                    title: t.description,
                    kind: "meeting_action",
                    requestedDueDate: t.due_date,
                  }} />
                )}
              </div>
            ))}
          </div>
          {canEdit && (
            <div className="mt-3 flex items-center gap-2">
              <input placeholder="Nova tarefa de reunião" value={taskDraft[m.id] ?? ""} onChange={(e) => setTaskDraft((d) => ({ ...d, [m.id]: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && addMeetingTask(m.id)} className="input-reach min-w-0 flex-1" />
              <Btn size="sm" onClick={() => addMeetingTask(m.id)}>Adicionar</Btn>
            </div>
          )}
        </GlassCard>
      ))}
      {meetings.length === 0 && <EmptyState title="Nenhuma reunião" description="Registre reuniões internas para acompanhar decisões e tarefas." />}
      {canEdit && (
        <GlassCard level={2} className="p-4">
          {adding ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <input autoFocus placeholder="Título da reunião" value={title} onChange={(e) => setTitle(e.target.value)} className="input-reach min-w-[220px] flex-1" />
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-reach w-40" />
                <Btn size="sm" onClick={addMeeting}>Adicionar</Btn>
                <Btn size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancelar</Btn>
              </div>
              {team.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11.5px] text-muted-foreground">Participantes:</span>
                  {team.map((t) => {
                    const on = newParticipants.includes(t.name);
                    return (
                      <button
                        key={t.id}
                        onClick={() => setNewParticipants((prev) => (on ? prev.filter((n) => n !== t.name) : [...prev, t.name]))}
                        className={on ? "rounded-full bg-reach-violet px-3 py-1 text-[11.5px] text-primary-foreground" : "rounded-full border border-dashed border-border px-3 py-1 text-[11.5px] text-muted-foreground hover:text-foreground"}
                      >
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <Btn variant="outline" size="sm" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" /> Nova reunião</Btn>
          )}
        </GlassCard>
      )}
    </div>
  );
}

function MensalTab({ brandId, monthly, canEdit, onChanged }: { brandId: string; monthly: MonthlyTracking[]; canEdit: boolean; onChanged: () => void }) {
  const [month, setMonth] = useState("");
  const [decisoes, setDecisoes] = useState("");
  const [insights, setInsights] = useState("");
  const [atencao, setAtencao] = useState("");
  const [resultados, setResultados] = useState("");

  async function save() {
    if (!month.trim()) return;
    await upsertMonthlyTracking({ brand_id: brandId, month_ref: month.trim(), decisoes_tomadas: decisoes, insights, ponto_atencao: atencao, resultados_internos: resultados });
    setMonth("");
    setDecisoes("");
    setInsights("");
    setAtencao("");
    setResultados("");
    onChanged();
  }

  return (
    <div className="space-y-5">
      {monthly.map((m) => (
        <GlassCard key={m.id} level={2} className="p-6">
          <h2 className="text-title mb-3">{m.month_ref}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {[["Decisões tomadas", m.decisoes_tomadas], ["Insights", m.insights], ["Ponto de atenção", m.ponto_atencao], ["Resultados internos", m.resultados_internos]].map(([label, value]) => (
              <div key={label as string}>
                <p className="text-label">{label}</p>
                <p className="mt-1 whitespace-pre-line text-[13px]">{(value as string) || "—"}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      ))}
      {monthly.length === 0 && <EmptyState title="Sem revisões mensais" description="Registre o primeiro mês para começar o histórico." />}
      {canEdit && (
        <GlassCard level={2} className="space-y-3 p-6">
          <h2 className="text-title">Registrar mês</h2>
          <input placeholder="Mês (ex.: Julho 2026)" value={month} onChange={(e) => setMonth(e.target.value)} className="input-reach" />
          <textarea placeholder="Decisões tomadas" value={decisoes} onChange={(e) => setDecisoes(e.target.value)} rows={2} className="input-reach resize-y" />
          <textarea placeholder="Insights" value={insights} onChange={(e) => setInsights(e.target.value)} rows={2} className="input-reach resize-y" />
          <textarea placeholder="Ponto de atenção" value={atencao} onChange={(e) => setAtencao(e.target.value)} rows={2} className="input-reach resize-y" />
          <textarea placeholder="Resultados internos" value={resultados} onChange={(e) => setResultados(e.target.value)} rows={2} className="input-reach resize-y" />
          <Btn size="sm" onClick={save}>Salvar mês</Btn>
        </GlassCard>
      )}
    </div>
  );
}

function CanaisTab({ brandId, channels, canEdit, onChanged }: { brandId: string; channels: Channel[]; canEdit: boolean; onChanged: () => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  async function add() {
    if (!name.trim()) return;
    await createChannel({ brand_id: brandId, name: name.trim(), order_index: channels.length });
    setName("");
    setAdding(false);
    onChanged();
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {channels.map((c) => (
          <GlassCard key={c.id} level={2} className="p-5">
            <h2 className="text-title mb-2">{c.name}</h2>
            {canEdit ? (
              <select value={c.status} onChange={(e) => updateChannel(c.id, { status: e.target.value }).then(onChanged)} className="input-reach !w-auto rounded-full py-1 text-[11px]">
                {CHANNEL_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            ) : (
              <StatusChip status={c.status} label={CHANNEL_STATUSES.find((s) => s.key === c.status)?.label} />
            )}
            {c.description && <p className="mt-2 text-[12.5px] text-muted-foreground">{c.description}</p>}
          </GlassCard>
        ))}
      </div>
      {channels.length === 0 && <EmptyState title="Nenhum canal" description="Configure os canais de comunicação da marca." />}
      {canEdit && (
        <GlassCard level={2} className="p-4">
          {adding ? (
            <div className="flex items-center gap-2">
              <input autoFocus placeholder="Nome do canal" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} className="input-reach min-w-0 flex-1" />
              <Btn size="sm" onClick={add}>Adicionar</Btn>
              <Btn size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancelar</Btn>
            </div>
          ) : (
            <Btn variant="outline" size="sm" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" /> Novo canal</Btn>
          )}
        </GlassCard>
      )}
    </div>
  );
}

function NotasTab({ brandId, canEdit }: { brandId: string; canEdit: boolean }) {
  const [notas, setNotas] = useState<Nota[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("todas");
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<Nota["kind"]>("nota");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [noteDate, setNoteDate] = useState("");

  async function load() {
    setNotas(await listNotas(brandId));
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

  async function add() {
    if (!title.trim()) return;
    await createNota({ brand_id: brandId, kind, title: title.trim(), content: content || null, note_date: noteDate || null });
    setTitle("");
    setContent("");
    setNoteDate("");
    setAdding(false);
    load();
  }

  const visible = filter === "todas" ? notas : notas.filter((n) => n.kind === filter);

  if (loading) return <p className="text-sm text-muted-foreground">Carregando notas…</p>;

  return (
    <div className="space-y-5">
      <GlassCard level={1} className="flex flex-wrap gap-1 p-1">
        {(["todas", ...NOTE_KINDS.map((k) => k.key)] as string[]).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={filter === k ? "rounded-xl bg-reach-violet px-3 py-1.5 text-[12.5px] font-medium text-primary-foreground" : "rounded-xl px-3 py-1.5 text-[12.5px] text-muted-foreground hover:bg-muted"}
          >
            {k === "todas" ? "Todas" : NOTE_KINDS.find((n) => n.key === k)?.label}
          </button>
        ))}
      </GlassCard>

      <div className="grid gap-4 sm:grid-cols-2">
        {visible.map((n) => (
          <GlassCard key={n.id} level={2} className="p-5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <StatusChip status={n.kind === "aviso" ? "atrasada" : n.kind === "lembrete" ? "em_andamento" : "planejamento"} label={NOTE_KINDS.find((k) => k.key === n.kind)?.label} />
              <div className="flex items-center gap-2">
                {n.note_date && <span className="text-[11px] text-muted-foreground">{n.note_date}</span>}
                {canEdit && (
                  <>
                    <button onClick={() => updateNota(n.id, { pinned: !n.pinned }).then(load)} className="text-[11px] text-muted-foreground hover:text-foreground">
                      {n.pinned ? "Desafixar" : "Fixar"}
                    </button>
                    <button onClick={() => deleteNota(n.id).then(load)} className="text-[11px] text-muted-foreground hover:text-reach-rose">
                      Excluir
                    </button>
                  </>
                )}
              </div>
            </div>
            <p className="text-[13.5px] font-medium">{n.title}</p>
            {n.content && <p className="mt-1 whitespace-pre-line text-[12.5px] text-muted-foreground">{n.content}</p>}
          </GlassCard>
        ))}
      </div>
      {visible.length === 0 && <EmptyState title="Nada registrado" description="Notas, lembretes, avisos e datas importantes da operação ficam aqui." />}

      {canEdit && (
        <GlassCard level={2} className="p-4">
          {adding ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <select value={kind} onChange={(e) => setKind(e.target.value as Nota["kind"])} className="input-reach">
                {NOTE_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
              </select>
              <input type="date" value={noteDate} onChange={(e) => setNoteDate(e.target.value)} className="input-reach" />
              <input autoFocus placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} className="input-reach sm:col-span-2" />
              <textarea placeholder="Conteúdo" rows={3} value={content} onChange={(e) => setContent(e.target.value)} className="input-reach resize-y sm:col-span-2" />
              <div className="flex gap-2 sm:col-span-2">
                <Btn size="sm" onClick={add}>Salvar</Btn>
                <Btn size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancelar</Btn>
              </div>
            </div>
          ) : (
            <Btn variant="outline" size="sm" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" /> Nova nota</Btn>
          )}
        </GlassCard>
      )}
    </div>
  );
}
