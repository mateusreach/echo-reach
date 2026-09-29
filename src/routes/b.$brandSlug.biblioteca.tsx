import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { BrandShell } from "@/components/reach/brand-shell";
import { Avatar, Badge, Button, EmptyState, Skeleton, type Tone } from "@/components/echo/primitives";
import { Alert, Chip, Field, LineTabs, Menu, Segmented, Select, TextArea, type Option } from "@/components/echo/controls";
import { Drawer, HoldButton, Modal } from "@/components/echo/overlays";
import { Icon, type IconName } from "@/components/echo/icon";
import { stagger } from "@/components/echo/motion";
import { useAccess, useBrandAccess } from "@/components/echo/session";
import { CONTEUDO_FORMATOS, CONTEUDO_STATUSES, IDEIA_FORMATOS, IDEIA_PRIORIDADES, IDEIA_STATUSES, type Conteudo, type Ideia } from "@/lib/reach-data";
import { REF_PURPOSES, REF_WHEN, type Referencia } from "@/lib/agency-data";
import { isViewingAsClient } from "@/lib/view-as";
import { relDay } from "@/lib/home-data";
import {
  SUGGESTION_NOTE, deleteIdeia, dispatchKey, loadLibrary, removeGroup, removeRef, reorder, saveCategoria, saveConteudo, saveIdeia, savePilar, saveRef, sendToWorkspace, suggestIdeia, useIdeia,
  type LibraryData,
} from "@/lib/library-data";

type Tab = "ideias" | "construir" | "estrutura" | "conteudos" | "referencias";
const TABS: Tab[] = ["ideias", "construir", "estrutura", "conteudos", "referencias"];

export const Route = createFileRoute("/b/$brandSlug/biblioteca")({
  head: () => ({ meta: [{ title: "Biblioteca · Brand · Echo" }] }),
  component: LibraryPage,
  validateSearch: (search: Record<string, unknown>) => ({ tab: typeof search.tab === "string" ? search.tab : undefined }),
});

const FORMAT_ICON: Record<string, IconName> = { Reels: "play", "Estático": "image", Carrossel: "carousel", Stories: "stories", TikTok: "tiktok", Feed: "feed", Live: "video", WhatsApp: "message", Outro: "file" };
const PRIORITY_COLOR: Record<string, string> = { alta: "var(--danger)", media: "var(--warn)", baixa: "var(--ok)" };
const IDEIA_TONE: Record<string, Tone> = { a_fazer: "todo", fazendo: "doing", feita: "review", concluido: "done" };
const CONT_TONE: Record<string, Tone> = { rascunho: "draft", aprovada: "approved", produzida: "review", publicada: "done" };
const WS_TONE: Record<string, Tone> = { Recebido: "todo", "Em execução": "doing", "Em aprovação": "review", "Concluído": "done" };
const LIKE_LABEL = { aguardando: "Aguardando o cliente", aprovado: "Aprovado no Like", ajustes: "Ajustes pedidos" } as const;
const LIKE_TONE: Record<string, Tone> = { aguardando: "review", aprovado: "approved", ajustes: "adjust" };
const CAPTION_LIMIT: Record<string, number> = { Instagram: 2200, TikTok: 2200, Facebook: 63206, LinkedIn: 3000, X: 280, YouTube: 5000 };
const CHANNELS = Object.keys(CAPTION_LIMIT);
const label = <T extends { key: string; label: string }>(list: readonly T[], k: string | null | undefined) => list.find((x) => x.key === k)?.label ?? k ?? "";
const ddmm = (d?: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "");
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function LibraryPage() {
  const { brandSlug } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isTeam } = useAccess();
  const [ready, setReady] = useState(false);
  const [viewAs, setViewAs] = useState(false);
  useEffect(() => { setReady(true); setViewAs(isViewingAsClient()); }, []);
  const q = useQuery({ queryKey: ["library", brandSlug], queryFn: () => loadLibrary(brandSlug), enabled: ready });
  const d = q.data;
  const { canBrand } = useBrandAccess(d?.brand.id);
  const tab: Tab = TABS.includes(search.tab as Tab) ? (search.tab as Tab) : "ideias";
  const setTab = (t: Tab) => navigate({ to: "/b/$brandSlug/biblioteca", params: { brandSlug }, search: { tab: t }, replace: true });
  const canEdit = !!isTeam && !viewAs;
  const canSuggest = !canEdit && canBrand("biblioteca.criar");
  const [openIdeia, setOpenIdeia] = useState<string | null>(null);
  const [openConteudo, setOpenConteudo] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["library", brandSlug] });

  const catById = useMemo(() => new Map((d?.categorias ?? []).map((c) => [c.id, c])), [d]);
  const classified = (i: Ideia) => !!(i.categoria_id && catById.get(i.categoria_id)?.pilar_id);
  const bank = (d?.ideias ?? []).filter(classified);
  const toBuild = (d?.ideias ?? []).filter((i) => !classified(i));

  const newIdea = async (patch: Partial<Ideia> = {}) => {
    if (!d) return;
    try { const i = await saveIdeia(brandSlug, d.brand.id, null, { title: "Nova ideia", ...patch } as never); await refresh(); setOpenIdeia(i.id); } catch { toast.error("Não foi possível criar a ideia."); }
  };

  const shell = (children: React.ReactNode) => (
    <BrandShell basePath={`/b/${brandSlug}`} brandName={d?.brand.name} brandLogoUrl={d?.brand.logoUrl} primaryColor={d?.brand.primary} accentColor={d?.brand.accent}>{children}</BrandShell>
  );

  if (!ready || q.isLoading) return shell(<div className="stack-lg" aria-busy="true"><Skeleton h={44} r={14} /><div className="idea-grid">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} h={170} r={20} />)}</div></div>);
  if (q.isError) return shell(<div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState kind="error" title="Não foi possível carregar a Biblioteca" actions={<Button variant="secondary" icon="refresh" onClick={() => q.refetch()}>Tentar novamente</Button>} /></div>);
  if (!d) return shell(<div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState kind="search" title="Cliente não encontrado" text="Este endereço não existe ou você não tem acesso." actions={<Link to="/clientes" className="e-btn secondary">Ver clientes</Link>} /></div>);

  const ideia = d.ideias.find((i) => i.id === openIdeia) ?? null;
  const conteudo = d.conteudos.find((c) => c.id === openConteudo) ?? null;

  return shell(
    <div className="stack-lg">
      <div className="lib-head">
        <LineTabs<Tab> value={tab} onChange={setTab} items={[
          { value: "ideias", label: `Banco de ideias · ${bank.length}`, icon: "sparkle" },
          { value: "construir", label: `A construir · ${toBuild.length}`, icon: "inbox" },
          { value: "estrutura", label: "Pilares e categorias", icon: "layers" },
          { value: "conteudos", label: `Conteúdos · ${d.conteudos.length}`, icon: "feed" },
          { value: "referencias", label: "Referências", icon: "pin" },
        ]} />
        <span style={{ flex: 1 }} />
        {canEdit && tab !== "referencias" && tab !== "conteudos" && <Button icon="plus" onClick={() => newIdea()}>Nova ideia</Button>}
        {canEdit && tab === "conteudos" && <Button icon="plus" onClick={async () => { const c = await saveConteudo(brandSlug, d.brand.id, null, {}); await refresh(); setOpenConteudo(c.id); }}>Novo conteúdo</Button>}
        {canSuggest && <Button icon="sparkle" onClick={() => setSuggesting(true)}>Sugerir ideia</Button>}
      </div>

      {tab === "ideias" && <IdeaBank d={d} ideias={bank} toBuild={toBuild.length} canEdit={canEdit} slug={brandSlug} onOpen={setOpenIdeia} onChanged={refresh} onQuick={(p) => newIdea(p)} goBuild={() => setTab("construir")} />}
      {tab === "construir" && <BuildView d={d} ideias={toBuild} canEdit={canEdit} slug={brandSlug} onOpen={setOpenIdeia} onChanged={refresh} />}
      {tab === "estrutura" && <StructureView d={d} canEdit={canEdit} slug={brandSlug} onChanged={refresh} onOpenCategoria={() => setTab("ideias")} />}
      {tab === "conteudos" && <ContentBoard d={d} canEdit={canEdit} onOpen={setOpenConteudo} />}
      {tab === "referencias" && <RefsView d={d} canEdit={canEdit} slug={brandSlug} onChanged={refresh} />}

      <IdeaDrawer ideia={ideia} d={d} canEdit={canEdit} slug={brandSlug} onClose={() => setOpenIdeia(null)} onChanged={refresh} onOpenConteudo={(id) => { setOpenIdeia(null); setTab("conteudos"); setOpenConteudo(id); }} />
      <ContentDrawer conteudo={conteudo} d={d} canEdit={canEdit} slug={brandSlug} onClose={() => setOpenConteudo(null)} onChanged={refresh} onOpenIdeia={(id) => { setOpenConteudo(null); setOpenIdeia(id); }} />
      <SuggestModal open={suggesting} onClose={() => setSuggesting(false)} onSend={async (x) => { await suggestIdeia(brandSlug, d.brand.id, x); toast.success("Sugestão enviada", { description: "A equipe vai classificar e responder por aqui." }); setSuggesting(false); refresh(); }} />
    </div>,
  );
}

