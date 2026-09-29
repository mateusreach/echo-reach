// ---------------------------------------------------------------------------
// AGÊNCIA — Modelos e Configurações (página 08)
//
// Modelos de plano (plan_templates), modelos de execução (workspace_templates),
// setores (workspace_sectors) e configurações da agência (app_settings),
// incluindo os padrões do Like. Sem banco, tudo roda em memória.
// ---------------------------------------------------------------------------
import { supabase } from "@/integrations/supabase/client";
import {
  baseTemplateDefs,
  createPlanTemplate,
  deletePlanTemplate,
  duplicatePlanTemplate,
  listPlanTemplates,
  updatePlanTemplate,
  type PlanTemplate,
  type PlanTemplateInput,
} from "@/lib/agency-data";
import { listWorkspaceDispatches, type WorkspaceDispatch } from "@/lib/reach-data";
import {
  DEFAULT_INVITE_CLIENTE_BODY,
  DEFAULT_INVITE_CLIENTE_SUBJECT,
  DEFAULT_INVITE_COLABORADOR_BODY,
  DEFAULT_INVITE_COLABORADOR_SUBJECT,
  fetchAppSettings,
  saveAppSettings,
} from "@/lib/branding";
import { isDemoMode } from "@/lib/home-data";
import type { Base, PathKey } from "@/components/echo/appearance";

const db = supabase as any;
const uid = () => Math.random().toString(36).slice(2, 10);

// ----- Modelos de plano -------------------------------------------------------

let demoPlans: PlanTemplate[] | null = null;
function plans(): PlanTemplate[] {
  if (demoPlans) return demoPlans;
  const now = new Date().toISOString();
  demoPlans = baseTemplateDefs().map((d, i) => ({ id: `pt-${i}`, name: d.name, description: d.description, type: d.type, objective: d.objective, audience: i % 2 ? "Clientes de conteúdo recorrente" : "Novos clientes em onboarding", notes: null, active: i !== 4, stages: d.stages, created_at: now, updated_at: now }));
  return demoPlans;
}

export async function listPlans(): Promise<PlanTemplate[]> {
  if (isDemoMode()) return plans().map((p) => ({ ...p }));
  return listPlanTemplates();
}

export async function savePlan(id: string | null, input: PlanTemplateInput & { active?: boolean }): Promise<PlanTemplate> {
  if (isDemoMode()) {
    const now = new Date().toISOString();
    if (id) {
      demoPlans = plans().map((p) => (p.id === id ? { ...p, ...input, updated_at: now } as PlanTemplate : p));
      return demoPlans.find((p) => p.id === id)!;
    }
    const t = { id: `pt-${uid()}`, description: null, type: null, objective: null, audience: null, notes: null, active: true, stages: [], created_at: now, updated_at: now, ...input } as PlanTemplate;
    demoPlans = [t, ...plans()];
    return t;
  }
  if (id) { await updatePlanTemplate(id, input); return (await listPlanTemplates()).find((p) => p.id === id)!; }
  return createPlanTemplate(input);
}

export async function duplicatePlan(t: PlanTemplate) {
  if (isDemoMode()) { const now = new Date().toISOString(); demoPlans = [{ ...structuredClone(t), id: `pt-${uid()}`, name: `${t.name} (cópia)`, created_at: now, updated_at: now }, ...plans()]; return; }
  await duplicatePlanTemplate(t);
}

export async function setPlanActive(id: string, active: boolean) {
  if (isDemoMode()) { demoPlans = plans().map((p) => (p.id === id ? { ...p, active } : p)); return; }
  await updatePlanTemplate(id, { active });
}

export async function removePlan(id: string) {
  if (isDemoMode()) { demoPlans = plans().filter((p) => p.id !== id); return; }
  await deletePlanTemplate(id);
}

// ----- Modelos de execução e setores -----------------------------------------

export const MATERIAL_TYPES = [
  { value: "post", label: "Post" },
  { value: "carrossel", label: "Carrossel" },
  { value: "video", label: "Vídeo" },
  { value: "stories", label: "Stories" },
  { value: "roteiro", label: "Roteiro" },
  { value: "texto", label: "Texto" },
  { value: "peca", label: "Peça" },
] as const;
export type MaterialType = (typeof MATERIAL_TYPES)[number]["value"];

export const EXEC_KINDS = [
  { value: "content_cycle", label: "Pauta de conteúdo" },
  { value: "campaign", label: "Campanha" },
  { value: "one_off", label: "Avulso" },
];

