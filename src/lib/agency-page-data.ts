// ---------------------------------------------------------------------------
// AGÊNCIA — dados de Início, Comunicação e Calendário (página 05)
//
// Com o Supabase conectado, lê e grava nas tabelas do piloto (agency_posts,
// agency_post_acks, agency_events, workspace_tasks, solicitacoes…). Sem banco,
// usa um conjunto de exemplo em memória: dá para testar criar, editar e dar
// "Ciente", mas nada é salvo ao recarregar.
// ---------------------------------------------------------------------------
import { supabase } from "@/integrations/supabase/client";
import {
  ackPost,
  createAgencyEvent,
  createAgencyPost,
  deleteAgencyEvent,
  deleteAgencyPost,
  listAgencyEvents,
  listAgencyPosts,
  listPostAcks,
  listWorkItems,
  unackPost,
  updateAgencyEvent,
  updateAgencyPost,
  type AgencyEvent,
  type AgencyPost,
} from "@/lib/agency-data";
import { listBrands } from "@/lib/reach-data";
import { addDays, frontRisk, toISO, today } from "@/lib/workspace-data";
import { isDemoMode } from "@/lib/home-data";

export type Person = { id: string; name: string; role?: string | null; open: number; late: number; leader?: boolean };
export type BrandLite = { id: string; name: string; slug: string };
export type AgendaEntry = {
  id: string;
  layer: "marco" | "prazo" | "reuniao";
  title: string;
  date: string;
  time?: string | null;
  brandId?: string | null;
  who?: string | null;
  category?: string;
  status?: string;
  description?: string | null;
  source?: AgencyEvent;
};
export type PostWithAcks = AgencyPost & { acks: { userId: string; name: string; at: string }[]; mine: boolean; author: string };

const iso = (n: number) => toISO(addDays(today(), n));

// ----- exemplo em memória -----------------------------------------------------

const DEMO_ME = { id: "u-helena", name: "Helena Duarte" };
const DEMO_TEAM: { id: string; name: string; role: string; leader?: boolean }[] = [
  { id: "u-helena", name: "Helena Duarte", role: "Diretora de Atendimento", leader: true },
  { id: "u-rafael", name: "Rafael Monteiro", role: "Estrategista" },
  { id: "u-camila", name: "Camila Rocha", role: "Redatora" },
  { id: "u-bruno", name: "Bruno Tavares", role: "Diretor de Arte", leader: true },
  { id: "u-marina", name: "Marina Lopes", role: "Designer" },
  { id: "u-theo", name: "Theo Almeida", role: "Editor de Vídeo" },
];
const DEMO_BRANDS: BrandLite[] = [
  ["Fina Fragrância", "fina-fragrancia"], ["Zelus", "zelus"], ["Isabela Gomes", "isabela-gomes"], ["Eliza", "eliza"], ["A Emporium", "emporium"],
  ["Spirale", "spirale"], ["Esense", "esense"], ["Gaby Mota Cachos", "gaby-mota-cachos"], ["Gamô Ateliê", "gamo-atelie"], ["Pão de Queijo da Maria", "pao-de-queijo-da-maria"], ["Dra. Giuliana", "dra-giuliana"],
].map(([name, slug]) => ({ id: `b-${slug}`, name, slug }));