// ----- Envio ao Workspace --------------------------------------------------------

function WorkspaceButton({ d, type, id, title, description, due, slug, onChanged, canEdit }: { d: LibraryData; type: "ideia" | "conteudo"; id: string; title: string; description?: string | null; due?: string | null; slug: string; onChanged: () => void; canEdit: boolean }) {
  const [busy, setBusy] = useState(false);
  const sent = d.dispatch[dispatchKey(type, id)];
  if (sent) return (
    <span className="e-row" style={{ gap: 8 }}>
      <Badge tone={WS_TONE[sent.status] ?? "todo"} dot>{sent.status}</Badge>
      <Link to={"/workspace/demandas" as never} className="e-btn ghost sm"><Icon name="external" size="sm" /> Abrir no Workspace</Link>
    </span>
  );
  if (!canEdit) return null;
  return (
    <Button variant="secondary" icon="send" loading={busy} onClick={async () => {
      setBusy(true);
      try { const r = await sendToWorkspace(slug, { brandId: d.brand.id, type, id, title, description, due }); toast.success(r.created ? "Enviado ao Workspace" : "Já estava no Workspace", { description: r.created ? "Uma entrega foi criada para a equipe." : "Nenhuma entrega nova foi criada." }); onChanged(); }
      catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível enviar."); }
      finally { setBusy(false); }
    }}>🚀 Enviar ao Workspace</Button>
  );
}

// ----- Banco de ideias --------------------------------------------------------------

type Filters = { q: string; pilar: string; categoria: string; formato: string; status: string; prioridade: string; campanha: string; responsavel: string; estrela: boolean };
const EMPTY_F: Filters = { q: "", pilar: "", categoria: "", formato: "", status: "", prioridade: "", campanha: "", responsavel: "", estrela: false };

