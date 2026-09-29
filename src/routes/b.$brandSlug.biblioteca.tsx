import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, ExternalLink, Layers, Paperclip, Plus, Send, Sparkle, Star, X } from "lucide-react";
import { ReachIconAnimation } from "@/components/reach/reach-icon-animation";
import { BrandShell } from "@/components/reach/brand-shell";
import { SendToWorkspaceModal } from "@/components/reach/workspace-forms";
import { PageHeader } from "@/components/reach/page-header";
import { GlassCard } from "@/components/reach/glass-card";
import { Btn, EmptyState, Field, SelectInput, StatusChip, TextArea, TextInput } from "@/components/ui-reach/primitives";
import { SectionEditor } from "@/components/reach/section-editor";
import { ReferenciasPanel } from "@/components/reach/referencias-panel";
import { ImageField, UploadButton } from "@/components/reach/uploader";
import { cn } from "@/lib/utils";
import { isViewingAsClient } from "@/lib/view-as";
import { supabase } from "@/integrations/supabase/client";
import {
  CONTEUDO_STATUSES,
  IDEIA_STATUSES,
  IDEIA_FORMATOS,
  IDEIA_PRIORIDADES,
  brandModules,
  createCategoria,
  createConteudoFromIdeia,
  createIdeia,
  createPilar,
  createSection,
  getBrandBySlug,
  getProfile,
  listBrandHomeSections,
  listCampaigns,
  listCategorias,
  listConteudos,
  listIdeias,
  listInitiatives,
  listPilares,
  listTeamMembers,
  newFieldKey,
  updateConteudo,
  updateIdeia,
  type Brand,
  type BrandHomeSection,
  type Campaign,
  type Categoria,
  type Conteudo,
  type Ideia,
  type Initiative,
  type Pilar,
  type TeamMember,
} from "@/lib/reach-data";
import { listSectors } from "@/lib/workspace-data";

export const Route = createFileRoute("/b/$brandSlug/biblioteca")({
  component: BibliotecaPage,
  validateSearch: (search: Record<string, unknown>) => ({
    tab: typeof search.tab === "string" ? search.tab : undefined,
  }),
});

function FormatoBadge({ value }: { value: string }) {
  const f = IDEIA_FORMATOS.find((x) => x.key.toLowerCase() === value.toLowerCase());
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-reach-blue/30 bg-reach-blue-soft px-2.5 py-1 text-[11px] font-medium text-reach-blue">
      {f?.icon && <span aria-hidden>{f.icon}</span>}
      {f?.label ?? value}
    </span>
  );
}

function PrioridadeBadge({ value }: { value: string }) {
  const p = IDEIA_PRIORIDADES.find((x) => x.key === value) ?? IDEIA_PRIORIDADES[1];
  const tone =
    p.key === "alta"
      ? "border-reach-rose/30 bg-reach-rose-soft text-reach-rose"
      : p.key === "baixa"
        ? "border-reach-mint/30 bg-reach-mint-soft text-reach-mint"
        : "border-reach-amber/30 bg-reach-amber-soft text-reach-amber";
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium", tone)}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {p.label}
    </span>
  );
}

type Section = "ideias" | "construir" | "estrutura" | "conteudos" | "referencias";

/** Aceita os valores antigos de `tab` (pilares/categorias) para não quebrar links salvos. */
function normalizeSection(raw?: string): Section {
  if (raw === "pilares" || raw === "categorias" || raw === "estrutura") return "estrutura";
  if (raw === "construir" || raw === "conteudos" || raw === "referencias") return raw;
  return "ideias";
}

/** Campos extras da ideia (colunas novas ainda não refletidas nos tipos gerados). */
type IdeiaExtra = Ideia & {
  priority?: string | null;
  starred?: boolean | null;
  initiative_id?: string | null;
  campaign_id?: string | null;
  responsible?: string | null;
  due_date?: string | null;
  notes?: string | null;
  link?: string | null;
  image_url?: string | null;
  attachments?: { name: string; url: string }[] | null;
  refs?: { name: string; url: string }[] | null;
};

