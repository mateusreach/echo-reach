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
    .select("id, title, status, owner_name, due_date, sector, note, requires_review, front_id, work_order_id, updated_at, started_at, brands!inner(id, name, slug), workspace_fronts(name)")
    .order("due_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return ((data ?? []) as any[]).map((t) => ({
    id: t.id, title: t.title, brand: t.brands, frontId: t.front_id, frontName: t.workspace_fronts?.name ?? null, workOrderId: t.work_order_id,
    status: t.status, owner: t.owner_name, due: t.due_date, sector: t.sector, note: t.note, requiresReview: !!t.requires_review,
    since: t.updated_at ?? t.started_at ?? nowISO(), remindedAt: null, likeMaterial: null,
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

export async function setTaskStatus(id: string, status: WorkStatus) {
  if (isDemoMode()) { const t = demo().tasks.find((x) => x.id === id); if (t) { t.status = status; t.since = nowISO(); } return; }
  await updateTask(id, { status, ...(status === DONE ? { completed_at: nowISO() } : {}), ...(status === "Iniciada" ? { started_at: nowISO() } : {}) } as never);
}

export async function patchTask(id: string, patch: Partial<Pick<OpsTask, "owner" | "due" | "note" | "sector" | "title">>) {
  if (isDemoMode()) { const t = demo().tasks.find((x) => x.id === id); if (t) Object.assign(t, patch); return; }
  const row: Record<string, unknown> = {};
  if ("owner" in patch) row.owner_name = patch.owner;
  if ("due" in patch) row.due_date = patch.due;
  if ("note" in patch) row.note = patch.note;
  if ("sector" in patch) row.sector = patch.sector;
  if ("title" in patch) row.title = patch.title;
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
