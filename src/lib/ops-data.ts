// ---------------------------------------------------------------------------
// WORKSPACE — operação (páginas 12–15)
//
// Frentes com risco de cobertura, tarefas nas 7 etapas oficiais e entregas de
// ciclo. Com Supabase, lê workspace_fronts / workspace_tasks e usa as RPCs
// idempotentes; sem banco, usa o roster real de clientes em memória.
// ---------------------------------------------------------------------------
import { supabase } from "@/integrations/supabase/client";
import { ROSTER } from "@/lib/clients-data";
import { addDays, frontPeriod, frontRisk, listFrontsWithRisk, toISO, today, updateTask, WORK_STATUSES, type Front, type FrontWithRisk, type WorkStatus } from "@/lib/workspace-data";
import { ensureFrontWorkOrder } from "@/lib/work-orders";
import { isDemoMode } from "@/lib/home-data";

const db = supabase as any;
const iso = (n: number) => toISO(addDays(today(), n));
const nowISO = () => new Date().toISOString();

export type OpsTask = {
  id: string;
  title: string;
  brand: { id: string; name: string; slug: string };
  frontId: string | null;
  frontName: string | null;
  workOrderId: string | null;
  status: WorkStatus;
  owner: string | null;
  due: string | null;
  sector: string | null;
  note: string | null;
  requiresReview: boolean;
  /** Desde quando está na etapa atual (para “aguardando o cliente há N dias”). */
  since: string;
  remindedAt: string | null;
  likeMaterial: string | null;
  time?: string | null;
  location?: string | null;
  urgency?: string | null;
  highlighted?: boolean;
  pinned?: boolean;
  reviewChecklist?: string | null;
  reviewText?: string | null;
  attachments?: { name: string; url: string }[];
  completedAt?: string | null;
  ownerId?: string | null;
};

export const DONE: WorkStatus = "Concluído";
export const isLateTask = (t: OpsTask) => !!t.due && t.due < iso(0) && t.status !== DONE;
export const daysSince = (isoDate: string) => Math.max(0, Math.round((today().getTime() - new Date(isoDate.slice(0, 10) + "T00:00:00").getTime()) / 86_400_000));

// ----- exemplo em memória -----------------------------------------------------

const TEAM = ["Helena Duarte", "Rafael Monteiro", "Camila Rocha", "Bruno Tavares", "Marina Lopes", "Theo Almeida"];
const FEED_STEPS: [string, string, string | null][] = [["Estratégia", "Planejamento", null], ["Roteiros", "Conteúdo", "roteiro"], ["Pré produção", "Estratégia", null], ["Briefing", "Criação / Entrega", null], ["Artes", "Criação / Entrega", "carrossel"], ["Vídeos", "Criação / Entrega", "video"], ["Legendas", "Criação / Entrega", "texto"]];
type DemoOps = { fronts: FrontWithRisk[]; tasks: OpsTask[]; cycles: Map<string, string> };
let store: DemoOps | null = null;

