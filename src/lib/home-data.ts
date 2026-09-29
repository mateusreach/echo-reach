// ---------------------------------------------------------------------------
// HOME DO ECHO — camada de dados
//
// Com o Supabase conectado, lê os dados reais de acordo com o papel da pessoa
// (a RLS decide o que cada um vê). Sem as variáveis do Supabase (ambiente local
// sem banco), entra em MODO DEMONSTRAÇÃO com dados de exemplo claramente
// identificados na interface.
// ---------------------------------------------------------------------------
import { supabase } from "@/integrations/supabase/client";
import { getAccess } from "@/lib/agency-data";
import { brandModules, myBrands, strategyProgress } from "@/lib/reach-data";
import { addDays, frontRisk, listFrontsWithRisk, RISK_LABELS, toISO, today, type RiskLevel } from "@/lib/workspace-data";

export type EnvId = "brand" | "workspace" | "like" | "e360";
export type Tone = "late" | "soon" | "ok";

export type HomeItem = {
  id: string;
  title: string;
  meta: string;
  client?: string;
  due?: string | null;
  tone?: Tone;
  badge?: { label: string; tone: "late" | "adjust" | "review" | "doing" | "done" | "todo" | "approved" | "blocked" };
  href?: string;
};

export type EnvSummary = {
  id: EnvId;
  available: boolean;
  reason?: string;
  count: number;
  label: string;
  sub?: string;
  href?: string;
};

export type HomeData = {
  mode: "live" | "demo";
  role: "team" | "client";
  isAdmin: boolean;
  person: { name: string; firstName: string };
  envs: EnvSummary[];
  team?: {
    myTasks: HomeItem[];
    myTasksTotal: number;
    waitingClient: HomeItem[];
    coverage: (HomeItem & { level: RiskLevel })[];
    requests: HomeItem[];
  };
  client?: {
    brand: { name: string; slug: string; logoUrl?: string | null; segment?: string | null };
    toDecide: HomeItem[];
    upcoming: HomeItem[];
    requests: HomeItem[];
    plan: { percent: number; done: number; total: number };
  };
  nextCommitment?: HomeItem | null;
};

export function isDemoMode() {
  const env = import.meta.env as Record<string, string | undefined>;
  return !env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_PUBLISHABLE_KEY;
}

// ----- utilitários -----------------------------------------------------------

function diffDays(iso?: string | null) {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Math.round((new Date(y, m - 1, d).getTime() - today().getTime()) / 86_400_000);
}
export function relDay(iso?: string | null): string {
  const n = diffDays(iso);
  if (n === null) return "Sem prazo";
  if (n === 0) return "Hoje";
  if (n === 1) return "Amanhã";
  if (n === -1) return "Ontem";
  if (n < 0) return `Há ${-n} dias`;
  if (n < 7) return `Em ${n} dias`;
  const [, m, d] = iso!.slice(0, 10).split("-");
  return `${d}/${m}`;
}
function tone(iso?: string | null): Tone {
  const n = diffDays(iso);
  if (n === null) return "ok";
  return n < 0 ? "late" : n <= 1 ? "soon" : "ok";
}
const first = (name: string) => name.trim().split(/\s+/)[0] ?? "";
const WORK_BADGE: Record<string, HomeItem["badge"]> = {
  Parada: { label: "Parada", tone: "todo" },
  Iniciada: { label: "Iniciada", tone: "doing" },
  "Avaliação interna": { label: "Avaliação interna", tone: "review" },
  "Aguardando retorno externo": { label: "Aguardando retorno externo", tone: "adjust" },
  Ajuste: { label: "Ajuste", tone: "adjust" },
  "Avaliação externa": { label: "Avaliação externa", tone: "review" },
  Concluído: { label: "Concluído", tone: "done" },
};

// ----- dados reais -----------------------------------------------------------

async function count(table: string, apply: (q: any) => any): Promise<number> {
  const { count: n, error } = await apply((supabase as any).from(table).select("id", { count: "exact", head: true }));
  if (error) return 0;
  return n ?? 0;
}

