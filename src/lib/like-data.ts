// ---------------------------------------------------------------------------
// LIKE — aprovação de materiais pelo cliente (página 18: dados e regras)
//
// Materiais em rodadas, versões imutáveis depois de enviadas, comentários
// ancorados (ponto, tempo, trecho), decisões imutáveis com desfazer em 5 min.
// Cada decisão atualiza Workspace, Biblioteca, cobertura e agenda do 360.
//
// Com Supabase: tabelas like_* e funções like_send_items / like_decide /
// like_undo / like_mark_published (migração 20260929150000_echo_like.sql).
// Sem banco: um motor em memória com as MESMAS regras, ligado aos exemplos
// do Workspace, da Biblioteca e do Espaço 360.
// ---------------------------------------------------------------------------
import { supabase } from "@/integrations/supabase/client";
import { isDemoMode } from "@/lib/home-data";
import { isViewingAsClient } from "@/lib/view-as";
import { addDays, frontPeriod, frontRisk, toISO, today } from "@/lib/workspace-data";
import { demoOps } from "@/lib/ops-data";
import { demoLibraryStore } from "@/lib/library-data";
import { demoEventsFor, demoRemoveEvent, demoSpaceStore, demoUpsertEvent, likeDecisionsDemo } from "@/lib/space-data";
import { ROSTER } from "@/lib/clients-data";