function buildDemo(): DemoOps {
  const fronts: FrontWithRisk[] = [];
  const tasks: OpsTask[] = [];
  let n = 0;
  ROSTER.forEach(([name, slug, , fr], ci) => {
    const brand = { id: `b-${slug}`, name, slug, logo_url: null };
    fr.forEach(([fname, until, lead], fi) => {
      const front: Front = { id: `${slug}-${fi}`, brand_id: brand.id, name: fname, recurrence: "weekly", approved_until: until, lead_days: lead, one_off_date: null, pending_start: null, pending_end: null, order_index: fi, template_id: null, created_at: nowISO(), updated_at: nowISO() } as Front;
      fronts.push({ front, brand, ...frontRisk(front), period: frontPeriod(front) });
      // Ciclo em andamento: as etapas do modelo Feed em pontos diferentes do fluxo.
      const stageAt = (ci + fi * 3) % 7;
      FEED_STEPS.forEach(([title, sector, like], si) => {
        if (fname !== "Feed" && si > 4) return;
        const status: WorkStatus = si < stageAt ? DONE : si === stageAt ? (WORK_STATUSES[(ci + fi) % 6] as WorkStatus) : "Parada";
        const due = iso(((ci + si) % 7) - 2);
        tasks.push({
          id: `t${++n}`, title: `${title} · ${fname}`, brand: { id: brand.id, name, slug }, frontId: front.id, frontName: fname, workOrderId: `wo-${front.id}`,
          status, owner: (ci + si) % 9 === 0 ? null : TEAM[(ci + si) % TEAM.length], due, sector, note: null, requiresReview: !!like,
          since: new Date(Date.now() - (((ci + si) % 6) + 1) * 86400e3).toISOString(), remindedAt: null, likeMaterial: like,
        });
      });
    });
  });
  // A pessoa do exemplo (Helena) tem algumas tarefas para hoje.
  tasks.filter((t) => t.status !== DONE && t.due && t.due <= iso(0)).slice(0, 4).forEach((t, i) => { t.owner = "Helena Duarte"; if (i < 2) t.due = iso(0); });
  return { fronts, tasks, cycles: new Map() };
}
const demo = () => (store ??= buildDemo());
/** Acesso ao exemplo em memória para as telas de operação por cliente. */
export const demoOps = () => demo();

// ----- leitura ----------------------------------------------------------------

export async function listOpsFronts(): Promise<FrontWithRisk[]> {
  if (isDemoMode()) {
    const d = demo();
    d.fronts = d.fronts.map((f) => ({ ...f, ...frontRisk(f.front), period: frontPeriod(f.front) }));
    const order = { red: 0, orange: 1, yellow: 2, green: 3 } as const;
    return structuredClone(d.fronts).sort((a, b) => order[a.level] - order[b.level] || a.slack - b.slack);
  }
  return listFrontsWithRisk();
}

export async function listOpsTasks(): Promise<OpsTask[]> {
  if (isDemoMode()) return structuredClone(demo().tasks);
  const { data, error } = await db
    .from("workspace_tasks")
    .select("id, title, status, owner_name, due_date, sector, note, requires_review, front_id, work_order_id, updated_at, started_at, event_time, location, urgency, highlighted, pinned, review_checklist, review_text, attachments, completed_at, owner_id, brands!inner(id, name, slug), workspace_fronts(name)")
    .order("due_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return ((data ?? []) as any[]).map((t) => ({
    id: t.id, title: t.title, brand: t.brands, frontId: t.front_id, frontName: t.workspace_fronts?.name ?? null, workOrderId: t.work_order_id,
    status: t.status, owner: t.owner_name, due: t.due_date, sector: t.sector, note: t.note, requiresReview: !!t.requires_review,
    since: t.updated_at ?? t.started_at ?? nowISO(), remindedAt: null, likeMaterial: null,
    time: t.event_time, location: t.location, urgency: t.urgency, highlighted: !!t.highlighted, pinned: !!t.pinned, reviewChecklist: t.review_checklist, reviewText: t.review_text, attachments: Array.isArray(t.attachments) ? t.attachments : [], completedAt: t.completed_at, ownerId: t.owner_id,
  }));
}

export async function myName(): Promise<string> {
  if (isDemoMode()) return "Helena Duarte";
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) return "";
  const { data: p } = await db.from("profiles").select("display_name, email").eq("id", id).maybeSingle();
  return p?.display_name ?? p?.email ?? "";
}

// ----- escrita ----------------------------------------------------------------

export const EXTERNAL: WorkStatus = "Avaliação externa";
/** A avaliação externa é do cliente (no Like): a equipe não conclui por ele. */
export class ClientDecisionRequired extends Error { constructor() { super("Esta tarefa está com o cliente. Só a decisão dele no Like conclui a avaliação externa."); } }

