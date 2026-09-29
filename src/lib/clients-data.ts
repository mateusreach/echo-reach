// ---------------------------------------------------------------------------
// CLIENTES — carteira e hub do cliente (página 06)
//
// Um cliente = um registro em `brands`, usado por Brand, Workspace, Like e
// Espaço 360. Com Supabase, lê e grava de verdade; sem banco, usa a carteira
// real da Reach (11 clientes e 16 frentes) com números de exemplo em memória.
// ---------------------------------------------------------------------------
import { supabase } from "@/integrations/supabase/client";
import { brandModules, createBrand, listBrands, updateBrand, type Brand, type BrandModules } from "@/lib/reach-data";
import { addDays, frontRisk, RECURRENCES, toISO, today, type RiskLevel } from "@/lib/workspace-data";
import { isDemoMode } from "@/lib/home-data";

export type FrontSummary = { id: string; name: string; recurrence: string | null; approvedUntil: string | null; leadDays: number; level: RiskLevel; diff: number };
export type ClientCard = {
  id: string;
  name: string;
  slug: string;
  segment: string | null;
  status: string;
  contract: string | null;
  logoUrl: string | null;
  primary: string | null;
  accent: string | null;
  contactName: string | null;
  contactEmail: string | null;
  description: string | null;
  modules: BrandModules;
  fronts: FrontSummary[];
  openTasks: number;
  lateTasks: number;
  nextDue: string | null;
  awaitingClient: number;
  members: string[];
  lastActivity: { text: string; at: string } | null;
};
export type ClientInput = { id?: string; name: string; slug: string; segment: string; status: string; contract_type: string; contact_name: string; contact_email: string; modules: BrandModules };