const db = supabase as any;
const nowISO = () => new Date().toISOString();
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 10)}`;
const clone = <T,>(x: T): T => structuredClone(x);

// ----- Tipos ----------------------------------------------------------------------

export type ItemKind = "post" | "carrossel" | "video" | "stories" | "roteiro" | "texto" | "peca" | "outro";
export type ItemStatus = "rascunho" | "aguardando" | "em_revisao" | "aprovado" | "ajustes" | "nova_versao" | "reprovado" | "agendado" | "publicado" | "cancelado";
export type Decision = "approved" | "changes_requested" | "rejected" | "undone";
export type ActorKind = "agency" | "client" | "guest";

export const KIND_LABEL: Record<ItemKind, string> = { post: "Post", carrossel: "Carrossel", video: "Vídeo", stories: "Stories", roteiro: "Roteiro", texto: "Texto", peca: "Peça", outro: "Outro" };
export const STATUS_LABEL: Record<ItemStatus, string> = { rascunho: "Rascunho interno", aguardando: "Aguardando aprovação", em_revisao: "Em revisão", aprovado: "Aprovado", ajustes: "Ajustes solicitados", nova_versao: "Nova versão", reprovado: "Reprovado", agendado: "Agendado", publicado: "Publicado", cancelado: "Cancelado" };
/** Estados em que o cliente ainda precisa decidir. */
export const PENDING: ItemStatus[] = ["aguardando", "em_revisao", "nova_versao"];
export const LIKE_PHRASES = ["Amei!", "Aprovado como está", "Ajustar texto", "Trocar imagem", "Ajustar cores", "Rever CTA", "Mudar a data", "Falta informação"];

export type Asset = { url: string; type: "image" | "video" | "pdf" | "link"; width?: number; height?: number; duration?: number; poster?: string; slide?: number; name?: string };
export type ScriptSection = { nome: string; tempo?: string; texto: string; off?: string; cta?: string };
export type Version = { id: string; itemId: string; number: number; assets: Asset[]; caption: string | null; hashtags: string | null; cta: string | null; script: ScriptSection[]; textBody: string | null; changesNote: string | null; sent: boolean; createdBy: string | null; createdAt: string };
export type Anchor = { type: "point"; slide: number; x: number; y: number } | { type: "time"; t: number } | { type: "text"; field: "caption" | "script" | "text_body"; start: number; end: number; quote: string };
export type Comment = { id: string; itemId: string; versionId: string | null; parentId: string | null; authorId: string | null; authorName: string; authorKind: ActorKind; body: string; mentions: string[]; anchor: Anchor | null; internal: boolean; resolvedAt: string | null; resolvedBy: string | null; editedAt: string | null; deletedAt: string | null; createdAt: string };
export type DecisionRow = { id: string; itemId: string; versionId: string; decision: Decision; decidedBy: string | null; deciderName: string | null; deciderKind: ActorKind; note: string | null; phrases: string[]; via: "like" | "outro_canal"; justification: string | null; undoes: string | null; createdAt: string };
export type Item = {
  id: string; brandId: string; brandSlug: string; brandName: string; roundId: string | null; title: string; kind: ItemKind;
  channelId: string | null; channelName: string | null; presetId: string | null; presetDimension: string | null;
  frontId: string | null; frontName: string | null; workOrderId: string | null; taskId: string | null; conteudoId: string | null; campaignId: string | null; solicitacaoId: string | null;
  publishAt: string | null; dueAt: string | null; status: ItemStatus; currentVersionId: string | null; priority: string; orderIndex: number;
  sentAt: string | null; decidedAt: string | null; publishedLink: string | null; isExample: boolean; createdAt: string;
  /** Capa colorida para materiais sem arte (roteiro, texto). */
  coverTone?: string | null;
};
export type ItemFull = Item & { versions: Version[]; current: Version | null; comments: Comment[]; decisions: DecisionRow[]; views: { userName: string; at: string }[] };
export type Round = { id: string; brandId: string; brandSlug: string; brandName: string; title: string; frontId: string | null; campaignId: string | null; periodStart: string | null; periodEnd: string | null; dueAt: string | null; message: string | null; status: "aberta" | "concluida" | "vencida" | "cancelada"; sentAt: string | null; isExample: boolean; createdAt: string };
export type Approver = { userId: string; name: string; email: string | null; role: "aprovador" | "revisor" | "observador"; orderIndex: number };
export type Settings = { rule: "qualquer" | "todos" | "sequencial"; decisionDays: number; remindBefore: boolean; remindOnDay: boolean; remindLate: boolean; requireCommentOnAdjust: boolean; allowDownload: boolean; watermark: boolean; allowShareLinks: boolean; timezone: string };
export type Activity = { id: string; itemId: string | null; roundId: string | null; actorName: string | null; event: string; payload: Record<string, unknown>; createdAt: string };
export type Actor = { id: string; name: string; kind: ActorKind; isAdmin?: boolean };

export const DEFAULT_SETTINGS: Settings = { rule: "qualquer", decisionDays: 2, remindBefore: true, remindOnDay: true, remindLate: true, requireCommentOnAdjust: true, allowDownload: false, watermark: true, allowShareLinks: false, timezone: "America/Sao_Paulo" };

// ----- Motor em memória -----------------------------------------------------------------

type Store = { rounds: Round[]; items: Item[]; versions: Version[]; comments: Comment[]; decisions: (DecisionRow & { prior: Prior })[]; approvers: Map<string, Approver[]>; settings: Map<string, Settings>; views: { itemId: string; versionId: string; userName: string; at: string }[]; activity: Activity[] };
type Prior = { itemStatus: ItemStatus; taskStatus?: string; taskCompletedAt?: string | null; conteudo?: { status: string; legenda: string | null; cta: string | null; roteiro: string | null } | null; frontUntil?: string | null; requestStatus?: string };
let store: Store | null = null;

const TEAM_ACTOR: Actor = { id: "u-helena", name: "Helena Duarte", kind: "agency", isAdmin: true };
const CLIENT_ACTOR: Actor = { id: "u-carla", name: "Carla Mendes", kind: "client" };
/** Quem está usando o demo: equipe, ou o cliente quando “Ver como cliente” está ativo. */
export function demoActor(): Actor { return isViewingAsClient() ? CLIENT_ACTOR : TEAM_ACTOR; }

/** Arte de exemplo (SVG) no tamanho do formato, para as prévias funcionarem sem arquivos. */
export function demoArt(title: string, w: number, h: number, hue: number, n = 1): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 55% 78%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360} 45% 52%)"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><circle cx="${w * 0.78}" cy="${h * 0.22}" r="${w * 0.16}" fill="rgba(255,255,255,.22)"/><text x="${w * 0.08}" y="${h * 0.8}" font-family="Georgia, serif" font-size="${w * 0.07}" fill="white">${title.replace(/[<&>"]/g, "")}</text><text x="${w * 0.08}" y="${h * 0.88}" font-family="Arial" font-size="${w * 0.035}" fill="rgba(255,255,255,.85)">${n > 1 ? `Página ${n}` : "Prévia"}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function seed(): Store {
  const s: Store = { rounds: [], items: [], versions: [], comments: [], decisions: [], approvers: new Map(), settings: new Map(), views: [], activity: [] };
  const ops = demoOps();
  const d = (n: number, h = 12) => new Date(Date.now() + n * 86400e3 + (h - new Date().getHours()) * 3600e3).toISOString();
  for (const [name, slug, has360] of ROSTER) {
    if (!has360) continue;
    const brandId = `b-${slug}`;
    s.approvers.set(brandId, [
      { userId: "u-carla", name: "Carla Mendes", email: `carla@${slug}.com.br`, role: "aprovador", orderIndex: 0 },
      { userId: "u-paulo", name: "Paulo Nunes", email: `paulo@${slug}.com.br`, role: "revisor", orderIndex: 1 },
    ]);
    s.settings.set(brandId, { ...DEFAULT_SETTINGS });
    const feed = ops.fronts.find((f) => f.brand.slug === slug && f.front.name === "Feed");
    const p = feed ? frontPeriod(feed.front) : { start: toISO(today()), end: toISO(addDays(today(), 6)) };
    const round: Round = { id: `rd-${slug}`, brandId, brandSlug: slug, brandName: name, title: `Feed · ${p.start.slice(8, 10)}/${p.start.slice(5, 7)} a ${p.end.slice(8, 10)}/${p.end.slice(5, 7)}`, frontId: feed?.front.id ?? null, campaignId: slug === "fina-fragrancia" ? "cp1" : null, periodStart: p.start, periodEnd: p.end, dueAt: d(2, 18), message: "Oi! Seguem os materiais da próxima semana. Qualquer ajuste, é só marcar no próprio material.", status: "aberta", sentAt: d(-1, 10), isExample: false, createdAt: d(-2) };
    s.rounds.push(round);
    const mk = (title: string, kind: ItemKind, status: ItemStatus, publishIn: number, hue: number, extra: Partial<Item> = {}, dims: [number, number] = [1080, 1350], slides = 1, caption: string | null = null, versions = 1) => {
      const id = uid("li");
      // Tarefa do Workspace vinculada, na etapa coerente com o estado do material.
      const task = { id: `t-${id}`, title: `${title}`, brand: { id: brandId, name, slug }, frontId: feed?.front.id ?? null, frontName: "Feed", workOrderId: feed ? `wo-${feed.front.id}` : null, status: (status === "rascunho" ? "Avaliação interna" : status === "ajustes" ? "Ajuste" : "Avaliação externa") as never, owner: "Marina Lopes", due: toISO(addDays(today(), 1)), sector: "Criação / Entrega", note: null, requiresReview: true, since: d(-1), remindedAt: null, likeMaterial: kind };
      ops.tasks.push(task);
      const item: Item = { id, brandId, brandSlug: slug, brandName: name, roundId: round.id, title, kind, channelId: "ch1", channelName: kind === "video" ? "TikTok" : "Instagram", presetId: kind === "stories" || kind === "video" ? "pr2" : "pr1", presetDimension: `${dims[0]}×${dims[1]}`, frontId: feed?.front.id ?? null, frontName: "Feed", workOrderId: task.workOrderId, taskId: task.id, conteudoId: null, campaignId: round.campaignId, solicitacaoId: null, publishAt: d(publishIn, 11), dueAt: round.dueAt, status, currentVersionId: null, priority: "media", orderIndex: s.items.length, sentAt: status === "rascunho" ? null : round.sentAt, decidedAt: null, publishedLink: null, isExample: false, createdAt: d(-2), ...extra };
      for (let n = 1; n <= versions; n++) {
        const v: Version = { id: uid("lv"), itemId: id, number: n, assets: Array.from({ length: slides }, (_, i) => ({ url: demoArt(title, dims[0], dims[1], hue + n * 12, i + 1), type: "image" as const, width: dims[0], height: dims[1], slide: i, name: `${title}-${i + 1}.png` })), caption, hashtags: "#finafragrancia #perfumaria", cta: "Conheça no link da bio", script: kind === "video" ? [{ nome: "Abertura", tempo: "0–3s", texto: "Mãos pesando as essências." }, { nome: "Meio", tempo: "3–12s", texto: "O frasco sendo preenchido.", off: "Cada lote é único." }, { nome: "Final", tempo: "12–15s", texto: "Logo e chamada.", cta: "Garanta o seu" }] : [], textBody: null, changesNote: n > 1 ? "Troquei a foto da capa e encurtei a legenda." : null, sent: status !== "rascunho", createdBy: "u-marina", createdAt: d(-3 + n) };
        s.versions.push(v);
        item.currentVersionId = v.id;
      }
      s.items.push(item);
      return item;
    };
    const a = mk("Carrossel “Notas de outono”", "carrossel", "aguardando", 5, 20, { conteudoId: slug === "fina-fragrancia" ? "k1" : null }, [1080, 1350], 4, "O outono chegou ao ateliê. Três fragrâncias, uma estação. 🍂\n\nQual delas combina com você?");
    const b = mk("Reels de bastidores", "video", "em_revisao", 7, 280, {}, [1080, 1920], 1, "Um dia no ateliê em 15 segundos.");
    mk("Stories: contagem regressiva", "stories", "nova_versao", 3, 330, {}, [1080, 1920], 3, null, 2);
    mk("Post: guia de presentes", "post", "rascunho", 9, 200, {}, [1080, 1350], 1, "Um perfume para cada pessoa especial.");
    const cv = s.versions.find((v) => v.id === a.currentVersionId)!;
    s.comments.push(
      { id: uid("lc"), itemId: b.id, versionId: b.currentVersionId, parentId: null, authorId: "u-carla", authorName: "Carla Mendes", authorKind: "client", body: "Aqui dá para mostrar mais o rótulo?", mentions: [], anchor: { type: "time", t: 6 }, internal: false, resolvedAt: null, resolvedBy: null, editedAt: null, deletedAt: null, createdAt: d(-1, 15) },
      { id: uid("lc"), itemId: b.id, versionId: b.currentVersionId, parentId: null, authorId: "u-marina", authorName: "Marina Lopes", authorKind: "agency", body: "Tem um take mais fechado, vou trocar se ela confirmar.", mentions: [], anchor: null, internal: true, resolvedAt: null, resolvedBy: null, editedAt: null, deletedAt: null, createdAt: d(-1, 16) },
    );
    s.views.push({ itemId: a.id, versionId: cv.id, userName: "Paulo Nunes", at: d(-1, 17) });
    for (const it of s.items.filter((x) => x.brandId === brandId)) s.activity.push({ id: uid("la"), itemId: it.id, roundId: round.id, actorName: "Helena Duarte", event: it.status === "rascunho" ? "criado" : "enviado", payload: {}, createdAt: it.sentAt ?? it.createdAt });
  }
  return s;
}
const S = () => (store ??= seed());
const libConteudos = (slug: string) => demoLibraryStore(slug)?.conteudos ?? [];

// Integrações no exemplo: as mesmas que o banco faz nas funções like_*.
function demoPrior(i: Item): Prior {
  const t = i.taskId ? demoOps().tasks.find((x) => x.id === i.taskId) : undefined;
  const c = i.conteudoId ? libConteudos(i.brandSlug).find((x) => x.id === i.conteudoId) : undefined;
  const f = i.frontId ? demoOps().fronts.find((x) => x.front.id === i.frontId) : undefined;
  const r = i.solicitacaoId ? demoSpaceStore(i.brandSlug).requests.find((x) => x.id === i.solicitacaoId) : undefined;
  return { itemStatus: i.status, taskStatus: t?.status, taskCompletedAt: t?.completedAt ?? null, conteudo: c ? { status: c.status, legenda: c.legenda, cta: c.cta, roteiro: c.roteiro } : null, frontUntil: f?.front.approved_until ?? null, requestStatus: r?.status };
}
function setTask(i: Item, status: string, completed?: boolean) {
  const t = i.taskId ? demoOps().tasks.find((x) => x.id === i.taskId) : undefined;
  if (t) { t.status = status as never; t.since = nowISO(); if (completed) t.completedAt = t.completedAt ?? toISO(today()); }
}
function refreshFront(frontId: string) {
  const f = demoOps().fronts.find((x) => x.front.id === frontId);
  if (f) Object.assign(f, frontRisk(f.front), { period: frontPeriod(f.front) });
}
/** Cobertura da frente antes de o Like mexer nela (base para recalcular ao reagendar). */
const frontBase = new Map<string, string | null>();
function captureBase(frontId: string) {
  if (frontBase.has(frontId)) return;
  const f = demoOps().fronts.find((x) => x.front.id === frontId);
  if (f) frontBase.set(frontId, f.front.approved_until ?? null);
}
function applyApproval(i: Item, v: Version) {
  i.status = "aprovado"; i.decidedAt = nowISO();
  if (i.frontId) captureBase(i.frontId);
  setTask(i, "Concluído", true);
  if (i.conteudoId) {
    const c = libConteudos(i.brandSlug).find((x) => x.id === i.conteudoId);
    if (c) { c.status = "aprovada"; c.legenda = v.caption ?? c.legenda; c.cta = v.cta ?? c.cta; if (v.script.length) c.roteiro = v.script.map((x) => `## ${x.nome}\n${x.texto}`).join("\n\n"); }
  }
  if (i.frontId && i.publishAt) {
    const f = demoOps().fronts.find((x) => x.front.id === i.frontId);
    const day = i.publishAt.slice(0, 10);
    if (f && (!f.front.approved_until || f.front.approved_until < day)) { f.front.approved_until = day; refreshFront(i.frontId); }
  }
  if (i.publishAt) demoUpsertEvent(i.brandSlug, { id: `ev-${i.id}`, likeItemId: i.id, kind: "publicacao", title: i.title, date: i.publishAt.slice(0, 10), start: i.publishAt.slice(11, 16), status: "agendado", auto: true });
  if (i.solicitacaoId) {
    const sp = demoSpaceStore(i.brandSlug);
    if (!sp.deliveries.some((x) => x.task_id === i.solicitacaoId)) sp.deliveries.unshift({ id: `dl-${i.id}`, title: i.title, status: "entregue", delivered_at: toISO(today()), task_id: i.solicitacaoId, campaign_id: i.campaignId, delivery_type: KIND_LABEL[i.kind], file_url: null, like: true });
  }
}
function recomputeFront(frontId: string, base: string | null) {
  const f = demoOps().fronts.find((x) => x.front.id === frontId);
  if (!f) return;
  const approved = S().items.filter((x) => x.frontId === frontId && ["aprovado", "agendado", "publicado"].includes(x.status) && x.publishAt).map((x) => x.publishAt!.slice(0, 10));
  f.front.approved_until = [base, ...approved].filter(Boolean).sort().pop() ?? null;
  refreshFront(frontId);
}
function log(i: Item | null, roundId: string | null, event: string, actor: Actor, payload: Record<string, unknown> = {}) {
  S().activity.push({ id: uid("la"), itemId: i?.id ?? null, roundId: roundId ?? i?.roundId ?? null, actorName: actor.name, event, payload, createdAt: nowISO() });
}
function updateRound(roundId: string | null) {
  if (!roundId) return;
  const r = S().rounds.find((x) => x.id === roundId);
  if (!r || r.status === "cancelada") return;
  const items = S().items.filter((x) => x.roundId === roundId && x.status !== "cancelado");
  r.status = items.every((x) => !["rascunho", ...PENDING, "ajustes"].includes(x.status)) ? "concluida" : r.dueAt && r.dueAt < nowISO() ? "vencida" : "aberta";
}