export type ExecItem = { title: string; sector: string | null; days_before: number; requires_review?: boolean; like_approval?: boolean; material_type?: MaterialType | null };
export type ExecTemplate = { id: string; name: string; kind: string; tasks: ExecItem[]; updated_at: string };
export type Sector = { id: string; name: string; order_index: number; tasks: number };

const normItems = (raw: unknown): ExecItem[] =>
  Array.isArray(raw)
    ? (raw as any[]).filter((x) => x && typeof x.title === "string").map((x) => ({
      title: x.title, sector: x.sector ?? null, days_before: Number(x.days_before ?? 0) || 0, requires_review: !!x.requires_review,
      like_approval: !!x.like_approval, material_type: x.material_type ?? null,
    }))
    : [];

let demoExec: { templates: ExecTemplate[]; sectors: Sector[] } | null = null;
function exec() {
  if (demoExec) return demoExec;
  const now = new Date().toISOString();
  const i = (title: string, sector: string, days_before: number, like?: MaterialType): ExecItem => ({ title, sector, days_before, like_approval: !!like, material_type: like ?? null });
  demoExec = {
    templates: [
      { id: "wt-feed", name: "Feed", kind: "content_cycle", updated_at: now, tasks: [i("Estratégia", "Planejamento", 1), i("Roteiros", "Conteúdo", 0, "roteiro"), i("Pré produção", "Estratégia", 0), i("Briefing", "Criação / Entrega", 0), i("Artes", "Criação / Entrega", 0, "carrossel"), i("Vídeos", "Criação / Entrega", 0, "video"), i("Legendas", "Criação / Entrega", 0, "texto")] },
      { id: "wt-stories", name: "Stories da semana", kind: "content_cycle", updated_at: now, tasks: [i("Pauta", "Planejamento", 2), i("Artes", "Criação / Entrega", 1, "stories")] },
      { id: "wt-camp", name: "Campanha de lançamento", kind: "campaign", updated_at: now, tasks: [i("Conceito", "Estratégia", 10), i("Key visual", "Criação / Entrega", 7, "peca"), i("Peças de mídia", "Criação / Entrega", 4, "peca"), i("Relatório", "Planejamento", 0)] },
    ],
    sectors: [
      { id: "s1", name: "Planejamento", order_index: 1, tasks: 14 },
      { id: "s2", name: "Conteúdo", order_index: 2, tasks: 22 },
      { id: "s3", name: "Estratégia", order_index: 3, tasks: 9 },
      { id: "s4", name: "Criação / Entrega", order_index: 4, tasks: 31 },
    ],
  };
  return demoExec;
}

export async function listExecTemplates(): Promise<ExecTemplate[]> {
  if (isDemoMode()) return exec().templates.map((t) => ({ ...t, tasks: t.tasks.map((x) => ({ ...x })) }));
  const { data, error } = await db.from("workspace_templates").select("*").order("name");
  if (error) throw error;
  return ((data ?? []) as any[]).map((t) => ({ id: t.id, name: t.name, kind: t.kind, tasks: normItems(t.tasks), updated_at: t.updated_at }));
}

export async function saveExecTemplate(id: string | null, input: { name: string; kind: string; tasks: ExecItem[] }) {
  const tasks = input.tasks.map((t) => ({ ...t, title: t.title.trim(), material_type: t.like_approval ? t.material_type ?? "post" : null })).filter((t) => t.title);
  if (isDemoMode()) {
    const s = exec();
    const now = new Date().toISOString();
    if (id) s.templates = s.templates.map((t) => (t.id === id ? { ...t, ...input, tasks, updated_at: now } : t));
    else s.templates = [...s.templates, { id: `wt-${uid()}`, ...input, tasks, updated_at: now }];
    return;
  }
  if (id) {
    const { error } = await db.from("workspace_templates").update({ name: input.name, kind: input.kind, tasks }).eq("id", id);
    if (error) throw error;
  } else {
    const { myOrganizationId } = await import("@/lib/agency-data");
    const { error } = await db.from("workspace_templates").insert({ name: input.name, kind: input.kind, tasks, organization_id: await myOrganizationId() });
    if (error) throw error;
  }
}

export async function removeExecTemplate(id: string) {
  if (isDemoMode()) { const s = exec(); s.templates = s.templates.filter((t) => t.id !== id); return; }
  const { error } = await db.from("workspace_templates").delete().eq("id", id);
  if (error) throw error;
}

