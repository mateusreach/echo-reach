// ---------------------------------------------------------------------------
// ENTREGAS (work orders) — a camada que faltava entre a FRENTE e as TAREFAS.
//
//   CLIENTE → FRENTE (regra recorrente) → ENTREGA (instância do ciclo) → TAREFAS
//
// Uma entrega também pode nascer de uma origem do Brand/360 (ideia, campanha,
// solicitação, tarefa, reunião). A origem fica em `workspace_work_order_sources`
// e é única por item: reenviar o mesmo item devolve sempre a mesma entrega.
// ---------------------------------------------------------------------------
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  frontPeriod,
  listAssignableMembers,
  listClientTaskOwners,
  templateTasks,
  type Front,
  type WorkTask,
  type WorkTemplate,
} from "@/lib/workspace-data";

export type WorkOrder = Database["public"]["Tables"]["workspace_work_orders"]["Row"];
export type WorkOrderSource = Database["public"]["Tables"]["workspace_work_order_sources"]["Row"];

/** Classificações da entrega — expansíveis: o banco aceita qualquer texto. */
export const WORK_ORDER_KINDS: Record<string, string> = {
  content_cycle: "Pauta de conteúdo",
  brand_request: "Solicitação do cliente",
  campaign: "Campanha",
  meeting_action: "Reunião",
  manual: "Material avulso",
};

export function workOrderKindLabel(kind: string) {
  return WORK_ORDER_KINDS[kind] ?? kind;
}

/** Estado externo (o que o cliente pode ver) a partir dos status internos. */
export function externalStatus(tasks: Pick<WorkTask, "status">[]): string {
  if (tasks.length === 0) return "Recebido";
  if (tasks.every((t) => t.status === "Concluído")) return "Concluído";
  if (tasks.some((t) => t.status === "Avaliação externa" || t.status === "Aguardando retorno externo"))
    return "Em aprovação";
  if (tasks.some((t) => t.status !== "Parada")) return "Em execução";
  return "Recebido";
}

export function workOrderProgress(tasks: Pick<WorkTask, "status">[]) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "Concluído").length;
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

// ----- leituras -------------------------------------------------------------