export async function setTaskStatus(id: string, status: WorkStatus, opts: { from?: WorkStatus; override?: boolean } = {}) {
  if (isDemoMode()) {
    const t = demo().tasks.find((x) => x.id === id);
    if (t && t.status === EXTERNAL && status === DONE && !opts.override) throw new ClientDecisionRequired();
    if (t) { t.status = status; t.since = nowISO(); if (status === DONE) t.completedAt = toISO(today()); }
    return;
  }
  if (!opts.override && status === DONE) {
    const cur = opts.from ?? ((await db.from("workspace_tasks").select("status").eq("id", id).maybeSingle()).data?.status as WorkStatus | undefined);
    if (cur === EXTERNAL) throw new ClientDecisionRequired();
  }
  await updateTask(id, { status, ...(status === DONE ? { completed_at: nowISO() } : {}), ...(status === "Iniciada" ? { started_at: nowISO() } : {}) } as never);
}

export type TaskPatch = Partial<Pick<OpsTask, "owner" | "due" | "note" | "sector" | "title" | "time" | "location" | "urgency" | "highlighted" | "pinned" | "requiresReview" | "reviewChecklist" | "reviewText">>;
export async function patchTask(id: string, patch: TaskPatch) {
  if (isDemoMode()) { const t = demo().tasks.find((x) => x.id === id); if (t) Object.assign(t, patch); return; }
  const row: Record<string, unknown> = {};
  if ("owner" in patch) row.owner_name = patch.owner;
  if ("due" in patch) row.due_date = patch.due;
  if ("note" in patch) row.note = patch.note;
  if ("sector" in patch) row.sector = patch.sector;
  if ("title" in patch) row.title = patch.title;
  if ("time" in patch) row.event_time = patch.time;
  if ("location" in patch) row.location = patch.location;
  if ("urgency" in patch) row.urgency = patch.urgency;
  if ("highlighted" in patch) row.highlighted = patch.highlighted;
  if ("pinned" in patch) row.pinned = patch.pinned;
  if ("requiresReview" in patch) row.requires_review = patch.requiresReview;
  if ("reviewChecklist" in patch) row.review_checklist = patch.reviewChecklist;
  if ("reviewText" in patch) row.review_text = patch.reviewText;
  await updateTask(id, row as never);
}

/** Cria (ou devolve) a entrega do próximo ciclo da frente — nunca duplica. */
export async function ensureCycle(f: FrontWithRisk): Promise<{ created: boolean; workOrderId: string }> {
  if (isDemoMode()) {
    const d = demo();
    const key = `${f.front.id}:${f.period.start}:${f.period.end}`;
    if (d.cycles.has(key)) return { created: false, workOrderId: d.cycles.get(key)! };
    const id = `wo-${Math.random().toString(36).slice(2, 8)}`;
    d.cycles.set(key, id);
    return { created: true, workOrderId: id };
  }
  const r = await ensureFrontWorkOrder(f.front, f.period);
  return { created: r.created, workOrderId: r.workOrderId };
}

/** Lembrete ao cliente sobre um material parado em Avaliação externa. */
export async function remindClient(task: OpsTask) {
  if (isDemoMode()) { const t = demo().tasks.find((x) => x.id === task.id); if (t) t.remindedAt = nowISO(); return; }
  // O envio real (e-mail + notificação no Like) chega com a página 23; aqui registramos na tarefa.
  await updateTask(task.id, { note: `${task.note ? `${task.note}\n` : ""}Lembrete enviado ao cliente em ${new Date().toLocaleDateString("pt-BR")}.` } as never);
}

/** Tempo real: quando uma frente muda (ex.: aprovação no Like), avisa quem está vendo. */
export function subscribeFronts(onChange: (frontId: string) => void) {
  if (isDemoMode()) return () => undefined;
  const ch = supabase.channel("echo-fronts").on("postgres_changes" as never, { event: "UPDATE", schema: "public", table: "workspace_fronts" }, (payload: any) => onChange(payload.new?.id)).subscribe();
  return () => { supabase.removeChannel(ch); };
}

/** Simulação do Like no modo demonstração: aprova um post e avança a cobertura. */
export function demoApprove(frontId: string, until: string) {
  if (!isDemoMode()) return;
  const f = demo().fronts.find((x) => x.front.id === frontId);
  if (f) f.front.approved_until = until;
}

// ----- Demandas: criar, ações em massa (com desfazer) --------------------------------

