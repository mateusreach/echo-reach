// ---------------------------------------------------------------------------
// BRAND — Biblioteca de conteúdo (página 09)
//
// Pilar → Categoria → Ideias; ideias viram Conteúdos ("Usar esta ideia") sem
// nunca alterar a ideia original. Envio ao Workspace é idempotente (RPC
// dispatch_brand_item_to_work_order). Sem banco, roda em memória.
// ---------------------------------------------------------------------------
import { supabase } from "@/integrations/supabase/client";
import {
  createCategoria,
  createConteudo,
  createConteudoFromIdeia,
  createIdeia,
  createPilar,
  getBrandBySlug,
  updateCategoria,
  updateConteudo,
  updateIdeia,
  updatePilar,
  type Categoria,
  type Conteudo,
  type Ideia,
  type Pilar,
} from "@/lib/reach-data";
import { createReferencia, updateReferencia, type Referencia } from "@/lib/agency-data";
import { dispatchBrandItemToWorkOrder, externalStatus } from "@/lib/work-orders";
import { addDays, toISO, today } from "@/lib/workspace-data";
import { isDemoMode } from "@/lib/home-data";

const db = supabase as any;
const iso = (n: number) => toISO(addDays(today(), n));
const now = () => new Date().toISOString();
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`;

export const SUGGESTION_NOTE = "Sugerida pelo cliente";
export type LibBrand = { id: string; name: string; slug: string; logoUrl: string | null; primary: string | null; accent: string | null };
export type Dispatch = { workOrderId: string; status: string };
export type LikeLink = { status: "aguardando" | "aprovado" | "ajustes"; round: number };
export type LibraryData = {
  brand: LibBrand;
  pilares: Pilar[];
  categorias: Categoria[];
  ideias: Ideia[];
  conteudos: Conteudo[];
  campaigns: { id: string; title: string }[];
  people: string[];
  refs: Referencia[];
  dispatch: Record<string, Dispatch>;
  like: Record<string, LikeLink>;
};
export const dispatchKey = (type: "ideia" | "conteudo", id: string) => `${type}:${id}`;

// ----- exemplo em memória -----------------------------------------------------

const demoStore = new Map<string, LibraryData>();
function demo(slug: string): LibraryData | null {
  if (demoStore.has(slug)) return demoStore.get(slug)!;
  const names: Record<string, string> = { "fina-fragrancia": "Fina Fragrância", zelus: "Zelus", eliza: "Eliza", "dra-giuliana": "Dra. Giuliana", emporium: "A Emporium", esense: "Esense", "pao-de-queijo-da-maria": "Pão de Queijo da Maria", "gaby-mota-cachos": "Gaby Mota Cachos", "gamo-atelie": "Gamô Ateliê", spirale: "Spirale", "isabela-gomes": "Isabela Gomes" };
  if (!names[slug]) return null;
  const b = `b-${slug}`;
  const t = now();
  const pil = (id: string, name: string, description: string, order: number): Pilar => ({ id, brand_id: b, name, description, order_index: order, created_at: t, updated_at: t });
  const cat = (id: string, pilar_id: string, name: string, order: number, description: string | null = null): Categoria => ({ id, brand_id: b, pilar_id, name, description, order_index: order, created_at: t, updated_at: t });
  const pilares = [pil("p1", "Bastidores", "O processo artesanal por trás de cada fragrância.", 0), pil("p2", "Produto", "Notas, famílias olfativas e coleções.", 1), pil("p3", "Educação", "Como escolher, usar e conservar perfumes.", 2), pil("p4", "Comunidade", "Clientes, depoimentos e encontros.", 3)];
  const categorias = [cat("c1", "p1", "Ateliê", 0, "Rotina de criação"), cat("c2", "p1", "Matéria-prima", 1), cat("c3", "p2", "Lançamentos", 0), cat("c4", "p2", "Notas olfativas", 1), cat("c5", "p3", "Guia de uso", 0), cat("c6", "p3", "Mitos e verdades", 1), cat("c7", "p4", "Depoimentos", 0)];
  let n = 0;
  const ide = (title: string, categoria_id: string | null, format: string, priority: string, status: string, extra: Partial<Ideia> = {}): Ideia => ({
    id: `i${++n}`, brand_id: b, categoria_id, title, description: null, format, priority, status, starred: false, responsible: null, due_date: null, image_url: null, link: null, refs: [], attachments: [], campaign_id: null, initiative_id: null, notes: null, order_index: n, created_at: t, updated_at: t, ...extra,
  });
  const ideias = [
    ide("Um dia no ateliê em 30 segundos", "c1", "Reels", "alta", "fazendo", { starred: true, responsible: "Rafael Monteiro", description: "Time-lapse do preparo de um lote, do pesar das essências ao envase.", due_date: iso(3) }),
    ide("As mãos por trás do frasco", "c1", "Carrossel", "media", "a_fazer", { responsible: "Camila Rocha", description: "Retratos da equipe com uma frase de cada pessoa sobre o ofício." }),
    ide("De onde vem a nossa baunilha", "c2", "Reels", "media", "a_fazer", { description: "Origem, colheita e cura da baunilha de Madagascar." }),
    ide("Fichas das matérias-primas", "c2", "Carrossel", "baixa", "a_fazer"),
    ide("Coleção Outono: notas e inspiração", "c3", "Carrossel", "alta", "feita", { starred: true, responsible: "Rafael Monteiro", campaign_id: "cp1", description: "Apresentação da coleção com as notas de cabeça, corpo e fundo." }),
    ide("Contagem regressiva do lançamento", "c3", "Stories", "alta", "fazendo", { campaign_id: "cp1", due_date: iso(1), responsible: "Marina Lopes" }),
    ide("O que é uma nota de fundo?", "c4", "Estático", "media", "a_fazer", { responsible: "Camila Rocha" }),
    ide("Família chipre explicada", "c4", "TikTok", "baixa", "a_fazer"),
    ide("Onde aplicar o perfume", "c5", "Reels", "alta", "concluido", { responsible: "Theo Almeida" }),
    ide("Como guardar seu perfume", "c5", "Estático", "media", "feita"),
    ide("Perfume vence? Mitos e verdades", "c6", "Carrossel", "alta", "a_fazer", { starred: true }),
    ide("Clientes contam o primeiro frasco", "c7", "Reels", "media", "a_fazer", { campaign_id: "cp2" }),
    ide("Perfume para presentear no Natal", null, "Carrossel", "media", "a_fazer", { description: "Guia por perfil de quem recebe." }),
    ide("Tour pela nova loja", null, "Reels", "baixa", "a_fazer"),
    ide("Kit de amostras: como escolher", null, "Stories", "media", "a_fazer", { notes: SUGGESTION_NOTE, description: "Muita gente pergunta no direct como escolher as amostras." }),
  ];
  const cont = (id: string, ideia_id: string | null, title: string, status: string, formato: string, canal: string, extra: Partial<Conteudo> = {}): Conteudo => ({
    id, brand_id: b, ideia_id, title, status, formato, canal, briefing: null, roteiro: null, legenda: null, cta: null, notes: null, image_url: null, attachments: [], publish_date: null, published_link: null, responsible: null, campaign_id: null, task_id: null, created_at: t, updated_at: t, ...extra,
  });
  const conteudos = [
    cont("k1", "i5", "Coleção Outono: notas e inspiração", "aprovada", "Carrossel", "Instagram", { campaign_id: "cp1", publish_date: iso(2), responsible: "Rafael Monteiro", briefing: "Apresentar as três fragrâncias da coleção com linguagem sensorial.", roteiro: "## Capa\nNotas de outono\n\n## Slide 2\nÂmbar e figo: a primeira fragrância\n\n## Slide 3\nCouro e baunilha", legenda: "O outono chegou ao ateliê. Três fragrâncias, uma estação. 🍂\n\nQual delas combina com você?", cta: "Conheça a coleção no link da bio" }),
    cont("k2", "i1", "Um dia no ateliê em 30 segundos", "rascunho", "Reels", "Instagram", { responsible: "Theo Almeida", publish_date: iso(5), briefing: "Time-lapse com trilha suave." }),
    cont("k3", "i9", "Onde aplicar o perfume", "publicada", "Reels", "Instagram", { publish_date: iso(-6), published_link: "https://instagram.com/p/exemplo", responsible: "Theo Almeida" }),
    cont("k4", "i10", "Como guardar seu perfume", "produzida", "Estático", "Instagram", { publish_date: iso(4), legenda: "Luz e calor são os maiores inimigos do seu perfume." }),
    cont("k5", "i5", "Coleção Outono: notas e inspiração (nova versão)", "rascunho", "Reels", "TikTok", { campaign_id: "cp1" }),
  ];
  const ref = (id: string, title: string, category: string, purpose: string, extra: Partial<Referencia> = {}): Referencia => ({
    id, brand_id: b, title, description: null, category, tags: [], purpose, when_to_use: "Sempre", usage_notes: null, links: [], attachments: [], cover_url: null, created_at: t, updated_at: t, ...extra,
  });
  const refs = [
    ref("r1", "Le Labo · fotografia de produto", "Visual", "Inspiração visual", { links: [{ label: "Instagram", url: "https://instagram.com/lelabofragrances" }], description: "Luz natural, fundo neutro e rótulos em destaque." }),
    ref("r2", "Aesop · tom de voz", "Texto", "Referência de abordagem", { when_to_use: "Em conteúdos específicos", description: "Frases curtas, sensoriais, sem exagero." }),
    ref("r3", "Byredo · lançamentos", "Campanha", "Desenvolver campanha", { when_to_use: "Em campanhas" }),
    ref("r4", "Reels de bastidores de cerâmica", "Vídeo", "Criar roteiro", { links: [{ label: "Exemplo", url: "https://instagram.com/reel/exemplo" }] }),
  ];
  const data: LibraryData = {
    brand: { id: b, name: names[slug], slug, logoUrl: null, primary: null, accent: null },
    pilares, categorias, ideias, conteudos,
    campaigns: [{ id: "cp1", title: "Lançamento Coleção Outono" }, { id: "cp2", title: "Mês do cliente" }],
    people: ["Rafael Monteiro", "Camila Rocha", "Bruno Tavares", "Marina Lopes", "Theo Almeida", "Júlia Castro"],
    refs,
    dispatch: { [dispatchKey("conteudo", "k1")]: { workOrderId: "wo-1", status: "Em aprovação" }, [dispatchKey("ideia", "i1")]: { workOrderId: "wo-2", status: "Em execução" } },
    like: { k1: { status: "aguardando", round: 1 }, k3: { status: "aprovado", round: 2 } },
  };
  demoStore.set(slug, data);
  return data;
}

const clone = <T,>(x: T): T => structuredClone(x);
/** Armazenamento do exemplo (usado pelo Like para atualizar conteúdos). */
export const demoLibraryStore = (slug: string) => demo(slug);

// ----- leitura ----------------------------------------------------------------

export async function loadLibrary(slug: string): Promise<LibraryData | null> {
  if (isDemoMode()) { const d = demo(slug); return d ? clone(d) : null; }
  const b = await getBrandBySlug(slug);
  if (!b) return null;
  const [pil, cat, ide, cont, camps, team, refs, sources] = await Promise.all([
    db.from("biblioteca_pilares").select("*").eq("brand_id", b.id).order("order_index"),
    db.from("biblioteca_categorias").select("*").eq("brand_id", b.id).order("order_index"),
    db.from("biblioteca_ideias").select("*").eq("brand_id", b.id).order("order_index"),
    db.from("conteudos").select("*").eq("brand_id", b.id).order("created_at", { ascending: false }),
    db.from("espaco360_campaigns").select("id, title").eq("brand_id", b.id).order("created_at", { ascending: false }),
    db.from("team_members").select("name").eq("active", true).order("name"),
    db.from("referencias").select("*").eq("brand_id", b.id).order("created_at", { ascending: false }),
    db.from("workspace_work_order_sources").select("work_order_id, source_type, source_id").eq("brand_id", b.id).in("source_type", ["ideia", "conteudo"]),
  ]);
  const src = (sources.data ?? []) as { work_order_id: string; source_type: "ideia" | "conteudo"; source_id: string }[];
  const dispatch: Record<string, Dispatch> = {};
  if (src.length) {
    const { data: tasks } = await db.from("workspace_tasks").select("work_order_id, status").in("work_order_id", src.map((s) => s.work_order_id));
    for (const s of src) dispatch[dispatchKey(s.source_type, s.source_id)] = { workOrderId: s.work_order_id, status: externalStatus(((tasks ?? []) as any[]).filter((t) => t.work_order_id === s.work_order_id)) };
  }
  const anyB = b as any;
  return {
    brand: { id: b.id, name: b.name, slug: b.slug, logoUrl: b.logo_url ?? null, primary: anyB.primary_color ?? null, accent: anyB.accent_color ?? null },
    pilares: pil.data ?? [], categorias: cat.data ?? [], ideias: ide.data ?? [], conteudos: cont.data ?? [],
    campaigns: camps.data ?? [], people: ((team.data ?? []) as any[]).map((m) => m.name),
    refs: ((refs.data ?? []) as any[]).map((r) => ({ ...r, links: r.links ?? [], attachments: r.attachments ?? [], tags: r.tags ?? [] })),
    dispatch,
    like: {}, // Vínculo com o Like chega na página 19.
  };
}

// ----- escrita ----------------------------------------------------------------

type IdeiaPatch = Partial<Pick<Ideia, "title" | "description" | "format" | "priority" | "status" | "starred" | "responsible" | "due_date" | "categoria_id" | "campaign_id" | "link" | "image_url" | "notes" | "refs" | "attachments">>;

export async function saveIdeia(slug: string, brandId: string, id: string | null, patch: IdeiaPatch): Promise<Ideia> {
  if (isDemoMode()) {
    const d = demo(slug)!;
    if (id) { d.ideias = d.ideias.map((i) => (i.id === id ? { ...i, ...patch, updated_at: now() } as Ideia : i)); return clone(d.ideias.find((i) => i.id === id)!); }
    const created = { id: uid("i"), brand_id: brandId, categoria_id: null, title: "Nova ideia", description: null, format: "Reels", priority: "media", status: "a_fazer", starred: false, responsible: null, due_date: null, image_url: null, link: null, refs: [], attachments: [], campaign_id: null, initiative_id: null, notes: null, order_index: d.ideias.length, created_at: now(), updated_at: now(), ...patch } as Ideia;
    d.ideias.push(created);
    return clone(created);
  }
  if (id) { await updateIdeia(id, patch as never); const { data } = await db.from("biblioteca_ideias").select("*").eq("id", id).single(); return data; }
  return createIdeia({ brand_id: brandId, title: patch.title ?? "Nova ideia", status: "a_fazer", ...patch } as never);
}

export async function deleteIdeia(slug: string, id: string) {
  if (isDemoMode()) { const d = demo(slug)!; d.ideias = d.ideias.filter((i) => i.id !== id); return; }
  const { error } = await db.from("biblioteca_ideias").delete().eq("id", id);
  if (error) throw error;
}

/** "Usar esta ideia": cria um conteúdo em Rascunho. A ideia não é tocada. */
export async function useIdeia(slug: string, ideia: Ideia): Promise<Conteudo> {
  if (isDemoMode()) {
    const d = demo(slug)!;
    const again = d.conteudos.some((c) => c.ideia_id === ideia.id);
    const c: Conteudo = { id: uid("k"), brand_id: ideia.brand_id, ideia_id: ideia.id, campaign_id: ideia.campaign_id, title: again ? `${ideia.title} (nova versão)` : ideia.title, briefing: ideia.description, formato: ideia.format, responsible: ideia.responsible, status: "rascunho", canal: "Instagram", roteiro: null, legenda: null, cta: null, notes: null, image_url: null, attachments: [], publish_date: null, published_link: null, task_id: null, created_at: now(), updated_at: now() };
    d.conteudos.unshift(c);
    return clone(c);
  }
  return createConteudoFromIdeia(ideia, ideia.brand_id);
}

type ConteudoPatch = Partial<Pick<Conteudo, "title" | "briefing" | "roteiro" | "legenda" | "cta" | "formato" | "canal" | "publish_date" | "published_link" | "responsible" | "status" | "campaign_id" | "image_url" | "attachments" | "notes">>;
export async function saveConteudo(slug: string, brandId: string, id: string | null, patch: ConteudoPatch): Promise<Conteudo> {
  if (isDemoMode()) {
    const d = demo(slug)!;
    if (id) { d.conteudos = d.conteudos.map((c) => (c.id === id ? { ...c, ...patch, updated_at: now() } as Conteudo : c)); return clone(d.conteudos.find((c) => c.id === id)!); }
    const c = { id: uid("k"), brand_id: brandId, ideia_id: null, title: "Novo conteúdo", status: "rascunho", formato: "Reels", canal: "Instagram", briefing: null, roteiro: null, legenda: null, cta: null, notes: null, image_url: null, attachments: [], publish_date: null, published_link: null, responsible: null, campaign_id: null, task_id: null, created_at: now(), updated_at: now(), ...patch } as Conteudo;
    d.conteudos.unshift(c);
    return clone(c);
  }
  if (id) { await updateConteudo(id, patch as never); const { data } = await db.from("conteudos").select("*").eq("id", id).single(); return data; }
  return createConteudo({ brand_id: brandId, title: patch.title ?? "Novo conteúdo", status: "rascunho", ...patch } as never);
}

export async function savePilar(slug: string, brandId: string, id: string | null, input: { name: string; description: string | null }, order = 0) {
  if (isDemoMode()) {
    const d = demo(slug)!;
    if (id) d.pilares = d.pilares.map((p) => (p.id === id ? { ...p, ...input } : p));
    else d.pilares.push({ id: uid("p"), brand_id: brandId, order_index: order, created_at: now(), updated_at: now(), ...input });
    return;
  }
  if (id) await updatePilar(id, input);
  else await createPilar({ brand_id: brandId, order_index: order, ...input });
}

export async function saveCategoria(slug: string, brandId: string, id: string | null, input: { name: string; description: string | null; pilar_id: string }, order = 0) {
  if (isDemoMode()) {
    const d = demo(slug)!;
    if (id) d.categorias = d.categorias.map((c) => (c.id === id ? { ...c, ...input } : c));
    else d.categorias.push({ id: uid("c"), brand_id: brandId, order_index: order, created_at: now(), updated_at: now(), ...input });
    return;
  }
  if (id) await updateCategoria(id, input);
  else await createCategoria({ brand_id: brandId, order_index: order, ...input });
}

export async function reorder(slug: string, table: "pilares" | "categorias", ids: string[]) {
  if (isDemoMode()) {
    const d = demo(slug)!;
    const list = d[table] as (Pilar | Categoria)[];
    for (const it of list) { const i = ids.indexOf(it.id); if (i >= 0) it.order_index = i; }
    list.sort((a, b) => a.order_index - b.order_index);
    return;
  }
  const t = table === "pilares" ? "biblioteca_pilares" : "biblioteca_categorias";
  for (const [i, id] of ids.entries()) await db.from(t).update({ order_index: i }).eq("id", id);
}

/** Excluir pilar/categoria só é permitido vazio; ideias nunca somem por tabela. */
export async function removeGroup(slug: string, table: "pilares" | "categorias", id: string) {
  if (isDemoMode()) { const d = demo(slug)!; (d as any)[table] = (d[table] as any[]).filter((x) => x.id !== id); return; }
  const { error } = await db.from(table === "pilares" ? "biblioteca_pilares" : "biblioteca_categorias").delete().eq("id", id);
  if (error) throw error;
}

/** Envio ao Workspace: idempotente — reenviar devolve a mesma entrega. */
export async function sendToWorkspace(slug: string, input: { brandId: string; type: "ideia" | "conteudo"; id: string; title: string; description?: string | null; due?: string | null }): Promise<{ workOrderId: string; created: boolean }> {
  if (isDemoMode()) {
    const d = demo(slug)!;
    const k = dispatchKey(input.type, input.id);
    if (d.dispatch[k]) return { workOrderId: d.dispatch[k].workOrderId, created: false };
    d.dispatch[k] = { workOrderId: uid("wo"), status: "Recebido" };
    return { workOrderId: d.dispatch[k].workOrderId, created: true };
  }
  return dispatchBrandItemToWorkOrder({
    brandId: input.brandId, sourceModule: "biblioteca", sourceType: input.type, sourceId: input.id, title: input.title, description: input.description ?? null,
    sourceUrl: `${window.location.origin}/b/${slug}/biblioteca?tab=${input.type === "ideia" ? "ideias" : "conteudos"}`, requestedDueDate: input.due ?? null,
  });
}

export async function saveRef(slug: string, brandId: string, id: string | null, input: Partial<Referencia> & { title: string }) {
  if (isDemoMode()) {
    const d = demo(slug)!;
    if (id) d.refs = d.refs.map((r) => (r.id === id ? { ...r, ...input, updated_at: now() } : r));
    else d.refs.unshift({ id: uid("r"), brand_id: brandId, description: null, category: "Visual", tags: [], purpose: null, when_to_use: null, usage_notes: null, links: [], attachments: [], cover_url: null, created_at: now(), updated_at: now(), ...input });
    return;
  }
  if (id) await updateReferencia(id, input);
  else await createReferencia({ brand_id: brandId, ...input });
}

export async function removeRef(slug: string, id: string) {
  if (isDemoMode()) { const d = demo(slug)!; d.refs = d.refs.filter((r) => r.id !== id); return; }
  const { error } = await db.from("referencias").delete().eq("id", id);
  if (error) throw error;
}

/** Sugestão do cliente: entra sem categoria, marcada para a equipe classificar. */
export async function suggestIdeia(slug: string, brandId: string, input: { title: string; description: string; format: string }) {
  return saveIdeia(slug, brandId, null, { ...input, notes: SUGGESTION_NOTE, categoria_id: null, status: "a_fazer", priority: "media" });
}