// ----- Leitura ---------------------------------------------------------------------------

const fullOf = (i: Item, actor: Actor): ItemFull => {
  const s = S();
  const versions = s.versions.filter((v) => v.itemId === i.id && (actor.kind === "agency" || v.sent)).sort((a, b) => a.number - b.number);
  return {
    ...clone(i), versions: clone(versions), current: clone(versions.find((v) => v.id === i.currentVersionId) ?? versions[versions.length - 1] ?? null),
    comments: clone(s.comments.filter((c) => c.itemId === i.id && !c.deletedAt && (actor.kind === "agency" || !c.internal))),
    decisions: s.decisions.filter((d) => d.itemId === i.id).map(({ prior: _p, ...d }) => clone(d)),
    views: s.views.filter((v) => v.itemId === i.id).map((v) => ({ userName: v.userName, at: v.at })),
  };
};
/** O cliente nunca vê rascunho interno. */
const visibleTo = (actor: Actor) => (i: Item) => actor.kind === "agency" || i.status !== "rascunho";

export type ItemFilter = { brandSlug?: string; roundId?: string; status?: ItemStatus[]; pendingOnly?: boolean; includeExamples?: boolean };

export async function listRounds(brandSlug?: string): Promise<(Round & { counts: Record<string, number>; total: number })[]> {
  if (isDemoMode()) {
    const actor = demoActor();
    return S().rounds.filter((r) => (!brandSlug || r.brandSlug === brandSlug) && (actor.kind === "agency" || r.sentAt)).map((r) => {
      const items = S().items.filter((i) => i.roundId === r.id && visibleTo(actor)(i));
      const counts: Record<string, number> = {};
      for (const i of items) counts[i.status] = (counts[i.status] ?? 0) + 1;
      return { ...clone(r), counts, total: items.length };
    });
  }
  let q = db.from("like_rounds").select("*, brands!inner(name, slug), like_items(status)").order("created_at", { ascending: false });
  if (brandSlug) q = q.eq("brands.slug", brandSlug);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => {
    const counts: Record<string, number> = {};
    for (const i of r.like_items ?? []) counts[i.status] = (counts[i.status] ?? 0) + 1;
    return { ...mapRound(r), counts, total: (r.like_items ?? []).length };
  });
}

export async function getRound(id: string) { return (await listRounds()).find((r) => r.id === id) ?? null; }