export async function listSectorsFull(): Promise<Sector[]> {
  if (isDemoMode()) return exec().sectors.map((s) => ({ ...s })).sort((a, b) => a.order_index - b.order_index);
  const [sec, tasks] = await Promise.all([
    db.from("workspace_sectors").select("id, name, order_index").order("order_index"),
    db.from("workspace_tasks").select("sector"),
  ]);
  if (sec.error) throw sec.error;
  const count = new Map<string, number>();
  for (const t of (tasks.data ?? []) as any[]) if (t.sector) count.set(String(t.sector).toLowerCase(), (count.get(String(t.sector).toLowerCase()) ?? 0) + 1);
  return ((sec.data ?? []) as any[]).map((s) => ({ id: s.id, name: s.name, order_index: s.order_index, tasks: count.get(String(s.name).toLowerCase()) ?? 0 }));
}

export async function addSector(name: string, order: number) {
  if (isDemoMode()) { const s = exec(); if (s.sectors.some((x) => x.name.toLowerCase() === name.toLowerCase())) throw new Error("Já existe um setor com esse nome."); s.sectors.push({ id: `s-${uid()}`, name, order_index: order, tasks: 0 }); return; }
  const { myOrganizationId } = await import("@/lib/agency-data");
  const { error } = await db.from("workspace_sectors").insert({ name, order_index: order, organization_id: await myOrganizationId() });
  if (error) throw error;
}

/** Renomear leva junto as tarefas e os modelos que usam o nome antigo. */
export async function renameSector(sector: Sector, name: string) {
  if (isDemoMode()) {
    const s = exec();
    s.sectors = s.sectors.map((x) => (x.id === sector.id ? { ...x, name } : x));
    s.templates = s.templates.map((t) => ({ ...t, tasks: t.tasks.map((i) => (i.sector === sector.name ? { ...i, sector: name } : i)) }));
    return;
  }
  const { error } = await db.from("workspace_sectors").update({ name }).eq("id", sector.id);
  if (error) throw error;
  await db.from("workspace_tasks").update({ sector: name }).eq("sector", sector.name);
  const templates = await listExecTemplates();
  for (const t of templates) {
    if (!t.tasks.some((i) => i.sector === sector.name)) continue;
    await db.from("workspace_templates").update({ tasks: t.tasks.map((i) => (i.sector === sector.name ? { ...i, sector: name } : i)) }).eq("id", t.id);
  }
}

export async function reorderSectors(ordered: Sector[]) {
  if (isDemoMode()) { const s = exec(); s.sectors = ordered.map((x, i) => ({ ...x, order_index: i + 1 })); return; }
  for (const [i, s] of ordered.entries()) await db.from("workspace_sectors").update({ order_index: i + 1 }).eq("id", s.id);
}

/** Excluir o setor não apaga tarefas: elas guardam o nome como texto. */
export async function removeSector(id: string) {
  if (isDemoMode()) { const s = exec(); s.sectors = s.sectors.filter((x) => x.id !== id); return; }
  const { error } = await db.from("workspace_sectors").delete().eq("id", id);
  if (error) throw error;
}

// ----- Configurações da agência ------------------------------------------------

export type LikeDefaults = {
  decisionDays: number;
  remindBefore: boolean;
  remindOnDay: boolean;
  remindLate: boolean;
  requireCommentOnAdjust: boolean;
  allowDownload: boolean;
  watermark: boolean;
};
export const DEFAULT_LIKE: LikeDefaults = { decisionDays: 2, remindBefore: true, remindOnDay: true, remindLate: true, requireCommentOnAdjust: true, allowDownload: false, watermark: true };

export type AgencySettings = {
  agency_name: string;
  agency_description: string;
  agency_email: string;
  agency_phone: string;
  agency_site: string;
  agency_address: string;
  logo_url: string | null;
  favicon_url: string | null;
  default_base: Base;
  default_path: PathKey;
  invite_colaborador_subject: string;
  invite_colaborador_body: string;
  invite_cliente_subject: string;
  invite_cliente_body: string;
  like_defaults: LikeDefaults;
};

const EMPTY: AgencySettings = {
  agency_name: "Reach", agency_description: "", agency_email: "", agency_phone: "", agency_site: "", agency_address: "",
  logo_url: null, favicon_url: null, default_base: "system", default_path: "iris",
  invite_colaborador_subject: DEFAULT_INVITE_COLABORADOR_SUBJECT, invite_colaborador_body: DEFAULT_INVITE_COLABORADOR_BODY,
  invite_cliente_subject: DEFAULT_INVITE_CLIENTE_SUBJECT, invite_cliente_body: DEFAULT_INVITE_CLIENTE_BODY,
  like_defaults: DEFAULT_LIKE,
};
let demoSettings: AgencySettings | null = null;