type DemoStore = { posts: AgencyPost[]; acks: { post_id: string; user_id: string; created_at: string }[]; events: AgencyEvent[] };
let demoStore: DemoStore | null = null;
function demo(): DemoStore {
  if (demoStore) return demoStore;
  const now = new Date().toISOString();
  const post = (id: string, kind: string, title: string, content: string, pinned: boolean, daysAgo: number): AgencyPost => {
    const at = new Date(Date.now() - daysAgo * 86_400_000).toISOString();
    return { id, kind, title, content, pinned, created_by: daysAgo > 3 ? "u-bruno" : "u-helena", created_at: at, updated_at: at };
  };
  const ev = (id: string, title: string, d: number, category: string, brand: string | null, time: string | null, status = "confirmado", responsible: string | null = null): AgencyEvent => ({
    id, title, event_date: iso(d), event_time: time, category, brand_id: brand ? `b-${brand}` : null, responsible, description: null, status, notes: null, created_at: now,
  });
  demoStore = {
    posts: [
      post("p1", "comunicado", "Nova rotina de aprovação a partir de outubro", "Os materiais passam pela avaliação interna antes de irem para o cliente. Quem não tiver acesso ao Like ainda, fale com a Helena.", true, 1),
      post("p2", "aviso", "Feriado de 12 de outubro", "Não teremos expediente no dia 12. Programem as publicações de Feed e Stories até sexta.", true, 3),
      post("p3", "atualizacao", "Modelo de Feed atualizado", "Incluímos a etapa de Pré produção no modelo Feed. As próximas entregas já nascem com as 7 tarefas.", false, 6),
      post("p4", "nota", "Fotos da coleção de velas da Fina", "O cliente enviou as fotos pelo Drive. A pasta está vinculada na biblioteca do Brand.", false, 9),
    ],
    acks: [
      { post_id: "p1", user_id: "u-rafael", created_at: now }, { post_id: "p1", user_id: "u-camila", created_at: now },
      { post_id: "p2", user_id: "u-rafael", created_at: now }, { post_id: "p2", user_id: "u-bruno", created_at: now }, { post_id: "p2", user_id: "u-marina", created_at: now }, { post_id: "p2", user_id: "u-helena", created_at: now },
    ],
    events: [
      ev("e1", "Planejamento de novembro · Fina", 1, "reuniao", "fina-fragrancia", "10:00", "confirmado", "Helena Duarte"),
      ev("e2", "Gravação na loja da Zelus", 2, "campanha", "zelus", "14:30", "planejado", "Theo Almeida"),
      ev("e3", "Entrega do pacote de Stories · Isabela", 4, "entrega", "isabela-gomes", null, "planejado", "Marina Lopes"),
      ev("e4", "Workshop interno de roteiro", 6, "interno", null, "16:00", "confirmado", "Camila Rocha"),
      ev("e5", "Dia das Crianças", 13, "feriado", null, null, "confirmado"),
      ev("e6", "Feriado: Nossa Senhora Aparecida", 13 - 1, "feriado", null, null, "confirmado"),
      ev("e7", "Lançamento da coleção de outono", 16, "campanha", "fina-fragrancia", "19:00", "planejado", "Rafael Monteiro"),
      ev("e8", "Revisão mensal · Spirale", -3, "reuniao", "spirale", "11:00", "concluido", "Helena Duarte"),
    ],
  };
  return demoStore;
}
function demoPrazos(): AgendaEntry[] {
  return [
    { id: "t1", layer: "prazo", title: "Legendas do Feed · semana 12/10", date: iso(-2), brandId: "b-fina-fragrancia", who: "Camila Rocha", status: "Ajuste" },
    { id: "t2", layer: "prazo", title: "Roteiro do Reels de lançamento", date: iso(-1), brandId: "b-zelus", who: "Camila Rocha", status: "Iniciada" },
    { id: "t3", layer: "prazo", title: "Artes do carrossel “Cachos no inverno”", date: iso(0), brandId: "b-gaby-mota-cachos", who: "Marina Lopes", status: "Avaliação interna" },
    { id: "t4", layer: "prazo", title: "Briefing do Stories de outubro", date: iso(0), brandId: "b-isabela-gomes", who: "Bruno Tavares", status: "Parada" },
    { id: "t5", layer: "prazo", title: "Estratégia do ciclo 13 a 19/10", date: iso(3), brandId: "b-spirale", who: "Rafael Monteiro", status: "Iniciada" },
    { id: "t6", layer: "prazo", title: "Vídeos da campanha de outono", date: iso(5), brandId: "b-fina-fragrancia", who: "Theo Almeida", status: "Iniciada" },
  ];
}
function demoReunioes(): AgendaEntry[] {
  return [
    { id: "r1", layer: "reuniao", title: "Reunião de alinhamento · Zelus", date: iso(3), time: "09:30", brandId: "b-zelus", who: "Helena Duarte" },
    { id: "r2", layer: "reuniao", title: "Revisão do plano · Isabela Gomes", date: iso(8), time: "15:00", brandId: "b-isabela-gomes", who: "Rafael Monteiro" },
  ];
}