export async function listItems(filter: ItemFilter = {}): Promise<ItemFull[]> {
  if (isDemoMode()) {
    const actor = demoActor();
    return S().items.filter((i) => visibleTo(actor)(i) && (filter.includeExamples || !i.isExample) && (!filter.brandSlug || i.brandSlug === filter.brandSlug) && (!filter.roundId || i.roundId === filter.roundId)
      && (!filter.status || filter.status.includes(i.status)) && (!filter.pendingOnly || PENDING.includes(i.status))).sort((a, b) => a.orderIndex - b.orderIndex).map((i) => fullOf(i, actor));
  }
  let q = db.from("like_items").select("*, brands!inner(name, slug), like_versions(*), like_comments(*), like_decisions(*), brand_identity_channels(name), brand_identity_presets(dimension), workspace_fronts(name)").order("order_index");
  if (filter.brandSlug) q = q.eq("brands.slug", filter.brandSlug);
  if (filter.roundId) q = q.eq("round_id", filter.roundId);
  if (filter.status) q = q.in("status", filter.status);
  if (filter.pendingOnly) q = q.in("status", PENDING);
  if (!filter.includeExamples) q = q.eq("is_example", false);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as any[]).map(mapItemFull);
}

export async function getItem(id: string): Promise<ItemFull | null> {
  if (isDemoMode()) { const i = S().items.find((x) => x.id === id); return i && visibleTo(demoActor())(i) ? fullOf(i, demoActor()) : null; }
  const { data } = await db.from("like_items").select("*, brands!inner(name, slug), like_versions(*), like_comments(*), like_decisions(*), brand_identity_channels(name), brand_identity_presets(dimension), workspace_fronts(name)").eq("id", id).maybeSingle();
  return data ? mapItemFull(data) : null;
}

// ----- Escrita: agência --------------------------------------------------------------------

export async function createRound(input: { brandId: string; brandSlug: string; brandName: string; title: string; frontId?: string | null; campaignId?: string | null; periodStart?: string | null; periodEnd?: string | null; dueAt?: string | null; message?: string | null; isExample?: boolean }): Promise<Round> {
  if (isDemoMode()) {
    const r: Round = { id: uid("rd"), brandId: input.brandId, brandSlug: input.brandSlug, brandName: input.brandName, title: input.title, frontId: input.frontId ?? null, campaignId: input.campaignId ?? null, periodStart: input.periodStart ?? null, periodEnd: input.periodEnd ?? null, dueAt: input.dueAt ?? null, message: input.message ?? null, status: "aberta", sentAt: null, isExample: !!input.isExample, createdAt: nowISO() };
    S().rounds.push(r);
    return clone(r);
  }
  const { data, error } = await db.from("like_rounds").insert({ brand_id: input.brandId, title: input.title, front_id: input.frontId ?? null, campaign_id: input.campaignId ?? null, period_start: input.periodStart ?? null, period_end: input.periodEnd ?? null, due_at: input.dueAt ?? null, message: input.message ?? null, is_example: !!input.isExample }).select("*, brands(name, slug)").single();
  if (error) throw error;
  return mapRound(data);
}

export type NewItem = Pick<Item, "brandId" | "brandSlug" | "brandName" | "title" | "kind"> & Partial<Pick<Item, "coverTone" | "roundId" | "channelId" | "channelName" | "presetId" | "presetDimension" | "frontId" | "frontName" | "workOrderId" | "taskId" | "conteudoId" | "campaignId" | "solicitacaoId" | "publishAt" | "dueAt" | "priority" | "isExample">>;
export type NewVersion = { assets: Asset[]; caption?: string | null; hashtags?: string | null; cta?: string | null; script?: ScriptSection[]; textBody?: string | null; changesNote?: string | null };

export async function createItem(input: NewItem, version: NewVersion): Promise<ItemFull> {
  if (isDemoMode()) {
    const s = S();
    const it: Item = { roundId: null, channelId: null, channelName: null, presetId: null, presetDimension: null, frontId: null, frontName: null, workOrderId: null, taskId: null, conteudoId: null, campaignId: null, solicitacaoId: null, publishAt: null, dueAt: null, priority: "media", isExample: false, ...input, id: uid("li"), status: "rascunho", currentVersionId: null, orderIndex: s.items.length, sentAt: null, decidedAt: null, publishedLink: null, createdAt: nowISO() };
    s.items.push(it);
    await addVersion(it.id, version);
    log(it, it.roundId, "criado", demoActor());
    return fullOf(it, TEAM_ACTOR);
  }
  const { data, error } = await db.from("like_items").insert({ brand_id: input.brandId, round_id: input.roundId ?? null, title: input.title, kind: input.kind, channel_id: input.channelId ?? null, preset_id: input.presetId ?? null, front_id: input.frontId ?? null, work_order_id: input.workOrderId ?? null, task_id: input.taskId ?? null, conteudo_id: input.conteudoId ?? null, campaign_id: input.campaignId ?? null, solicitacao_id: input.solicitacaoId ?? null, publish_at: input.publishAt ?? null, due_at: input.dueAt ?? null, priority: input.priority ?? "media", cover_tone: input.coverTone ?? null, is_example: !!input.isExample }).select("id").single();
  if (error) throw error;
  await addVersion(data.id, version);
  return (await getItem(data.id))!;
}

/** Nova versão: a anterior enviada fica congelada; o material volta a aguardar quando for enviado. */
export async function addVersion(itemId: string, v: NewVersion): Promise<Version> {
  if (isDemoMode()) {
    const s = S();
    const it = s.items.find((x) => x.id === itemId)!;
    const n = Math.max(0, ...s.versions.filter((x) => x.itemId === itemId).map((x) => x.number)) + 1;
    const ver: Version = { id: uid("lv"), itemId, number: n, assets: v.assets, caption: v.caption ?? null, hashtags: v.hashtags ?? null, cta: v.cta ?? null, script: v.script ?? [], textBody: v.textBody ?? null, changesNote: v.changesNote ?? null, sent: false, createdBy: demoActor().id, createdAt: nowISO() };
    s.versions.push(ver);
    it.currentVersionId = ver.id;
    if (n > 1 && ["ajustes", "reprovado"].includes(it.status)) it.status = "nova_versao";
    if (n > 1) log(it, it.roundId, "nova_versao", demoActor(), { number: n });
    return clone(ver);
  }
  const { data: last } = await db.from("like_versions").select("number, brand_id").eq("item_id", itemId).order("number", { ascending: false }).limit(1).maybeSingle();
  const { data: item } = await db.from("like_items").select("brand_id, status").eq("id", itemId).single();
  const { data, error } = await db.from("like_versions").insert({ item_id: itemId, brand_id: item.brand_id, number: (last?.number ?? 0) + 1, assets: v.assets, caption: v.caption ?? null, hashtags: v.hashtags ?? null, cta: v.cta ?? null, script: v.script ?? [], text_body: v.textBody ?? null, changes_note: v.changesNote ?? null }).select().single();
  if (error) throw error;
  await db.from("like_items").update({ current_version_id: data.id, ...(["ajustes", "reprovado"].includes(item.status) ? { status: "nova_versao" } : {}) }).eq("id", itemId);
  return mapVersion(data);
}

/** Envio: rascunho → aguardando; tarefa em Avaliação externa; solicitação aguardando o cliente. */
export async function sendItems(itemIds: string[], roundId?: string | null): Promise<number> {
  if (isDemoMode()) {
    let n = 0;
    for (const id of itemIds) {
      const it = S().items.find((x) => x.id === id);
      if (!it || !["rascunho", "ajustes", "nova_versao"].includes(it.status)) continue;
      const v = S().versions.find((x) => x.id === it.currentVersionId);
      if (!v) throw new Error(`O material "${it.title}" não tem versão para enviar.`);
      v.sent = true;
      const wasDraft = it.status === "rascunho";
      it.status = "aguardando"; it.sentAt = it.sentAt ?? nowISO();
      setTask(it, "Avaliação externa");
      if (it.solicitacaoId) { const r = demoSpaceStore(it.brandSlug).requests.find((x) => x.id === it.solicitacaoId); if (r) r.status = "aguardando_cliente"; }
      log(it, it.roundId, wasDraft ? "enviado" : "nova_versao", demoActor());
      n++;
    }
    if (roundId) { const r = S().rounds.find((x) => x.id === roundId); if (r) { r.sentAt = r.sentAt ?? nowISO(); updateRound(roundId); } }
    return n;
  }
  const { data, error } = await db.rpc("like_send_items", { p_items: itemIds });
  if (error) throw error;
  if (roundId) await db.from("like_rounds").update({ sent_at: nowISO() }).eq("id", roundId).is("sent_at", null);
  return data as number;
}

