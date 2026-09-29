// ---------------------------------------------------------------------------
// Echo · busca global (⌘K e /pesquisa) e itens recentes
// No banco: echo_search() (SECURITY INVOKER, a RLS vale). No demo: índice em
// memória montado das camadas demo, com a mesma regra: o cliente não vê
// tarefas, entregas, frentes, pessoas nem rascunhos do Like (A2).
// ---------------------------------------------------------------------------
import { supabase } from "@/integrations/supabase/client";
import { isDemoMode } from "./home-data";
import { isViewingAsClient, viewingAsClientBrandName } from "./view-as";
import { ROSTER } from "./clients-data";
import { demoOps } from "./ops-data";
import { demoLibraryStore } from "./library-data";
import { demoPlanStore } from "./plan-data";
import { demoSpaceStore } from "./space-data";
import { loadTeam } from "./team-data";
import { listItems, STATUS_LABEL } from "./like-data";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type HitKind = "cliente" | "tarefa" | "entrega" | "frente" | "ideia" | "conteudo" | "campanha" | "solicitacao" | "material" | "secao" | "pessoa";
export type Hit = { kind: HitKind; id: string; title: string; sub: string | null; brandSlug: string | null; href: string; at: string | null; rank: number };
export const KIND_META: Record<HitKind, { label: string; plural: string; icon: string; env: "brand" | "workspace" | "like" | "e360" | "agencia" }> = {
  cliente: { label: "Cliente", plural: "Clientes", icon: "briefcase", env: "agencia" },
  tarefa: { label: "Tarefa", plural: "Tarefas", icon: "checkCircle", env: "workspace" },
  entrega: { label: "Entrega", plural: "Entregas", icon: "inbox", env: "workspace" },
  frente: { label: "Frente", plural: "Frentes", icon: "feed", env: "workspace" },
  ideia: { label: "Ideia", plural: "Ideias", icon: "sparkle", env: "brand" },
  conteudo: { label: "Conteúdo", plural: "Conteúdos", icon: "fileText", env: "brand" },
  campanha: { label: "Campanha", plural: "Campanhas", icon: "megaphone", env: "e360" },
  solicitacao: { label: "Solicitação", plural: "Solicitações", icon: "message", env: "e360" },
  material: { label: "Material do Like", plural: "Materiais do Like", icon: "heart", env: "like" },
  secao: { label: "Seção do plano", plural: "Seções do plano", icon: "layers", env: "brand" },
  pessoa: { label: "Pessoa", plural: "Pessoas", icon: "user", env: "agencia" },
};

/** Normaliza para comparar sem acento nem caixa. */
export const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function score(q: string, title: string, sub?: string | null): number {
  const t = norm(title), n = norm(q).trim();
  if (!n) return 0;
  if (t === n) return 10;
  if (t.startsWith(n)) return 6;
  const words = n.split(/\s+/).filter(Boolean);
  const hay = `${t} ${norm(sub ?? "")}`;
  if (!words.every((w) => hay.includes(w))) return 0;
  return (t.includes(n) ? 4 : 2) + (words.some((w) => t.split(/\W+/).some((x) => x.startsWith(w))) ? 1 : 0);
}

type Doc = Omit<Hit, "rank">;
let cache: { key: string; at: number; docs: Doc[] } | null = null;

