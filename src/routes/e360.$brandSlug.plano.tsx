import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { ReachIconAnimation } from "@/components/reach/reach-icon-animation";
import { SpaceShell } from "@/components/reach/space-shell";
import { PageHeader } from "@/components/reach/page-header";
import { GlassCard } from "@/components/reach/glass-card";
import { Btn, StatusChip } from "@/components/ui-reach/primitives";
import { applyTemplateToBrand, getAccess, listPlanTemplates, modulePermissionKey, type PlanTemplate } from "@/lib/agency-data";
import { SectionEditor } from "@/components/reach/section-editor";
import { IdentidadeVisualSection } from "@/components/reach/identidade-visual-section";
import { isViewingAsClient } from "@/lib/view-as";
import { supabase } from "@/integrations/supabase/client";
import {
  OBJECTIVE_PERIODS,
  OBJECTIVE_STATUSES,
  STAGES,
  createObjective,
  createSection,
  brandModules,
  getBrandBySlug,
  getBrandMembership,
  getProfile,
  listBrandHomeSections,
  listCampaigns,
  listInitiatives,
  listObjectives,
  minhaEmpresaSection,
  newFieldKey,
  sectionsByStage,
  updateObjective,
  type Brand,
  type BrandHomeSection,
  type Campaign,
  type Initiative,
  type Objective,
} from "@/lib/reach-data";

export const Route = createFileRoute("/e360/$brandSlug/plano")({
  component: PlanoPage,
  validateSearch: (search: Record<string, unknown>) => ({
    tab: typeof search.tab === "string" ? search.tab : undefined,
  }),
});

const TAB_KEYS = { fundacao: "Fundação", objetivos: "Objetivos", estrategia: "Estratégia" } as const;

const TABS = ["Fundação", "Objetivos", "Estratégia"] as const;

