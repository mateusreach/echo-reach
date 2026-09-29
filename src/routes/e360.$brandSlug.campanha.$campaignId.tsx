import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, X } from "lucide-react";
import { ReachIconAnimation } from "@/components/reach/reach-icon-animation";
import { SpaceShell } from "@/components/reach/space-shell";
import { PageHeader } from "@/components/reach/page-header";
import { GlassCard } from "@/components/reach/glass-card";
import { Btn, EmptyState, StatusChip } from "@/components/ui-reach/primitives";
import { isViewingAsClient } from "@/lib/view-as";
import { getAccess, modulePermissionKey } from "@/lib/agency-data";
import { supabase } from "@/integrations/supabase/client";
import {
  CAMPAIGN_STAGES,
  DELIVERY_STATUSES,
  deriveCampaignStatus,
  PRIORITIES,
  SOLICITACAO_STATUSES,
  TASK_STATUSES,
  createSolicitacao,
  createTask,
  getBrandBySlug,
  getBrandMembership,
  brandModules,
  getCampaign,
  getProfile,
  listConteudos,
  listDeliveries,
  listInitiatives,
  listKpis,
  listObjectives,
  listSolicitacoes,
  listTasks,
  updateCampaign,
  updateSolicitacao,
  updateTask,
  type Brand,
  type Campaign,
  type Conteudo,
  type Delivery,
  type Espaco360Task,
  type Initiative,
  type Kpi,
  type Objective,
  type Solicitacao,
} from "@/lib/reach-data";

export const Route = createFileRoute("/e360/$brandSlug/campanha/$campaignId")({
  component: CampaignDetailPage,
});

const TABS = ["Informações", "Estratégia", "Ciclo", "Execução", "Materiais", "Solicitações", "Acompanhamento", "Resultados", "Aprendizados"] as const;
type TabKey = (typeof TABS)[number];

function toList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  return [];
}