// ----- quem sou -----------------------------------------------------------------

async function me(): Promise<{ id: string; name: string }> {
  if (isDemoMode()) return DEMO_ME;
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id ?? "";
  const { data: p } = await supabase.from("profiles").select("display_name, email").eq("id", id).maybeSingle();
  return { id, name: p?.display_name || p?.email || "" };
}

async function peopleNames(): Promise<Map<string, string>> {
  if (isDemoMode()) return new Map(DEMO_TEAM.map((t) => [t.id, t.name]));
  const { data } = await supabase.from("profiles").select("id, display_name, email");
  return new Map(((data ?? []) as any[]).map((p) => [p.id, p.display_name || p.email || "Alguém"]));
}

export async function listBrandsLite(): Promise<BrandLite[]> {
  if (isDemoMode()) return DEMO_BRANDS;
  const b = await listBrands();
  return b.map((x) => ({ id: x.id, name: x.name, slug: x.slug }));
}

// ----- Início ----------------------------------------------------------------------

export type AgencyHome = {
  kpis: { clients: number; requests: number; late: number; awaitingClient: number; uncovered: number };
  late: AgendaEntry[];
  soon: AgendaEntry[];
  upcoming: AgendaEntry[];
  posts: PostWithAcks[];
  team: Person[];
  brands: BrandLite[];
};

export async function loadAgencyHome(): Promise<AgencyHome> {
  const todayISO = toISO(today());
  const in7 = iso(7);
  if (isDemoMode()) {
    const prazos = demoPrazos();
    const posts = await listPostsWithAcks();
    const events = demo().events.filter((e) => e.event_date >= todayISO).sort((a, b) => a.event_date.localeCompare(b.event_date));
    const byPerson = (name: string) => prazos.filter((p) => p.who === name);
    return {
      kpis: { clients: 11, requests: 4, late: prazos.filter((p) => p.date < todayISO).length, awaitingClient: 3, uncovered: 1 },
      late: prazos.filter((p) => p.date < todayISO),
      soon: prazos.filter((p) => p.date >= todayISO && p.date <= in7),
      upcoming: events.slice(0, 6).map(eventToEntry),
      posts,
      team: DEMO_TEAM.map((t) => ({ id: t.id, name: t.name, role: t.role, leader: t.leader, open: byPerson(t.name).length + (t.id === "u-helena" ? 3 : 1), late: byPerson(t.name).filter((p) => p.date < todayISO).length })),
      brands: DEMO_BRANDS,
    };
  }
  const [items, brands, events, posts, tasksRes, fronts, team] = await Promise.all([
    listWorkItems(),
    listBrandsLite(),
    listAgencyEvents(),
    listPostsWithAcks(),
    supabase.from("workspace_tasks").select("id,title,due_date,status,brand_id,owner_id,owner_name").neq("status", "Concluído"),
    supabase.from("workspace_fronts").select("approved_until, lead_days"),
    supabase.from("team_members").select("id,name,job_title,is_leader,active,user_id").eq("active", true),
  ]);
  const tasks = (tasksRes.data ?? []) as any[];
  const done = ["concluida", "concluido", "cancelada", "cancelado", "entregue", "publicado"];
  const open = items.filter((i) => !done.includes(i.status));
  const toEntry = (t: any): AgendaEntry => ({ id: t.id, layer: "prazo", title: t.title, date: t.due_date, brandId: t.brand_id, who: t.owner_name, status: t.status });
  const lateTasks = tasks.filter((t) => t.due_date && t.due_date < todayISO);
  const late360 = open.filter((i) => i.dueDate && i.dueDate < todayISO).map((i) => ({ id: i.id, layer: "prazo" as const, title: i.title, date: i.dueDate!, brandId: i.brandId, who: i.responsible, status: i.status }));
  const soonTasks = tasks.filter((t) => t.due_date && t.due_date >= todayISO && t.due_date <= in7);
  return {
    kpis: {
      clients: brands.length,
      requests: items.filter((i) => i.kind === "solicitacao" && !done.includes(i.status)).length,
      late: lateTasks.length + late360.length,
      awaitingClient: tasks.filter((t) => t.status === "Avaliação externa").length,
      uncovered: ((fronts.data ?? []) as any[]).filter((f) => frontRisk(f).level === "red").length,
    },
    late: [...lateTasks.map(toEntry), ...late360].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8),
    soon: soonTasks.map(toEntry).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8),
    upcoming: events.filter((e) => e.event_date >= todayISO).slice(0, 6).map(eventToEntry),
    posts,
    team: ((team.data ?? []) as any[]).map((m) => {
      const mine = tasks.filter((t) => (m.user_id && t.owner_id === m.user_id) || t.owner_name === m.name);
      return { id: m.id, name: m.name, role: m.job_title, leader: m.is_leader, open: mine.length, late: mine.filter((t) => t.due_date && t.due_date < todayISO).length };
    }).sort((a, b) => b.open - a.open),
    brands,
  };
}