function BibliotecaPage() {
  const { brandSlug } = Route.useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [displayName, setDisplayName] = useState("Você");
  const [canEdit, setCanEdit] = useState(false);
  const [isAgency, setIsAgency] = useState(false);
  const searchParams = Route.useSearch();
  const section = normalizeSection(searchParams.tab as string | undefined);
  const setSection = (next: Section) =>
    navigate({ to: "/b/$brandSlug/biblioteca", params: { brandSlug }, search: { tab: next } });

  const [pilares, setPilares] = useState<Pilar[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [ideias, setIdeias] = useState<Ideia[]>([]);
  const [conteudos, setConteudos] = useState<Conteudo[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [refSections, setRefSections] = useState<BrandHomeSection[]>([]);
  const [pilarFilter, setPilarFilter] = useState<string>("");
  const [categoriaFilter, setCategoriaFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [formatFilter, setFormatFilter] = useState<string>("");
  const [openIdeiaId, setOpenIdeiaId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

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
    setBrand(b);
    const [profile, pil, cat, ide, cont, secs, camps, inits] = await Promise.all([
      getProfile(session.user.id),
      listPilares(b.id),
      listCategorias(b.id),
      listIdeias(b.id),
      listConteudos(b.id),
      listBrandHomeSections(b.id),
      listCampaigns(b.id),
      listInitiatives(b.id),
    ]);
    setCanEdit(!!profile && !isViewingAsClient());
    setIsAgency(profile?.role === "agency" && !isViewingAsClient());
    if (profile?.display_name) setDisplayName(profile.display_name);
    setPilares(pil);
    setCategorias(cat);
    setIdeias(ide);
    setConteudos(cont);
    setCampaigns(camps);
    setInitiatives(inits);
    setRefSections(secs.filter((s) => s.stage === "conhecimento"));
    setLoading(false);
  }

  useEffect(() => {
    setLoading(true);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandSlug]);

  const categoriaById = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);
  const pilarById = useMemo(() => new Map(pilares.map((p) => [p.id, p])), [pilares]);

  /** Uma ideia só é estruturada quando tem categoria — e a categoria carrega o pilar. */
  const isClassificada = (i: Ideia) => {
    const cat = i.categoria_id ? categoriaById.get(i.categoria_id) : undefined;
    return !!cat && !!cat.pilar_id;
  };
  const ideiasEstruturadas = useMemo(() => ideias.filter(isClassificada), [ideias, categoriaById]);
  const ideiasAConstruir = useMemo(() => ideias.filter((i) => !isClassificada(i)), [ideias, categoriaById]);

  const ideiasFiltradas = useMemo(
    () =>
      ideiasEstruturadas.filter((i) => {
        const cat = i.categoria_id ? categoriaById.get(i.categoria_id) : undefined;
        if (pilarFilter && cat?.pilar_id !== pilarFilter) return false;
        if (categoriaFilter && i.categoria_id !== categoriaFilter) return false;
        if (statusFilter && i.status !== statusFilter) return false;
        if (formatFilter && (i.format ?? "") !== formatFilter) return false;
        return true;
      }),
    [ideiasEstruturadas, categoriaById, pilarFilter, categoriaFilter, statusFilter, formatFilter],
  );

  const openIdeia = (ideias.find((i) => i.id === openIdeiaId) ?? null) as IdeiaExtra | null;

  /** FAB: cria a ideia sem pilar/categoria e abre o mesmo formulário de sempre. */
  async function novaIdeia() {
    if (!brand || creating) return;
    setCreating(true);
    try {
      const created = await createIdeia({
        brand_id: brand.id,
        categoria_id: null,
        title: "Nova ideia",
        order_index: ideias.length,
        status: "a_fazer",
      } as any);
      await refresh();
      if (created?.id) setOpenIdeiaId(created.id);
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <ReachIconAnimation size={48} context="page-loading" />
        <p className="text-sm text-muted-foreground">Carregando Biblioteca…</p>
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
    <BrandShell basePath={`/b/${brandSlug}`} displayName={displayName} primaryColor={(brand as any)?.primary_color} accentColor={(brand as any)?.accent_color}>
      <PageHeader
        eyebrow="Materiais de marca"
        title="Biblioteca"
        description="Pilar → Categoria → Ideias. Ideias sem classificação ficam em “Ideias a construir”."
      />

      <GlassCard level={1} className="mb-6 flex flex-wrap gap-1 p-1 lg:hidden">
        {[
          { key: "ideias", label: "Banco de Ideias" },
          { key: "construir", label: `Ideias a construir${ideiasAConstruir.length ? ` (${ideiasAConstruir.length})` : ""}` },
          { key: "estrutura", label: "Pilares e categorias" },
          { key: "conteudos", label: "Conteúdos" },
          { key: "referencias", label: "Referências" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setSection(t.key as Section)}
            className={
              section === t.key
                ? "rounded-xl bg-reach-coral px-3 py-1.5 text-[12.5px] font-medium text-primary-foreground"
                : "rounded-xl px-3 py-1.5 text-[12.5px] text-muted-foreground hover:bg-muted"
            }
          >
            {t.label}
          </button>
        ))}
      </GlassCard>

      {section === "conteudos" && (
        <ConteudosView conteudos={conteudos} campaigns={campaigns} ideias={ideias} canEdit={canEdit} onChanged={refresh} />
      )}

      {section === "referencias" && (
        <div className="space-y-6">
          <ReferenciasPanel brandId={brand.id} canEdit={isAgency} />
          {refSections.length > 0 && (
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                Seções de referência já cadastradas neste cliente
              </p>
              {refSections.map((s) => (
                <SectionEditor key={s.id} section={s} canEdit={isAgency} onSaved={refresh} />
              ))}
            </div>
          )}

        </div>
      )}

      {section === "estrutura" && (
        <EstruturaView
          brandId={brand.id}
          pilares={pilares}
          categorias={categorias}
          ideias={ideiasEstruturadas}
          pilarAberto={pilarFilter}
          setPilarAberto={setPilarFilter}
          canEdit={canEdit}
          onChanged={refresh}
          onOpenCategoria={(id) => {
            setCategoriaFilter(id);
            setSection("ideias");
          }}
        />
      )}

      {section === "construir" && (
        <AConstruirView
          ideias={ideiasAConstruir as IdeiaExtra[]}
          conteudos={conteudos}
          canEdit={canEdit}
          onOpen={setOpenIdeiaId}
          onChanged={refresh}
        />
      )}

      {section === "ideias" && (
        <BancoDeIdeias
          ideias={ideiasFiltradas}
          total={ideiasEstruturadas.length}
          aConstruir={ideiasAConstruir.length}
          onVerAConstruir={() => setSection("construir")}
          pilares={pilares}
          categorias={categorias}
          categoriaById={categoriaById}
          pilarById={pilarById}
          conteudos={conteudos}
          pilarFilter={pilarFilter}
          categoriaFilter={categoriaFilter}
          statusFilter={statusFilter}
          formatFilter={formatFilter}
          setFormatFilter={setFormatFilter}
          setPilarFilter={setPilarFilter}
          setCategoriaFilter={setCategoriaFilter}
          setStatusFilter={setStatusFilter}
          canEdit={canEdit}
          onChanged={refresh}
          onOpen={setOpenIdeiaId}
        />
      )}

      {canEdit && section !== "conteudos" && section !== "referencias" && (
        <button
          onClick={novaIdeia}
          disabled={creating}
          aria-label="Nova ideia"
          className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-[13.5px] font-medium text-primary-foreground shadow-glow transition-all hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60 sm:bottom-8 sm:right-8"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">{creating ? "Criando…" : "Nova ideia"}</span>
        </button>
      )}

      {openIdeia && (
        <IdeiaDrawer
          ideia={openIdeia}
          brandId={brand.id}
          brandSlug={brandSlug}
          brand={brand}
          pilares={pilares}
          categorias={categorias}
          campaigns={campaigns}
          initiatives={initiatives}
          conteudos={conteudos.filter((c) => c.ideia_id === openIdeia.id)}
          canEdit={canEdit}
          onClose={() => setOpenIdeiaId(null)}
          onChanged={refresh}
        />
      )}
    </BrandShell>
  );
}



function ConteudosView({
  conteudos,
  campaigns,
  ideias,
  canEdit,
  onChanged,
}: {
  conteudos: Conteudo[];
  campaigns: Campaign[];
  ideias: Ideia[];
  canEdit: boolean;
  onChanged: () => void;
}) {
  return (
    <GlassCard level={2} className="p-6">
      <div className="space-y-2">
        {conteudos.map((c) => {
          const origem = ideias.find((i) => i.id === c.ideia_id);
          return (
            <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
              {canEdit ? (
                <select value={c.status} onChange={(e) => updateConteudo(c.id, { status: e.target.value }).then(onChanged)} className="input-reach !w-auto rounded-full py-1 text-[11px]">
                  {CONTEUDO_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              ) : (
                <StatusChip status={c.status} label={CONTEUDO_STATUSES.find((s) => s.key === c.status)?.label} />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px]">{c.title}</p>
                {origem && <p className="truncate text-[11.5px] text-muted-foreground">Ideia original: {origem.title}</p>}
              </div>
              {c.formato && <StatusChip status="planejamento" label={c.formato} />}
              {canEdit ? (
                <select value={c.campaign_id ?? ""} onChange={(e) => updateConteudo(c.id, { campaign_id: e.target.value || null }).then(onChanged)} className="input-reach !w-auto rounded-full py-1 text-[11px]">
                  <option value="">Sem campanha</option>
                  {campaigns.map((camp) => <option key={camp.id} value={camp.id}>{camp.title}</option>)}
                </select>
              ) : (
                campaigns.find((camp) => camp.id === c.campaign_id) && (
                  <StatusChip status="planejamento" label={campaigns.find((camp) => camp.id === c.campaign_id)?.title} />
                )
              )}
            </div>
          );
        })}
        {conteudos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum conteúdo criado ainda. Use "Usar esta ideia" no Banco de Ideias para gerar o primeiro.</p>}
      </div>
    </GlassCard>
  );
}

/* ── Pilar → Categoria (estrutura) ─────────────────────────── */
function EstruturaView({
  brandId,
  pilares,
  categorias,
  ideias,
  pilarAberto,
  setPilarAberto,
  canEdit,
  onChanged,
  onOpenCategoria,
}: {
  brandId: string;
  pilares: Pilar[];
  categorias: Categoria[];
  ideias: Ideia[];
  pilarAberto: string;
  setPilarAberto: (v: string) => void;
  canEdit: boolean;
  onChanged: () => void;
  onOpenCategoria: (categoriaId: string) => void;
}) {
  const [addingPilar, setAddingPilar] = useState(false);
  const [pilarName, setPilarName] = useState("");
  const [pilarDesc, setPilarDesc] = useState("");
  const [addingCatFor, setAddingCatFor] = useState<string | null>(null);
  const [catName, setCatName] = useState("");

  const catsDoPilar = (pilarId: string) => categorias.filter((c) => c.pilar_id === pilarId);
  const countIdeias = (categoriaId: string) => ideias.filter((i) => i.categoria_id === categoriaId).length;

  async function addPilar() {
    if (!pilarName.trim()) return;
    await createPilar({ brand_id: brandId, name: pilarName.trim(), description: pilarDesc, order_index: pilares.length });
    setPilarName("");
    setPilarDesc("");
    setAddingPilar(false);
    onChanged();
  }

  async function addCategoria(pilarId: string) {
    if (!catName.trim()) return;
    await createCategoria({ brand_id: brandId, pilar_id: pilarId, name: catName.trim(), order_index: categorias.length });
    setCatName("");
    setAddingCatFor(null);
    onChanged();
  }

  return (
    <div className="space-y-4">
      {pilares.map((p) => {
        const cats = catsDoPilar(p.id);
        const aberto = pilarAberto === p.id;
        const totalIdeias = cats.reduce((acc, c) => acc + countIdeias(c.id), 0);
        return (
          <GlassCard key={p.id} level={2} className="overflow-hidden p-0">
            <button
              onClick={() => setPilarAberto(aberto ? "" : p.id)}
              className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-muted"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-reach-blue-soft text-reach-blue">
                <Layers className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold">{p.name}</span>
                {p.description && <span className="block truncate text-[12px] text-muted-foreground">{p.description}</span>}
              </span>
              <span className="hidden shrink-0 gap-2 sm:flex">
                <StatusChip status="planejamento" label={`${cats.length} categoria(s)`} />
                <StatusChip status="rascunho" label={`${totalIdeias} ideia(s)`} />
              </span>
              <ChevronRight className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", aberto && "rotate-90")} />
            </button>

            {aberto && (
              <div className="border-t border-border p-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {cats.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => onOpenCategoria(c.id)}
                      className="rounded-2xl border border-border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:bg-muted"
                    >
                      <p className="truncate text-[13.5px] font-medium">{c.name}</p>
                      {c.description && <p className="mt-1 line-clamp-2 text-[12px] text-muted-foreground">{c.description}</p>}
                      <p className="mt-3 text-[11.5px] text-muted-foreground">{countIdeias(c.id)} ideia(s) · ver banco</p>
                    </button>
                  ))}
                  {cats.length === 0 && (
                    <p className="text-[12.5px] text-muted-foreground">Nenhuma categoria neste pilar ainda.</p>
                  )}
                </div>

                {canEdit && (
                  <div className="mt-4">
                    {addingCatFor === p.id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          autoFocus
                          placeholder="Nome da categoria"
                          value={catName}
                          onChange={(e) => setCatName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && addCategoria(p.id)}
                          className="input-reach min-w-[200px] flex-1"
                        />
                        <Btn size="sm" onClick={() => addCategoria(p.id)}>Adicionar</Btn>
                        <Btn size="sm" variant="ghost" onClick={() => setAddingCatFor(null)}>Cancelar</Btn>
                      </div>
                    ) : (
                      <Btn size="sm" variant="outline" onClick={() => setAddingCatFor(p.id)}>
                        <Plus className="h-3.5 w-3.5" /> Nova categoria
                      </Btn>
                    )}
                  </div>
                )}
              </div>
            )}
          </GlassCard>
        );
      })}

      {pilares.length === 0 && <EmptyState title="Nenhum pilar criativo" description="Cadastre o primeiro pilar de conteúdo." />}

      {canEdit && (
        <GlassCard level={2} className="p-4">
          {addingPilar ? (
            <div className="space-y-2">
              <input autoFocus placeholder="Nome do pilar" value={pilarName} onChange={(e) => setPilarName(e.target.value)} className="input-reach" />
              <textarea placeholder="Descrição (opcional)" value={pilarDesc} onChange={(e) => setPilarDesc(e.target.value)} rows={2} className="input-reach resize-y" />
              <div className="flex gap-2">
                <Btn size="sm" onClick={addPilar}>Adicionar</Btn>
                <Btn size="sm" variant="ghost" onClick={() => setAddingPilar(false)}>Cancelar</Btn>
              </div>
            </div>
          ) : (
            <Btn variant="outline" size="sm" onClick={() => setAddingPilar(true)}><Plus className="h-3.5 w-3.5" /> Novo pilar</Btn>
          )}
        </GlassCard>
      )}
    </div>
  );
}