async function loadLive(): Promise<HomeData | "unauthenticated"> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return "unauthenticated";
  const access = await getAccess();
  const { data: profile } = await supabase.from("profiles").select("display_name, email").eq("id", access.userId!).maybeSingle();
  const name = profile?.display_name || profile?.email || session.session.user.email || "";
  const todayISO = toISO(today());

  if (access.isAgency) {
    const [tasksRes, externalRes, fronts, reqRes, brandsRes, openTasks] = await Promise.all([
      supabase.from("workspace_tasks").select("id,title,due_date,status,brands(name,slug)").eq("owner_id", access.userId!).neq("status", "Concluído").order("due_date", { ascending: true, nullsFirst: false }).limit(40),
      supabase.from("workspace_tasks").select("id,title,due_date,status,updated_at,brands(name,slug)").eq("status", "Avaliação externa").order("updated_at", { ascending: true }).limit(20),
      listFrontsWithRisk().catch(() => []),
      supabase.from("solicitacoes").select("id,title,due_date,status,created_at,brands(name,slug)").eq("status", "nova").order("created_at", { ascending: false }).limit(6),
      supabase.from("brands").select("id,modules,status"),
      count("workspace_tasks", (q) => q.neq("status", "Concluído")),
    ]);
    const tasks = (tasksRes.data ?? []) as any[];
    const dueNow = tasks.filter((t) => t.due_date && t.due_date <= todayISO);
    const brands = (brandsRes.data ?? []) as any[];
    const lateAll = await count("workspace_tasks", (q) => q.neq("status", "Concluído").lt("due_date", todayISO));
    const with360 = brands.filter((b) => brandModules(b).espaco360).length;
    const requestsNew = await count("solicitacoes", (q) => q.eq("status", "nova"));
    const external = (externalRes.data ?? []) as any[];
    const risky = fronts.filter((f) => f.level === "red" || f.level === "orange");

    return {
      mode: "live",
      role: "team",
      isAdmin: access.isAdmin,
      person: { name, firstName: first(name) },
      envs: [
        { id: "brand", available: true, count: brands.filter((b) => brandModules(b).biblioteca).length, label: "clientes com biblioteca", href: "/clientes" },
        { id: "workspace", available: true, count: openTasks, label: "tarefas abertas", sub: lateAll ? `${lateAll} atrasadas` : "nenhuma atrasada", href: "/workspace" },
        { id: "like", available: true, count: external.length, label: "em avaliação externa", sub: "vão para o Like", href: "/like" },
        { id: "e360", available: with360 > 0, reason: "Nenhum cliente com Espaço 360", count: requestsNew, label: "solicitações novas", sub: `${with360} espaços ativos`, href: "/e360" },
      ],
      team: {
        myTasksTotal: dueNow.length,
        myTasks: dueNow.slice(0, 6).map((t) => ({
          id: t.id, title: t.title, client: t.brands?.name, meta: t.brands?.name ?? "Sem cliente", due: t.due_date, tone: tone(t.due_date),
          badge: WORK_BADGE[t.status], href: t.brands?.slug ? `/workspace/cliente/${t.brands.slug}` : "/workspace/agenda",
        })),
        waitingClient: external.filter((t) => (diffDays(t.updated_at?.slice(0, 10)) ?? 0) <= -2).slice(0, 5).map((t) => ({
          id: t.id, title: t.title, client: t.brands?.name, meta: `${t.brands?.name ?? ""} · aguardando há ${-(diffDays(t.updated_at?.slice(0, 10)) ?? 0)} dias`,
          tone: "soon" as Tone, badge: { label: "Avaliação externa", tone: "review" as const }, href: "/workspace/avaliacoes",
        })),
        coverage: risky.slice(0, 5).map((f) => ({
          id: f.front.id, title: `${f.brand.name} · ${f.front.name}`, client: f.brand.name, level: f.level,
          meta: f.front.approved_until ? `Aprovado até ${f.front.approved_until.slice(8, 10)}/${f.front.approved_until.slice(5, 7)} · antecedência ${f.front.lead_days ?? 0}d` : "Sem data de aprovação",
          badge: { label: RISK_LABELS[f.level], tone: f.level === "red" ? "late" : "adjust" }, href: "/workspace/controle",
        })),
        requests: ((reqRes.data ?? []) as any[]).map((r) => ({
          id: r.id, title: r.title, client: r.brands?.name, meta: `${r.brands?.name ?? ""} · ${relDay(r.created_at?.slice(0, 10))}`, due: r.due_date, tone: tone(r.due_date),
          badge: { label: "Nova", tone: "todo" as const }, href: r.brands?.slug ? `/e360/${r.brands.slug}?tab=Solicitações` : "/e360",
        })),
      },
    };
  }

  // Cliente
  const mine = await myBrands().catch(() => []);
  const brand = mine.find((b) => brandModules(b).espaco360) ?? mine[0];
  if (!brand) return "unauthenticated";
  const has360 = brandModules(brand).espaco360;
  const [eventsRes, reqRes, initRes] = await Promise.all([
    supabase.from("espaco360_calendar_events").select("id,title,event_date,start_time,event_type").eq("brand_id", brand.id).gte("event_date", todayISO).order("event_date").limit(5),
    supabase.from("solicitacoes").select("id,title,status,due_date").eq("brand_id", brand.id).not("status", "in", "(concluida,cancelada)").order("created_at", { ascending: false }).limit(5),
    supabase.from("espaco360_initiatives").select("status").eq("brand_id", brand.id),
  ]);
  const prog = strategyProgress((initRes.data ?? []) as { status: string }[]);
  const REQ: Record<string, HomeItem["badge"]> = {
    nova: { label: "Nova", tone: "todo" }, em_analise: { label: "Em análise", tone: "review" }, aprovada: { label: "Aprovada", tone: "approved" },
    em_execucao: { label: "Em execução", tone: "doing" }, aguardando_cliente: { label: "Aguardando você", tone: "adjust" },
  };
  const upcoming = ((eventsRes.data ?? []) as any[]).map((e) => ({
    id: e.id, title: e.title, meta: `${relDay(e.event_date)}${e.start_time ? ` · ${e.start_time.slice(0, 5)}` : ""}`, due: e.event_date, tone: "ok" as Tone,
    href: `/e360/${brand.slug}/agenda`,
  }));
  return {
    mode: "live",
    role: "client",
    isAdmin: false,
    person: { name, firstName: first(name) },
    envs: [
      { id: "like", available: true, count: 0, label: "materiais para decidir", href: "/like" },
      { id: "e360", available: has360, reason: "Espaço 360 não contratado", count: (reqRes.data ?? []).length, label: "solicitações em andamento", href: `/e360/${brand.slug}` },
      { id: "brand", available: brandModules(brand).biblioteca, reason: "Biblioteca não contratada", count: prog.total, label: "estratégias no plano", href: `/b/${brand.slug}/biblioteca` },
    ],
    client: {
      brand: { name: brand.name, slug: brand.slug, logoUrl: brand.logo_url, segment: brand.segment },
      toDecide: [],
      upcoming,
      requests: ((reqRes.data ?? []) as any[]).map((r) => ({
        id: r.id, title: r.title, meta: r.due_date ? `Prazo ${relDay(r.due_date)}` : "Sem prazo", badge: REQ[r.status] ?? { label: r.status, tone: "todo" as const },
        href: `/e360/${brand.slug}?tab=Solicitações`,
      })),
      plan: { percent: prog.percent, done: prog.done, total: prog.total },
    },
    nextCommitment: upcoming[0] ?? null,
  };
}

