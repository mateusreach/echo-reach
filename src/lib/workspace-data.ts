// ---------------------------------------------------------------------------
// WORKSPACE — camada de dados (operação e entregas)
//
// Porta da lógica do protótipo "Cliente nunca sem post" para a infraestrutura
// real do Reach: clientes são `brands` (cadastro único do ecossistema) e as
// pessoas são a mesma equipe do Brand. Nada de localStorage como banco.
// ---------------------------------------------------------------------------
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Front = Database["public"]["Tables"]["workspace_fronts"]["Row"];
export type WorkTask = Database["public"]["Tables"]["workspace_tasks"]["Row"];
export type WorkReview = Database["public"]["Tables"]["workspace_reviews"]["Row"];
export type WorkTemplate = Database["public"]["Tables"]["workspace_templates"]["Row"];
export type ClientTaskOwner = Database["public"]["Tables"]["workspace_client_task_owners"]["Row"];
export type WorkGoal = Database["public"]["Tables"]["workspace_goals"]["Row"];
export type WorkNote = Database["public"]["Tables"]["workspace_notes"]["Row"];

/** Os sete status oficiais do Workspace — etapa do processo, nunca prioridade. */
export const WORK_STATUSES = [
  "Parada",
  "Iniciada",
  "Avaliação interna",
  "Aguardando retorno externo",
  "Ajuste",
  "Avaliação externa",
  "Concluído",
] as const;
export type WorkStatus = (typeof WORK_STATUSES)[number];

export const RECURRENCES = {
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
  oneoff: "Avulsa",
} as const;
export type Recurrence = keyof typeof RECURRENCES;

export const REVIEW_PHRASES = [
  "Tudo certo",
  "Aprovado para seguir",
  "Ajustar texto",
  "Ajustar informação",
  "Ajustar estratégia",
  "Ajustar CTA",
  "Rever briefing",
  "Rever formato",
  "Falta informação",
  "Precisa complementar",
];

// ----- datas (fuso local, sem deslocamento de UTC) -------------------------

export function localDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}
export function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function today(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}
/** Data ISO (aaaa-mm-dd) no formato brasileiro dd/mm/aaaa, sem deslocamento de fuso. */
export function formatDateBR(iso?: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}
export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}
export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
}

// ----- inteligência "cliente nunca sem post" -------------------------------

export type RiskLevel = "red" | "orange" | "yellow" | "green";

export const RISK_LABELS: Record<RiskLevel, string> = {
  red: "Sem cobertura",
  orange: "Produzir agora",
  yellow: "Atenção",
  green: "Coberto",
};

/**
 * Risco de a frente ficar sem conteúdo: distância entre hoje e a data até a
 * qual o cliente está aprovado, descontada a antecedência mínima de produção.
 */
export function frontRisk(front: Pick<Front, "approved_until" | "lead_days">) {
  if (!front.approved_until) return { diff: 0, slack: 0, level: "red" as RiskLevel };
  const diff = Math.round((localDate(front.approved_until).getTime() - today().getTime()) / 86_400_000);
  const slack = diff - Number(front.lead_days ?? 0);
  const level: RiskLevel = diff < 0 ? "red" : slack <= 0 ? "orange" : slack <= 2 ? "yellow" : "green";
  return { diff, slack, level };
}

/** Período pendente da frente — o ciclo que precisa ser trabalhado a seguir. */
export function frontPeriod(front: Front): { start: string; end: string } {
  const base = front.approved_until ? localDate(front.approved_until) : today();
  const start = front.pending_start ? localDate(front.pending_start) : addDays(base, 1);
  let end: Date;
  if (front.pending_end) end = localDate(front.pending_end);
  else if (front.recurrence === "weekly") end = addDays(base, 7);
  else if (front.recurrence === "biweekly") end = addDays(base, 14);
  else if (front.recurrence === "monthly") end = addMonths(base, 1);
  else end = front.one_off_date ? localDate(front.one_off_date) : start;
  return { start: toISO(start), end: toISO(end) };
}

const RISK_ORDER: Record<RiskLevel, number> = { red: 0, orange: 1, yellow: 2, green: 3 };

export type FrontWithRisk = {
  front: Front;
  brand: { id: string; name: string; slug: string; logo_url: string | null };
  level: RiskLevel;
  diff: number;
  slack: number;
  period: { start: string; end: string };
};