/* ── Card visual da ideia ──────────────────────────────────── */
function IdeiaCard({
  ideia,
  pilarName,
  categoriaName,
  producoes,
  canEdit,
  onOpen,
  onChanged,
}: {
  ideia: IdeiaExtra;
  pilarName?: string;
  categoriaName?: string;
  producoes: number;
  canEdit: boolean;
  onOpen: (id: string) => void;
  onChanged: () => void;
}) {
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-reach-blue/30 hover:bg-muted">
      <button onClick={() => onOpen(ideia.id)} className="flex flex-1 flex-col text-left">
        {ideia.image_url ? (
          <img src={ideia.image_url} alt="" loading="lazy" className="h-32 w-full object-cover" />
        ) : (
          <div className="h-1.5 w-full bg-reach-blue-soft" />
        )}
        <div className="flex flex-1 flex-col gap-2 p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {[pilarName, categoriaName].filter(Boolean).join(" · ") || "Sem classificação"}
          </p>
          <p className="line-clamp-2 text-[14px] font-medium leading-snug">{ideia.title}</p>
          {ideia.description && <p className="line-clamp-2 text-[12.5px] text-muted-foreground">{ideia.description}</p>}
          <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2">
            <StatusChip status={ideia.status} label={IDEIA_STATUSES.find((s) => s.key === ideia.status)?.label} />
            {ideia.format && <FormatoBadge value={ideia.format} />}
            <PrioridadeBadge value={ideia.priority ?? "media"} />
            {producoes > 0 && <StatusChip status="rascunho" label={`${producoes} em produção`} />}
          </div>
          {(ideia.responsible || ideia.due_date) && (
            <p className="text-[11px] text-muted-foreground">
              {[ideia.responsible, ideia.due_date && new Date(`${ideia.due_date}T00:00:00`).toLocaleDateString("pt-BR")]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>
      </button>
      <button
        aria-label={ideia.starred ? "Remover destaque" : "Destacar ideia"}
        title={ideia.starred ? "Remover destaque" : "Destacar ideia"}
        disabled={!canEdit}
        onClick={async () => {
          await updateIdeia(ideia.id, { starred: !ideia.starred } as any);
          onChanged();
        }}
        className={cn(
          "absolute right-2.5 top-2.5 rounded-full bg-background/70 p-1.5 backdrop-blur transition-colors",
          ideia.starred ? "text-reach-amber" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Star className="h-4 w-4" fill={ideia.starred ? "currentColor" : "none"} />
      </button>
    </div>
  );
}

/* ── Ideias sem pilar/categoria ────────────────────────────── */
function AConstruirView({
  ideias,
  conteudos,
  canEdit,
  onOpen,
  onChanged,
}: {
  ideias: IdeiaExtra[];
  conteudos: Conteudo[];
  canEdit: boolean;
  onOpen: (id: string) => void;
  onChanged: () => void;
}) {
  return (
    <div className="space-y-4">
      <GlassCard level={1} className="flex items-start gap-3 p-4">
        <Sparkle className="mt-0.5 h-4 w-4 shrink-0 text-reach-amber" />
        <p className="text-[12.5px] text-muted-foreground">
          Espaço livre para capturar ideias antes de classificá-las. Abra uma ideia e escolha a categoria para
          movê-la para o Banco de Ideias.
        </p>
      </GlassCard>

      {ideias.length === 0 ? (
        <EmptyState title="Nenhuma ideia solta" description="Use o botão “Nova ideia” para capturar algo rapidamente." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {ideias.map((i) => (
            <IdeiaCard
              key={i.id}
              ideia={i}
              producoes={conteudos.filter((c) => c.ideia_id === i.id).length}
              canEdit={canEdit}
              onOpen={onOpen}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Banco de Ideias (galeria hierárquica) ─────────────────── */
function BancoDeIdeias({
  ideias,
  total,
  aConstruir,
  onVerAConstruir,
  pilares,
  categorias,
  categoriaById,
  pilarById,
  conteudos,
  pilarFilter,
  categoriaFilter,
  statusFilter,
  formatFilter,
  setFormatFilter,
  setPilarFilter,
  setCategoriaFilter,
  setStatusFilter,
  canEdit,
  onChanged,
  onOpen,
}: {
  ideias: Ideia[];
  total: number;
  aConstruir: number;
  onVerAConstruir: () => void;
  pilares: Pilar[];
  categorias: Categoria[];
  categoriaById: Map<string, Categoria>;
  pilarById: Map<string, Pilar>;
  conteudos: Conteudo[];
  pilarFilter: string;
  categoriaFilter: string;
  statusFilter: string;
  formatFilter: string;
  setFormatFilter: (v: string) => void;
  setPilarFilter: (v: string) => void;
  setCategoriaFilter: (v: string) => void;
  setStatusFilter: (v: string) => void;
  canEdit: boolean;
  onChanged: () => void;
  onOpen: (id: string) => void;
}) {
  const categoriasDisponiveis = pilarFilter ? categorias.filter((c) => c.pilar_id === pilarFilter) : categorias;

  /** Agrupa Pilar → Categoria → Ideias, mantendo a ordem cadastrada. */
  const grupos = useMemo(() => {
    const ordenadas = [...ideias].sort(
      (a, b) => Number(!!(b as IdeiaExtra).starred) - Number(!!(a as IdeiaExtra).starred),
    );
    return pilares
      .map((p) => ({
        pilar: p,
        categorias: categorias
          .filter((c) => c.pilar_id === p.id)
          .map((c) => ({ categoria: c, ideias: ordenadas.filter((i) => i.categoria_id === c.id) as IdeiaExtra[] }))
          .filter((g) => g.ideias.length > 0),
      }))
      .filter((g) => g.categorias.length > 0);
  }, [ideias, pilares, categorias]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <SelectInput
          value={pilarFilter}
          onChange={(e) => {
            setPilarFilter(e.target.value);
            setCategoriaFilter("");
          }}
          className="!w-auto"
        >
          <option value="">Todos os pilares</option>
          {pilares.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </SelectInput>
        <SelectInput value={categoriaFilter} onChange={(e) => setCategoriaFilter(e.target.value)} className="!w-auto">
          <option value="">Todas as categorias</option>
          {categoriasDisponiveis.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </SelectInput>
        <SelectInput value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="!w-auto">
          <option value="">Todos os status</option>
          {IDEIA_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </SelectInput>
        <span className="text-[11.5px] text-muted-foreground">{ideias.length} de {total} ideias</span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {[{ key: "", label: "Todos", icon: "" }, ...IDEIA_FORMATOS].map((f) => (
          <button
            key={f.key || "todos"}
            onClick={() => setFormatFilter(f.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] transition-colors",
              formatFilter === f.key
                ? "border-reach-blue/40 bg-reach-blue-soft text-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {f.icon && <span aria-hidden>{f.icon}</span>}
            {f.label}
          </button>
        ))}
      </div>

      {aConstruir > 0 && (
        <button
          onClick={onVerAConstruir}
          className="flex w-full items-center gap-3 rounded-2xl border border-reach-amber/25 bg-reach-amber-soft px-4 py-3 text-left transition-colors hover:brightness-110"
        >
          <Sparkle className="h-4 w-4 shrink-0 text-reach-amber" />
          <span className="text-[12.5px]">
            <strong>{aConstruir}</strong> ideia(s) ainda sem pilar ou categoria — ver “Ideias a construir”.
          </span>
        </button>
      )}

      {grupos.map(({ pilar, categorias: cats }) => (
        <section key={pilar.id} className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="h-4 w-1 rounded-full bg-reach-blue" />
            <h2 className="text-[15px] font-semibold">{pilar.name}</h2>
            <span className="text-[11.5px] text-muted-foreground">
              {cats.reduce((acc, c) => acc + c.ideias.length, 0)} ideia(s)
            </span>
          </div>
          {cats.map(({ categoria, ideias: lista }) => (
            <div key={categoria.id} className="space-y-3">
              <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                {categoria.name} · {lista.length}
              </p>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {lista.map((i) => {
                  const cat = i.categoria_id ? categoriaById.get(i.categoria_id) : undefined;
                  const pil = cat ? pilarById.get(cat.pilar_id) : undefined;
                  return (
                    <IdeiaCard
                      key={i.id}
                      ideia={i}
                      pilarName={pil?.name}
                      categoriaName={cat?.name}
                      producoes={conteudos.filter((c) => c.ideia_id === i.id).length}
                      canEdit={canEdit}
                      onOpen={onOpen}
                      onChanged={onChanged}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      ))}

      {grupos.length === 0 && (
        <EmptyState title="Nenhuma ideia com esses filtros" description="Ajuste os filtros ou crie uma nova ideia." />
      )}
    </div>
  );
}


function LinkList({
  label,
  items,
  canEdit,
  onChange,
  gallery,
  uploadFolder,
}: {
  label: string;
  items: { name: string; url: string }[];
  canEdit: boolean;
  onChange: (next: { name: string; url: string }[]) => void;
  gallery?: boolean;
  uploadFolder?: string;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const isImage = (u: string) => /\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/i.test(u);
  const images = gallery ? items.filter((i) => isImage(i.url)) : [];
  const others = gallery ? items.filter((i) => !isImage(i.url)) : items;

  return (
    <div>
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      {images.length > 0 && (
        <div className="mb-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((it, idx) => (
            <a key={idx} href={it.url} target="_blank" rel="noreferrer" className="group relative block overflow-hidden rounded-xl border border-border">
              <img src={it.url} alt={it.name} loading="lazy" className="aspect-square w-full object-cover transition-transform group-hover:scale-105" />
              {canEdit && (
                <span
                  role="button"
                  onClick={(e) => {
                    e.preventDefault();
                    onChange(items.filter((x) => x !== it));
                  }}
                  className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-background/80 text-muted-foreground"
                >
                  <X className="h-3 w-3" />
                </span>
              )}
            </a>
          ))}
        </div>
      )}
      <div className="space-y-1.5">
        {others.map((it, idx) => (
          <div key={idx} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
            <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <a href={it.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-[12.5px] hover:underline">
              {it.name || it.url}
            </a>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {canEdit && (
              <button onClick={() => onChange(items.filter((x) => x !== it))} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        {items.length === 0 && <p className="text-[12px] text-muted-foreground">Nada por aqui ainda.</p>}
      </div>
      {canEdit && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <TextInput placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} className="!w-36" />
          <TextInput placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} className="min-w-[180px] flex-1" />
          <Btn
            size="sm"
            variant="outline"
            onClick={() => {
              if (!url.trim()) return;
              onChange([...items, { name: name.trim() || url.trim(), url: url.trim() }]);
              setName("");
              setUrl("");
            }}
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar link
          </Btn>
          <UploadButton
            folder={uploadFolder ?? "biblioteca"}
            onUploaded={(files) => onChange([...items, ...files.map((f) => ({ name: f.name, url: f.url }))])}
          />
        </div>
      )}
    </div>
  );
}

function IdeiaDrawer({
  ideia,
  brandId,
  brandSlug,
  brand,
  pilares,
  categorias,
  campaigns,
  initiatives,
  conteudos,
  canEdit,
  onClose,
  onChanged,
}: {
  ideia: IdeiaExtra;
  brandId: string;
  brandSlug: string;
  brand: Brand;
  pilares: Pilar[];
  categorias: Categoria[];
  campaigns: Campaign[];
  initiatives: Initiative[];
  conteudos: Conteudo[];
  canEdit: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [form, setForm] = useState<IdeiaExtra>(ideia);
  const [saving, setSaving] = useState(false);
  const [using, setUsing] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [workspaceSectors, setWorkspaceSectors] = useState<{ id: string; name: string }[]>([]);
  const [workspaceTeam, setWorkspaceTeam] = useState<TeamMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const wsEnabled = brandModules(brand).workspace;

  useEffect(() => {
    if (!sendOpen) return;
    void Promise.all([listSectors(), listTeamMembers()]).then(([sectors, team]) => {
      setWorkspaceSectors(sectors);
      setWorkspaceTeam(team);
    }).catch((err) => setError(err instanceof Error ? err.message : "Não foi possível carregar as opções do Workspace."));
  }, [sendOpen]);

  useEffect(() => setForm(ideia), [ideia]);

  const set = <K extends keyof IdeiaExtra>(key: K, value: IdeiaExtra[K]) => setForm((f) => ({ ...f, [key]: value }));
  const categoria = categorias.find((c) => c.id === form.categoria_id);
  const pilarAtual = categoria ? pilares.find((p) => p.id === categoria.pilar_id) : undefined;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await updateIdeia(ideia.id, {
        title: form.title,
        description: form.description,
        format: form.format,
        priority: form.priority ?? "media",
        starred: !!form.starred,
        status: form.status,
        categoria_id: form.categoria_id,
        initiative_id: form.initiative_id ?? null,
        campaign_id: form.campaign_id ?? null,
        responsible: form.responsible ?? null,
        due_date: form.due_date || null,
        notes: form.notes ?? null,
        link: form.link ?? null,
        image_url: form.image_url ?? null,
        attachments: form.attachments ?? [],
        refs: form.refs ?? [],
      } as any);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar a ideia.");
    }
    setSaving(false);
  }

  async function usarIdeia() {
    setUsing(true);
    setError(null);
    try {
      await createConteudoFromIdeia(ideia, brandId, form.campaign_id ?? undefined);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível criar o conteúdo.");
    }
    setUsing(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 overlay-scrim" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-border bg-card/95 p-6 backdrop-blur-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {pilarAtual?.name ?? "Sem pilar"} · {categoria?.name ?? "Sem categoria"}
            </p>
            <h2 className="truncate text-[17px] font-semibold">{form.title}</h2>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && <p className="mb-3 rounded-xl border border-reach-rose/30 bg-reach-rose-soft px-3 py-2 text-[12.5px] text-reach-rose">{error}</p>}

        <div className="space-y-4">
          <Field label="Título">
            <TextInput value={form.title} disabled={!canEdit} onChange={(e) => set("title", e.target.value)} />
          </Field>
          <Field label="Descrição">
            <TextArea rows={4} value={form.description ?? ""} disabled={!canEdit} onChange={(e) => set("description", e.target.value)} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Categoria (define o pilar)">
              <SelectInput
                value={form.categoria_id ?? ""}
                disabled={!canEdit}
                onChange={(e) => set("categoria_id", e.target.value || null)}
              >
                <option value="">Sem classificação (ideia a construir)</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {pilares.find((p) => p.id === c.pilar_id)?.name} · {c.name}
                  </option>
                ))}
              </SelectInput>
            </Field>

            <Field label="Estratégia do plano">
              <SelectInput value={form.initiative_id ?? ""} disabled={!canEdit} onChange={(e) => set("initiative_id", e.target.value || null)}>
                <option value="">Sem estratégia</option>
                {initiatives.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
              </SelectInput>
            </Field>
            <Field label="Campanha (opcional)">
              <SelectInput value={form.campaign_id ?? ""} disabled={!canEdit} onChange={(e) => set("campaign_id", e.target.value || null)}>
                <option value="">Sem campanha</option>
                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </SelectInput>
            </Field>
            <Field label="Status da ideia">
              <SelectInput value={form.status} disabled={!canEdit} onChange={(e) => set("status", e.target.value)}>
                {IDEIA_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </SelectInput>
            </Field>
            <Field label="Formato">
              <SelectInput value={form.format ?? ""} disabled={!canEdit} onChange={(e) => set("format", e.target.value || null)}>
                <option value="">Sem formato</option>
                {IDEIA_FORMATOS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
              </SelectInput>
            </Field>
            <Field label="Prioridade">
              <SelectInput value={form.priority ?? "media"} disabled={!canEdit} onChange={(e) => set("priority", e.target.value)}>
                {IDEIA_PRIORIDADES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </SelectInput>
            </Field>
            <Field label="Responsável">
              <TextInput value={form.responsible ?? ""} disabled={!canEdit} onChange={(e) => set("responsible", e.target.value)} />
            </Field>
            <Field label="Data">
              <TextInput type="date" value={form.due_date ?? ""} disabled={!canEdit} onChange={(e) => set("due_date", e.target.value)} />
            </Field>
            <Field label="Link">
              <TextInput placeholder="https://…" value={form.link ?? ""} disabled={!canEdit} onChange={(e) => set("link", e.target.value)} />
            </Field>
          </div>

          <Field label="Imagem de capa">
            <ImageField
              value={form.image_url ?? null}
              folder="ideias"
              canEdit={canEdit}
              onChange={(url) => set("image_url", url)}
            />
          </Field>

          <Field label="Observações">
            <TextArea rows={3} value={form.notes ?? ""} disabled={!canEdit} onChange={(e) => set("notes", e.target.value)} />
          </Field>

          <LinkList label="Arquivos e anexos" gallery uploadFolder="ideias" items={form.attachments ?? []} canEdit={canEdit} onChange={(next) => set("attachments", next)} />
          <LinkList label="Referências" gallery uploadFolder="referencias" items={form.refs ?? []} canEdit={canEdit} onChange={(next) => set("refs", next)} />

          <div>
            <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Conteúdos gerados</span>
            {conteudos.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">Nenhum conteúdo em produção a partir desta ideia.</p>
            ) : (
              <div className="space-y-1.5">
                {conteudos.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
                    <StatusChip status={c.status} label={CONTEUDO_STATUSES.find((s) => s.key === c.status)?.label} />
                    <span className="min-w-0 flex-1 truncate text-[12.5px]">{c.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {canEdit && (
          <div className="sticky bottom-0 mt-6 flex flex-wrap gap-2 border-t border-border bg-card/95 pt-4">
            <Btn variant="primary" onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar ideia"}</Btn>
            <Btn variant="outline" onClick={usarIdeia} disabled={using}>
              <Sparkle className="h-3.5 w-3.5" /> {using ? "Criando…" : "Usar ideia"}
            </Btn>
            {wsEnabled && (
              <Btn variant="outline" onClick={() => setSendOpen(true)}>
                <Send className="h-3.5 w-3.5" /> Enviar criação ao Workspace
              </Btn>
            )}
            <span className="self-center text-[11.5px] text-muted-foreground">A ideia original é preservada.</span>
          </div>
        )}
      </aside>
      {sendOpen && (
        <SendToWorkspaceModal
          source={{
            brandId,
            sourceModule: "brand",
            sourceType: "ideia",
            sourceId: form.id,
            sourceUrl: `/b/${brandSlug}/biblioteca`,
            title: form.title,
            description: [form.description, form.link ? `Referência: ${form.link}` : null, form.notes].filter(Boolean).join("\n\n"),
          }}
          sectors={workspaceSectors}
          team={workspaceTeam}
          onClose={() => setSendOpen(false)}
        />
      )}
    </div>
  );
}