export async function createOpsTask(input: { brand: { id: string; name: string; slug: string }; workOrderId: string | null; title: string; sector: string | null; owner: string | null; due: string | null }) {
  if (isDemoMode()) {
    demo().tasks.push({ id: `t-${Math.random().toString(36).slice(2, 8)}`, title: input.title, brand: input.brand, frontId: null, frontName: null, workOrderId: input.workOrderId, status: "Parada", owner: input.owner, due: input.due, sector: input.sector, note: null, requiresReview: false, since: nowISO(), remindedAt: null, likeMaterial: null });
    return;
  }
  const { error } = await db.from("workspace_tasks").insert({ brand_id: input.brand.id, work_order_id: input.workOrderId, title: input.title, sector: input.sector, owner_name: input.owner, due_date: input.due, status: "Parada" });
  if (error) throw error;
}

type Snapshot = Pick<OpsTask, "id" | "status" | "owner" | "due" | "sector">;
/** Aplica a mesma mudança a várias tarefas e devolve como desfazer. */
export async function bulkUpdate(tasks: OpsTask[], change: { status?: WorkStatus; owner?: string | null; shiftDays?: number; sector?: string | null }): Promise<() => Promise<void>> {
  const before: Snapshot[] = tasks.map((t) => ({ id: t.id, status: t.status, owner: t.owner, due: t.due, sector: t.sector }));
  for (const t of tasks) {
    if (change.status === DONE && t.status === EXTERNAL) continue; // decisão do cliente
    if (change.status) await setTaskStatus(t.id, change.status, { from: t.status });
    const p: TaskPatch = {};
    if ("owner" in change) p.owner = change.owner ?? null;
    if ("sector" in change) p.sector = change.sector ?? null;
    if (change.shiftDays && t.due) p.due = toISO(addDays(new Date(t.due + "T00:00:00"), change.shiftDays));
    if (Object.keys(p).length) await patchTask(t.id, p);
  }
  return async () => {
    for (const b of before) {
      if (change.status) await setTaskStatus(b.id, b.status, { override: true });
      await patchTask(b.id, { owner: b.owner, due: b.due, sector: b.sector });
    }
  };
}

// ----- Calendário: camadas de publicações aprovadas e reuniões -----------------------

export type CalendarLayerItem = { id: string; kind: "publicacao" | "reuniao"; title: string; date: string; brand: { name: string; slug: string } };
export async function listCalendarLayers(): Promise<CalendarLayerItem[]> {
  if (isDemoMode()) {
    const b = (slug: string, name: string) => ({ slug, name });
    return [
      { id: "p1", kind: "publicacao", title: "Carrossel “Notas de outono”", date: iso(2), brand: b("fina-fragrancia", "Fina Fragrância") },
      { id: "p2", kind: "publicacao", title: "Reels de lançamento", date: iso(5), brand: b("zelus", "Zelus") },
      { id: "p3", kind: "publicacao", title: "Guia: como guardar seu perfume", date: iso(4), brand: b("fina-fragrancia", "Fina Fragrância") },
      { id: "p4", kind: "publicacao", title: "Stories da semana", date: iso(1), brand: b("eliza", "Eliza") },
      { id: "m1", kind: "reuniao", title: "Alinhamento mensal", date: iso(3), brand: b("fina-fragrancia", "Fina Fragrância") },
      { id: "m2", kind: "reuniao", title: "Aprovação do plano de novembro", date: iso(8), brand: b("dra-giuliana", "Dra. Giuliana") },
    ];
  }
  const [pubs, meets] = await Promise.all([
    db.from("conteudos").select("id, title, publish_date, status, brands!inner(name, slug)").in("status", ["aprovada", "produzida", "publicada"]).not("publish_date", "is", null),
    db.from("espaco360_meetings").select("id, title, meeting_date, brands!inner(name, slug)"),
  ]);
  return [
    ...((pubs.data ?? []) as any[]).map((p) => ({ id: p.id, kind: "publicacao" as const, title: p.title, date: String(p.publish_date).slice(0, 10), brand: p.brands })),
    ...((meets.data ?? []) as any[]).map((m) => ({ id: m.id, kind: "reuniao" as const, title: m.title, date: String(m.meeting_date).slice(0, 10), brand: m.brands })),
  ];
}