const PALETTES = [["#6B4FE8", "#6FA9F5"], ["#DC3F88", "#B98CF2"], ["#2E7BE4", "#9C84F3"], ["#D8520C", "#E86AA0"], ["#1FA774", "#6FA9F5"], ["#8C6A4B", "#E3C39C"]];
export function clientGradient(c: Pick<ClientCard, "primary" | "accent" | "name">) {
  if (c.primary) return `linear-gradient(135deg, ${c.primary}, ${c.accent ?? c.primary})`;
  const i = [...c.name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % PALETTES.length;
  return `linear-gradient(135deg, ${PALETTES[i][0]}, ${PALETTES[i][1]})`;
}

export function slugify(n: string) {
  return n.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function summarizeFront(f: { id: string; name: string; recurrence: string | null; approved_until: string | null; lead_days: number | null }): FrontSummary {
  const r = frontRisk({ approved_until: f.approved_until, lead_days: f.lead_days ?? 0 });
  return { id: f.id, name: f.name, recurrence: f.recurrence ? RECURRENCES[f.recurrence as keyof typeof RECURRENCES] ?? f.recurrence : null, approvedUntil: f.approved_until, leadDays: f.lead_days ?? 0, level: r.level, diff: r.diff };
}

// ----- exemplo: a carteira real da Reach -----------------------------------------------------

const ROSTER: [string, string, boolean, [string, string, number][]][] = [
  ["Dra. Giuliana", "dra-giuliana", false, [["Feed", "2026-10-02", 3]]],
  ["Fina Fragrância", "fina-fragrancia", true, [["Feed", "2026-10-02", 3], ["TikTok", "2026-09-30", 4]]],
  ["A Emporium", "emporium", false, [["Feed", "2026-09-30", 3]]],
  ["Esense", "esense", false, [["Feed", "2026-09-30", 5]]],
  ["Eliza", "eliza", false, [["Feed", "2026-09-30", 3], ["Stories", "2026-09-23", 2]]],
  ["Pão de Queijo da Maria", "pao-de-queijo-da-maria", false, [["Feed", "2026-09-30", 3]]],
  ["Gaby Mota Cachos", "gaby-mota-cachos", false, [["Feed", "2026-09-30", 3]]],
  ["Gamô Ateliê", "gamo-atelie", false, [["Feed", "2026-09-30", 2]]],
  ["Zelus", "zelus", true, [["Feed", "2026-09-30", 3], ["Stories", "2026-09-28", 2]]],
  ["Spirale", "spirale", false, [["Feed", "2026-09-30", 3], ["Stories", "2026-09-30", 2]]],
  ["Isabela Gomes", "isabela-gomes", true, [["Feed", "2026-09-30", 3], ["Stories", "2026-09-30", 2]]],
];
const SEGMENTS: Record<string, string> = {
  "dra-giuliana": "Dermatologia", "fina-fragrancia": "Perfumaria artesanal", emporium: "Empório gourmet", esense: "Aromaterapia", eliza: "Moda feminina",
  "pao-de-queijo-da-maria": "Alimentação", "gaby-mota-cachos": "Beleza e cabelos", "gamo-atelie": "Ateliê de cerâmica", zelus: "Saúde e bem-estar", spirale: "Arquitetura", "isabela-gomes": "Marca pessoal",
};
const TEAM = ["Helena Duarte", "Rafael Monteiro", "Camila Rocha", "Bruno Tavares", "Marina Lopes", "Theo Almeida"];

let demoClients: ClientCard[] | null = null;
function demo(): ClientCard[] {
  if (demoClients) return demoClients;
  demoClients = ROSTER.map(([name, slug, has360, fronts], i) => {
    const open = [7, 12, 4, 3, 6, 2, 5, 3, 9, 4, 8][i];
    return {
      id: `b-${slug}`, name, slug, segment: SEGMENTS[slug], status: i === 7 ? "onboarding" : "ativo", contract: i % 4 === 3 ? "projeto" : "recorrente",
      logoUrl: null, primary: null, accent: null, contactName: null, contactEmail: null, description: null,
      modules: { biblioteca: true, plano: has360, espaco360: has360, workspace: true, like: has360 },
      fronts: fronts.map(([fname, until, lead], k) => summarizeFront({ id: `${slug}-${k}`, name: fname, recurrence: fname === "Feed" ? "weekly" : "weekly", approved_until: until, lead_days: lead })),
      openTasks: open, lateTasks: [1, 2, 0, 0, 1, 0, 1, 0, 1, 0, 0][i], nextDue: toISO(addDays(today(), (i % 4))), awaitingClient: [0, 2, 1, 0, 0, 1, 0, 0, 1, 0, 1][i],
      members: TEAM.slice(i % 3, (i % 3) + 3),
      lastActivity: { text: ["Legendas do Feed em ajuste", "Carrossel “Notas de outono” enviado ao cliente", "Post do empório aprovado", "Frente Feed coberta até 30/09", "Stories da semana em produção", "Nova solicitação: cardápio de outubro", "Artes do carrossel em avaliação interna", "Onboarding: identidade visual recebida", "Roteiro do Reels de lançamento iniciado", "Estratégia do ciclo 13 a 19/10", "Pacote de Stories entregue"][i], at: toISO(addDays(today(), -(i % 5))) },
    };
  });
  return demoClients;
}

// ----- leitura --------------------------------------------------------------------------------

function fromBrand(b: Brand, extra: Partial<ClientCard> = {}): ClientCard {
  return {
    id: b.id, name: b.name, slug: b.slug, segment: b.segment, status: b.status ?? "ativo", contract: b.contract_type, logoUrl: b.logo_url,
    primary: b.primary_color, accent: b.accent_color, contactName: b.contact_name, contactEmail: b.contact_email, description: b.description,
    modules: brandModules(b), fronts: [], openTasks: 0, lateTasks: 0, nextDue: null, awaitingClient: 0, members: [], lastActivity: null, ...extra,
  };
}

export async function listPortfolio(): Promise<ClientCard[]> {
  if (isDemoMode()) return demo();
  const todayISO = toISO(today());
  const [brands, fronts, tasks] = await Promise.all([
    listBrands(),
    supabase.from("workspace_fronts").select("id, brand_id, name, recurrence, approved_until, lead_days"),
    supabase.from("workspace_tasks").select("brand_id, title, status, due_date, owner_name, updated_at").neq("status", "Concluído"),
  ]);
  const fr = (fronts.data ?? []) as any[];
  const tk = (tasks.data ?? []) as any[];
  return brands.map((b) => {
    const mine = tk.filter((t) => t.brand_id === b.id);
    const last = [...mine].sort((a, c) => (c.updated_at ?? "").localeCompare(a.updated_at ?? ""))[0];
    return fromBrand(b, {
      fronts: fr.filter((f) => f.brand_id === b.id).map(summarizeFront),
      openTasks: mine.length,
      lateTasks: mine.filter((t) => t.due_date && t.due_date < todayISO).length,
      nextDue: mine.map((t) => t.due_date).filter(Boolean).sort()[0] ?? null,
      awaitingClient: mine.filter((t) => t.status === "Avaliação externa").length,
      members: [...new Set(mine.map((t) => t.owner_name).filter(Boolean))].slice(0, 5) as string[],
      lastActivity: last ? { text: `${last.title} · ${last.status}`, at: (last.updated_at ?? "").slice(0, 10) } : null,
    });
  });
}

export type ClientHubData = {
  client: ClientCard;
  counts: { ideias: number; conteudos: number; campanhas: number; solicitacoes: number; entregas: number };
  users: { name: string; email: string | null; admin: boolean; lastAccess: string | null }[];
  activity: { who: string; text: string; at: string; env: "brand" | "workspace" | "like" | "e360" }[];
};

export async function loadClientHub(slug: string): Promise<ClientHubData | null> {
  if (isDemoMode()) {
    const c = demo().find((x) => x.slug === slug);
    if (!c) return null;
    const d = (n: number) => toISO(addDays(today(), -n));
    return {
      client: c,
      counts: { ideias: 24, conteudos: 9, campanhas: c.modules.espaco360 ? 3 : 0, solicitacoes: c.modules.espaco360 ? 2 : 0, entregas: 4 },
      users: c.modules.espaco360 ? [{ name: "Carla Mendes", email: `carla@${c.slug}.com.br`, admin: true, lastAccess: d(1) }, { name: "Paulo Nunes", email: `paulo@${c.slug}.com.br`, admin: false, lastAccess: d(6) }] : [],
      activity: [
        { who: c.members[0] ?? "Helena Duarte", text: c.lastActivity?.text ?? "Atualizou a operação", at: d(0), env: "workspace" },
        { who: "Camila Rocha", text: "Criou 3 ideias no pilar “Bastidores”", at: d(1), env: "brand" },
        ...(c.modules.espaco360 ? [{ who: "Carla Mendes", text: "Abriu a solicitação “Fotos da coleção nova”", at: d(2), env: "e360" as const }] : []),
        { who: "Bruno Tavares", text: "Enviou o carrossel para avaliação interna", at: d(3), env: "workspace" },
        { who: "Rafael Monteiro", text: "Atualizou a estratégia do trimestre", at: d(5), env: "brand" },
      ],
    };
  }
  const { data: b } = await supabase.from("brands").select("*").eq("slug", slug).maybeSingle();
  if (!b) return null;
  const all = await listPortfolio();
  const client = all.find((x) => x.id === b.id) ?? fromBrand(b as Brand);
  const count = async (table: string, extra?: (q: any) => any) => {
    let q = (supabase as any).from(table).select("id", { count: "exact", head: true }).eq("brand_id", b.id);
    if (extra) q = extra(q);
    const { count: n } = await q;
    return n ?? 0;
  };
  const [ideias, conteudos, campanhas, solicitacoes, entregas, members, logs, recent] = await Promise.all([
    count("biblioteca_ideias"), count("conteudos"), count("espaco360_campaigns"),
    count("solicitacoes", (q) => q.not("status", "in", "(concluida,cancelada)")),
    count("workspace_work_orders", (q) => q.neq("status", "Concluída")),
    supabase.from("brand_members").select("is_admin, member_role, profiles(display_name, email)").eq("brand_id", b.id),
    supabase.from("brand_access_logs").select("user_id, created_at, user_email").eq("brand_id", b.id).order("created_at", { ascending: false }).limit(200),
    supabase.from("workspace_tasks").select("title, status, owner_name, updated_at").eq("brand_id", b.id).order("updated_at", { ascending: false }).limit(6),
  ]);
  const lastBy = new Map<string, string>();
  ((logs.data ?? []) as any[]).forEach((l) => { if (l.user_email && !lastBy.has(l.user_email)) lastBy.set(l.user_email, (l.created_at ?? "").slice(0, 10)); });
  return {
    client,
    counts: { ideias, conteudos, campanhas, solicitacoes, entregas },
    users: ((members.data ?? []) as any[]).filter((m) => m.member_role !== "agency").map((m) => ({ name: m.profiles?.display_name || m.profiles?.email || "Pessoa", email: m.profiles?.email ?? null, admin: !!m.is_admin, lastAccess: lastBy.get(m.profiles?.email ?? "") ?? null })),
    activity: ((recent.data ?? []) as any[]).map((t) => ({ who: t.owner_name || "Equipe", text: `${t.title} · ${t.status}`, at: (t.updated_at ?? "").slice(0, 10), env: "workspace" as const })),
  };
}

// ----- escrita --------------------------------------------------------------------------------

export async function saveClient(input: ClientInput): Promise<string> {
  const slug = slugify(input.slug || input.name);
  if (isDemoMode()) {
    const list = demo();
    if (list.some((c) => c.slug === slug && c.id !== input.id)) throw new Error("Já existe um cliente com este endereço. Escolha outro.");
    if (input.id) {
      demoClients = list.map((c) => (c.id === input.id ? { ...c, name: input.name, slug, segment: input.segment || null, status: input.status, contract: input.contract_type, contactName: input.contact_name || null, contactEmail: input.contact_email || null, modules: input.modules } : c));
    } else {
      demoClients = [...list, { id: `b-${slug}`, name: input.name, slug, segment: input.segment || null, status: input.status, contract: input.contract_type, logoUrl: null, primary: null, accent: null, contactName: input.contact_name || null, contactEmail: input.contact_email || null, description: null, modules: input.modules, fronts: [], openTasks: 0, lateTasks: 0, nextDue: null, awaitingClient: 0, members: [], lastActivity: { text: "Cliente cadastrado", at: toISO(today()) } }];
    }
    return slug;
  }
  const { data: clash } = await supabase.from("brands").select("id").eq("slug", slug).maybeSingle();
  if (clash && clash.id !== input.id) throw new Error("Já existe um cliente com este endereço. Escolha outro.");
  const patch = { name: input.name, slug, segment: input.segment || null, status: input.status, contract_type: input.contract_type, contact_name: input.contact_name || null, contact_email: input.contact_email || null, modules: input.modules as never };
  if (input.id) await updateBrand(input.id, patch);
  else await createBrand(patch as never);
  return slug;
}

export async function saveModules(id: string, modules: BrandModules) {
  if (isDemoMode()) { demoClients = demo().map((c) => (c.id === id ? { ...c, modules } : c)); return; }
  await updateBrand(id, { modules: modules as never });
}