/** Todas as frentes da organização, ordenadas do maior para o menor risco. */
export async function listFrontsWithRisk(): Promise<FrontWithRisk[]> {
  const { data, error } = await supabase
    .from("workspace_fronts")
    .select("*, brands!inner(id, name, slug, logo_url, modules)");
  if (error) throw error;

  return (data ?? [])
    .filter((row) => (row as any).brands?.modules?.workspace !== false)
    .map((row) => {
      const { brands, ...front } = row as any;
      return {
        front: front as Front,
        brand: brands,
        ...frontRisk(front),
        period: frontPeriod(front as Front),
      };
    })
    .sort((a, b) => RISK_ORDER[a.level] - RISK_ORDER[b.level] || a.slack - b.slack);
}

// ----- leituras -------------------------------------------------------------

export async function listWorkspaceBrands() {
  const { data, error } = await supabase
    .from("brands")
    .select("id, name, slug, logo_url, status, modules")
    .order("name");
  if (error) throw error;
  return (data ?? []).filter((b) => (b.modules as any)?.workspace !== false);
}

export async function listFronts(brandId: string): Promise<Front[]> {
  const { data, error } = await supabase
    .from("workspace_fronts")
    .select("*")
    .eq("brand_id", brandId)
    .order("order_index");
  if (error) throw error;
  return data ?? [];
}

export async function listTasks(filter: { brandId?: string; frontId?: string } = {}): Promise<WorkTask[]> {
  let q = supabase.from("workspace_tasks").select("*");
  if (filter.brandId) q = q.eq("brand_id", filter.brandId);
  if (filter.frontId) q = q.eq("front_id", filter.frontId);
  const { data, error } = await q.order("priority").order("created_at");
  if (error) throw error;
  return data ?? [];
}

/**
 * Tarefas em aberto de uma pessoa — base da "Minha agenda".
 * Vale pelo vínculo da conta (owner_id) e também pelo nome cadastrado na equipe,
 * para que a tarefa apareça mesmo quando o responsável foi escolhido pelo nome.
 */
export async function listMyTasks(userId: string): Promise<(WorkTask & { brands?: { name: string } | null })[]> {
  const { data: mine } = await supabase.from("team_members").select("name").eq("user_id", userId);
  const names = (mine ?? []).map((m) => m.name).filter(Boolean);
  const quoted = names.map((n) => `"${n.replace(/"/g, '\\"')}"`).join(",");
  const { data, error } = await supabase
    .from("workspace_tasks")
    .select("*, brands(name)")
    .or(names.length ? `owner_id.eq.${userId},owner_name.in.(${quoted})` : `owner_id.eq.${userId}`)
    .neq("status", "Concluído")
    .order("priority");
  if (error) throw error;
  return data ?? [];
}

/** Tarefas paradas em avaliação — base da área de Avaliações. */
export async function listTasksInReview(): Promise<WorkTask[]> {
  const { data, error } = await supabase
    .from("workspace_tasks")
    .select("*")
    .in("status", ["Avaliação interna", "Avaliação externa"])
    .order("priority");
  if (error) throw error;
  return data ?? [];
}

