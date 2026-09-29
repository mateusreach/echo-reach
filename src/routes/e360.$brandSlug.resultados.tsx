import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Target, TrendingUp } from "lucide-react";
import { ReachIconAnimation } from "@/components/reach/reach-icon-animation";
import { SpaceShell } from "@/components/reach/space-shell";
import { PageHeader } from "@/components/reach/page-header";
import { GlassCard } from "@/components/reach/glass-card";
import { Btn, EmptyState, StatusChip } from "@/components/ui-reach/primitives";
import { isViewingAsClient } from "@/lib/view-as";
import { getAccess, modulePermissionKey } from "@/lib/agency-data";
import { supabase } from "@/integrations/supabase/client";
import {
  OBJECTIVE_PERIODS,
  OBJECTIVE_STATUSES,
  createKpi,
  createObjective,
  brandModules,
  getBrandBySlug,
  getBrandMembership,
  getProfile,
  listCampaigns,
  listInitiatives,
  listKpis,
  listObjectives,
  updateObjective,
  type Brand,
  type Campaign,
  type Initiative,
  type Kpi,
  type Objective,
} from "@/lib/reach-data";

export const Route = createFileRoute("/e360/$brandSlug/resultados")({
  component: ResultadosPage,
});

function ResultadosPage() {
  const { brandSlug } = Route.useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [displayName, setDisplayName] = useState("Você");
  const [canEdit, setCanEdit] = useState(false);
  const [tab, setTab] = useState<"visao" | "objetivos" | "kpis">("visao");

  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [kpis, setKpis] = useState<Kpi[]>([]);

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
    const [profile, init, camp, objs, ks] = await Promise.all([
      getProfile(session.user.id),
      listInitiatives(b.id),
      listCampaigns(b.id),
      listObjectives(b.id),
      listKpis(b.id),
    ]);
    setCanEdit(!isViewingAsClient() && (access.isAgency || !!membership?.isAdmin || !!membership?.permissions.includes(modulePermissionKey("espaco360", "editar"))));
    if (profile?.display_name) setDisplayName(profile.display_name);
    setInitiatives(init);
    setCampaigns(camp);
    setObjectives(objs);
    setKpis(ks);
    setLoading(false);
  }

  useEffect(() => {
    setLoading(true);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandSlug]);

  const byPeriod = useMemo(() => {
    const groups: Record<string, Objective[]> = {};
    for (const o of objectives) {
      const key = o.period_label || OBJECTIVE_PERIODS.find((p) => p.key === o.period_type)?.label || o.period_type;
      groups[key] = groups[key] || [];
      groups[key].push(o);
    }
    return Object.entries(groups);
  }, [objectives]);

  const kpisByCampaign = useMemo(() => {
    const groups: Record<string, Kpi[]> = { __geral__: [] };
    for (const k of kpis) {
      const key = k.campaign_id || "__geral__";
      groups[key] = groups[key] || [];
      groups[key].push(k);
    }
    return groups;
  }, [kpis]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <ReachIconAnimation size={48} context="page-loading" />
        <p className="text-sm text-muted-foreground">Carregando Resultados…</p>
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

  const objetivosAtingidos = objectives.filter((o) => o.status === "atingido").length;
  const objetivosProgresso = objectives.length ? Math.round((objetivosAtingidos / objectives.length) * 100) : 0;

  return (
    <SpaceShell brandSlug={brandSlug} brandName={brand.name} primaryColor={(brand as any)?.primary_color} accentColor={(brand as any)?.accent_color}>
      <PageHeader eyebrow="Performance" title="Resultados" description="Objetivos, KPIs por campanha, comparativos e histórico. Dados reais, registrados manualmente pela equipe." />

      <GlassCard level={1} className="mb-6 flex flex-wrap gap-1 p-1">
        {[
          { key: "visao", label: "Visão geral" },
          { key: "objetivos", label: "Objetivos" },
          { key: "kpis", label: "KPIs por campanha" },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key as any)} className={tab === t.key ? "rounded-xl bg-reach-coral px-3 py-1.5 text-[12.5px] font-medium text-primary-foreground" : "rounded-xl px-3 py-1.5 text-[12.5px] text-muted-foreground hover:bg-muted"}>
            {t.label}
          </button>
        ))}
      </GlassCard>

      {tab === "visao" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <GlassCard level={2} className="p-5">
              <div className="text-label">Objetivos atingidos</div>
              <div className="mt-2 text-display text-reach-coral">{objetivosAtingidos}/{objectives.length || 0}</div>
            </GlassCard>
            <GlassCard level={2} className="p-5">
              <div className="text-label">Progresso geral</div>
              <div className="mt-2 text-display text-reach-mint">{objetivosProgresso}%</div>
            </GlassCard>
            <GlassCard level={2} className="p-5">
              <div className="text-label">Campanhas em andamento</div>
              <div className="mt-2 text-display text-reach-violet">{campaigns.filter((c) => c.status === "em_andamento").length}</div>
            </GlassCard>
            <GlassCard level={2} className="p-5">
              <div className="text-label">Indicadores registrados</div>
              <div className="mt-2 text-display text-reach-blue">{kpis.length}</div>
            </GlassCard>
          </div>
          <GlassCard level={2} className="p-6">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
              <div className="h-full rounded-full bg-reach-coral" style={{ width: `${objetivosProgresso}%` }} />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">Progresso combinado de todos os objetivos cadastrados.</p>
          </GlassCard>
        </div>
      )}

      {tab === "objetivos" && (
        <ObjetivosTab brandId={brand.id} byPeriod={byPeriod} canEdit={canEdit} onChanged={refresh} totalObjectives={objectives.length} />
      )}

      {tab === "kpis" && (
        <KpisTab brandId={brand.id} campaigns={campaigns} objectives={objectives} kpisByCampaign={kpisByCampaign} canEdit={canEdit} onChanged={refresh} />
      )}
    </SpaceShell>
  );
}