export async function cancelItem(itemId: string) {
  if (isDemoMode()) { const it = S().items.find((x) => x.id === itemId); if (it) { it.status = "cancelado"; log(it, it.roundId, "cancelado", demoActor()); updateRound(it.roundId); } return; }
  const { error } = await db.from("like_items").update({ status: "cancelado" }).eq("id", itemId);
  if (error) throw error;
}

export async function schedule(itemId: string, publishAt: string) {
  if (isDemoMode()) {
    const it = S().items.find((x) => x.id === itemId);
    if (!it) return;
    it.publishAt = publishAt;
    if (it.status === "aprovado") it.status = "agendado";
    if (["aprovado", "agendado"].includes(it.status)) demoUpsertEvent(it.brandSlug, { id: `ev-${it.id}`, likeItemId: it.id, kind: "publicacao", title: it.title, date: publishAt.slice(0, 10), start: publishAt.slice(11, 16), status: "agendado", auto: true });
    log(it, it.roundId, "agendado", demoActor(), { publishAt });
    return;
  }
  const { error } = await db.from("like_items").update({ publish_at: publishAt, status: "agendado" }).eq("id", itemId).in("status", ["aprovado", "agendado"]);
  if (error) throw error;
}

/**
 * Muda só a data de publicação (arrastar na grade ou no calendário), sem mudar o
 * estado. Se o material já estava aprovado, atualiza a agenda e a cobertura da
 * frente e avisa o cliente.
 */
export async function movePublish(itemId: string, publishAt: string): Promise<{ notifyClient: boolean }> {
  if (isDemoMode()) {
    const it = S().items.find((x) => x.id === itemId);
    if (!it) throw new Error("Material não encontrado.");
    if (["publicado", "cancelado"].includes(it.status)) throw new Error("Material publicado ou cancelado não muda de data.");
    const approved = ["aprovado", "agendado"].includes(it.status);
    it.publishAt = publishAt;
    if (approved) {
      demoUpsertEvent(it.brandSlug, { id: `ev-${it.id}`, likeItemId: it.id, kind: "publicacao", title: it.title, date: publishAt.slice(0, 10), start: publishAt.slice(11, 16), status: "agendado", auto: true });
      if (it.frontId) { captureBase(it.frontId); recomputeFront(it.frontId, frontBase.get(it.frontId) ?? null); }
    }
    log(it, it.roundId, "reagendado", demoActor(), { publishAt, notifyClient: approved });
    return { notifyClient: approved };
  }
  const { data: it, error: e1 } = await db.from("like_items").select("status").eq("id", itemId).single();
  if (e1) throw e1;
  const { error } = await db.from("like_items").update({ publish_at: publishAt }).eq("id", itemId);
  if (error) throw error;
  return { notifyClient: ["aprovado", "agendado"].includes(it.status) };
}

export async function markPublished(itemId: string, link: string) {
  if (isDemoMode()) {
    const it = S().items.find((x) => x.id === itemId);
    if (!it) return;
    if (!["aprovado", "agendado", "publicado"].includes(it.status)) throw new Error("Só materiais aprovados podem ser publicados.");
    it.status = "publicado"; it.publishedLink = link;
    if (it.conteudoId) { const c = libConteudos(it.brandSlug).find((x) => x.id === it.conteudoId); if (c) { c.status = "publicada"; c.published_link = link; } }
    for (const ev of demoEventsFor(it.brandSlug, it.id)) demoUpsertEvent(it.brandSlug, { ...(ev as import("@/lib/space-data").AgendaItem), likeItemId: it.id, status: "concluido" });
    log(it, it.roundId, "publicado", demoActor(), { link });
    return;
  }
  const { error } = await db.rpc("like_mark_published", { p_item: itemId, p_link: link });
  if (error) throw error;
}

// ----- Comentários ------------------------------------------------------------------------

export async function listComments(itemId: string): Promise<Comment[]> { return (await getItem(itemId))?.comments ?? []; }

export async function addComment(itemId: string, input: { body: string; anchor?: Anchor | null; internal?: boolean; parentId?: string | null; versionId?: string | null }, actor: Actor = demoActor()): Promise<Comment> {
  if (!input.body.trim()) throw new Error("Escreva o comentário.");
  if (isDemoMode()) {
    const it = S().items.find((x) => x.id === itemId)!;
    if (actor.kind !== "agency" && input.internal) throw new Error("Comentários internos são só da equipe.");
    const c: Comment = { id: uid("lc"), itemId, versionId: input.versionId ?? it.currentVersionId, parentId: input.parentId ?? null, authorId: actor.id, authorName: actor.name, authorKind: actor.kind, body: input.body.trim(), mentions: [], anchor: input.anchor ?? null, internal: !!input.internal, resolvedAt: null, resolvedBy: null, editedAt: null, deletedAt: null, createdAt: nowISO() };
    S().comments.push(c);
    if (actor.kind !== "agency" && !c.internal && ["aguardando", "nova_versao"].includes(it.status)) it.status = "em_revisao";
    log(it, it.roundId, "comentado", actor, { internal: c.internal });
    return clone(c);
  }
  const { data: it } = await db.from("like_items").select("brand_id, current_version_id").eq("id", itemId).single();
  const { data: sess } = await supabase.auth.getSession();
  const { data, error } = await db.from("like_comments").insert({ item_id: itemId, brand_id: it.brand_id, version_id: input.versionId ?? it.current_version_id, parent_id: input.parentId ?? null, body: input.body.trim(), anchor: input.anchor ?? null, internal: !!input.internal, author_kind: actor.kind, author_name: actor.name, author_id: sess.session?.user.id }).select().single();
  if (error) throw error;
  return mapComment(data);
}

export async function resolveComment(commentId: string, resolved = true, actor: Actor = demoActor()) {
  if (isDemoMode()) { const c = S().comments.find((x) => x.id === commentId); if (c) { c.resolvedAt = resolved ? nowISO() : null; c.resolvedBy = resolved ? actor.id : null; } return; }
  const { data: sess } = await supabase.auth.getSession();
  const { error } = await db.from("like_comments").update({ resolved_at: resolved ? nowISO() : null, resolved_by: resolved ? sess.session?.user.id : null }).eq("id", commentId);
  if (error) throw error;
}

/** Editar o próprio comentário (só o autor). */
export async function editComment(commentId: string, body: string, actor: Actor = demoActor()) {
  if (!body.trim()) throw new Error("Escreva o comentário.");
  if (isDemoMode()) {
    const c = S().comments.find((x) => x.id === commentId);
    if (!c || c.authorId !== actor.id) throw new Error("Só quem escreveu pode editar.");
    c.body = body.trim(); c.editedAt = nowISO();
    return;
  }
  const { error } = await db.from("like_comments").update({ body: body.trim(), edited_at: nowISO() }).eq("id", commentId);
  if (error) throw error;
}