export async function listReviews(taskId: string): Promise<WorkReview[]> {
  const { data, error } = await supabase
    .from("workspace_reviews")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listTemplates(): Promise<WorkTemplate[]> {
  const { data, error } = await supabase.from("workspace_templates").select("*").order("name");
  if (error) throw error;
  return data ?? [];
}

/** Setores da operação (cadastro por organização). */
export async function listSectors() {
  const { data, error } = await supabase
    .from("workspace_sectors")
    .select("id, name")
    .order("order_index");
  if (error) throw error;
  return data ?? [];
}

export async function listNotes(): Promise<WorkNote[]> {
  const { data, error } = await supabase
    .from("workspace_notes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// ----- escritas -------------------------------------------------------------

async function orgId() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: p } = await supabase.from("profiles").select("organization_id").eq("id", data.user.id).maybeSingle();
  return p?.organization_id ?? null;
}

export async function createFront(input: Database["public"]["Tables"]["workspace_fronts"]["Insert"]) {
  const { data, error } = await supabase.from("workspace_fronts").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateFront(id: string, patch: Database["public"]["Tables"]["workspace_fronts"]["Update"]) {
  const { error } = await supabase.from("workspace_fronts").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteFront(id: string) {
  const { error } = await supabase.from("workspace_fronts").delete().eq("id", id);
  if (error) throw error;
}

export async function createTask(input: Database["public"]["Tables"]["workspace_tasks"]["Insert"]) {
  const { data, error } = await supabase.from("workspace_tasks").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateTask(id: string, patch: Database["public"]["Tables"]["workspace_tasks"]["Update"]) {
  const { error } = await supabase.from("workspace_tasks").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteTask(id: string) {
  const { error } = await supabase.from("workspace_tasks").delete().eq("id", id);
  if (error) throw error;
}

/** Muda o status registrando início e conclusão automaticamente. */
export async function changeTaskStatus(task: WorkTask, status: WorkStatus) {
  const patch: Database["public"]["Tables"]["workspace_tasks"]["Update"] = { status };
  if (status !== "Parada" && !task.started_at) patch.started_at = toISO(today());
  patch.completed_at = status === "Concluído" ? toISO(today()) : null;
  await updateTask(task.id, patch);
}

export async function createReview(input: Database["public"]["Tables"]["workspace_reviews"]["Insert"]) {
  const { data, error } = await supabase.from("workspace_reviews").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function createNote(text: string, author?: string) {
  const organization_id = await orgId();
  const { error } = await supabase.from("workspace_notes").insert({ text, author, organization_id });
  if (error) throw error;
}

export async function createTemplate(input: { name: string; kind: string; tasks: unknown }) {
  const organization_id = await orgId();
  const { error } = await supabase.from("workspace_templates").insert({ ...input, organization_id } as any);
  if (error) throw error;
}

export async function updateTemplate(id: string, patch: { name?: string; kind?: string; tasks?: unknown }) {
  const { error } = await supabase.from("workspace_templates").update(patch as any).eq("id", id);
  if (error) throw error;
}

export async function deleteTemplate(id: string) {
  const { error } = await supabase.from("workspace_templates").delete().eq("id", id);
  if (error) throw error;
}

export async function createSector(name: string, order_index = 0) {
  const organization_id = await orgId();
  const { error } = await supabase.from("workspace_sectors").insert({ name, order_index, organization_id } as any);
  if (error) throw error;
}

export async function deleteSector(id: string) {
  const { error } = await supabase.from("workspace_sectors").delete().eq("id", id);
  if (error) throw error;
}

/** Item de um modelo de demanda: o que sempre precisa existir naquele ciclo. */
export type TemplateTask = {
  title: string;
  sector?: string | null;
  owner_name?: string | null;
  /** Dias de antecedência em relação ao prazo da entrega. */
  days_before?: number | null;
  requires_review?: boolean | null;
};

export function templateTasks(t: WorkTemplate): TemplateTask[] {
  const raw = t.tasks as unknown;
  return Array.isArray(raw) ? (raw as TemplateTask[]).filter((x) => x && typeof x.title === "string") : [];
}

/** Cria de uma vez todas as demandas previstas por um modelo. */
export async function applyTemplate(
  template: WorkTemplate,
  target: { brand_id: string; front_id?: string | null; due_date?: string | null },
) {
  const items = templateTasks(template);
  if (items.length === 0) return 0;
  const rows = items.map((item, i) => ({
    brand_id: target.brand_id,
    front_id: target.front_id ?? null,
    title: item.title,
    sector: item.sector ?? null,
    due_date: target.due_date ?? null,
    status: "Parada",
    priority: i + 1,
  }));
  const { error } = await supabase.from("workspace_tasks").insert(rows as any);
  if (error) throw error;
  return rows.length;
}

export type ScheduledTask = WorkTask & { brands: { id: string; name: string; slug: string } | null };

/** Demandas com prazo dentro do mês — base do Cronograma. */
export async function listTasksInRange(startISO: string, endISO: string): Promise<ScheduledTask[]> {
  const { data, error } = await supabase
    .from("workspace_tasks")
    .select("*, brands(id, name, slug)")
    .gte("due_date", startISO)
    .lte("due_date", endISO)
    .order("due_date");
  if (error) throw error;
  return (data ?? []) as unknown as ScheduledTask[];
}

/** Tarefas de uma entrega, na ordem de execução do modelo. */
export async function listTasksByWorkOrder(workOrderIds: string[]): Promise<WorkTask[]> {
  if (workOrderIds.length === 0) return [];
  const { data, error } = await supabase
    .from("workspace_tasks")
    .select("*")
    .in("work_order_id", workOrderIds)
    .order("priority");
  if (error) throw error;
  return data ?? [];
}

// ----- responsáveis por cliente ---------------------------------------------

/** Pessoas que podem ser responsáveis: equipe cadastrada + contas da agência. */
export type Assignable = { name: string; user_id: string | null };

export async function listAssignableMembers(): Promise<Assignable[]> {
  const [team, profiles] = await Promise.all([
    supabase.from("team_members").select("name, user_id").eq("active", true).order("name"),
    supabase.from("profiles").select("id, display_name, email, role").eq("role", "agency"),
  ]);
  const out: Assignable[] = (team.data ?? []).map((m) => ({ name: m.name, user_id: m.user_id }));
  for (const p of profiles.data ?? []) {
    if (out.some((m) => m.user_id === p.id)) continue;
    const name = p.display_name || p.email || "";
    if (name && !out.some((m) => m.name.toLowerCase() === name.toLowerCase())) out.push({ name, user_id: p.id });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export async function listClientTaskOwners(brandId: string): Promise<ClientTaskOwner[]> {
  const { data, error } = await supabase.from("workspace_client_task_owners").select("*").eq("brand_id", brandId);
  if (error) throw error;
  return data ?? [];
}

export async function saveClientTaskOwner(input: {
  brandId: string;
  taskTitle: string;
  ownerName: string | null;
  ownerId: string | null;
  daysBefore: number | null;
}) {
  const { error } = await supabase.from("workspace_client_task_owners").upsert(
    {
      brand_id: input.brandId,
      task_title: input.taskTitle,
      owner_name: input.ownerName,
      owner_id: input.ownerId,
      days_before: input.daysBefore,
    },
    { onConflict: "brand_id,task_title" },
  );
  if (error) throw error;
}

// ----- metas semanais --------------------------------------------------------

/** Segunda-feira da semana de uma data (ISO aaaa-mm-dd). */
export function weekStartISO(d: Date = today()): string {
  const day = (d.getDay() + 6) % 7;
  return toISO(addDays(d, -day));
}

export async function listGoals(): Promise<WorkGoal[]> {
  const { data, error } = await supabase.from("workspace_goals").select("*").eq("active", true).order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function saveGoal(
  input: Omit<Database["public"]["Tables"]["workspace_goals"]["Insert"], "organization_id" | "created_by"> & { id?: string },
) {
  const organization_id = await orgId();
  if (!organization_id) throw new Error("Sua conta não está vinculada a uma agência.");
  const { data: auth } = await supabase.auth.getUser();
  const row = { ...input, organization_id, created_by: auth.user?.id ?? null };
  const { error } = input.id
    ? await supabase.from("workspace_goals").update(row).eq("id", input.id)
    : await supabase.from("workspace_goals").insert(row);
  if (error) throw error;
}

export async function deleteGoal(id: string) {
  const { error } = await supabase.from("workspace_goals").update({ active: false }).eq("id", id);
  if (error) throw error;
}

/** A meta vale na semana `week`? (a partir da semana inicial; sempre, se recorrente) */
export function goalAppliesToWeek(goal: Pick<WorkGoal, "week_start" | "recurring">, week: string) {
  return goal.recurring ? goal.week_start <= week : goal.week_start === week;
}

/**
 * Progresso de uma meta numa semana. Tarefas contam pela data de conclusão;
 * entregas (ordens de execução) pela data em que foram concluídas.
 */
export function goalProgress(
  goal: WorkGoal,
  week: string,
  tasks: Pick<WorkTask, "title" | "status" | "completed_at" | "brand_id" | "owner_id" | "owner_name">[],
  orders: { brand_id: string; status: string; updated_at: string }[],
) {
  const start = week;
  const end = toISO(addDays(localDate(week), 6));
  let done = 0;
  if (goal.metric === "entregas") {
    done = orders.filter(
      (o) => o.status === "Concluída" && o.updated_at.slice(0, 10) >= start && o.updated_at.slice(0, 10) <= end && (!goal.brand_id || o.brand_id === goal.brand_id),
    ).length;
  } else {
    done = tasks.filter((t) => {
      if (t.status !== "Concluído" || !t.completed_at) return false;
      if (t.completed_at < start || t.completed_at > end) return false;
      if (goal.scope === "tarefa" && (t.title ?? "").trim().toLowerCase() !== (goal.task_title ?? "").trim().toLowerCase()) return false;
      if (goal.brand_id && t.brand_id !== goal.brand_id) return false;
      if (goal.member_id || goal.member_name) {
        const byId = !!goal.member_id && t.owner_id === goal.member_id;
        const byName = !!goal.member_name && (t.owner_name ?? "").toLowerCase() === goal.member_name.toLowerCase();
        if (!byId && !byName) return false;
      }
      return true;
    }).length;
  }
  return { done, target: goal.target, percent: Math.min(100, Math.round((done / goal.target) * 100)), reached: done >= goal.target };
}