/** Link "Adicionar ao Google Agenda" para uma tarefa com prazo (dia inteiro). */
export function googleCalendarLink(t: OpsTask) {
  if (!t.due) return null;
  const start = t.due.replace(/-/g, "");
  const endD = addDays(new Date(t.due + "T00:00:00"), 1);
  const end = toISO(endD).replace(/-/g, "");
  const params = new URLSearchParams({ action: "TEMPLATE", text: `${t.title} · ${t.brand.name}`, dates: `${start}/${end}`, details: `${t.frontName ? `Frente ${t.frontName} · ` : ""}Etapa: ${t.status}\nEcho · Workspace` });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}


// ----- Avaliações internas (página 15) ------------------------------------------------

export type TaskReview = { id: string; taskId: string; scope: "interna" | "externa" | "externa_excecao"; decision: "aprovado" | "ajuste"; phrases: string[]; comment: string | null; checklist: { item: string; ok: boolean }[]; reviewer: string | null; at: string };
const demoReviews: TaskReview[] = [];

export async function listTaskReviews(taskId: string): Promise<TaskReview[]> {
  if (isDemoMode()) return demoReviews.filter((r) => r.taskId === taskId).sort((a, b) => b.at.localeCompare(a.at));
  const { data } = await db.from("workspace_reviews").select("*").eq("task_id", taskId).order("created_at", { ascending: false });
  return ((data ?? []) as any[]).map((r) => ({ id: r.id, taskId: r.task_id, scope: r.scope, decision: r.decision, phrases: r.phrases ?? [], comment: r.comment, checklist: Array.isArray(r.checklist) ? r.checklist : [], reviewer: r.reviewer_name, at: r.created_at }));
}

async function writeReview(task: OpsTask, r: Omit<TaskReview, "id" | "taskId" | "at" | "reviewer">) {
  const reviewer = await myName();
  if (isDemoMode()) { demoReviews.push({ ...r, id: `rv-${Math.random().toString(36).slice(2, 8)}`, taskId: task.id, reviewer, at: nowISO() }); return; }
  const { error } = await db.from("workspace_reviews").insert({ task_id: task.id, brand_id: task.brand.id, scope: r.scope, decision: r.decision, phrases: r.phrases, comment: r.comment, checklist: r.checklist, reviewer_name: reviewer });
  if (error) throw error;
}

/**
 * Decisão interna. Aprovado: material do Like vai para Avaliação externa (o
 * cliente decide); o resto vai para Concluído. Ajuste: volta para Ajuste.
 */
export async function submitInternalReview(task: OpsTask, input: { decision: "aprovado" | "ajuste"; phrases: string[]; comment: string; checklist: { item: string; ok: boolean }[] }): Promise<WorkStatus> {
  await writeReview(task, { scope: "interna", decision: input.decision, phrases: input.phrases, comment: input.comment.trim() || null, checklist: input.checklist });
  const next: WorkStatus = input.decision === "ajuste" ? "Ajuste" : task.likeMaterial ? EXTERNAL : DONE;
  await setTaskStatus(task.id, next, { from: task.status });
  if (input.decision === "ajuste") await patchTask(task.id, { note: [task.note, `Ajuste pedido: ${[...input.phrases, input.comment.trim()].filter(Boolean).join(" · ")}`].filter(Boolean).join("\n") });
  return next;
}

/** Exceção de administrador: cliente aprovou por outro canal. Justificativa obrigatória, fica no histórico. */
export async function registerOutsideApproval(task: OpsTask, justification: string) {
  if (justification.trim().length < 10) throw new Error("Explique como o cliente aprovou (mínimo de 10 caracteres).");
  await writeReview(task, { scope: "externa_excecao", decision: "aprovado", phrases: ["Aprovado pelo cliente por outro canal"], comment: justification.trim(), checklist: [] });
  await setTaskStatus(task.id, DONE, { override: true });
}

// ----- Metas semanais (página 15) ---------------------------------------------------------