function PlanoPage() {
  const { brandSlug } = Route.useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [displayName, setDisplayName] = useState("Você");
  const [isAgency, setIsAgency] = useState(false);
  const [canEditPlano, setCanEditPlano] = useState(false);
  const searchParams = Route.useSearch();
  const tab = (TAB_KEYS[(searchParams.tab as keyof typeof TAB_KEYS) ?? "fundacao"] ?? "Fundação") as (typeof TABS)[number];
  const setTab = (next: (typeof TABS)[number]) => {
    const key = (Object.keys(TAB_KEYS) as (keyof typeof TAB_KEYS)[]).find((k) => TAB_KEYS[k] === next) ?? "fundacao";
    navigate({ to: "/e360/$brandSlug/plano", params: { brandSlug }, search: { tab: key, filtro: undefined } });
  };
  const [sections, setSections] = useState<BrandHomeSection[]>([]);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stage, setStage] = useState<string>("alicerce");
  const [addingSection, setAddingSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");

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
    const [profile, secs, objs, init, camp] = await Promise.all([
      getProfile(session.user.id),
      listBrandHomeSections(b.id),
      listObjectives(b.id),
      listInitiatives(b.id),
      listCampaigns(b.id),
    ]);
    const agency = access.isAgency && !isViewingAsClient();
    setIsAgency(agency);
    if (agency) {
      setCanEditPlano(true);
    } else {
      setCanEditPlano(!!membership && (membership.isAdmin || membership.permissions.includes(modulePermissionKey("espaco360", "editar"))));
    }
    if (profile?.display_name) setDisplayName(profile.display_name);
    setSections(secs);
    setObjectives(objs);
    setInitiatives(init);
    setCampaigns(camp);
    setLoading(false);
  }

  useEffect(() => {
    setLoading(true);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandSlug]);

  async function handleAddSection() {
    if (!brand || !newSectionTitle.trim()) return;
    await createSection({
      brand_id: brand.id,
      stage,
      section_key: newFieldKey(newSectionTitle),
      title: newSectionTitle.trim(),
      order_index: sectionsByStage(sections, stage).length,
    });
    setNewSectionTitle("");
    setAddingSection(false);
    refresh();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <ReachIconAnimation size={48} context="page-loading" />
        <p className="text-sm text-muted-foreground">Carregando Plano…</p>
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

  const empresa = minhaEmpresaSection(sections);
  const empresaFields = (empresa?.fields as unknown as { key: string; label: string; value: string }[]) ?? [];
  const descricao = empresaFields.find((f) => f.key === "descricao_institucional")?.value ?? brand.description;
  const currentStageSections = sectionsByStage(sections, stage);
  const estruturaSections = sections.filter((s) => s.stage === "estrutura");

  // Etapas exibidas como abas: as 4 fases legadas + qualquer etapa customizada
  // vinda de um Modelo de Plano com Tipo de Planejamento (Comunicação,
  // Conteúdo, Campanha etc.) que já tenha sido aplicado neste cliente.
  const customStageKeys = Array.from(new Set(sections.map((s) => s.stage))).filter((k) => !STAGES.some((s) => s.key === k));
  const availableStages: { key: string; label: string; description?: string }[] = [
    ...STAGES,
    ...customStageKeys.map((k) => ({ key: k, label: k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) })),
  ];

  return (
    <SpaceShell brandSlug={brandSlug} brandName={brand.name} primaryColor={(brand as any)?.primary_color} accentColor={(brand as any)?.accent_color}>
      <PageHeader
        eyebrow="Estratégia"
        title="Plano"
        description={descricao ?? "O que queremos alcançar e por que estamos fazendo isso — fundação, objetivos e estratégia da marca."}
      />

      <GlassCard level={1} className="mb-6 flex flex-wrap gap-1 p-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={tab === t ? "rounded-xl bg-reach-coral px-3 py-1.5 text-[12.5px] font-medium text-primary-foreground" : "rounded-xl px-3 py-1.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-muted"}
          >
            {t}
          </button>
        ))}
      </GlassCard>

      {tab === "Fundação" && (
        <div className="space-y-5">
          <GlassCard level={2} className="p-5">
            <div className="flex flex-wrap gap-2">
              {availableStages.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setStage(s.key)}
                  className={stage === s.key ? "rounded-full bg-reach-coral px-4 py-2 text-sm font-medium text-primary-foreground" : "rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {availableStages.find((s) => s.key === stage)?.description && (
              <p className="mt-3 text-sm text-muted-foreground">{availableStages.find((s) => s.key === stage)?.description}</p>
            )}
          </GlassCard>

          {stage === "acabamento" && (
            <IdentidadeVisualSection brandId={brand.id} brandName={brand.name} canEdit={canEditPlano} />
          )}

          {currentStageSections.map((section) => (
            <SectionEditor key={section.id} section={section} brandId={brand.id} canEdit={canEditPlano} onSaved={refresh} />
          ))}
          {currentStageSections.length === 0 && (
            <GlassCard level={2} className="p-6">
              <p className="text-sm text-muted-foreground">Nenhuma seção cadastrada nesta etapa ainda.</p>
            </GlassCard>
          )}
          {canEditPlano && (
            <GlassCard level={2} className="space-y-3 p-4">
              {addingSection ? (
                <div className="flex items-center gap-2">
                  <input autoFocus placeholder="Título da nova seção" value={newSectionTitle} onChange={(e) => setNewSectionTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddSection()} className="input-reach min-w-0 flex-1" />
                  <Btn size="sm" onClick={handleAddSection}>Adicionar</Btn>
                  <Btn size="sm" variant="ghost" onClick={() => setAddingSection(false)}>Cancelar</Btn>
                </div>
              ) : (
                <Btn variant="outline" size="sm" onClick={() => setAddingSection(true)}>
                  <Plus className="h-3.5 w-3.5" /> Nova seção em {availableStages.find((s) => s.key === stage)?.label}
                </Btn>
              )}
              <AplicarModelo brandId={brand.id} onApplied={refresh} />
            </GlassCard>
          )}

        </div>
      )}

      {tab === "Objetivos" && (
        <ObjetivosTab brandId={brand.id} objectives={objectives} initiatives={initiatives} brandSlug={brandSlug} canEdit={canEditPlano} onChanged={refresh} />
      )}

      {tab === "Estratégia" && (
        <div className="space-y-5">
          {estruturaSections.map((s) => (
            <SectionEditor key={s.id} section={s} brandId={brand.id} canEdit={canEditPlano} onSaved={refresh} />
          ))}

          <GlassCard level={2} className="p-6">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-title">Estratégias</h2>
              <Link
                to="/e360/$brandSlug"
                params={{ brandSlug }}
                search={{ tab: "Estratégias" } as any}
                className="text-[11.5px] text-reach-coral hover:underline"
              >
                Gerenciar no Espaço 360 →
              </Link>
            </div>
            <div className="space-y-2">
              {initiatives.map((i) => {
                const objective = objectives.find((o) => o.id === i.objective_id);
                const campaignCount = campaigns.filter((c) => c.initiative_id === i.id).length;
                return (
                  <Link
                    key={i.id}
                    to="/e360/$brandSlug"
                    params={{ brandSlug }}
                    search={{ tab: "Estratégias" } as any}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px]">{i.title}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {objective ? `Objetivo: ${objective.title} · ` : ""}
                        {campaignCount} campanha(s)
                      </span>
                    </span>
                    <StatusChip status={i.status} />
                  </Link>
                );
              })}
              {initiatives.length === 0 && (
                <Link
                  to="/e360/$brandSlug"
                  params={{ brandSlug }}
                  search={{ tab: "Estratégias" } as any}
                  className="block rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground hover:text-foreground"
                >
                  Nenhuma estratégia definida neste Plano. Criar estratégia →
                </Link>
              )}
            </div>
          </GlassCard>

          <GlassCard level={2} className="p-6">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-title">Campanhas planejadas</h2>
              <Link
                to="/e360/$brandSlug"
                params={{ brandSlug }}
                search={{ tab: "Campanhas" } as any}
                className="text-[11.5px] text-reach-coral hover:underline"
              >
                Gerenciar no Espaço 360 →
              </Link>
            </div>
            <div className="space-y-2">
              {campaigns.map((c) => {
                const initiative = initiatives.find((i) => i.id === c.initiative_id);
                return (
                  <Link
                    key={c.id}
                    to="/e360/$brandSlug/campanha/$campaignId"
                    params={{ brandSlug, campaignId: c.id }}
                    search={{ tab: undefined, filtro: undefined }}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px]">{c.title}</span>
                      {initiative && <span className="block truncate text-[11px] text-muted-foreground">Estratégia: {initiative.title}</span>}
                    </span>
                    <StatusChip status={c.status} />
                  </Link>
                );
              })}
              {campaigns.length === 0 && (
                <Link
                  to="/e360/$brandSlug"
                  params={{ brandSlug }}
                  search={{ tab: "Campanhas" } as any}
                  className="block rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground hover:text-foreground"
                >
                  {initiatives.length === 0
                    ? "Defina uma estratégia primeiro para poder criar campanhas."
                    : "Esta estratégia ainda não possui campanhas. Criar campanha →"}
                </Link>
              )}
            </div>
          </GlassCard>
        </div>
      )}
    </SpaceShell>
  );
}