export async function listWorkOrders(filter: { brandId?: string; frontId?: string } = {}): Promise<WorkOrder[]> {
  let q = supabase.from("workspace_work_orders").select("*");
  if (filter.brandId) q = q.eq("brand_id", filter.brandId);
  if (filter.frontId) q = q.eq("front_id", filter.frontId);
  const { data, error } = await q.order("period_start", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getWorkOrder(id: string): Promise<WorkOrder | null> {
  const { data, error } = await supabase.from("workspace_work_orders").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listWorkOrderSources(workOrderIds: string[]): Promise<WorkOrderSource[]> {
  if (workOrderIds.length === 0) return [];
  const { data, error } = await supabase
    .from("workspace_work_order_sources")
    .select("*")
    .in("work_order_id", workOrderIds);
  if (error) throw error;
  return data ?? [];
}

/** Origem já registrada para um item do Brand/360 — define o estado do botão 🚀. */
export async function findWorkOrderForSource(input: {
  brandId: string;
  sourceModule: string;
  sourceType: string;
  sourceId: string;
}): Promise<WorkOrderSource | null> {
  const { data, error } = await supabase
    .from("workspace_work_order_sources")
    .select("*")
    .eq("brand_id", input.brandId)
    .eq("source_module", input.sourceModule)
    .eq("source_type", input.sourceType)
    .eq("source_id", input.sourceId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ----- escritas -------------------------------------------------------------

export async function createWorkOrder(input: Database["public"]["Tables"]["workspace_work_orders"]["Insert"]) {
  const { data, error } = await supabase.from("workspace_work_orders").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateWorkOrder(id: string, patch: Database["public"]["Tables"]["workspace_work_orders"]["Update"]) {
  const { error } = await supabase.from("workspace_work_orders").update(patch).eq("id", id);
  if (error) throw error;
}

/**
 * Materializa o ciclo pendente de uma frente. Idempotente pela chave
 * (frente + período): chamar duas vezes devolve a mesma entrega.
 */
export async function ensureFrontWorkOrder(
  front: Front,
  period?: { start: string; end: string },
): Promise<{ workOrderId: string; created: boolean }> {
  const p = period ?? frontPeriod(front);
  const { data, error } = await supabase.rpc("ensure_front_work_order", {
    p_front_id: front.id,
    p_period_start: p.start,
    p_period_end: p.end,
  });
  if (error) throw error;
  const row = data?.[0];
  if (!row?.work_order_id) throw new Error("O Workspace não retornou a entrega criada.");
  return { workOrderId: row.work_order_id, created: row.created };
}

/** Envio interno: um item do Brand/360 vira uma entrega (nunca duplica). */
export async function dispatchBrandItemToWorkOrder(input: {
  brandId: string;
  sourceModule: "brand" | "espaco360" | "biblioteca";
  sourceType: string;
  sourceId: string;
  sourceUrl?: string | null;
  title: string;
  kind?: string;
  description?: string | null;
  requestedDueDate?: string | null;
  internalDueDate?: string | null;
  priority?: number;
}): Promise<{ workOrderId: string; created: boolean }> {
  const { data, error } = await supabase.rpc("dispatch_brand_item_to_work_order", {
    p_brand_id: input.brandId,
    p_source_module: input.sourceModule,
    p_source_type: input.sourceType,
    p_source_id: input.sourceId,
    p_title: input.title.trim(),
    p_kind: input.kind ?? "brand_request",
    p_description: input.description?.trim() || undefined,
    p_source_url: input.sourceUrl || undefined,
    p_requested_due_date: input.requestedDueDate || undefined,
    p_internal_due_date: input.internalDueDate || undefined,
    p_priority: Math.max(input.priority ?? 999, 1),
  });
  if (error) throw error;
  const row = data?.[0];
  if (!row?.work_order_id) throw new Error("O Workspace não retornou a entrega criada.");
  return { workOrderId: row.work_order_id, created: row.created };
}

/**
 * Entrada do cliente: envia a própria solicitação/tarefa do 360 para a triagem.
 * O banco valida o vínculo com o cliente; o cliente não define setor,
 * responsável nem prioridade interna.
 */
export async function submitClientRequestToWorkspace(input: {
  sourceType: "solicitacao" | "tarefa";
  sourceId: string;
  sourceUrl?: string | null;
}): Promise<{ workOrderId: string; created: boolean }> {
  const { data, error } = await supabase.rpc("submit_client_request_to_workspace", {
    p_source_type: input.sourceType,
    p_source_id: input.sourceId,
    p_source_url: input.sourceUrl || undefined,
  });
  if (error) throw error;
  const row = data?.[0];
  if (!row?.work_order_id) throw new Error("A solicitação não pôde ser encaminhada.");
  return { workOrderId: row.work_order_id, created: row.created };
}

/** Cria as tarefas do modelo DENTRO de uma entrega (nunca soltas). */
export async function applyTemplateToWorkOrder(
  template: WorkTemplate,
  target: { brandId: string; workOrderId: string; frontId?: string | null; dueDate?: string | null },
) {
  const items = templateTasks(template);
  if (items.length === 0) return 0;
  // Responsável e antecedência configurados para ESTE cliente têm prioridade sobre o modelo.
  const [owners, members] = await Promise.all([listClientTaskOwners(target.brandId), listAssignableMembers()]);
  const rows = items.map((item, i) => {
    const cfg = owners.find((o) => o.task_title.toLowerCase() === item.title.toLowerCase());
    const ownerName = cfg?.owner_name ?? item.owner_name ?? null;
    const member = members.find((m) => m.name === ownerName);
    return {
      brand_id: target.brandId,
      front_id: target.frontId ?? null,
      work_order_id: target.workOrderId,
      title: item.title,
      sector: item.sector ?? null,
      owner_name: ownerName,
      owner_id: cfg?.owner_id ?? member?.user_id ?? null,
      due_date: taskDueDate(target.dueDate ?? null, cfg?.days_before ?? item.days_before ?? null),
      status: "Parada",
      priority: i + 1,
    };
  });
  const { error } = await supabase.from("workspace_tasks").insert(rows);
  if (error) throw error;
  return rows.length;
}

/** Prazo da etapa: prazo da entrega menos a antecedência prevista no modelo. */
function taskDueDate(deliveryDue: string | null, daysBefore: number | null) {
  if (!deliveryDue) return null;
  if (!daysBefore) return deliveryDue;
  const [y, m, d] = deliveryDue.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, (d ?? 1) - daysBefore);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