function ObjetivosTab({ brandId, byPeriod, canEdit, onChanged, totalObjectives }: { brandId: string; byPeriod: [string, Objective[]][]; canEdit: boolean; onChanged: () => void; totalObjectives: number }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [periodType, setPeriodType] = useState("mensal");
  const [periodLabel, setPeriodLabel] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [unit, setUnit] = useState("");

  async function add() {
    if (!title.trim()) return;
    await createObjective({
      brand_id: brandId,
      title: title.trim(),
      period_type: periodType,
      period_label: periodLabel || null,
      target_value: targetValue ? Number(targetValue) : null,
      unit: unit || null,
      order_index: totalObjectives,
    });
    setTitle("");
    setPeriodLabel("");
    setTargetValue("");
    setUnit("");
    setAdding(false);
    onChanged();
  }

  return (
    <div className="space-y-5">
      {byPeriod.map(([period, objs]) => (
        <GlassCard key={period} level={2} className="p-6">
          <h2 className="text-title mb-3">{period}</h2>
          <div className="space-y-3">
            {objs.map((o) => {
              const pct = o.target_value ? Math.min(100, Math.round(((o.current_value ?? 0) / o.target_value) * 100)) : null;
              return (
                <div key={o.id} className="rounded-xl border border-border bg-card px-4 py-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-[13.5px] font-medium">{o.title}</span>
                    {canEdit ? (
                      <select value={o.status} onChange={(e) => updateObjective(o.id, { status: e.target.value }).then(onChanged)} className="input-reach !w-auto rounded-full py-1 text-[11px]">
                        {OBJECTIVE_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </select>
                    ) : (
                      <StatusChip status={o.status} label={OBJECTIVE_STATUSES.find((s) => s.key === o.status)?.label} />
                    )}
                  </div>
                  {o.target_value != null ? (
                    <>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
                        <div className="h-full rounded-full bg-reach-blue" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-[11.5px] text-muted-foreground">
                        <span>{o.current_value ?? 0} / {o.target_value} {o.unit ?? ""}</span>
                        {canEdit && (
                          <input
                            type="number"
                            defaultValue={o.current_value ?? 0}
                            onBlur={(e) => updateObjective(o.id, { current_value: Number(e.target.value) }).then(onChanged)}
                            className="input-reach !w-24 py-0.5 text-right text-[11.5px]"
                          />
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-[11.5px] text-muted-foreground">Sem meta numérica definida.</p>
                  )}
                </div>
              );
            })}
          </div>
        </GlassCard>
      ))}
      {byPeriod.length === 0 && <EmptyState title="Nenhum objetivo cadastrado" description="Defina objetivos anuais, trimestrais ou mensais para acompanhar o progresso real." />}
      {canEdit && (
        <GlassCard level={2} className="p-4">
          {adding ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <input autoFocus placeholder="Título do objetivo" value={title} onChange={(e) => setTitle(e.target.value)} className="input-reach sm:col-span-2" />
              <select value={periodType} onChange={(e) => setPeriodType(e.target.value)} className="input-reach">
                {OBJECTIVE_PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
              <input placeholder="Rótulo do período (ex.: Q3 2026)" value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} className="input-reach" />
              <input type="number" placeholder="Meta numérica (opcional)" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} className="input-reach" />
              <input placeholder="Unidade (ex.: leads, R$, %)" value={unit} onChange={(e) => setUnit(e.target.value)} className="input-reach" />
              <div className="flex gap-2 sm:col-span-2">
                <Btn size="sm" onClick={add}>Adicionar</Btn>
                <Btn size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancelar</Btn>
              </div>
            </div>
          ) : (
            <Btn variant="outline" size="sm" onClick={() => setAdding(true)}><Target className="h-3.5 w-3.5" /> Novo objetivo</Btn>
          )}
        </GlassCard>
      )}
    </div>
  );
}

function KpisTab({ brandId, campaigns, objectives, kpisByCampaign, canEdit, onChanged }: { brandId: string; campaigns: Campaign[]; objectives: Objective[]; kpisByCampaign: Record<string, Kpi[]>; canEdit: boolean; onChanged: () => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [unit, setUnit] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [objectiveId, setObjectiveId] = useState("");
  const [source, setSource] = useState("manual");

  async function add() {
    if (!name.trim() || !value) return;
    await createKpi({
      brand_id: brandId,
      name: name.trim(),
      value: Number(value),
      target_value: targetValue ? Number(targetValue) : null,
      unit: unit || null,
      campaign_id: campaignId || null,
      objective_id: objectiveId || null,
      source,
    });
    setName("");
    setValue("");
    setTargetValue("");
    setUnit("");
    setCampaignId("");
    setObjectiveId("");
    setAdding(false);
    onChanged();
  }

  return (
    <div className="space-y-5">
      {campaigns.map((c) => {
        const ks = kpisByCampaign[c.id] ?? [];
        if (ks.length === 0) return null;
        return (
          <GlassCard key={c.id} level={2} className="p-6">
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5 text-reach-blue" />
              <h2 className="text-title">{c.title}</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {ks.map((k) => (
                <div key={k.id} className="rounded-xl border border-border bg-card px-4 py-3">
                  <p className="text-[12.5px] text-muted-foreground">{k.name}</p>
                  <p className="mt-1 text-[18px] font-semibold">{k.value}{k.unit ? ` ${k.unit}` : ""}{k.target_value != null ? <span className="ml-1 text-[11.5px] font-normal text-muted-foreground">/ meta {k.target_value}</span> : null}</p>
                </div>
              ))}
            </div>
          </GlassCard>
        );
      })}

      {(kpisByCampaign.__geral__ ?? []).length > 0 && (
        <GlassCard level={2} className="p-6">
          <h2 className="text-title mb-3">Indicadores gerais</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {kpisByCampaign.__geral__.map((k) => (
              <div key={k.id} className="rounded-xl border border-border bg-card px-4 py-3">
                <p className="text-[12.5px] text-muted-foreground">{k.name}</p>
                <p className="mt-1 text-[18px] font-semibold">{k.value}{k.unit ? ` ${k.unit}` : ""}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {campaigns.every((c) => (kpisByCampaign[c.id] ?? []).length === 0) && (kpisByCampaign.__geral__ ?? []).length === 0 && (
        <EmptyState title="Nenhum indicador registrado" description="Registre alcance, impressões, leads, vendas, ROAS ou indicadores personalizados por campanha." />
      )}

      {canEdit && (
        <GlassCard level={2} className="p-4">
          {adding ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <input autoFocus placeholder="Nome do indicador (ex.: Leads, ROAS)" value={name} onChange={(e) => setName(e.target.value)} className="input-reach sm:col-span-2" />
              <input type="number" placeholder="Valor" value={value} onChange={(e) => setValue(e.target.value)} className="input-reach" />
              <input type="number" placeholder="Meta (opcional)" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} className="input-reach" />
              <input placeholder="Unidade (opcional)" value={unit} onChange={(e) => setUnit(e.target.value)} className="input-reach" />
              <select value={source} onChange={(e) => setSource(e.target.value)} className="input-reach">
                <option value="manual">Manual</option>
                <option value="planilha">Planilha</option>
                <option value="plataforma">Plataforma de anúncios</option>
              </select>
              <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className="input-reach">
                <option value="">Sem campanha (geral)</option>
                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
              <select value={objectiveId} onChange={(e) => setObjectiveId(e.target.value)} className="input-reach sm:col-span-2">
                <option value="">Sem objetivo vinculado</option>
                {objectives.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
              </select>
              <div className="flex gap-2 sm:col-span-2">
                <Btn size="sm" onClick={add}>Adicionar</Btn>
                <Btn size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancelar</Btn>
              </div>
            </div>
          ) : (
            <Btn variant="outline" size="sm" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" /> Novo indicador</Btn>
          )}
        </GlassCard>
      )}
    </div>
  );
}