function ObjetivosTab({
  brandId,
  objectives,
  initiatives,
  brandSlug,
  canEdit,
  onChanged,
}: {
  brandId: string;
  objectives: Objective[];
  initiatives: Initiative[];
  brandSlug: string;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [periodType, setPeriodType] = useState("trimestral");
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
      order_index: objectives.length,
    });
    setTitle("");
    setPeriodLabel("");
    setTargetValue("");
    setUnit("");
    setAdding(false);
    onChanged();
  }

  const grouped: Record<string, Objective[]> = { anual: [], trimestral: [], mensal: [] };
  for (const o of objectives) grouped[o.period_type]?.push(o);

  return (
    <div className="space-y-5">
      {OBJECTIVE_PERIODS.map((p) => (
        <GlassCard key={p.key} level={2} className="p-6">
          <h2 className="text-title mb-3">Objetivos {p.plural.toLowerCase()}</h2>
          <div className="space-y-3">
            {grouped[p.key].map((o) => {
              const progress = o.target_value ? Math.min(100, Math.round(((o.current_value ?? 0) / o.target_value) * 100)) : 0;
              const linkedStrategies = initiatives.filter((i) => i.objective_id === o.id);
              return (
                <div key={o.id} className="rounded-xl border border-border bg-card px-4 py-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-[13.5px] font-medium">{o.title}</span>
                    {canEdit ? (
                      <select value={o.status} onChange={(e) => updateObjective(o.id, { status: e.target.value }).then(onChanged)} className="input-reach !w-auto rounded-full py-1 text-[11px]">
                        {OBJECTIVE_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </select>
                    ) : (
                      <StatusChip status={o.status} label={OBJECTIVE_STATUSES.find((s) => s.key === o.status)?.label} />
                    )}
                  </div>
                  {o.target_value != null && (
                    <>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
                        <div className="h-full rounded-full bg-reach-violet" style={{ width: `${progress}%` }} />
                      </div>
                      <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                        {o.current_value ?? 0} / {o.target_value} {o.unit ?? ""} · {o.period_label ?? ""}
                      </p>
                    </>
                  )}
                  <Link
                    to="/e360/$brandSlug"
                    params={{ brandSlug }}
                    search={{ tab: "Estratégias", filtro: o.id } as any}
                    className="mt-2 inline-block text-[11.5px] text-reach-coral hover:underline"
                  >
                    {linkedStrategies.length} estratégia(s) vinculada(s) →
                  </Link>
                </div>
              );
            })}
            {grouped[p.key].length === 0 && <p className="text-sm text-muted-foreground">Nenhum objetivo {p.label.toLowerCase()} ainda.</p>}
          </div>
        </GlassCard>
      ))}

      {canEdit && (
        <GlassCard level={2} className="p-4">
          {adding ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <input autoFocus placeholder="Título do objetivo" value={title} onChange={(e) => setTitle(e.target.value)} className="input-reach sm:col-span-2" />
              <select value={periodType} onChange={(e) => setPeriodType(e.target.value)} className="input-reach">
                {OBJECTIVE_PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
              <input placeholder="Período (ex.: Q3 2026)" value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} className="input-reach" />
              <input placeholder="Meta (número)" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} className="input-reach" />
              <input placeholder="Unidade (ex.: vendas, %)" value={unit} onChange={(e) => setUnit(e.target.value)} className="input-reach" />
              <div className="flex gap-2 sm:col-span-2">
                <Btn size="sm" onClick={add}>Adicionar</Btn>
                <Btn size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancelar</Btn>
              </div>
            </div>
          ) : (
            <Btn variant="outline" size="sm" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" /> Novo objetivo</Btn>
          )}
        </GlassCard>
      )}
    </div>
  );
}