export type Goal = { id: string; title: string; scope: "geral" | "tarefa"; metric: "tarefas" | "entregas"; taskTitle: string | null; memberName: string | null; brandId: string | null; target: number; weekStart: string; recurring: boolean; reward: string | null };
let demoGoals: Goal[] | null = null;
const monday = (d = today()) => toISO(addDays(d, -((d.getDay() + 6) % 7)));
function goalsStore() {
  if (demoGoals) return demoGoals;
  const w = monday();
  demoGoals = [
    { id: "g1", title: "Fechar 20 tarefas na semana", scope: "geral", metric: "tarefas", taskTitle: null, memberName: null, brandId: null, target: 20, weekStart: toISO(addDays(new Date(`${w}T00:00:00`), -14)), recurring: true, reward: "Café da manhã da equipe na sexta" },
    { id: "g2", title: "Artes sem atraso", scope: "tarefa", metric: "tarefas", taskTitle: "Artes", memberName: "Marina Lopes", brandId: null, target: 4, weekStart: w, recurring: true, reward: "Sexta à tarde livre" },
    { id: "g3", title: "Roteiros da Fina", scope: "tarefa", metric: "tarefas", taskTitle: "Roteiros", memberName: null, brandId: "b-fina-fragrancia", target: 2, weekStart: w, recurring: false, reward: null },
  ];
  // Algumas conclusões nesta semana para o progresso aparecer no exemplo.
  const d = demo();
  d.tasks.filter((t) => t.status === DONE).slice(0, 14).forEach((t, i) => { t.completedAt = toISO(addDays(new Date(`${w}T00:00:00`), i % 2)); });
  return demoGoals;
}

export const weekOf = monday;
export async function listWeeklyGoals(): Promise<Goal[]> {
  if (isDemoMode()) return structuredClone(goalsStore());
  const { data, error } = await db.from("workspace_goals").select("*").eq("active", true).order("created_at");
  if (error) throw error;
  return ((data ?? []) as any[]).map((g) => ({ id: g.id, title: g.title, scope: g.scope, metric: g.metric, taskTitle: g.task_title, memberName: g.member_name, brandId: g.brand_id, target: g.target, weekStart: g.week_start, recurring: g.recurring, reward: g.reward }));
}

export async function saveWeeklyGoal(g: Omit<Goal, "id"> & { id?: string }) {
  if (isDemoMode()) { const s = goalsStore(); if (g.id) demoGoals = s.map((x) => (x.id === g.id ? { ...x, ...g } as Goal : x)); else s.push({ ...g, id: `g-${Math.random().toString(36).slice(2, 7)}` }); return; }
  const { saveGoal } = await import("@/lib/workspace-data");
  await saveGoal({ id: g.id, title: g.title, scope: g.scope, metric: g.metric, task_title: g.taskTitle, member_name: g.memberName, brand_id: g.brandId, target: g.target, week_start: g.weekStart, recurring: g.recurring, reward: g.reward } as never);
}

export async function removeWeeklyGoal(id: string) {
  if (isDemoMode()) { demoGoals = goalsStore().filter((g) => g.id !== id); return; }
  const { deleteGoal } = await import("@/lib/workspace-data");
  await deleteGoal(id);
}

export const goalApplies = (g: Goal, week: string) => (g.recurring ? g.weekStart <= week : g.weekStart === week);
export function weeklyProgress(g: Goal, week: string, tasks: OpsTask[]) {
  const end = toISO(addDays(new Date(`${week}T00:00:00`), 6));
  const done = tasks.filter((t) => t.status === DONE && t.completedAt && t.completedAt.slice(0, 10) >= week && t.completedAt.slice(0, 10) <= end
    && (g.scope !== "tarefa" || t.title.toLowerCase().startsWith((g.taskTitle ?? "").toLowerCase()))
    && (!g.brandId || t.brand.id === g.brandId) && (!g.memberName || (t.owner ?? "").toLowerCase() === g.memberName.toLowerCase())).length;
  return { done, target: g.target, percent: Math.min(100, Math.round((done / Math.max(1, g.target)) * 100)), reached: done >= g.target };
}