function eventToEntry(e: AgencyEvent): AgendaEntry {
  return { id: e.id, layer: "marco", title: e.title, date: e.event_date, time: e.event_time, brandId: e.brand_id, who: e.responsible, category: e.category, status: e.status, description: e.description, source: e };
}

// ----- Comunicação --------------------------------------------------------------------

export async function listPostsWithAcks(): Promise<PostWithAcks[]> {
  const my = await me();
  const names = await peopleNames();
  if (isDemoMode()) {
    const s = demo();
    return [...s.posts]
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.created_at.localeCompare(a.created_at))
      .map((p) => {
        const acks = s.acks.filter((a) => a.post_id === p.id).map((a) => ({ userId: a.user_id, name: names.get(a.user_id) ?? "Alguém", at: a.created_at }));
        return { ...p, acks, mine: acks.some((a) => a.userId === my.id), author: names.get(p.created_by ?? "") ?? "Reach" };
      });
  }
  const [posts, acks] = await Promise.all([listAgencyPosts(), listPostAcks()]);
  return posts.map((p) => {
    const list = acks.filter((a) => a.post_id === p.id).map((a) => ({ userId: a.user_id, name: names.get(a.user_id) ?? "Alguém", at: a.created_at }));
    return { ...p, acks: list, mine: list.some((a) => a.userId === my.id), author: names.get(p.created_by ?? "") ?? "Reach" };
  });
}

export async function listTeamForAcks(): Promise<{ id: string; name: string }[]> {
  if (isDemoMode()) return DEMO_TEAM.map((t) => ({ id: t.id, name: t.name }));
  const { data } = await supabase.from("profiles").select("id, display_name, email, active, role");
  const { data: roles } = await supabase.from("user_roles").select("user_id, role");
  const agency = new Set(((roles ?? []) as any[]).filter((r) => r.role !== "client").map((r) => r.user_id));
  return ((data ?? []) as any[]).filter((p) => p.active !== false && agency.has(p.id)).map((p) => ({ id: p.id, name: p.display_name || p.email }));
}