// ----- Decisão ------------------------------------------------------------------------------

export class LikeRuleError extends Error {}

/**
 * Decide sobre a versão atual. Regras: só o cliente aprovador decide (a equipe só
 * por “outro canal”, admin, com justificativa); pedir ajuste exige motivo quando
 * configurado; aprovar de novo a mesma versão não duplica nada.
 */
export async function decide(itemId: string, versionId: string, decision: Exclude<Decision, "undone">, opts: { note?: string; phrases?: string[]; via?: "like" | "outro_canal"; justification?: string; actor?: Actor } = {}): Promise<{ status: ItemStatus; decisionId: string | null }> {
  const via = opts.via ?? "like";
  if (isDemoMode()) {
    const s = S();
    const actor = opts.actor ?? demoActor();
    const it = s.items.find((x) => x.id === itemId);
    if (!it) throw new LikeRuleError("Material não encontrado.");
    if (it.currentVersionId !== versionId) throw new LikeRuleError("Existe uma versão mais nova deste material.");
    if (via === "outro_canal") {
      if (actor.kind !== "agency" || !actor.isAdmin) throw new LikeRuleError("Só um administrador da agência registra aprovação por outro canal.");
      if ((opts.justification ?? "").trim().length < 10) throw new LikeRuleError("Explique como o cliente aprovou (mínimo de 10 caracteres).");
    } else if (actor.kind === "agency") throw new LikeRuleError("A decisão é do cliente, no Like.");
    else if (!(s.approvers.get(it.brandId) ?? []).some((a) => a.userId === actor.id && a.role === "aprovador")) throw new LikeRuleError("Você não está entre os aprovadores deste cliente.");
    if (!PENDING.includes(it.status)) {
      if (["aprovado", "agendado"].includes(it.status) && decision === "approved") return { status: it.status, decisionId: null };
      throw new LikeRuleError("Este material não está aguardando decisão.");
    }
    const settings = s.settings.get(it.brandId) ?? DEFAULT_SETTINGS;
    const openComments = s.comments.some((c) => c.itemId === itemId && c.versionId === versionId && !c.internal && !c.resolvedAt && c.authorKind !== "agency");
    if (decision === "changes_requested" && settings.requireCommentOnAdjust && !(opts.note ?? "").trim() && !(opts.phrases ?? []).length && !openComments)
      throw new LikeRuleError("Diga o que ajustar: comente no material ou escolha uma frase.");
    const prior = demoPrior(it);
    const row = { id: uid("ld"), itemId, versionId, decision, decidedBy: actor.id, deciderName: actor.name, deciderKind: actor.kind, note: opts.note?.trim() || null, phrases: opts.phrases ?? [], via, justification: opts.justification?.trim() || null, undoes: null, createdAt: nowISO(), prior };
    s.decisions.push(row);
    log(it, it.roundId, "decidido", actor, { decision, decisionId: row.id });
    const v = s.versions.find((x) => x.id === versionId)!;
    // Espelho no histórico de indicadores do 360.
    likeDecisionsDemo(it.brandSlug).push({ id: row.id, material: it.title, front: it.frontName ?? KIND_LABEL[it.kind], decision: decision === "approved" ? "aprovado" : "ajustes", sentAt: it.sentAt ?? it.createdAt, decidedAt: row.createdAt, round: v.number });
    if (decision === "approved") {
      const approvers = (s.approvers.get(it.brandId) ?? []).filter((a) => a.role === "aprovador");
      const done = new Set(s.decisions.filter((d) => d.itemId === itemId && d.versionId === versionId && d.decision === "approved" && !s.decisions.some((u) => u.undoes === d.id)).map((d) => d.decidedBy));
      const ok = settings.rule === "qualquer" || via === "outro_canal" || approvers.every((a) => done.has(a.userId));
      if (ok) applyApproval(it, v); else it.status = "em_revisao";
    } else if (decision === "changes_requested") {
      it.status = "ajustes"; it.decidedAt = nowISO();
      setTask(it, "Ajuste");
      const t = it.taskId ? demoOps().tasks.find((x) => x.id === it.taskId) : undefined;
      const pending = s.comments.filter((c) => c.itemId === itemId && c.versionId === versionId && !c.internal && !c.resolvedAt).map((c) => `• ${c.body}`);
      if (t) t.note = [t.note, `Ajustes pedidos no Like: ${[...(opts.phrases ?? []), opts.note].filter(Boolean).join(" · ")}`, ...pending].filter(Boolean).join("\n");
      if (it.solicitacaoId) { const r = demoSpaceStore(it.brandSlug).requests.find((x) => x.id === it.solicitacaoId); if (r) r.status = "em_execucao"; }
    } else {
      it.status = "reprovado"; it.decidedAt = nowISO();
      setTask(it, "Ajuste");
      if (it.conteudoId) { const c = libConteudos(it.brandSlug).find((x) => x.id === it.conteudoId); if (c) c.status = "rascunho"; }
    }
    updateRound(it.roundId);
    return { status: it.status, decisionId: row.id };
  }
  const { data, error } = await db.rpc("like_decide", { p_item: itemId, p_version: versionId, p_decision: decision, p_note: opts.note ?? null, p_phrases: opts.phrases ?? [], p_via: via, p_justification: opts.justification ?? null });
  if (error) throw new LikeRuleError(error.message);
  const { data: last } = await db.from("like_decisions").select("id").eq("item_id", itemId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return { status: data as ItemStatus, decisionId: last?.id ?? null };
}

export const UNDO_MS = 5 * 60 * 1000;

/** Desfazer (até 5 min, só quem decidiu): restaura tarefa, conteúdo, frente, agenda e solicitação. */
export async function undoDecision(decisionId: string, actor: Actor = demoActor()): Promise<ItemStatus> {
  if (isDemoMode()) {
    const s = S();
    const d = s.decisions.find((x) => x.id === decisionId);
    if (!d || d.decision === "undone") throw new LikeRuleError("Decisão não encontrada.");
    if (d.decidedBy !== actor.id) throw new LikeRuleError("Só quem decidiu pode desfazer.");
    if (Date.now() - new Date(d.createdAt).getTime() > UNDO_MS) throw new LikeRuleError("O prazo para desfazer (5 minutos) terminou.");
    if (s.decisions.some((x) => x.undoes === d.id)) throw new LikeRuleError("Esta decisão já foi desfeita.");
    const it = s.items.find((x) => x.id === d.itemId)!;
    const p = d.prior;
    s.decisions.push({ ...d, id: uid("ld"), decision: "undone", undoes: d.id, note: "Decisão desfeita", createdAt: nowISO(), prior: p });
    it.status = p.itemStatus; it.decidedAt = null;
    const t = it.taskId ? demoOps().tasks.find((x) => x.id === it.taskId) : undefined;
    if (t && p.taskStatus) { t.status = p.taskStatus as never; t.completedAt = p.taskCompletedAt ?? null; }
    if (it.conteudoId && p.conteudo) { const c = libConteudos(it.brandSlug).find((x) => x.id === it.conteudoId); if (c) Object.assign(c, p.conteudo); }
    if (it.solicitacaoId && p.requestStatus) { const r = demoSpaceStore(it.brandSlug).requests.find((x) => x.id === it.solicitacaoId); if (r) r.status = p.requestStatus; }
    if (d.decision === "approved") {
      demoRemoveEvent(it.brandSlug, it.id);
      if (it.frontId) recomputeFront(it.frontId, p.frontUntil ?? null);
      if (it.solicitacaoId) { const sp = demoSpaceStore(it.brandSlug); sp.deliveries = sp.deliveries.filter((x) => x.id !== `dl-${it.id}`); }
    }
    const hist = likeDecisionsDemo(it.brandSlug);
    const hi = hist.findIndex((x) => x.id === d.id);
    if (hi >= 0) hist.splice(hi, 1);
    log(it, it.roundId, "desfeito", actor, { decisionId: d.id });
    updateRound(it.roundId);
    return it.status;
  }
  const { data, error } = await db.rpc("like_undo", { p_decision: decisionId });
  if (error) throw new LikeRuleError(error.message);
  return data as ItemStatus;
}

// ----- Visualizações, aprovadores, configurações, linha do tempo -------------------------------

export async function markViewed(itemId: string, versionId: string, actor: Actor = demoActor()) {
  if (isDemoMode()) {
    const s = S();
    const v = s.views.find((x) => x.itemId === itemId && x.versionId === versionId && x.userName === actor.name);
    if (v) v.at = nowISO(); else { s.views.push({ itemId, versionId, userName: actor.name, at: nowISO() }); if (actor.kind !== "agency") log(s.items.find((x) => x.id === itemId) ?? null, null, "visto", actor); }
    return;
  }
  const { data: it } = await db.from("like_items").select("brand_id").eq("id", itemId).single();
  await db.from("like_views").upsert({ item_id: itemId, version_id: versionId, brand_id: it.brand_id, last_seen_at: nowISO() }, { onConflict: "item_id,version_id,user_id" });
}

/** Lembrete aos aprovadores (fica no histórico; o envio real sai pelas notificações). */
export async function remindApprovers(itemIds: string[], actor: Actor = demoActor()): Promise<number> {
  if (isDemoMode()) {
    let n = 0;
    for (const id of itemIds) { const it = S().items.find((x) => x.id === id); if (it && PENDING.includes(it.status)) { log(it, it.roundId, "lembrete", actor); n++; } }
    return n;
  }
  const { data } = await db.from("like_items").select("id, brand_id, round_id").in("id", itemIds).in("status", PENDING);
  const rows = ((data ?? []) as any[]).map((r) => ({ item_id: r.id, brand_id: r.brand_id, round_id: r.round_id, actor_name: actor.name, event: "lembrete", payload: {} }));
  if (rows.length) await db.from("like_activity").insert(rows);
  return rows.length;
}

export async function listApprovers(brandId: string): Promise<Approver[]> {
  if (isDemoMode()) return clone(S().approvers.get(brandId) ?? []);
  const { data } = await db.from("like_approvers").select("*, profiles(display_name, email)").eq("brand_id", brandId).order("order_index");
  return ((data ?? []) as any[]).map((a) => ({ userId: a.user_id, name: a.profiles?.display_name ?? a.profiles?.email ?? "Pessoa", email: a.profiles?.email ?? null, role: a.role, orderIndex: a.order_index }));
}

export async function saveApprovers(brandId: string, list: Approver[]) {
  if (isDemoMode()) { S().approvers.set(brandId, clone(list)); return; }
  await db.from("like_approvers").delete().eq("brand_id", brandId);
  if (list.length) { const { error } = await db.from("like_approvers").insert(list.map((a, i) => ({ brand_id: brandId, user_id: a.userId, role: a.role, order_index: i }))); if (error) throw error; }
}

export async function getSettings(brandId: string): Promise<Settings> {
  if (isDemoMode()) return clone(S().settings.get(brandId) ?? DEFAULT_SETTINGS);
  const { data } = await db.from("like_settings").select("*").eq("brand_id", brandId).maybeSingle();
  if (!data) {
    const { loadAgencySettings } = await import("@/lib/settings-data");
    const d = (await loadAgencySettings()).like_defaults;
    return { ...DEFAULT_SETTINGS, decisionDays: d.decisionDays, remindBefore: d.remindBefore, remindOnDay: d.remindOnDay, remindLate: d.remindLate, requireCommentOnAdjust: d.requireCommentOnAdjust, allowDownload: d.allowDownload, watermark: d.watermark };
  }
  return { rule: data.rule, decisionDays: data.decision_days, remindBefore: data.remind_before, remindOnDay: data.remind_on_day, remindLate: data.remind_late, requireCommentOnAdjust: data.require_comment_on_adjust, allowDownload: data.allow_download, watermark: data.watermark, allowShareLinks: data.allow_share_links, timezone: data.timezone };
}

export async function saveSettings(brandId: string, s: Settings) {
  if (isDemoMode()) { S().settings.set(brandId, clone(s)); return; }
  const { error } = await db.from("like_settings").upsert({ brand_id: brandId, rule: s.rule, decision_days: s.decisionDays, remind_before: s.remindBefore, remind_on_day: s.remindOnDay, remind_late: s.remindLate, require_comment_on_adjust: s.requireCommentOnAdjust, allow_download: s.allowDownload, watermark: s.watermark, allow_share_links: s.allowShareLinks, timezone: s.timezone, updated_at: nowISO() });
  if (error) throw error;
}

/** URL assinada de curta duração para um arquivo do bucket privado like-assets. */
export async function signedAssetUrl(pathOrUrl: string, seconds = 300): Promise<string> {
  if (isDemoMode() || /^(data:|https?:)/.test(pathOrUrl)) return pathOrUrl;
  const { data, error } = await supabase.storage.from("like-assets").createSignedUrl(pathOrUrl, seconds);
  if (error) throw error;
  return data.signedUrl;
}

export async function itemTimeline(itemId: string): Promise<Activity[]> {
  if (isDemoMode()) {
    const actor = demoActor();
    return clone(S().activity.filter((a) => a.itemId === itemId && (actor.kind === "agency" || !a.payload.internal))).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  const { data } = await db.from("like_activity").select("*").eq("item_id", itemId).order("created_at");
  return ((data ?? []) as any[]).map((a) => ({ id: a.id, itemId: a.item_id, roundId: a.round_id, actorName: a.actor_name, event: a.event, payload: a.payload ?? {}, createdAt: a.created_at }));
}

/** Tempo real: comentários, decisões e status. Devolve a função para cancelar. */
export function subscribeLike(onChange: (table: string, row: Record<string, unknown>) => void) {
  if (isDemoMode()) return () => undefined;
  const ch = supabase.channel("echo-like");
  for (const table of ["like_items", "like_comments", "like_decisions"]) ch.on("postgres_changes" as never, { event: "*", schema: "public", table }, (p: any) => onChange(table, p.new ?? p.old ?? {}));
  ch.subscribe();
  return () => { supabase.removeChannel(ch); };
}

// ----- Utilidades para testes (diagnóstico) -----------------------------------------------------

export const demoActors = { team: TEAM_ACTOR, client: CLIENT_ACTOR };
/** Apaga os registros de exemplo (is_example) criados pelo diagnóstico. */
export async function purgeExamples(): Promise<number> {
  if (isDemoMode()) {
    const s = S();
    const ids = new Set(s.items.filter((i) => i.isExample).map((i) => i.id));
    const rounds = new Set(s.rounds.filter((r) => r.isExample).map((r) => r.id));
    s.items = s.items.filter((i) => !ids.has(i.id));
    s.versions = s.versions.filter((v) => !ids.has(v.itemId));
    s.comments = s.comments.filter((c) => !ids.has(c.itemId));
    s.decisions = s.decisions.filter((d) => !ids.has(d.itemId));
    s.activity = s.activity.filter((a) => !(a.itemId && ids.has(a.itemId)) && !(a.roundId && rounds.has(a.roundId)));
    s.views = s.views.filter((v) => !ids.has(v.itemId));
    s.rounds = s.rounds.filter((r) => !rounds.has(r.id));
    return ids.size + rounds.size;
  }
  const { data: items } = await db.from("like_items").select("id").eq("is_example", true);
  // Decisões e atividade são imutáveis; os exemplos saem em cascata pelo item (a política bloqueia só update/delete direto).
  await db.from("like_items").delete().eq("is_example", true);
  await db.from("like_rounds").delete().eq("is_example", true);
  return (items ?? []).length;
}
export const countExamples = () => (isDemoMode() ? S().items.filter((i) => i.isExample).length + S().rounds.filter((r) => r.isExample).length : 0);

// ----- Mapeamento do banco -----------------------------------------------------------------

function mapRound(r: any): Round {
  return { id: r.id, brandId: r.brand_id, brandSlug: r.brands?.slug ?? "", brandName: r.brands?.name ?? "", title: r.title, frontId: r.front_id, campaignId: r.campaign_id, periodStart: r.period_start, periodEnd: r.period_end, dueAt: r.due_at, message: r.message, status: r.status, sentAt: r.sent_at, isExample: r.is_example, createdAt: r.created_at };
}
function mapVersion(v: any): Version {
  return { id: v.id, itemId: v.item_id, number: v.number, assets: v.assets ?? [], caption: v.caption, hashtags: v.hashtags, cta: v.cta, script: v.script ?? [], textBody: v.text_body, changesNote: v.changes_note, sent: v.sent, createdBy: v.created_by, createdAt: v.created_at };
}
function mapComment(c: any): Comment {
  return { id: c.id, itemId: c.item_id, versionId: c.version_id, parentId: c.parent_id, authorId: c.author_id, authorName: c.author_name ?? "Pessoa", authorKind: c.author_kind, body: c.body, mentions: c.mentions ?? [], anchor: c.anchor, internal: c.internal, resolvedAt: c.resolved_at, resolvedBy: c.resolved_by, editedAt: c.edited_at, deletedAt: c.deleted_at, createdAt: c.created_at };
}
function mapItemFull(i: any): ItemFull {
  const versions = ((i.like_versions ?? []) as any[]).map(mapVersion).sort((a, b) => a.number - b.number);
  return {
    id: i.id, brandId: i.brand_id, brandSlug: i.brands?.slug ?? "", brandName: i.brands?.name ?? "", roundId: i.round_id, title: i.title, kind: i.kind, channelId: i.channel_id, channelName: i.brand_identity_channels?.name ?? null, presetId: i.preset_id, presetDimension: i.brand_identity_presets?.dimension ?? null,
    frontId: i.front_id, frontName: i.workspace_fronts?.name ?? null, workOrderId: i.work_order_id, taskId: i.task_id, conteudoId: i.conteudo_id, campaignId: i.campaign_id, solicitacaoId: i.solicitacao_id, publishAt: i.publish_at, dueAt: i.due_at, status: i.status,
    currentVersionId: i.current_version_id, priority: i.priority, orderIndex: i.order_index, sentAt: i.sent_at, decidedAt: i.decided_at, publishedLink: i.published_link, isExample: i.is_example, createdAt: i.created_at, coverTone: i.cover_tone ?? null,
    versions, current: versions.find((v) => v.id === i.current_version_id) ?? versions[versions.length - 1] ?? null,
    comments: ((i.like_comments ?? []) as any[]).filter((c) => !c.deleted_at).map(mapComment),
    decisions: ((i.like_decisions ?? []) as any[]).map((d) => ({ id: d.id, itemId: d.item_id, versionId: d.version_id, decision: d.decision, decidedBy: d.decided_by, deciderName: d.decider_name, deciderKind: d.decider_kind, note: d.note, phrases: d.phrases ?? [], via: d.via, justification: d.justification, undoes: d.undoes, createdAt: d.created_at })),
    views: [],
  };
}

// ----- Arquivos (envio) --------------------------------------------------------------------

/** Lê largura, altura e duração no navegador e gera a capa do vídeo (quadro em 1s). */
export async function inspectFile(file: File): Promise<Omit<Asset, "url">> {
  const type: Asset["type"] = file.type.startsWith("video/") ? "video" : file.type === "application/pdf" ? "pdf" : "image";
  const url = URL.createObjectURL(file);
  try {
    if (type === "image") {
      const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error("Imagem inválida")); i.src = url; });
      return { type, width: img.naturalWidth, height: img.naturalHeight, name: file.name };
    }
    if (type === "video") {
      const v = document.createElement("video");
      v.muted = true; v.preload = "metadata"; v.src = url;
      await new Promise((ok, bad) => { v.onloadedmetadata = ok; v.onerror = () => bad(new Error("Vídeo inválido")); });
      v.currentTime = Math.min(1, (v.duration || 1) / 2);
      await new Promise((ok) => { v.onseeked = ok; setTimeout(ok, 1500); });
      const c = document.createElement("canvas");
      c.width = v.videoWidth; c.height = v.videoHeight;
      c.getContext("2d")?.drawImage(v, 0, 0);
      return { type, width: v.videoWidth, height: v.videoHeight, duration: Math.round(v.duration), poster: c.toDataURL("image/jpeg", 0.7), name: file.name };
    }
    return { type, name: file.name };
  } finally { if (type !== "video") setTimeout(() => URL.revokeObjectURL(url), 5000); }
}