function AplicarModelo({ brandId, onApplied }: { brandId: string; onApplied: () => void }) {
  const [templates, setTemplates] = useState<PlanTemplate[]>([]);
  const [selected, setSelected] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listPlanTemplates()
      .then((t) => setTemplates(t.filter((x) => x.active)))
      .catch((error) => setMsg(error instanceof Error ? error.message : "Não foi possível carregar os modelos."));
  }, []);

  async function apply() {
    const tpl = templates.find((t) => t.id === selected);
    if (!tpl) return;
    setBusy(true);
    setMsg(null);
    try {
      const count = await applyTemplateToBrand(tpl, brandId);
      setMsg(count > 0 ? `${count} seção(ões) criada(s) a partir do modelo.` : "Nenhuma seção nova — o modelo já foi aplicado.");
      onApplied();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Falha ao aplicar modelo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
      <span className="text-xs text-muted-foreground">Aplicar modelo de plano:</span>
      {templates.length > 0 && <>
        <select value={selected} onChange={(e) => setSelected(e.target.value)} className="input-reach h-9 w-auto min-w-[180px] rounded-full text-sm">
          <option value="">Selecione um modelo…</option>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <Btn size="sm" variant="outline" onClick={apply} disabled={!selected || busy}>
          {busy ? "Aplicando…" : "Aplicar"}
        </Btn>
      </>}
      <Link to="/agencia/modelos" className="text-xs text-primary underline underline-offset-2">{templates.length ? "Gerenciar modelos" : "Criar modelo"}</Link>
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
    </div>
  );
}