export async function toggleAck(postId: string, on: boolean) {
  if (isDemoMode()) {
    const s = demo();
    s.acks = s.acks.filter((a) => !(a.post_id === postId && a.user_id === DEMO_ME.id));
    if (on) s.acks.push({ post_id: postId, user_id: DEMO_ME.id, created_at: new Date().toISOString() });
    return;
  }
  if (on) await ackPost(postId);
  else await unackPost(postId);
}

export async function savePost(input: { id?: string; title: string; content: string; kind: string; pinned: boolean }) {
  if (isDemoMode()) {
    const s = demo();
    const now = new Date().toISOString();
    if (input.id) s.posts = s.posts.map((p) => (p.id === input.id ? { ...p, ...input, updated_at: now } : p));
    else s.posts.unshift({ id: `p${Date.now()}`, created_by: DEMO_ME.id, created_at: now, updated_at: now, ...input });
    return;
  }
  if (input.id) await updateAgencyPost(input.id, { title: input.title, content: input.content, kind: input.kind, pinned: input.pinned });
  else await createAgencyPost({ title: input.title, content: input.content, kind: input.kind, pinned: input.pinned });
}

export async function removePost(id: string) {
  if (isDemoMode()) { const s = demo(); s.posts = s.posts.filter((p) => p.id !== id); s.acks = s.acks.filter((a) => a.post_id !== id); return; }
  await deleteAgencyPost(id);
}

// ----- Calendário -----------------------------------------------------------------------

export async function loadCalendar(startISO: string, endISO: string): Promise<{ marcos: AgendaEntry[]; prazos: AgendaEntry[]; reunioes: AgendaEntry[]; brands: BrandLite[] }> {
  const brands = await listBrandsLite();
  const inRange = (d: string) => d >= startISO && d <= endISO;
  if (isDemoMode()) {
    return { marcos: demo().events.map(eventToEntry).filter((e) => inRange(e.date)), prazos: demoPrazos().filter((e) => inRange(e.date)), reunioes: demoReunioes().filter((e) => inRange(e.date)), brands };
  }
  const [events, tasks, meets] = await Promise.all([
    listAgencyEvents(),
    supabase.from("workspace_tasks").select("id,title,due_date,status,brand_id,owner_name").gte("due_date", startISO).lte("due_date", endISO),
    supabase.from("espaco360_calendar_events").select("id,title,event_date,start_time,brand_id,responsible,event_type").eq("event_type", "reuniao").gte("event_date", startISO).lte("event_date", endISO),
  ]);
  return {
    marcos: events.map(eventToEntry).filter((e) => inRange(e.date)),
    prazos: ((tasks.data ?? []) as any[]).map((t) => ({ id: t.id, layer: "prazo" as const, title: t.title, date: t.due_date, brandId: t.brand_id, who: t.owner_name, status: t.status })),
    reunioes: ((meets.data ?? []) as any[]).map((m) => ({ id: m.id, layer: "reuniao" as const, title: m.title, date: m.event_date, time: m.start_time, brandId: m.brand_id, who: m.responsible })),
    brands,
  };
}

export async function saveEvent(input: Partial<AgencyEvent> & { title: string; event_date: string }) {
  if (isDemoMode()) {
    const s = demo();
    if (input.id) s.events = s.events.map((e) => (e.id === input.id ? { ...e, ...input } as AgencyEvent : e));
    else s.events.push({ id: `e${Date.now()}`, category: "evento", status: "planejado", event_time: null, brand_id: null, responsible: null, description: null, notes: null, created_at: new Date().toISOString(), ...input } as AgencyEvent);
    return;
  }
  const { id, ...rest } = input;
  if (id) await updateAgencyEvent(id, rest);
  else await createAgencyEvent(rest as Partial<AgencyEvent> & { title: string; event_date: string });
}

export async function removeEvent(id: string) {
  if (isDemoMode()) { const s = demo(); s.events = s.events.filter((e) => e.id !== id); return; }
  await deleteAgencyEvent(id);
}