/** Envia o arquivo para o bucket privado (ou mantém local no exemplo). */
export async function uploadAsset(brandId: string, file: File, meta: Omit<Asset, "url">): Promise<Asset> {
  if (file.size > 200 * 1024 * 1024) throw new Error("O arquivo passa de 200 MB.");
  if (isDemoMode()) return { ...meta, url: URL.createObjectURL(file) };
  const path = `${brandId}/rascunhos/${crypto.randomUUID()}/${file.name.replace(/[^\w.-]+/g, "-")}`;
  const { error } = await supabase.storage.from("like-assets").upload(path, file, { contentType: file.type || undefined });
  if (error) throw error;
  const { data } = await supabase.storage.from("like-assets").createSignedUrl(path, 60 * 60 * 24 * 7);
  return { ...meta, url: data?.signedUrl ?? path, name: meta.name ?? file.name };
}

/** Soma dias úteis (seg–sex) a uma data. */
export function addBusinessDays(from: Date, days: number) {
  const d = new Date(from);
  let n = 0;
  while (n < days) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) n++; }
  d.setHours(18, 0, 0, 0);
  return d;
}

/** Capas para materiais sem arte, nos tons da biblioteca. */
export const COVER_TONES: { key: string; label: string; css: string }[] = [
  { key: "lima", label: "Lima", css: "linear-gradient(135deg, #D8F27A, #9CCB3B)" },
  { key: "pessego", label: "Pêssego", css: "linear-gradient(135deg, #FFD3B8, #F59A6B)" },
  { key: "rosa", label: "Rosa", css: "linear-gradient(135deg, #F7B8D2, #DC3F88)" },
  { key: "azul", label: "Azul", css: "linear-gradient(135deg, #B8D8FF, #2E7BE4)" },
  { key: "roxo", label: "Roxo", css: "linear-gradient(135deg, #CFC2FF, #6B4FE8)" },
  { key: "preto", label: "Preto", css: "linear-gradient(135deg, #3A3842, #111015)" },
];
export const coverCss = (tone?: string | null) => COVER_TONES.find((t) => t.key === tone)?.css ?? COVER_TONES[4].css;

/** Transforma um link de vídeo (YouTube, Vimeo, Google Drive) em endereço incorporável. */
export function embedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  const dr = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (dr) return `https://drive.google.com/file/d/${dr[1]}/preview`;
  return null;
}