function IdeaBank({ d, ideias, toBuild, canEdit, slug, onOpen, onChanged, onQuick, goBuild }: { d: LibraryData; ideias: Ideia[]; toBuild: number; canEdit: boolean; slug: string; onOpen: (id: string) => void; onChanged: () => void; onQuick: (p: Partial<Ideia>) => void; goBuild: () => void }) {
  const [f, setF] = useState<Filters>(EMPTY_F);
  const [view, setView] = useState<"grade" | "lista">("grade");
  const [quick, setQuick] = useState({ title: "", format: "Reels" });
  const grid = useRef<HTMLDivElement>(null);
  const catById = new Map(d.categorias.map((c) => [c.id, c]));
  const pilarById = new Map(d.pilares.map((p) => [p.id, p]));
  const productions = (id: string) => d.conteudos.filter((c) => c.ideia_id === id).length;
  const shown = ideias.filter((i) => {
    const c = i.categoria_id ? catById.get(i.categoria_id) : undefined;
    return (!f.q || norm(`${i.title} ${i.description ?? ""}`).includes(norm(f.q))) && (!f.pilar || c?.pilar_id === f.pilar) && (!f.categoria || i.categoria_id === f.categoria)
      && (!f.formato || i.format === f.formato) && (!f.status || i.status === f.status) && (!f.prioridade || i.priority === f.prioridade)
      && (!f.campanha || i.campaign_id === f.campanha) && (!f.responsavel || i.responsible === f.responsavel) && (!f.estrela || i.starred);
  }).sort((a, b) => Number(b.starred) - Number(a.starred) || a.order_index - b.order_index);
  const active = Object.entries(f).filter(([k, v]) => k !== "q" && v).length + (f.q ? 1 : 0);
  useEffect(() => { if (grid.current) stagger(grid.current.querySelectorAll(".idea-card"), { y: 8, dur: 380 }, 25); }, [view, active]);
  const opt = (list: Option[], all: string) => [{ value: "", label: all }, ...list];
  const star = async (i: Ideia) => { await saveIdeia(slug, d.brand.id, i.id, { starred: !i.starred }); onChanged(); };
  const cats = d.categorias.filter((c) => !f.pilar || c.pilar_id === f.pilar);

  return (
    <div className="stack">
      {canEdit && (
        <form className="quick-idea e-glass" onSubmit={(e) => { e.preventDefault(); if (!quick.title.trim()) return; onQuick({ title: quick.title.trim(), format: quick.format, categoria_id: f.categoria || null }); setQuick({ ...quick, title: "" }); }}>
          <Icon name="sparkle" size="sm" />
          <input className="quick-input" value={quick.title} placeholder={f.categoria ? `Nova ideia em ${catById.get(f.categoria)?.name}…` : "Escreva uma ideia e tecle Enter"} aria-label="Título da nova ideia" onChange={(e) => setQuick({ ...quick, title: e.target.value })} />
          <div className="quick-format"><Select value={quick.format} onChange={(v) => setQuick({ ...quick, format: v })} options={IDEIA_FORMATOS.map((x) => ({ value: x.key, label: x.label, icon: FORMAT_ICON[x.key] }))} /></div>
          <Button type="submit" size="sm" disabled={!quick.title.trim()}>Adicionar</Button>
        </form>
      )}
      <div className="filter-bar e-glass">
        <Field icon="search" placeholder="Buscar ideia" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} aria-label="Buscar ideia" />
        <div className="filter-grid">
          <Select value={f.pilar} onChange={(v) => setF({ ...f, pilar: v, categoria: "" })} options={opt(d.pilares.map((p) => ({ value: p.id, label: p.name })), "Todos os pilares")} />
          <Select value={f.categoria} onChange={(v) => setF({ ...f, categoria: v })} options={opt(cats.map((c) => ({ value: c.id, label: c.name })), "Todas as categorias")} />
          <Select value={f.formato} onChange={(v) => setF({ ...f, formato: v })} options={opt(IDEIA_FORMATOS.map((x) => ({ value: x.key, label: x.label })), "Todos os formatos")} />
          <Select value={f.status} onChange={(v) => setF({ ...f, status: v })} options={opt(IDEIA_STATUSES.map((x) => ({ value: x.key, label: x.label })), "Todos os status")} />
          <Select value={f.prioridade} onChange={(v) => setF({ ...f, prioridade: v })} options={opt(IDEIA_PRIORIDADES.map((x) => ({ value: x.key, label: x.label })), "Todas as prioridades")} />
          <Select value={f.campanha} onChange={(v) => setF({ ...f, campanha: v })} options={opt(d.campaigns.map((c) => ({ value: c.id, label: c.title })), "Todas as campanhas")} />
          <Select value={f.responsavel} onChange={(v) => setF({ ...f, responsavel: v })} options={opt(d.people.map((p) => ({ value: p, label: p })), "Todos os responsáveis")} />
        </div>
        <div className="e-row between wrap" style={{ gap: 8 }}>
          <div className="e-row" style={{ gap: 8 }}>
            <Chip icon="star" pressed={f.estrela} onClick={() => setF({ ...f, estrela: !f.estrela })}>Com estrela</Chip>
            <span className="e-caption tnum" aria-live="polite">{shown.length} de {ideias.length} ideias</span>
            {active > 0 && <button type="button" className="e-link" onClick={() => setF(EMPTY_F)}>Limpar filtros</button>}
          </div>
          <Segmented value={view} onChange={setView} label="Visualização" items={[{ value: "grade", label: "Grade", icon: "grid" }, { value: "lista", label: "Lista", icon: "list" }]} />
        </div>
      </div>
      {toBuild > 0 && <Alert kind="info" title={`${toBuild} ${toBuild === 1 ? "ideia espera" : "ideias esperam"} classificação`} actions={<Button size="sm" variant="secondary" onClick={goBuild}>Classificar</Button>}>Ideias sem pilar e categoria ficam em “A construir”.</Alert>}
      {shown.length === 0 ? (
        <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}>
          {ideias.length === 0
            ? <EmptyState icon="sparkle" title="O banco de ideias está vazio" text="Crie pilares e categorias e comece a registrar ideias para este cliente." />
            : <EmptyState kind="search" title="Nenhuma ideia com esses filtros" text="Tente combinar menos filtros." actions={<Button variant="secondary" onClick={() => setF(EMPTY_F)}>Limpar filtros</Button>} />}
        </div>
      ) : (
        <div className={view === "grade" ? "idea-grid" : "idea-list"} ref={grid}>
          {shown.map((i) => {
            const c = i.categoria_id ? catById.get(i.categoria_id) : undefined;
            const p = c ? pilarById.get(c.pilar_id) : undefined;
            const prod = productions(i.id);
            const ws = d.dispatch[dispatchKey("ideia", i.id)];
            return (
              <article key={i.id} className={`idea-card e-glass${view === "lista" ? " row" : ""}`}>
                <div className="idea-top">
                  <span className="fmt"><Icon name={FORMAT_ICON[i.format ?? ""] ?? "file"} size="sm" />{i.format}</span>
                  <span className="prio" style={{ ["--c" as string]: PRIORITY_COLOR[i.priority] }} title={`Prioridade ${label(IDEIA_PRIORIDADES, i.priority).toLowerCase()}`}><i />{label(IDEIA_PRIORIDADES, i.priority)}</span>
                  <span style={{ flex: 1 }} />
                  <button type="button" className={`star${i.starred ? " on" : ""}`} aria-pressed={i.starred} aria-label={i.starred ? "Tirar estrela" : "Marcar com estrela"} disabled={!canEdit} onClick={() => star(i)}><Icon name="star" size="sm" /></button>
                </div>
                <button type="button" className="idea-open" onClick={() => onOpen(i.id)}>
                  <b>{i.title}</b>
                  {view === "grade" && i.description && <span className="e-small idea-desc">{i.description}</span>}
                </button>
                <span className="e-caption e-ellipsis">{p?.name} › {c?.name}</span>
                <div className="idea-foot">
                  <Badge tone={IDEIA_TONE[i.status] ?? "todo"}>{label(IDEIA_STATUSES, i.status)}</Badge>
                  {prod > 0 && <span className="e-caption tnum" title="Conteúdos produzidos a partir desta ideia"><Icon name="feed" size="sm" /> {prod}</span>}
                  {ws && <Badge tone={WS_TONE[ws.status] ?? "todo"}>WS · {ws.status}</Badge>}
                  <span style={{ flex: 1 }} />
                  {i.due_date && <span className="e-caption tnum">{ddmm(i.due_date)}</span>}
                  {i.responsible && <Avatar name={i.responsible} size="xs" />}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ----- A construir -----------------------------------------------------------------

function BuildView({ d, ideias, canEdit, slug, onOpen, onChanged }: { d: LibraryData; ideias: Ideia[]; canEdit: boolean; slug: string; onOpen: (id: string) => void; onChanged: () => void }) {
  const [over, setOver] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const classify = async (ideiaId: string, categoriaId: string) => {
    const c = d.categorias.find((x) => x.id === categoriaId);
    await saveIdeia(slug, d.brand.id, ideiaId, { categoria_id: categoriaId, notes: null });
    toast.success("Ideia classificada", { description: `${d.pilares.find((p) => p.id === c?.pilar_id)?.name} › ${c?.name}` });
    onChanged();
  };
  const catOpts = d.pilares.flatMap((p) => d.categorias.filter((c) => c.pilar_id === p.id).map((c) => ({ value: c.id, label: `${p.name} › ${c.name}` })));
  if (ideias.length === 0) return <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState icon="checkCircle" title="Tudo classificado" text="Novas ideias sem pilar e categoria aparecem aqui." /></div>;
  return (
    <div className="build-layout">
      <div className="e-stack" style={{ gap: 8 }}>
        <span className="e-label">{canEdit ? "Arraste para um pilar ou escolha a categoria" : "Ideias aguardando classificação"}</span>
        {ideias.map((i) => (
          <div key={i.id} className={`build-card e-glass${dragging === i.id ? " dragging" : ""}`} draggable={canEdit}
            onDragStart={(e) => { e.dataTransfer.setData("text/x-ideia", i.id); e.dataTransfer.effectAllowed = "move"; setDragging(i.id); }} onDragEnd={() => { setDragging(null); setOver(null); }}>
            <div className="e-row" style={{ gap: 8 }}>
              {canEdit && <span className="tpl-grip" aria-hidden="true"><Icon name="grip" size="sm" /></span>}
              <button type="button" className="idea-open e-grow" onClick={() => onOpen(i.id)}><b>{i.title}</b>{i.description && <span className="e-caption idea-desc">{i.description}</span>}</button>
              {i.notes === SUGGESTION_NOTE && <Badge tone="glass" icon="sparkle">Sugestão do cliente</Badge>}
              <span className="fmt"><Icon name={FORMAT_ICON[i.format ?? ""] ?? "file"} size="sm" />{i.format}</span>
            </div>
            {canEdit && <div className="build-select"><Select value="" placeholder="Classificar em…" onChange={(v) => classify(i.id, v)} options={catOpts} icon="layers" /></div>}
          </div>
        ))}
      </div>
      {canEdit && (
        <div className="build-targets">
          {d.pilares.map((p) => (
            <div key={p.id} className="build-pilar e-glass">
              <b>{p.name}</b>
              {d.categorias.filter((c) => c.pilar_id === p.id).map((c) => (
                <div key={c.id} className={`drop-cat${over === c.id ? " over" : ""}${dragging ? " ready" : ""}`}
                  onDragOver={(e: DragEvent) => { if (!e.dataTransfer.types.includes("text/x-ideia")) return; e.preventDefault(); setOver(c.id); }}
                  onDragLeave={() => setOver((o) => (o === c.id ? null : o))}
                  onDrop={(e: DragEvent) => { e.preventDefault(); const id = e.dataTransfer.getData("text/x-ideia"); setOver(null); setDragging(null); if (id) classify(id, c.id); }}>
                  <Icon name="folder" size="sm" /> {c.name}
                </div>
              ))}
              {d.categorias.every((c) => c.pilar_id !== p.id) && <span className="e-caption">Sem categorias</span>}
            </div>
          ))}
          {d.pilares.length === 0 && <EmptyState compact icon="layers" title="Crie pilares primeiro" text="Em “Pilares e categorias”." />}
        </div>
      )}
    </div>
  );
}

// ----- Pilares e categorias -------------------------------------------------------

function StructureView({ d, canEdit, slug, onChanged, onOpenCategoria }: { d: LibraryData; canEdit: boolean; slug: string; onChanged: () => void; onOpenCategoria: () => void }) {
  const [edit, setEdit] = useState<{ kind: "pilares" | "categorias"; id: string | null; name: string; description: string; pilar_id?: string } | null>(null);
  const [removing, setRemoving] = useState<{ kind: "pilares" | "categorias"; id: string; name: string } | null>(null);
  const count = (catId: string) => d.ideias.filter((i) => i.categoria_id === catId).length;
  const move = async (kind: "pilares" | "categorias", list: { id: string }[], i: number, to: number) => { const ids = list.map((x) => x.id); const [x] = ids.splice(i, 1); ids.splice(to, 0, x); await reorder(slug, kind, ids); onChanged(); };
  const save = async () => {
    if (!edit || !edit.name.trim()) return;
    try {
      if (edit.kind === "pilares") await savePilar(slug, d.brand.id, edit.id, { name: edit.name.trim(), description: edit.description.trim() || null }, d.pilares.length);
      else await saveCategoria(slug, d.brand.id, edit.id, { name: edit.name.trim(), description: edit.description.trim() || null, pilar_id: edit.pilar_id! }, d.categorias.filter((c) => c.pilar_id === edit.pilar_id).length);
      toast.success(edit.id ? "Alterações salvas" : edit.kind === "pilares" ? "Pilar criado" : "Categoria criada");
      setEdit(null); onChanged();
    } catch { toast.error("Não foi possível salvar."); }
  };
  return (
    <div className="stack">
      {canEdit && <div><Button variant="secondary" icon="plus" onClick={() => setEdit({ kind: "pilares", id: null, name: "", description: "" })}>Novo pilar</Button></div>}
      {d.pilares.length === 0 && <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState icon="layers" title="Nenhum pilar ainda" text="Pilares são os grandes temas da marca. Cada um se divide em categorias, que guardam as ideias." /></div>}
      <div className="pilar-grid">
        {d.pilares.map((p, pi) => {
          const cats = d.categorias.filter((c) => c.pilar_id === p.id);
          const total = cats.reduce((n, c) => n + count(c.id), 0);
          return (
            <section key={p.id} className="pilar-card e-glass">
              <header className="e-row" style={{ gap: 8, alignItems: "flex-start" }}>
                <span className="tpl-num tnum">{pi + 1}</span>
                <div className="e-grow" style={{ minWidth: 0 }}><b className="pilar-name">{p.name}</b>{p.description && <p className="e-small" style={{ margin: "2px 0 0" }}>{p.description}</p>}</div>
                <span className="e-caption tnum">{total} {total === 1 ? "ideia" : "ideias"}</span>
                {canEdit && <Menu align="right" trigger={({ toggle }) => <Button size="sm" variant="ghost" icon="more" aria-label={`Ações de ${p.name}`} onClick={toggle} />} items={[
                  { label: "Editar", icon: "edit", onSelect: () => setEdit({ kind: "pilares", id: p.id, name: p.name, description: p.description ?? "" }) },
                  { label: "Nova categoria", icon: "plus", onSelect: () => setEdit({ kind: "categorias", id: null, name: "", description: "", pilar_id: p.id }) },
                  { label: "Subir", icon: "chevUp", disabled: pi === 0, onSelect: () => move("pilares", d.pilares, pi, pi - 1) },
                  { label: "Descer", icon: "chevDown", disabled: pi === d.pilares.length - 1, onSelect: () => move("pilares", d.pilares, pi, pi + 1) },
                  "-",
                  { label: cats.length ? "Excluir (esvazie antes)" : "Excluir", icon: "trash", danger: true, disabled: cats.length > 0, onSelect: () => setRemoving({ kind: "pilares", id: p.id, name: p.name }) },
                ]} />}
              </header>
              <div className="e-stack" style={{ gap: 6 }}>
                {cats.map((c, ci) => (
                  <div key={c.id} className="cat-row">
                    <Icon name="folder" size="sm" />
                    <span className="e-grow" style={{ minWidth: 0 }}><b>{c.name}</b>{c.description && <span className="e-caption"> · {c.description}</span>}</span>
                    <button type="button" className="e-link tnum" onClick={onOpenCategoria}>{count(c.id)}</button>
                    {canEdit && <Menu align="right" trigger={({ toggle }) => <Button size="sm" variant="ghost" icon="more" aria-label={`Ações de ${c.name}`} onClick={toggle} />} items={[
                      { label: "Editar", icon: "edit", onSelect: () => setEdit({ kind: "categorias", id: c.id, name: c.name, description: c.description ?? "", pilar_id: c.pilar_id }) },
                      { label: "Subir", icon: "chevUp", disabled: ci === 0, onSelect: () => move("categorias", cats, ci, ci - 1) },
                      { label: "Descer", icon: "chevDown", disabled: ci === cats.length - 1, onSelect: () => move("categorias", cats, ci, ci + 1) },
                      "-",
                      { label: count(c.id) ? "Excluir (mova as ideias antes)" : "Excluir", icon: "trash", danger: true, disabled: count(c.id) > 0, onSelect: () => setRemoving({ kind: "categorias", id: c.id, name: c.name }) },
                    ]} />}
                  </div>
                ))}
                {cats.length === 0 && <span className="e-caption">Nenhuma categoria.</span>}
                {canEdit && <button type="button" className="tpl-add" onClick={() => setEdit({ kind: "categorias", id: null, name: "", description: "", pilar_id: p.id })}><Icon name="plus" size="sm" /> Categoria</button>}
              </div>
            </section>
          );
        })}
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} icon={edit?.kind === "pilares" ? "layers" : "folder"} title={`${edit?.id ? "Editar" : "Novo"} ${edit?.kind === "pilares" ? "pilar" : "categoria"}`}
        footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancelar</Button><Button disabled={!edit?.name.trim()} onClick={save}>Salvar</Button></>}>
        {edit && <div className="e-stack" style={{ gap: 12 }}>
          <Field label="Nome" autoFocus value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && save()} />
          {edit.kind === "categorias" && <Select label="Pilar" value={edit.pilar_id} onChange={(v) => setEdit({ ...edit, pilar_id: v })} options={d.pilares.map((p) => ({ value: p.id, label: p.name }))} />}
          <TextArea label="Descrição" optional rows={3} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
        </div>}
      </Modal>
      <Modal open={!!removing} onClose={() => setRemoving(null)} icon="trash" tone="danger" title={`Excluir “${removing?.name}”?`}
        footer={<><Button variant="secondary" onClick={() => setRemoving(null)}>Cancelar</Button><Button variant="danger" onClick={async () => { if (!removing) return; await removeGroup(slug, removing.kind, removing.id); toast.success("Excluído"); setRemoving(null); onChanged(); }}>Excluir</Button></>}>
        <p className="e-small" style={{ margin: 0 }}>Está vazio, então nenhuma ideia é afetada.</p>
      </Modal>
    </div>
  );
}

// ----- Conteúdos --------------------------------------------------------------------

function ContentBoard({ d, canEdit, onOpen }: { d: LibraryData; canEdit: boolean; onOpen: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [canal, setCanal] = useState("");
  const list = d.conteudos.filter((c) => (!q || norm(c.title).includes(norm(q))) && (!canal || c.canal === canal));
  const camp = new Map(d.campaigns.map((c) => [c.id, c.title]));
  return (
    <div className="stack">
      <div className="e-row wrap" style={{ gap: 8 }}>
        <div style={{ flex: "1 1 240px" }}><Field icon="search" placeholder="Buscar conteúdo" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar conteúdo" /></div>
        <Chip pressed={!canal} onClick={() => setCanal("")}>Todos os canais</Chip>
        {[...new Set(d.conteudos.map((c) => c.canal).filter(Boolean) as string[])].map((c) => <Chip key={c} pressed={canal === c} onClick={() => setCanal(canal === c ? "" : c)}>{c}</Chip>)}
      </div>
      {d.conteudos.length === 0 ? <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState icon="feed" title="Nenhum conteúdo em produção" text={canEdit ? "Abra uma ideia e use “Usar esta ideia” para começar a produzir." : "Os conteúdos em produção aparecem aqui."} /></div> : (
        <div className="kanban">
          {CONTEUDO_STATUSES.map((s) => {
            const col = list.filter((c) => c.status === s.key);
            return (
              <section key={s.key} className="kcol">
                <header><Badge tone={CONT_TONE[s.key]} dot>{s.label}</Badge><span className="e-caption tnum">{col.length}</span></header>
                {col.map((c) => {
                  const like = d.like[c.id];
                  return (
                    <button key={c.id} type="button" className="kcard e-glass" onClick={() => onOpen(c.id)}>
                      <span className="fmt"><Icon name={FORMAT_ICON[c.formato ?? ""] ?? "file"} size="sm" />{c.formato}{c.canal ? ` · ${c.canal}` : ""}</span>
                      <b>{c.title}</b>
                      {c.campaign_id && <span className="e-caption e-ellipsis"><Icon name="megaphone" size="sm" /> {camp.get(c.campaign_id)}</span>}
                      <span className="kcard-foot">
                        {like && <Badge tone={LIKE_TONE[like.status]} icon="heart">{like.status === "aguardando" ? "No Like" : like.status === "aprovado" ? "Aprovado" : "Ajustes"}</Badge>}
                        <span style={{ flex: 1 }} />
                        {c.publish_date && <span className="e-caption tnum">{ddmm(c.publish_date)}</span>}
                        {c.responsible && <Avatar name={c.responsible} size="xs" />}
                      </span>
                    </button>
                  );
                })}
                {col.length === 0 && <span className="e-caption kempty">Nada aqui</span>}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ----- Ideia ----------------------------------------------------------------------

function IdeaDrawer({ ideia, d, canEdit, slug, onClose, onChanged, onOpenConteudo }: { ideia: Ideia | null; d: LibraryData; canEdit: boolean; slug: string; onClose: () => void; onChanged: () => void; onOpenConteudo: (id: string) => void }) {
  const [x, setX] = useState<Ideia | null>(null);
  const [pilar, setPilar] = useState("");
  const [saving, setSaving] = useState(false);
  const [using, setUsing] = useState(false);
  const [last, setLast] = useState<Ideia | null>(null);
  if (ideia && ideia !== last) setLast(ideia);
  useEffect(() => { if (ideia) { setX({ ...ideia }); setPilar(d.categorias.find((c) => c.id === ideia.categoria_id)?.pilar_id ?? ""); } }, [ideia?.id]);
  const cur = x ?? last;
  if (!cur) return <Drawer open={false} onClose={onClose} title="" />;
  const ro = !canEdit;
  const dirty = !!ideia && JSON.stringify(x) !== JSON.stringify(ideia);
  const prods = d.conteudos.filter((c) => c.ideia_id === cur.id);
  const set = (p: Partial<Ideia>) => setX((v) => (v ? { ...v, ...p } : v));
  const save = async () => {
    if (!x || !x.title.trim()) { toast.error("Dê um título à ideia."); return; }
    setSaving(true);
    try {
      await saveIdeia(slug, d.brand.id, x.id, { title: x.title.trim(), description: x.description, format: x.format, priority: x.priority, status: x.status, starred: x.starred, responsible: x.responsible, due_date: x.due_date, categoria_id: x.categoria_id, campaign_id: x.campaign_id, link: x.link });
      toast.success("Ideia salva"); onChanged(); onClose();
    } catch { toast.error("Não foi possível salvar."); } finally { setSaving(false); }
  };
  return (
    <Drawer open={!!ideia} onClose={onClose} eyebrow={cur.notes === SUGGESTION_NOTE ? "Sugestão do cliente" : "Ideia"} title={cur.title || "Ideia"}
      footer={canEdit ? <><HoldButton label="Segure para excluir" size="sm" onConfirm={async () => { await deleteIdeia(slug, cur.id); toast.success("Ideia excluída"); onChanged(); onClose(); }} /><span style={{ flex: 1 }} /><Button variant="ghost" onClick={onClose}>Fechar</Button><Button icon="check" loading={saving} disabled={!dirty} onClick={save}>Salvar</Button></> : undefined}>
      {canEdit && (
        <div className="drawer-actions">
          <Button icon="sparkle" loading={using} onClick={async () => {
            if (dirty) { toast.error("Salve as alterações antes de usar a ideia."); return; }
            setUsing(true);
            try { const c = await useIdeia(slug, cur); toast.success(prods.length ? "Nova versão criada" : "Conteúdo criado em Rascunho", { description: "A ideia original continua intacta.", action: { label: "Abrir", onClick: () => onOpenConteudo(c.id) } }); onChanged(); }
            catch { toast.error("Não foi possível criar o conteúdo."); } finally { setUsing(false); }
          }}>Usar esta ideia</Button>
          <WorkspaceButton d={d} type="ideia" id={cur.id} title={cur.title} description={cur.description} due={cur.due_date} slug={slug} onChanged={onChanged} canEdit={canEdit} />
        </div>
      )}
      <Field label="Título" value={cur.title} disabled={ro} onChange={(e) => set({ title: e.target.value })} />
      <TextArea label="Descrição" rows={4} value={cur.description ?? ""} disabled={ro} optional onChange={(e) => set({ description: e.target.value || null })} />
      <div className="grid-2" style={{ gap: 12 }}>
        <Select label="Pilar" value={pilar} disabled={ro} placeholder="Sem pilar" onChange={(v) => { setPilar(v); set({ categoria_id: null }); }} options={d.pilares.map((p) => ({ value: p.id, label: p.name }))} />
        <Select label="Categoria" value={cur.categoria_id ?? ""} disabled={ro || !pilar} placeholder={pilar ? "Escolha" : "Escolha o pilar"} onChange={(v) => set({ categoria_id: v })} options={d.categorias.filter((c) => c.pilar_id === pilar).map((c) => ({ value: c.id, label: c.name }))} />
        <Select label="Formato" value={cur.format ?? ""} disabled={ro} onChange={(v) => set({ format: v })} options={IDEIA_FORMATOS.map((f) => ({ value: f.key, label: f.label, icon: FORMAT_ICON[f.key] }))} />
        <Select label="Status" value={cur.status} disabled={ro} onChange={(v) => set({ status: v })} options={IDEIA_STATUSES.map((s) => ({ value: s.key, label: s.label }))} />
        <Select label="Responsável" value={cur.responsible ?? ""} disabled={ro} placeholder="Ninguém" onChange={(v) => set({ responsible: v || null })} options={[{ value: "", label: "Ninguém" }, ...d.people.map((p) => ({ value: p, label: p }))]} />
        <Field label="Prazo" type="date" value={cur.due_date ?? ""} disabled={ro} optional onChange={(e) => set({ due_date: e.target.value || null })} />
        <Select label="Campanha" value={cur.campaign_id ?? ""} disabled={ro} placeholder="Nenhuma" onChange={(v) => set({ campaign_id: v || null })} options={[{ value: "", label: "Nenhuma" }, ...d.campaigns.map((c) => ({ value: c.id, label: c.title }))]} />
        <Field label="Link de referência" icon="link" value={cur.link ?? ""} disabled={ro} optional onChange={(e) => set({ link: e.target.value || null })} />
      </div>
      <div className="e-field">
        <span className="e-field-label">Prioridade</span>
        <Segmented value={cur.priority} onChange={(v) => !ro && set({ priority: v })} label="Prioridade" items={IDEIA_PRIORIDADES.map((p) => ({ value: p.key, label: p.label }))} />
      </div>
      <div className="e-stack" style={{ gap: 6 }}>
        <span className="e-label">Produções · {prods.length}</span>
        {prods.length ? prods.map((c) => (
          <button key={c.id} type="button" className="exec-row" onClick={() => onOpenConteudo(c.id)}>
            <span className="e-grow e-ellipsis">{c.title}</span><Badge tone={CONT_TONE[c.status]}>{label(CONTEUDO_STATUSES, c.status)}</Badge><Icon name="chevRight" size="sm" />
          </button>
        )) : <span className="e-caption">Ainda não virou conteúdo.</span>}
      </div>
    </Drawer>
  );
}

// ----- Conteúdo -------------------------------------------------------------------

type CTab = "briefing" | "roteiro" | "legenda" | "publicacao";

function ScriptBlock({ value, onChange, ro }: { value: string; onChange: (v: string) => void; ro: boolean }) {
  const [editing, setEditing] = useState(false);
  const parts = value.split(/^## /m).filter((s) => s.trim()).map((s) => { const [h, ...rest] = s.split("\n"); return value.trimStart().startsWith("## ") ? { h: h.trim(), body: rest.join("\n").trim() } : { h: "", body: s.trim() }; });
  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); toast.success("Copiado"); } catch { toast.error("Não foi possível copiar."); } };
  if (editing || (!value && !ro)) return (
    <div className="e-stack" style={{ gap: 8 }}>
      <TextArea label="Roteiro" rows={12} value={value} disabled={ro} help="Use “## Nome da seção” para separar cenas, slides ou blocos." onChange={(e) => onChange(e.target.value)} />
      {value && <div><Button size="sm" variant="secondary" icon="check" onClick={() => setEditing(false)}>Ver seções</Button></div>}
    </div>
  );
  return (
    <div className="e-stack" style={{ gap: 8 }}>
      <div className="e-row between"><span className="e-label">{parts.length} {parts.length === 1 ? "seção" : "seções"}</span><span className="e-row" style={{ gap: 6 }}><Button size="sm" variant="ghost" icon="copy" onClick={() => copy(value)}>Copiar tudo</Button>{!ro && <Button size="sm" variant="secondary" icon="edit" onClick={() => setEditing(true)}>Editar</Button>}</span></div>
      {parts.map((p, i) => (
        <div key={i} className="script-sec">
          <div className="e-row between">{p.h ? <b>{p.h}</b> : <span />}<Button size="sm" variant="ghost" icon="copy" aria-label={`Copiar ${p.h || "seção"}`} onClick={() => copy(p.body)} /></div>
          <p>{p.body}</p>
        </div>
      ))}
      {!value && <span className="e-caption">Sem roteiro.</span>}
    </div>
  );
}

function ContentDrawer({ conteudo, d, canEdit, slug, onClose, onChanged, onOpenIdeia }: { conteudo: Conteudo | null; d: LibraryData; canEdit: boolean; slug: string; onClose: () => void; onChanged: () => void; onOpenIdeia: (id: string) => void }) {
  const [x, setX] = useState<Conteudo | null>(null);
  const [tab, setTab] = useState<CTab>("briefing");
  const [saving, setSaving] = useState(false);
  const [last, setLast] = useState<Conteudo | null>(null);
  if (conteudo && conteudo !== last) setLast(conteudo);
  useEffect(() => { if (conteudo) { setX({ ...conteudo }); setTab("briefing"); } }, [conteudo?.id]);
  const cur = x ?? last;
  if (!cur) return <Drawer open={false} onClose={onClose} title="" />;
  const ro = !canEdit;
  const set = (p: Partial<Conteudo>) => setX((v) => (v ? { ...v, ...p } : v));
  const dirty = !!conteudo && JSON.stringify(x) !== JSON.stringify(conteudo);
  const limit = CAPTION_LIMIT[cur.canal ?? "Instagram"] ?? 2200;
  const len = (cur.legenda ?? "").length;
  const like = d.like[cur.id];
  const origin = cur.ideia_id ? d.ideias.find((i) => i.id === cur.ideia_id) : null;
  const save = async () => {
    if (!x) return;
    if (len > limit) { setTab("legenda"); toast.error(`A legenda passou do limite do ${cur.canal}.`); return; }
    setSaving(true);
    try { await saveConteudo(slug, d.brand.id, x.id, { title: x.title, briefing: x.briefing, roteiro: x.roteiro, legenda: x.legenda, cta: x.cta, formato: x.formato, canal: x.canal, publish_date: x.publish_date, published_link: x.published_link, responsible: x.responsible, status: x.status, campaign_id: x.campaign_id }); toast.success("Conteúdo salvo"); onChanged(); onClose(); }
    catch { toast.error("Não foi possível salvar."); } finally { setSaving(false); }
  };
  return (
    <Drawer open={!!conteudo} onClose={onClose} eyebrow="Conteúdo" title={cur.title}
      footer={canEdit ? <><Button variant="ghost" onClick={onClose}>Fechar</Button><Button icon="check" loading={saving} disabled={!dirty} onClick={save}>Salvar</Button></> : undefined}>
      <div className="drawer-actions">
        <Badge tone={CONT_TONE[cur.status]} dot>{label(CONTEUDO_STATUSES, cur.status)}</Badge>
        {like && <Link to={"/like" as never} className="e-btn ghost sm"><Icon name="heart" size="sm" /> Ver no Like · {LIKE_LABEL[like.status]}{like.round > 1 ? ` · rodada ${like.round}` : ""}</Link>}
        <span style={{ flex: 1 }} />
        {canEdit && <Link to={`/like/${slug}/enviar?conteudo=${cur.id}` as never} className="e-btn secondary sm"><Icon name="heart" size="sm" /> Enviar para aprovação</Link>}
        <WorkspaceButton d={d} type="conteudo" id={cur.id} title={cur.title} description={cur.briefing} due={cur.publish_date} slug={slug} onChanged={onChanged} canEdit={canEdit} />
      </div>
      {origin && <button type="button" className="origin-link" onClick={() => onOpenIdeia(origin.id)}><Icon name="sparkle" size="sm" /> Nasceu da ideia <b>{origin.title}</b><Icon name="chevRight" size="sm" /></button>}
      {canEdit && <div className="e-field"><span className="e-field-label">Etapa</span><Segmented value={cur.status} onChange={(v) => set({ status: v })} label="Etapa" items={CONTEUDO_STATUSES.map((s) => ({ value: s.key, label: s.label }))} /></div>}
      <LineTabs<CTab> value={tab} onChange={setTab} items={[{ value: "briefing", label: "Briefing" }, { value: "roteiro", label: "Roteiro" }, { value: "legenda", label: "Legenda" }, { value: "publicacao", label: "Publicação" }]} />
      {tab === "briefing" && <>
        <Field label="Título" value={cur.title} disabled={ro} onChange={(e) => set({ title: e.target.value })} />
        <TextArea label="Briefing" rows={7} value={cur.briefing ?? ""} disabled={ro} optional onChange={(e) => set({ briefing: e.target.value || null })} />
      </>}
      {tab === "roteiro" && <ScriptBlock value={cur.roteiro ?? ""} ro={ro} onChange={(v) => set({ roteiro: v || null })} />}
      {tab === "legenda" && <>
        <Select label="Canal" value={cur.canal ?? "Instagram"} disabled={ro} onChange={(v) => set({ canal: v })} options={CHANNELS.map((c) => ({ value: c, label: c }))} />
        <div className="e-field">
          <TextArea label="Legenda" rows={8} value={cur.legenda ?? ""} disabled={ro} optional onChange={(e) => set({ legenda: e.target.value || null })} />
          <div className={`caption-count tnum${len > limit ? " over" : len > limit * 0.9 ? " near" : ""}`}><div className="e-bar sm"><i style={{ ["--v" as string]: `${Math.min(100, (len / limit) * 100)}%` }} /></div>{len.toLocaleString("pt-BR")} / {limit.toLocaleString("pt-BR")} no {cur.canal ?? "Instagram"}</div>
        </div>
        <Field label="Chamada para ação (CTA)" value={cur.cta ?? ""} disabled={ro} optional onChange={(e) => set({ cta: e.target.value || null })} />
      </>}
      {tab === "publicacao" && <div className="grid-2" style={{ gap: 12 }}>
        <Select label="Formato" value={cur.formato ?? ""} disabled={ro} onChange={(v) => set({ formato: v })} options={CONTEUDO_FORMATOS.map((f) => ({ value: f, label: f, icon: FORMAT_ICON[f] }))} />
        <Field label="Data de publicação" type="date" value={cur.publish_date ?? ""} disabled={ro} optional onChange={(e) => set({ publish_date: e.target.value || null })} />
        <Select label="Responsável" value={cur.responsible ?? ""} disabled={ro} placeholder="Ninguém" onChange={(v) => set({ responsible: v || null })} options={[{ value: "", label: "Ninguém" }, ...d.people.map((p) => ({ value: p, label: p }))]} />
        <Select label="Campanha" value={cur.campaign_id ?? ""} disabled={ro} placeholder="Nenhuma" onChange={(v) => set({ campaign_id: v || null })} options={[{ value: "", label: "Nenhuma" }, ...d.campaigns.map((c) => ({ value: c.id, label: c.title }))]} />
        <div style={{ gridColumn: "1 / -1" }}><Field label="Link publicado" icon="link" value={cur.published_link ?? ""} disabled={ro} optional placeholder="https://" onChange={(e) => set({ published_link: e.target.value || null })} /></div>
        {cur.published_link && <a className="e-link" href={cur.published_link} target="_blank" rel="noreferrer"><Icon name="external" size="sm" /> Abrir publicação</a>}
        <span className="e-caption" style={{ gridColumn: "1 / -1" }}>Atualizado {relDay(cur.updated_at.slice(0, 10)).toLowerCase()}</span>
      </div>}
    </Drawer>
  );
}

// ----- Referências ---------------------------------------------------------------

function RefsView({ d, canEdit, slug, onChanged }: { d: LibraryData; canEdit: boolean; slug: string; onChanged: () => void }) {
  const [cat, setCat] = useState("");
  const [purpose, setPurpose] = useState("");
  const [edit, setEdit] = useState<(Partial<Referencia> & { title: string; linkText: string }) | null>(null);
  const cats = [...new Set(d.refs.map((r) => r.category))];
  const list = d.refs.filter((r) => (!cat || r.category === cat) && (!purpose || r.purpose === purpose));
  const save = async () => {
    if (!edit || !edit.title.trim()) return;
    const links = edit.linkText.split("\n").map((l) => l.trim()).filter(Boolean).map((url) => ({ url }));
    try { await saveRef(slug, d.brand.id, edit.id ?? null, { title: edit.title.trim(), description: edit.description ?? null, category: edit.category || "Visual", purpose: edit.purpose ?? null, when_to_use: edit.when_to_use ?? null, cover_url: edit.cover_url ?? null, links }); toast.success("Referência salva"); setEdit(null); onChanged(); }
    catch { toast.error("Não foi possível salvar."); }
  };
  return (
    <div className="stack">
      <div className="e-row between wrap" style={{ gap: 8 }}>
        <div className="e-row wrap" style={{ gap: 6 }}>
          <Chip pressed={!cat} onClick={() => setCat("")}>Todas</Chip>
          {cats.map((c) => <Chip key={c} pressed={cat === c} onClick={() => setCat(cat === c ? "" : c)}>{c}</Chip>)}
          <div style={{ width: 220 }}><Select value={purpose} onChange={setPurpose} options={[{ value: "", label: "Qualquer propósito" }, ...REF_PURPOSES.map((p) => ({ value: p, label: p }))]} /></div>
        </div>
        {canEdit && <Button icon="plus" onClick={() => setEdit({ title: "", linkText: "", category: "Visual" })}>Nova referência</Button>}
      </div>
      {list.length === 0 ? <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState icon="image" title={d.refs.length ? "Nenhuma referência com esse filtro" : "Nenhuma referência ainda"} text="Guarde aqui o que inspira a marca: visuais, tom de voz, campanhas e roteiros." /></div> : (
        <div className="ref-grid">
          {list.map((r) => (
            <article key={r.id} className="ref-card e-glass">
              <div className="ref-cover">{r.cover_url ? <img src={r.cover_url} alt="" /> : <Icon name="image" />}<span className="ref-cat">{r.category}</span></div>
              <div className="ref-body">
                <b>{r.title}</b>
                {r.description && <span className="e-small idea-desc">{r.description}</span>}
                <div className="e-row wrap" style={{ gap: 4 }}>{r.purpose && <Badge tone="glass">{r.purpose}</Badge>}{r.when_to_use && <span className="e-caption">{r.when_to_use}</span>}</div>
                <div className="e-row" style={{ gap: 6, marginTop: 4 }}>
                  {r.links[0] && <a className="e-link" href={r.links[0].url} target="_blank" rel="noreferrer"><Icon name="external" size="sm" /> {r.links[0].label ?? "Abrir"}</a>}
                  <span style={{ flex: 1 }} />
                  {canEdit && <Menu align="right" trigger={({ toggle }) => <Button size="sm" variant="ghost" icon="more" aria-label={`Ações de ${r.title}`} onClick={toggle} />} items={[
                    { label: "Editar", icon: "edit", onSelect: () => setEdit({ ...r, linkText: r.links.map((l) => l.url).join("\n") }) },
                    { label: "Excluir", icon: "trash", danger: true, onSelect: async () => { await removeRef(slug, r.id); toast.success("Referência excluída"); onChanged(); } },
                  ]} />}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      <Drawer open={!!edit} onClose={() => setEdit(null)} eyebrow="Referência" title={edit?.id ? "Editar referência" : "Nova referência"}
        footer={<><Button variant="ghost" onClick={() => setEdit(null)}>Cancelar</Button><Button icon="check" disabled={!edit?.title.trim()} onClick={save}>Salvar</Button></>}>
        {edit && <>
          <Field label="Título" autoFocus value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
          <div className="grid-2" style={{ gap: 12 }}>
            <Field label="Categoria" value={edit.category ?? ""} placeholder="Visual, Texto, Vídeo…" onChange={(e) => setEdit({ ...edit, category: e.target.value })} />
            <Select label="Propósito" value={edit.purpose ?? ""} placeholder="Escolha" onChange={(v) => setEdit({ ...edit, purpose: v })} options={REF_PURPOSES.map((p) => ({ value: p, label: p }))} />
            <Select label="Quando usar" value={edit.when_to_use ?? ""} placeholder="Escolha" onChange={(v) => setEdit({ ...edit, when_to_use: v })} options={REF_WHEN.map((p) => ({ value: p, label: p }))} />
            <Field label="Capa (URL da imagem)" optional value={edit.cover_url ?? ""} onChange={(e) => setEdit({ ...edit, cover_url: e.target.value || null })} />
          </div>
          <TextArea label="Descrição" optional rows={3} value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
          <TextArea label="Links" optional rows={3} help="Um por linha." value={edit.linkText} onChange={(e) => setEdit({ ...edit, linkText: e.target.value })} />
        </>}
      </Drawer>
    </div>
  );
}

// ----- Sugestão do cliente -------------------------------------------------------

function SuggestModal({ open, onClose, onSend }: { open: boolean; onClose: () => void; onSend: (x: { title: string; description: string; format: string }) => Promise<void> }) {
  const [f, setF] = useState({ title: "", description: "", format: "Reels" });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setF({ title: "", description: "", format: "Reels" }); }, [open]);
  return (
    <Modal open={open} onClose={onClose} icon="sparkle" title="Sugerir uma ideia" sub="A equipe recebe e organiza no Banco de ideias."
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button icon="send" loading={busy} disabled={!f.title.trim()} onClick={async () => { setBusy(true); try { await onSend(f); } catch { toast.error("Não foi possível enviar."); } finally { setBusy(false); } }}>Enviar sugestão</Button></>}>
      <div className="e-stack" style={{ gap: 12 }}>
        <Field label="Ideia" autoFocus value={f.title} placeholder="Ex.: Mostrar como escolher o perfume ideal" onChange={(e) => setF({ ...f, title: e.target.value })} />
        <TextArea label="Conte um pouco mais" optional rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <Select label="Formato" value={f.format} onChange={(v) => setF({ ...f, format: v })} options={IDEIA_FORMATOS.map((x) => ({ value: x.key, label: x.label, icon: FORMAT_ICON[x.key] }))} />
      </div>
    </Modal>
  );
}