async function demoDocs(client: boolean): Promise<Doc[]> {
  const key = client ? `c:${viewingAsClientBrandName() ?? ""}` : "team";
  if (cache && cache.key === key && Date.now() - cache.at < 15000) return cache.docs;
  const brandName = viewingAsClientBrandName();
  const roster = ROSTER.filter(([name]) => !client || !brandName || name === brandName);
  const slugs = new Set(roster.map(([, slug]) => slug));
  const docs: Doc[] = [];
  for (const [name, slug, has360] of roster) {
    docs.push({ kind: "cliente", id: `b-${slug}`, title: name, sub: client ? "Espaço 360" : "Hub do cliente", brandSlug: slug, href: client ? `/e360/${slug}` : `/clientes/${slug}`, at: null });
    const lib = demoLibraryStore(slug);
    for (const i of lib?.ideias ?? []) docs.push({ kind: "ideia", id: i.id, title: i.title, sub: `${name}${i.description ? ` · ${i.description.slice(0, 60)}` : ""}`, brandSlug: slug, href: `/b/${slug}/biblioteca`, at: i.updated_at });
    for (const c of lib?.conteudos ?? []) docs.push({ kind: "conteudo", id: c.id, title: c.title, sub: `${name}${c.formato ? ` · ${c.formato}` : ""}`, brandSlug: slug, href: `/b/${slug}/biblioteca`, at: c.updated_at });
    const plan = demoPlanStore(slug);
    for (const s of plan?.sections ?? []) docs.push({ kind: "secao", id: s.id, title: s.title, sub: `${name} · Plano`, brandSlug: slug, href: `/b/${slug}/plano`, at: null });
    for (const c of plan?.campaigns ?? []) docs.push({ kind: "campanha", id: c.id, title: c.title, sub: name, brandSlug: slug, href: has360 ? `/e360/${slug}/campanha/${c.id}` : `/b/${slug}/plano`, at: null });
    if (has360) for (const r of demoSpaceStore(slug).requests) docs.push({ kind: "solicitacao", id: r.id, title: r.title, sub: `${name} · ${r.status.replace(/_/g, " ")}`, brandSlug: slug, href: `/e360/${slug}`, at: r.created_at });
  }
  if (!client) {
    const ops = demoOps();
    for (const t of ops.tasks) docs.push({ kind: "tarefa", id: t.id, title: t.title, sub: `${t.brand.name} · ${t.status}${t.owner ? ` · ${t.owner}` : ""}`, brandSlug: t.brand.slug, href: `/workspace/cliente/${t.brand.slug}`, at: t.since ?? null });
    for (const f of ops.fronts) docs.push({ kind: "frente", id: f.front.id, title: `${f.front.name} · ${f.brand.name}`, sub: "Frente de cobertura", brandSlug: f.brand.slug, href: "/workspace/controle", at: null });
    const seen = new Set<string>();
    for (const t of ops.tasks) if (t.workOrderId && !seen.has(t.workOrderId)) { seen.add(t.workOrderId); docs.push({ kind: "entrega", id: t.workOrderId, title: `${t.frontName ?? "Entrega"} · ${t.brand.name}`, sub: "Entrega do Workspace", brandSlug: t.brand.slug, href: `/workspace/cliente/${t.brand.slug}`, at: null }); }
    try { for (const p of (await loadTeam()).people) docs.push({ kind: "pessoa", id: p.id, title: p.name, sub: p.jobTitle, brandSlug: null, href: "/agencia/equipe", at: null }); } catch { /* sem equipe no demo */ }
  }
  // listItems já esconde rascunhos do cliente.
  for (const i of await listItems()) if (!client || slugs.has(i.brandSlug)) docs.push({ kind: "material", id: i.id, title: i.title, sub: `${i.brandName} · ${STATUS_LABEL[i.status]}`, brandSlug: i.brandSlug, href: `/like/${i.brandSlug}/m/${i.id}`, at: i.sentAt ?? i.createdAt });
  cache = { key, at: Date.now(), docs };
  return docs;
}

/** Deixa o índice pronto (chamado ao abrir o ⌘K) para a busca responder rápido. */
export function warmSearch(client?: boolean) { if (isDemoMode()) void demoDocs(client ?? isViewingAsClient()); }

/** Limita a quantidade por tipo, para um tipo muito comum não esconder os outros. */
function capPerKind(hits: Hit[], perKind?: number) {
  if (!perKind) return hits;
  const n = new Map<string, number>();
  return hits.filter((h) => { const c = (n.get(h.kind) ?? 0) + 1; n.set(h.kind, c); return c <= perKind; });
}

export async function searchAll(q: string, opts: { client?: boolean; limit?: number; perKind?: number } = {}): Promise<Hit[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  const limit = opts.limit ?? 40;
  if (isDemoMode()) {
    const client = opts.client ?? isViewingAsClient();
    const ranked = (await demoDocs(client)).map((d) => ({ ...d, rank: score(term, d.title, d.sub) })).filter((d) => d.rank > 0).sort((a, b) => b.rank - a.rank || (b.at ?? "").localeCompare(a.at ?? ""));
    return capPerKind(ranked, opts.perKind).slice(0, limit);
  }
  const { data, error } = await db.rpc("echo_search", { p_q: term, p_limit: opts.perKind ? 100 : limit });
  if (error) throw error;
  const hits = ((data ?? []) as any[]).map((r) => ({ kind: r.kind, id: r.id, title: r.title, sub: r.sub, brandSlug: r.brand_slug, href: r.href, at: r.at, rank: r.rank }));
  return capPerKind(hits, opts.perKind).slice(0, limit);
}

// ----- Recentes (conveniência por pessoa, só neste navegador) -----------------------------
const RKEY = "echo_recent_v1";
export type Recent = { kind: HitKind; id: string; title: string; sub: string | null; href: string; at: string };
export function listRecent(): Recent[] {
  try { return JSON.parse(localStorage.getItem(RKEY) ?? "[]") as Recent[]; } catch { return []; }
}
export function trackRecent(r: Omit<Recent, "at">) {
  try {
    const list = [{ ...r, at: new Date().toISOString() }, ...listRecent().filter((x) => x.href !== r.href)].slice(0, 8);
    localStorage.setItem(RKEY, JSON.stringify(list));
  } catch { /* armazenamento indisponível */ }
}

/** Divide o texto em partes, marcando os trechos que batem com a busca (sem acento). */
export function highlight(text: string, q: string): { t: string; on: boolean }[] {
  const words = norm(q).split(/\s+/).filter((w) => w.length > 1);
  if (!words.length) return [{ t: text, on: false }];
  const n = norm(text);
  const marks = new Array(text.length).fill(false);
  for (const w of words) { let i = n.indexOf(w); while (i >= 0) { for (let k = i; k < i + w.length; k++) marks[k] = true; i = n.indexOf(w, i + w.length); } }
  const out: { t: string; on: boolean }[] = [];
  for (let i = 0; i < text.length; i++) { const last = out[out.length - 1]; if (last && last.on === marks[i]) last.t += text[i]; else out.push({ t: text[i], on: marks[i] }); }
  return out;
}
