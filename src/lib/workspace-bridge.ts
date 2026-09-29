// Ponte de rastreabilidade Reach Brand → Reach Workspace.
// `brand_id` é o identificador central e estável do cliente em todo o ecossistema.
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type WorkspaceTaskSource = Database["public"]["Tables"]["workspace_task_sources"]["Row"];

export type BrandWorkspaceDispatchInput = {
  brandId: string;
  sourceModule: "brand" | "espaco360";
  sourceType: string;
  sourceId: string;
  sourceUrl: string;
  title: string;
  description?: string | null;
  sector?: string | null;
  ownerId?: string | null;
  ownerName?: string | null;
  dueDate?: string | null;
  priority?: number;
  note?: string | null;
};

export type BrandWorkspaceDispatchResult = {
  workspaceTaskId: string;
  created: boolean;
};

export function missingBridgeObject(error: { message?: string; code?: string }, name: string) {
  return (error.code === "PGRST202" || error.code === "PGRST205" || /schema cache/i.test(error.message ?? ""))
    && (error.message ?? "").includes(name);
}

async function dispatchWithoutSourceTable(input: BrandWorkspaceDispatchInput): Promise<BrandWorkspaceDispatchResult> {
  const { data: existing, error: readError } = await supabase
    .from("workspace_tasks")
    .select("id, brand_id")
    .eq("id", input.sourceId)
    .maybeSingle();
  if (readError) throw readError;
  if (existing) {
    if (existing.brand_id !== input.brandId) throw new Error("Esta origem já pertence a outro cliente.");
    return { workspaceTaskId: existing.id, created: false };
  }
  const note = [input.description?.trim(), input.note?.trim(), input.sourceUrl && `Origem: ${input.sourceUrl}`]
    .filter(Boolean)
    .join("\n\n");
  const { error } = await supabase.from("workspace_tasks").insert({
    id: input.sourceId,
    brand_id: input.brandId,
    title: input.title.trim(),
    sector: input.sector?.trim() || null,
    owner_id: input.ownerId || null,
    owner_name: input.ownerName?.trim() || null,
    due_date: input.dueDate || null,
    month: input.dueDate?.slice(0, 7) || null,
    priority: Math.max(input.priority ?? 999, 1),
    note: note || null,
    status: "Parada",
  });
  if (error && error.code !== "23505") throw error;
  return { workspaceTaskId: input.sourceId, created: !error };
}

/**
 * Cria a demanda interna e seu vínculo de origem em uma única transação.
 * O banco usa uma chave única da origem: reabrir o modal ou clicar novamente
 * retorna a mesma demanda, sem inserir uma segunda tarefa.
 */
export async function dispatchBrandItemToWorkspace(
  input: BrandWorkspaceDispatchInput,
): Promise<BrandWorkspaceDispatchResult> {
  // Demandas criadas pelo modo de compatibilidade mantêm o ID da origem.
  // Reconhecê-las antes da RPC evita duplicação quando a migração for aplicada.
  const { data: fallbackTask } = await supabase
    .from("workspace_tasks")
    .select("id, brand_id")
    .eq("id", input.sourceId)
    .maybeSingle();
  if (fallbackTask) {
    if (fallbackTask.brand_id !== input.brandId) throw new Error("Esta origem já pertence a outro cliente.");
    return { workspaceTaskId: fallbackTask.id, created: false };
  }
  const { data, error } = await supabase.rpc("dispatch_brand_item_to_workspace", {
    p_brand_id: input.brandId,
    p_source_module: input.sourceModule,
    p_source_type: input.sourceType,
    p_source_id: input.sourceId,
    p_title: input.title.trim(),
    p_description: input.description?.trim() || undefined,
    p_sector: input.sector?.trim() || undefined,
    p_owner_id: input.ownerId || undefined,
    p_owner_name: input.ownerName?.trim() || undefined,
    p_due_date: input.dueDate || undefined,
    p_priority: Math.max(input.priority ?? 999, 1),
    p_note: input.note?.trim() || undefined,
    p_source_url: input.sourceUrl,
  });
  if (error && missingBridgeObject(error, "dispatch_brand_item_to_workspace"))
    return dispatchWithoutSourceTable(input);
  if (error) throw error;
  const row = data?.[0];
  if (!row?.workspace_task_id) throw new Error("O Workspace não retornou a demanda criada.");
  return { workspaceTaskId: row.workspace_task_id, created: row.created };
}

export async function listWorkspaceTaskSources(taskIds: string[]): Promise<WorkspaceTaskSource[]> {
  if (!taskIds.length) return [];
  const { data, error } = await supabase
    .from("workspace_task_sources")
    .select("*")
    .in("workspace_task_id", taskIds);
  if (error && missingBridgeObject(error, "workspace_task_sources")) return [];
  if (error) throw error;
  return data ?? [];
}

export async function getWorkspaceTaskSourceForOrigin(input: Pick<BrandWorkspaceDispatchInput, "brandId" | "sourceModule" | "sourceType" | "sourceId">) {
  const { data, error } = await supabase
    .from("workspace_task_sources")
    .select("*")
    .eq("brand_id", input.brandId)
    .eq("source_module", input.sourceModule)
    .eq("source_type", input.sourceType)
    .eq("source_id", input.sourceId)
    .maybeSingle();
  if (error && missingBridgeObject(error, "workspace_task_sources")) return null;
  if (error) throw error;
  return data;
}