// ----- demonstração ----------------------------------------------------------

function demo(role: "team" | "client"): HomeData {
  const d = (n: number) => toISO(addDays(today(), n));
  const front = (brand: string, name: string, approved: number, lead: number) => {
    const approved_until = d(approved);
    const r = frontRisk({ approved_until, lead_days: lead });
    return {
      id: `${brand}-${name}`, title: `${brand} · ${name}`, client: brand, level: r.level,
      meta: `Aprovado até ${approved_until.slice(8, 10)}/${approved_until.slice(5, 7)} · antecedência ${lead}d`,
      badge: { label: RISK_LABELS[r.level], tone: r.level === "red" ? ("late" as const) : ("adjust" as const) }, href: "/workspace/controle",
    };
  };
  if (role === "team")
    return {
      mode: "demo",
      role,
      isAdmin: true,
      person: { name: "Helena Duarte", firstName: "Helena" },
      envs: [
        { id: "brand", available: true, count: 11, label: "clientes com biblioteca", sub: "38 ideias a construir", href: "/clientes" },
        { id: "workspace", available: true, count: 47, label: "tarefas abertas", sub: "6 atrasadas", href: "/workspace" },
        { id: "like", available: true, count: 9, label: "em avaliação externa", sub: "vão para o Like", href: "/like" },
        { id: "e360", available: true, count: 4, label: "solicitações novas", sub: "3 espaços ativos", href: "/e360" },
      ],
      team: {
        myTasksTotal: 5,
        myTasks: [
          { id: "t1", title: "Legendas do Feed · semana 12/10", client: "Fina Fragrância", meta: "Fina Fragrância · Criação / Entrega", due: d(-2), tone: "late", badge: { label: "Ajuste", tone: "adjust" }, href: "/workspace" },
          { id: "t2", title: "Roteiro do Reels de lançamento", client: "Zelus", meta: "Zelus · Conteúdo", due: d(-1), tone: "late", badge: { label: "Iniciada", tone: "doing" }, href: "/workspace" },
          { id: "t3", title: "Artes do carrossel “Cachos no inverno”", client: "Gaby Mota Cachos", meta: "Gaby Mota Cachos · Criação / Entrega", due: d(0), tone: "soon", badge: { label: "Avaliação interna", tone: "review" }, href: "/workspace" },
          { id: "t4", title: "Briefing do Stories de outubro", client: "Isabela Gomes", meta: "Isabela Gomes · Criação / Entrega", due: d(0), tone: "soon", badge: { label: "Parada", tone: "todo" }, href: "/workspace" },
          { id: "t5", title: "Estratégia do ciclo 13 a 19/10", client: "Spirale", meta: "Spirale · Planejamento", due: d(0), tone: "soon", badge: { label: "Iniciada", tone: "doing" }, href: "/workspace" },
        ],
        waitingClient: [
          { id: "w1", title: "Carrossel “Notas de outono”", client: "Fina Fragrância", meta: "Fina Fragrância · aguardando há 4 dias", tone: "late", badge: { label: "Avaliação externa", tone: "review" }, href: "/workspace/avaliacoes" },
          { id: "w2", title: "Vídeo de bastidores da loja", client: "A Emporium", meta: "A Emporium · aguardando há 3 dias", tone: "soon", badge: { label: "Avaliação externa", tone: "review" }, href: "/workspace/avaliacoes" },
          { id: "w3", title: "Post “Pão quentinho às 7h”", client: "Pão de Queijo da Maria", meta: "Pão de Queijo da Maria · aguardando há 2 dias", tone: "soon", badge: { label: "Avaliação externa", tone: "review" }, href: "/workspace/avaliacoes" },
        ],
        coverage: [front("Eliza", "Stories", -2, 3), front("Zelus", "Stories", 1, 3), front("Fina Fragrância", "TikTok", 2, 4), front("Esense", "Feed", 3, 5)].filter((f) => f.level !== "green"),
        requests: [
          { id: "s1", title: "Campanha de Dia das Crianças", client: "Isabela Gomes", meta: "Isabela Gomes · Hoje", due: d(9), tone: "ok", badge: { label: "Nova", tone: "todo" }, href: "/e360" },
          { id: "s2", title: "Ajustar horário dos Stories de sexta", client: "Zelus", meta: "Zelus · Ontem", due: d(2), tone: "ok", badge: { label: "Nova", tone: "todo" }, href: "/e360" },
          { id: "s3", title: "Fotos novas da coleção de velas", client: "Fina Fragrância", meta: "Fina Fragrância · Há 2 dias", due: d(5), tone: "ok", badge: { label: "Nova", tone: "todo" }, href: "/e360" },
        ],
      },
    };
  const upcoming: HomeItem[] = [
    { id: "e1", title: "Reunião de planejamento de novembro", meta: `${relDay(d(1))} · 10:00`, due: d(1), tone: "ok" },
    { id: "e2", title: "Publicação: carrossel “Notas de outono”", meta: `${relDay(d(3))} · 19:00`, due: d(3), tone: "ok" },
    { id: "e3", title: "Gravação na loja do Centro", meta: `${relDay(d(6))} · 14:30`, due: d(6), tone: "ok" },
  ];
  return {
    mode: "demo",
    role,
    isAdmin: false,
    person: { name: "Carla Mendes", firstName: "Carla" },
    envs: [
      { id: "like", available: true, count: 3, label: "materiais para decidir", sub: "o primeiro vence amanhã", href: "/like" },
      { id: "e360", available: true, count: 2, label: "solicitações em andamento", href: "/e360" },
      { id: "brand", available: true, count: 19, label: "estratégias no plano", sub: "leitura", href: "/clientes" },
    ],
    client: {
      brand: { name: "Fina Fragrância", slug: "fina-fragrancia", segment: "Perfumaria artesanal" },
      toDecide: [
        { id: "l1", title: "Carrossel “Notas de outono”", meta: "Carrossel · 6 imagens · versão 2", due: d(1), tone: "soon", badge: { label: "Nova versão", tone: "review" } },
        { id: "l2", title: "Reels “Como escolher sua fragrância”", meta: "Reels · 0:34 · versão 1", due: d(2), tone: "ok", badge: { label: "Aguardando", tone: "todo" } },
        { id: "l3", title: "Post “Kit presente de Natal”", meta: "Post · 1080×1350 · versão 1", due: d(4), tone: "ok", badge: { label: "Aguardando", tone: "todo" } },
      ],
      upcoming,
      requests: [
        { id: "r1", title: "Fotos novas da coleção de velas", meta: `Prazo ${relDay(d(5))}`, badge: { label: "Em execução", tone: "doing" } },
        { id: "r2", title: "Texto para o site: página Sobre", meta: `Prazo ${relDay(d(12))}`, badge: { label: "Em análise", tone: "review" } },
      ],
      plan: { percent: 42, done: 8, total: 19 },
    },
    nextCommitment: upcoming[0],
  };
}

export async function loadHome(demoRole: "team" | "client"): Promise<HomeData | "unauthenticated"> {
  if (isDemoMode()) return demo(demoRole);
  return loadLive();
}