function CampaignDetailPage() {
  const { brandSlug, campaignId } = Route.useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [displayName, setDisplayName] = useState("Você");
  const [canEdit, setCanEdit] = useState(false);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [tasks, setTasks] = useState<Espaco360Task[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [conteudos, setConteudos] = useState<Conteudo[]>([]);
  const [tab, setTab] = useState<TabKey>("Informações");

  async function refresh() {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) {
      navigate({ to: "/auth" });
      return;
    }
    const b = await getBrandBySlug(brandSlug);
    if (!b || !brandModules(b).espaco360) {
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
    const [profile, camp, init, objs, tks, dels, sols, ks, conts] = await Promise.all([
      getProfile(session.user.id),
      getCampaign(campaignId),
      listInitiatives(b.id),
      listObjectives(b.id),
      listTasks(b.id),
      listDeliveries(b.id),
      listSolicitacoes(b.id),
      listKpis(b.id),
      listConteudos(b.id),
    ]);
    setCanEdit(!isViewingAsClient() && (access.isAgency || !!membership?.isAdmin || !!membership?.permissions.includes(modulePermissionKey("espaco360", "editar"))));
    if (profile?.display_name) setDisplayName(profile.display_name);
    setCampaign(camp?.brand_id === b.id ? camp : null);
    setInitiatives(init);
    setObjectives(objs);
    setTasks(tks.filter((t) => t.campaign_id === campaignId));
    setDeliveries(dels.filter((d) => d.campaign_id === campaignId));
    setSolicitacoes(sols.filter((s) => s.campaign_id === campaignId));
    setKpis(ks.filter((k) => k.campaign_id === campaignId));
    setConteudos(conts.filter((c) => c.campaign_id === campaignId));
    setLoading(false);
  }

  useEffect(() => {
    setLoading(true);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandSlug, campaignId]);

  const requiredTasks = tasks.filter((t) => t.is_required);
  const doneRequired = requiredTasks.filter((t) => t.status === "concluida");
  const progressPct = requiredTasks.length ? Math.round((doneRequired.length / requiredTasks.length) * 100) : 0;

  async function saveField(patch: Partial<Campaign>) {
    if (!campaign) return;
    const finalPatch = patch.stage ? { ...patch, status: deriveCampaignStatus(patch.stage) } : patch;
    await updateCampaign(campaign.id, finalPatch as any);
    refresh();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <ReachIconAnimation size={48} context="page-loading" />
        <p className="text-sm text-muted-foreground">Carregando campanha…</p>
      </div>
    );
  }
  if (!brand || !campaign) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <p className="text-lg font-semibold">Campanha não encontrada</p>
      </div>
    );
  }

  return (
    <SpaceShell brandSlug={brandSlug} brandName={brand.name} primaryColor={(brand as any)?.primary_color} accentColor={(brand as any)?.accent_color}>
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1">
        <Link to="/e360/$brandSlug" params={{ brandSlug }} search={{ tab: "Campanhas", filtro: undefined }} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para Campanhas
        </Link>
        <Link to="/e360/$brandSlug/plano" params={{ brandSlug }} search={{ tab: "estrategia", filtro: undefined }} className="text-xs text-muted-foreground transition-colors hover:text-foreground">
          Ver no Plano →
        </Link>
      </div>
      <PageHeader
        eyebrow={campaign.quarter ?? "Campanha"}
        title={campaign.title}
        description={`${CAMPAIGN_STAGES.find((s) => s.key === campaign.stage)?.label ?? "Planejamento"} · ${requiredTasks.length ? `${doneRequired.length}/${requiredTasks.length} tarefas obrigatórias concluídas — ${progressPct}%` : "sem tarefas obrigatórias vinculadas"}`}
      />

      {requiredTasks.length > 0 && (
        <GlassCard level={2} className="mb-6 p-5">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
            <div className="h-full rounded-full bg-reach-coral" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="mt-2 text-[11.5px] text-muted-foreground">
            {progressPct < 100 ? "A campanha só pode ser considerada concluída quando todas as tarefas obrigatórias forem finalizadas." : "Todas as tarefas obrigatórias foram concluídas."}
          </p>
        </GlassCard>
      )}

      <GlassCard level={1} className="mb-6 flex flex-wrap gap-1 p-1">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={tab === t ? "rounded-xl bg-reach-coral px-3 py-1.5 text-[12.5px] font-medium text-primary-foreground" : "rounded-xl px-3 py-1.5 text-[12.5px] text-muted-foreground hover:bg-muted"}>
            {t}
          </button>
        ))}
      </GlassCard>

      {tab === "Informações" && (
        <InformacoesTab campaign={campaign} initiatives={initiatives} objectives={objectives} brandSlug={brandSlug} canEdit={canEdit} onSave={saveField} />
      )}
      {tab === "Estratégia" && <EstrategiaTab campaign={campaign} canEdit={canEdit} onSave={saveField} />}
      {tab === "Ciclo" && <CicloTab campaign={campaign} canEdit={canEdit} onSave={saveField} />}
      {tab === "Execução" && <ExecucaoTab brandId={brand.id} campaignId={campaign.id} campaignInitiativeId={campaign.initiative_id} tasks={tasks} initiatives={initiatives} canEdit={canEdit} onChanged={refresh} />}
      {tab === "Materiais" && <MateriaisTab campaign={campaign} conteudos={conteudos} canEdit={canEdit} onSave={saveField} />}
      {tab === "Solicitações" && <SolicitacoesTab brandId={brand.id} campaignId={campaign.id} solicitacoes={solicitacoes} canEdit={canEdit} onChanged={refresh} />}
      {tab === "Acompanhamento" && <AcompanhamentoTab deliveries={deliveries} />}
      {tab === "Resultados" && <ResultadosTab kpis={kpis} />}
      {tab === "Aprendizados" && <AprendizadosTab campaign={campaign} canEdit={canEdit} onSave={saveField} />}
    </SpaceShell>
  );
}

function EditableText({ label, value, canEdit, multiline, onSave }: { label: string; value: string | null; canEdit: boolean; multiline?: boolean; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => setDraft(value ?? ""), [value]);
  return (
    <div>
      <p className="text-label mb-1.5">{label}</p>
      {canEdit ? (
        multiline ? (
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => draft !== (value ?? "") && onSave(draft)} rows={3} className="input-reach resize-y" />
        ) : (
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => draft !== (value ?? "") && onSave(draft)} className="input-reach" />
        )
      ) : (
        <p className="whitespace-pre-line text-[13.5px]">{value || "—"}</p>
      )}
    </div>
  );
}