export async function loadAgencySettings(): Promise<AgencySettings> {
  if (isDemoMode()) {
    demoSettings ??= { ...EMPTY, agency_name: "Reach Comunicação", agency_description: "Agência de comunicação e conteúdo para marcas de alto padrão.", agency_email: "contato@reach.com.br", agency_phone: "(11) 4002-8922", agency_site: "reach.com.br", agency_address: "Rua Oscar Freire, 1200 · São Paulo" };
    return structuredClone(demoSettings);
  }
  const s = ((await fetchAppSettings()) ?? {}) as any;
  const pick = (k: keyof AgencySettings) => (s[k] ?? EMPTY[k]) as never;
  return {
    agency_name: pick("agency_name"), agency_description: pick("agency_description"), agency_email: pick("agency_email"), agency_phone: pick("agency_phone"),
    agency_site: pick("agency_site"), agency_address: pick("agency_address"), logo_url: s.logo_url ?? null, favicon_url: s.favicon_url ?? null,
    default_base: s.default_base ?? (s.default_theme === "auto" ? "system" : s.default_theme) ?? "system", default_path: s.default_path ?? "iris",
    invite_colaborador_subject: s.invite_colaborador_subject || EMPTY.invite_colaborador_subject, invite_colaborador_body: s.invite_colaborador_body || EMPTY.invite_colaborador_body,
    invite_cliente_subject: s.invite_cliente_subject || EMPTY.invite_cliente_subject, invite_cliente_body: s.invite_cliente_body || EMPTY.invite_cliente_body,
    like_defaults: { ...DEFAULT_LIKE, ...(s.like_defaults ?? {}) },
  };
}

export async function saveAgencySettings(patch: Partial<AgencySettings>) {
  if (isDemoMode()) { demoSettings = { ...(demoSettings ?? EMPTY), ...structuredClone(patch) }; return; }
  const row: Record<string, unknown> = { ...patch };
  if (patch.default_base) row.default_theme = patch.default_base === "system" ? "auto" : patch.default_base;
  await saveAppSettings(row as never);
}

// ----- Integrações --------------------------------------------------------------

export type Connection = { brandId: string; name: string; slug: string; connected: boolean; url: string | null; clientId: string | null };
export async function loadIntegrations(): Promise<{ connections: Connection[]; dispatches: (WorkspaceDispatch & { brandName: string })[] }> {
  if (isDemoMode()) {
    const now = Date.now();
    const b = [["Fina Fragrância", "fina-fragrancia", true], ["Zelus", "zelus", true], ["Eliza", "eliza", false], ["Spirale", "spirale", false]] as const;
    return {
      connections: b.map(([name, slug, c], i) => ({ brandId: `b${i}`, name, slug, connected: c, url: c ? `https://workspace.reach.com.br/api/intake/${slug}` : null, clientId: c ? `WS-${120 + i}` : null })),
      dispatches: [
        { id: "d1", brand_id: "b0", brandName: "Fina Fragrância", origin: "criacao", source_table: null, source_id: null, title: "Carrossel “Notas de outono”", payload: {}, status: "enviado", response: null, external_id: "8812", created_at: new Date(now - 3600e3).toISOString(), updated_at: "" },
        { id: "d2", brand_id: "b1", brandName: "Zelus", origin: "solicitacao", source_table: null, source_id: null, title: "Fotos da coleção nova", payload: {}, status: "erro", response: "Tempo esgotado", external_id: null, created_at: new Date(now - 86400e3).toISOString(), updated_at: "" },
        { id: "d3", brand_id: "b0", brandName: "Fina Fragrância", origin: "criacao", source_table: null, source_id: null, title: "Reels de lançamento", payload: {}, status: "registrado", response: null, external_id: null, created_at: new Date(now - 2 * 86400e3).toISOString(), updated_at: "" },
      ],
    };
  }
  const [brands, dispatches] = await Promise.all([db.from("brands").select("id, name, slug, workspace_connected, workspace_url, workspace_client_id").order("name"), listWorkspaceDispatches().catch(() => [])]);
  const list = (brands.data ?? []) as any[];
  const name = new Map(list.map((b) => [b.id, b.name]));
  return {
    connections: list.map((b) => ({ brandId: b.id, name: b.name, slug: b.slug, connected: !!b.workspace_connected, url: b.workspace_url ?? null, clientId: b.workspace_client_id ?? null })),
    dispatches: dispatches.slice(0, 20).map((d) => ({ ...d, brandName: name.get(d.brand_id) ?? "Cliente" })),
  };
}

export async function saveConnection(brandId: string, c: { connected: boolean; url: string; clientId: string }) {
  if (isDemoMode()) return;
  const { error } = await db.from("brands").update({ workspace_connected: c.connected, workspace_url: c.url.trim() || null, workspace_client_id: c.clientId.trim() || null }).eq("id", brandId);
  if (error) throw error;
}