function InformacoesTab({
  campaign,
  initiatives,
  objectives,
  brandSlug,
  canEdit,
  onSave,
}: {
  campaign: Campaign;
  initiatives: Initiative[];
  objectives: Objective[];
  brandSlug: string;
  canEdit: boolean;
  onSave: (p: Partial<Campaign>) => void;
}) {
  const linkedInitiative = initiatives.find((i) => i.id === campaign.initiative_id);
  const linkedObjective = objectives.find((o) => o.id === (campaign.objective_id ?? linkedInitiative?.objective_id));
  return (
    <GlassCard level={2} className="space-y-4 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <EditableText label="Título" value={campaign.title} canEdit={canEdit} onSave={(v) => onSave({ title: v })} />
        <EditableText label="Período" value={campaign.quarter} canEdit={canEdit} onSave={(v) => onSave({ quarter: v })} />
        <div>
          <p className="text-label mb-1.5">Estratégia vinculada</p>
          {canEdit ? (
            <select
              value={campaign.initiative_id ?? ""}
              onChange={(e) => {
                const next = initiatives.find((i) => i.id === e.target.value);
                onSave({ initiative_id: e.target.value || null, objective_id: next?.objective_id ?? null });
              }}
              className="input-reach"
            >
              <option value="">Nenhuma</option>
              {initiatives.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
            </select>
          ) : (
            <p className="text-[13.5px]">{linkedInitiative?.title ?? "—"}</p>
          )}
        </div>
        <div>
          <p className="text-label mb-1.5">Objetivo</p>
          <p className="text-[13.5px]">{linkedObjective?.title ?? "— (definido pela estratégia)"}</p>
        </div>
        <div>
          <p className="text-label mb-1.5">Prioridade</p>
          {canEdit ? (
            <select value={campaign.priority} onChange={(e) => onSave({ priority: e.target.value })} className="input-reach">
              {PRIORITIES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          ) : (
            <StatusChip status={campaign.priority} />
          )}
        </div>
        <EditableText label="Responsável" value={campaign.responsible} canEdit={canEdit} onSave={(v) => onSave({ responsible: v })} />
        <div>
          <p className="text-label mb-1.5">Data de início</p>
          {canEdit ? (
            <input type="date" value={campaign.start_date ?? ""} onChange={(e) => onSave({ start_date: e.target.value || null })} className="input-reach" />
          ) : (
            <p className="text-[13.5px]">{campaign.start_date || "—"}</p>
          )}
        </div>
        <div>
          <p className="text-label mb-1.5">Data de encerramento</p>
          {canEdit ? (
            <input type="date" value={campaign.end_date ?? ""} onChange={(e) => onSave({ end_date: e.target.value || null })} className="input-reach" />
          ) : (
            <p className="text-[13.5px]">{campaign.end_date || "—"}</p>
          )}
        </div>
      </div>
      <EditableText label="Descrição" value={campaign.description} canEdit={canEdit} multiline onSave={(v) => onSave({ description: v })} />
    </GlassCard>
  );
}

function EstrategiaTab({ campaign, canEdit, onSave }: { campaign: Campaign; canEdit: boolean; onSave: (p: Partial<Campaign>) => void }) {
  return (
    <GlassCard level={2} className="space-y-4 p-6">
      <EditableText label="Contexto" value={campaign.context} canEdit={canEdit} multiline onSave={(v) => onSave({ context: v })} />
      <EditableText label="Oportunidade" value={campaign.opportunity} canEdit={canEdit} multiline onSave={(v) => onSave({ opportunity: v })} />
      <EditableText label="Público-alvo" value={campaign.target_audience} canEdit={canEdit} multiline onSave={(v) => onSave({ target_audience: v })} />
      <EditableText label="Mensagem principal" value={campaign.message} canEdit={canEdit} multiline onSave={(v) => onSave({ message: v })} />
      <EditableText label="Oferta" value={campaign.offer} canEdit={canEdit} multiline onSave={(v) => onSave({ offer: v })} />
      <EditableText label="Produtos envolvidos" value={campaign.products} canEdit={canEdit} multiline onSave={(v) => onSave({ products: v })} />
    </GlassCard>
  );
}

function CicloTab({ campaign, canEdit, onSave }: { campaign: Campaign; canEdit: boolean; onSave: (p: Partial<Campaign>) => void }) {
  const currentIndex = CAMPAIGN_STAGES.findIndex((s) => s.key === campaign.stage);
  return (
    <GlassCard level={2} className="p-6">
      <p className="text-label mb-4">Etapa atual do ciclo</p>
      <div className="flex flex-wrap gap-2">
        {CAMPAIGN_STAGES.map((s, idx) => {
          const active = s.key === campaign.stage;
          const past = currentIndex >= 0 && idx < currentIndex;
          return (
            <button
              key={s.key}
              disabled={!canEdit}
              onClick={() => onSave({ stage: s.key })}
              className={
                active
                  ? "rounded-xl bg-reach-coral px-3.5 py-2 text-[12.5px] font-medium text-primary-foreground"
                  : past
                  ? "rounded-xl bg-reach-coral/20 px-3.5 py-2 text-[12.5px] text-reach-coral"
                  : "rounded-xl border border-border px-3.5 py-2 text-[12.5px] text-muted-foreground enabled:hover:bg-muted"
              }
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </GlassCard>
  );
}

function ExecucaoTab({ brandId, campaignId, campaignInitiativeId, tasks, initiatives, canEdit, onChanged }: { brandId: string; campaignId: string; campaignInitiativeId: string | null; tasks: Espaco360Task[]; initiatives: Initiative[]; canEdit: boolean; onChanged: () => void }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [isRequired, setIsRequired] = useState(true);
  const [dueDate, setDueDate] = useState("");

  async function add() {
    if (!title.trim()) return;
    await createTask({ brand_id: brandId, campaign_id: campaignId, initiative_id: campaignInitiativeId, title: title.trim(), is_required: isRequired, due_date: dueDate || null });
    setTitle("");
    setDueDate("");
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
      <GlassCard level={2} className="p-6">
        <div className="space-y-2">
          {tasks.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <button onClick={() => canEdit && cycleStatus(t)}>
                <StatusChip status={t.status} label={TASK_STATUSES.find((s) => s.key === t.status)?.label} />
              </button>
              <p className="min-w-0 flex-1 truncate text-[13px]">{t.title}</p>
              {t.is_required && <StatusChip status="atrasada" label="Obrigatória" />}
              {t.due_date && <span className="shrink-0 text-[11px] text-muted-foreground">{t.due_date}</span>}
            </div>
          ))}
          {tasks.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma tarefa vinculada a esta campanha ainda.</p>}
        </div>
      </GlassCard>
      {canEdit && (
        <GlassCard level={2} className="p-4">
          {adding ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <input autoFocus placeholder="Título da tarefa" value={title} onChange={(e) => setTitle(e.target.value)} className="input-reach sm:col-span-2" />
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input-reach" />
              <label className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
                <input type="checkbox" checked={isRequired} onChange={(e) => setIsRequired(e.target.checked)} /> Obrigatória para concluir a campanha
              </label>
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

function MateriaisTab({ campaign, conteudos, canEdit, onSave }: { campaign: Campaign; conteudos: Conteudo[]; canEdit: boolean; onSave: (p: Partial<Campaign>) => void }) {
  const materials = toList(campaign.materials);
  const [draft, setDraft] = useState("");

  async function addMaterial() {
    if (!draft.trim()) return;
    onSave({ materials: [...materials, draft.trim()] as any });
    setDraft("");
  }
  async function removeMaterial(idx: number) {
    onSave({ materials: materials.filter((_, i) => i !== idx) as any });
  }

  return (
    <div className="space-y-5">
      <GlassCard level={2} className="p-6">
        <p className="text-label mb-3">Conteúdos vinculados</p>
        <div className="space-y-2">
          {conteudos.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-2.5">
              <span className="min-w-0 flex-1 truncate text-[13px]">{c.title}</span>
              <StatusChip status={c.status} />
            </div>
          ))}
          {conteudos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum conteúdo vinculado ainda. Crie a partir de uma ideia na Biblioteca.</p>}
        </div>
      </GlassCard>
      <GlassCard level={2} className="p-6">
        <p className="text-label mb-3">Materiais e referências</p>
        <div className="space-y-2">
          {materials.map((m, idx) => (
            <div key={idx} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-2.5">
              <span className="min-w-0 flex-1 truncate text-[13px]">{m}</span>
              {canEdit && (
                <button onClick={() => removeMaterial(idx)} className="text-muted-foreground hover:text-reach-rose">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          {materials.length === 0 && <p className="text-sm text-muted-foreground">Nenhum material listado ainda.</p>}
        </div>
        {canEdit && (
          <div className="mt-3 flex items-center gap-2">
            <input placeholder="Descrição do material (ex.: link de arte, arquivo, referência)" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addMaterial()} className="input-reach min-w-0 flex-1" />
            <Btn size="sm" onClick={addMaterial}>Adicionar</Btn>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

function SolicitacoesTab({ brandId, campaignId, solicitacoes, canEdit, onChanged }: { brandId: string; campaignId: string; solicitacoes: Solicitacao[]; canEdit: boolean; onChanged: () => void }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");

  async function add() {
    if (!title.trim()) return;
    await createSolicitacao({ brand_id: brandId, campaign_id: campaignId, title: title.trim() });
    setTitle("");
    setAdding(false);
    onChanged();
  }

  return (
    <div className="space-y-5">
      <GlassCard level={2} className="p-6">
        <div className="space-y-2">
          {solicitacoes.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
              {canEdit ? (
                <select value={s.status} onChange={(e) => updateSolicitacao(s.id, { status: e.target.value }).then(onChanged)} className="input-reach !w-auto rounded-full py-1 text-[11px]">
                  {SOLICITACAO_STATUSES.map((st) => <option key={st.key} value={st.key}>{st.label}</option>)}
                </select>
              ) : (
                <StatusChip status={s.status} />
              )}
              <p className="min-w-0 flex-1 truncate text-[13px]">{s.title}</p>
              <span className="text-[11px] text-muted-foreground">{s.task_id ? "Tarefa vinculada" : "Sincronização pendente"}</span>
            </div>
          ))}
          {solicitacoes.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma solicitação para esta campanha.</p>}
        </div>
      </GlassCard>
      {canEdit && (
        <GlassCard level={2} className="p-4">
          {adding ? (
            <div className="flex flex-wrap items-center gap-2">
              <input autoFocus placeholder="Título da solicitação" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} className="input-reach min-w-[220px] flex-1" />
              <Btn size="sm" onClick={add}>Adicionar</Btn>
              <Btn size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancelar</Btn>
            </div>
          ) : (
            <Btn variant="outline" size="sm" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" /> Nova solicitação</Btn>
          )}
        </GlassCard>
      )}
    </div>
  );
}

function AcompanhamentoTab({ deliveries }: { deliveries: Delivery[] }) {
  const completed = deliveries.filter((delivery) => delivery.status === "entregue" || delivery.status === "publicado");
  return (
    <GlassCard level={2} className="p-6">
      <p className="mb-4 text-[12.5px] text-muted-foreground">Entregas concluídas desta campanha. Cada solicitação é executada como tarefa e aparece aqui ao ser concluída.</p>
      <div className="space-y-2">
        {completed.map((delivery) => (
          <div key={delivery.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
            <StatusChip status={delivery.status} label={DELIVERY_STATUSES.find((status) => status.key === delivery.status)?.label} />
            <p className="min-w-0 flex-1 truncate text-[13px]">{delivery.title}</p>
            {delivery.delivered_at && <span className="text-[11px] text-muted-foreground">{delivery.delivered_at.slice(0, 10)}</span>}
          </div>
        ))}
        {completed.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma entrega concluída para esta campanha.</p>}
      </div>
    </GlassCard>
  );
}

function ResultadosTab({ kpis }: { kpis: Kpi[] }) {
  return (
    <GlassCard level={2} className="p-6">
      <div className="grid gap-3 sm:grid-cols-2">
        {kpis.map((k) => (
          <div key={k.id} className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-[12.5px] text-muted-foreground">{k.name}</p>
            <p className="mt-1 text-[18px] font-semibold">{k.value}{k.unit ? ` ${k.unit}` : ""}{k.target_value != null ? <span className="ml-1 text-[11.5px] font-normal text-muted-foreground">/ meta {k.target_value}</span> : null}</p>
          </div>
        ))}
      </div>
      {kpis.length === 0 && <p className="text-sm text-muted-foreground">Nenhum resultado registrado ainda. Adicione indicadores em Resultados → KPIs por campanha.</p>}
    </GlassCard>
  );
}

function AprendizadosTab({ campaign, canEdit, onSave }: { campaign: Campaign; canEdit: boolean; onSave: (p: Partial<Campaign>) => void }) {
  const learnings = toList(campaign.learnings);
  const [draft, setDraft] = useState("");

  async function addLearning() {
    if (!draft.trim()) return;
    onSave({ learnings: [...learnings, draft.trim()] as any });
    setDraft("");
  }
  async function removeLearning(idx: number) {
    onSave({ learnings: learnings.filter((_, i) => i !== idx) as any });
  }

  return (
    <GlassCard level={2} className="p-6">
      <div className="space-y-2">
        {learnings.map((l, idx) => (
          <div key={idx} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3">
            <span className="min-w-0 flex-1 text-[13px]">{l}</span>
            {canEdit && (
              <button onClick={() => removeLearning(idx)} className="text-muted-foreground hover:text-reach-rose">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        {learnings.length === 0 && <p className="text-sm text-muted-foreground">Nenhum aprendizado registrado ainda.</p>}
      </div>
      {canEdit && (
        <div className="mt-3 flex items-center gap-2">
          <input placeholder="O que aprendemos com esta campanha?" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addLearning()} className="input-reach min-w-0 flex-1" />
          <Btn size="sm" onClick={addLearning}>Adicionar</Btn>
        </div>
      )}
    </GlassCard>
  );
}
