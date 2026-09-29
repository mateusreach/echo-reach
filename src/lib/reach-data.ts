// Data access layer for the multi-tenant Reach Brand OS.
// Talks to Supabase (Lovable Cloud) directly from the client; RLS enforces
// agency vs. client permissions server-side, so this file stays thin.
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Brand = Database["public"]["Tables"]["brands"]["Row"];
export type BrandHomeSection = Database["public"]["Tables"]["brand_home_sections"]["Row"];

// Tipos legados ("text"/"textarea"/"image"/"file") continuam existindo em
// seções antigas; tipos novos vêm dos Modelos de Plano (ver TEMPLATE_FIELD_TYPES
// em @/lib/agency-data). O componente que renderiza o campo (SectionEditor)
// trata os dois formatos.
export type SectionFieldType =
  | "text" | "textarea" | "image" | "file"
  | "texto_curto" | "texto_longo" | "numero" | "data" | "selecao" | "selecao_multipla"
  | "sim_nao" | "escala" | "lista" | "imagem" | "arquivo" | "pilares" | "categorias" | "canais";

export type SectionField = {
  key: string;
  label: string;
  type: SectionFieldType;
  value: string;
  required?: boolean;
  help?: string | null;
  options?: string[];
};

export const STAGES = [
  { key: "alicerce", label: "Alicerce", description: "Diagnóstico e planejamento estratégico." },
  { key: "estrutura", label: "Estrutura", description: "Decisões estratégicas construídas a partir do Alicerce." },
  { key: "acabamento", label: "Acabamento", description: "Identidade visual e elementos gráficos da marca." },
  { key: "comunicacao", label: "Comunicação", description: "Execução e acompanhamento da estratégia da marca." },
  { key: "conhecimento", label: "Diagnóstico e Estudos", description: "Etapas de planejamentos de Comunicação, Conteúdo, Campanha e outros tipos, geradas a partir de um Modelo de Plano." },
] as const;

export type StageKey = (typeof STAGES)[number]["key"];

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function listClientProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from("profiles").select("*").eq("role", "client").order("display_name");
  if (error) throw error;
  return data ?? [];
}

export async function addBrandMember(brandId: string, userId: string, memberRole: "agency" | "client" = "client") {
  const { error } = await supabase.from("brand_members").insert({ brand_id: brandId, user_id: userId, member_role: memberRole });
  if (error) throw error;
}

export async function removeBrandMember(brandId: string, userId: string) {
  const { error } = await supabase.from("brand_members").delete().eq("brand_id", brandId).eq("user_id", userId);
  if (error) throw error;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listBrands(): Promise<Brand[]> {
  const { data, error } = await supabase.from("brands").select("*").order("name");
  if (error) throw error;
  return data ?? [];
}

export async function getBrandBySlug(slug: string): Promise<Brand | null> {
  const { data, error } = await supabase.from("brands").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data;
}

/** Marcas às quais o usuário autenticado está vinculado (via brand_members) — usado para levar um cliente direto ao ambiente certo, sem depender de papel fixo/hardcoded. */
export async function myBrands(): Promise<Brand[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user.id;
  if (!uid) return [];
  const { data, error } = await supabase.from("brand_members").select("brands(*)").eq("user_id", uid);
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => r.brands).filter(Boolean) as Brand[];
}

/** Vínculo (se houver) do usuário autenticado com um cliente específico —
 * usado para bloquear rotas/módulos que a permissão dele não cobre. */
export async function getBrandMembership(brandId: string): Promise<{ isAdmin: boolean; permissions: string[] } | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user.id;
  if (!uid) return null;
  const { data, error } = await (supabase as any)
    .from("brand_members")
    .select("is_admin, permissions")
    .eq("brand_id", brandId)
    .eq("user_id", uid)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { isAdmin: !!data.is_admin, permissions: data.permissions ?? [] };
}

export async function createBrand(input: {
  name: string;
  slug: string;
  segment?: string;
  description?: string;
  status?: string;
  contract_type?: string | null;
  modules?: Record<string, boolean>;
}) {
  const { myOrganizationId } = await import("@/lib/agency-data");
  const organization_id = await myOrganizationId();
  const { data, error } = await supabase.from("brands").insert({ ...input, organization_id } as any).select().single();
  if (error) throw error;
  return data;
}

export async function listBrandHomeSections(brandId: string): Promise<BrandHomeSection[]> {
  const { data, error } = await supabase
    .from("brand_home_sections")
    .select("*")
    .eq("brand_id", brandId)
    .order("stage")
    .order("order_index");
  if (error) throw error;
  return data ?? [];
}

export function sectionsByStage(sections: BrandHomeSection[], stage: string) {
  return sections.filter((s) => s.stage === stage).sort((a, b) => a.order_index - b.order_index);
}

export function minhaEmpresaSection(sections: BrandHomeSection[]) {
  return sections.find((s) => s.stage === "minha_empresa");
}

export async function updateSectionFields(sectionId: string, fields: SectionField[]) {
  const { error } = await supabase
    .from("brand_home_sections")
    .update({ fields: fields as unknown as Database["public"]["Tables"]["brand_home_sections"]["Update"]["fields"] })
    .eq("id", sectionId);
  if (error) throw error;
}

export async function createSection(input: {
  brand_id: string;
  stage: string;
  section_key: string;
  title: string;
  order_index?: number;
}) {
  const { data, error } = await supabase
    .from("brand_home_sections")
    .insert({ ...input, fields: [] })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export function newFieldKey(label: string) {
  return (
    label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || `campo_${Date.now()}`
  );
}

// ---------------------------------------------------------------------------
// Espaço 360 — centro operacional (Fase 2)
// ---------------------------------------------------------------------------

export type Initiative = Database["public"]["Tables"]["espaco360_initiatives"]["Row"];
export type Campaign = Database["public"]["Tables"]["espaco360_campaigns"]["Row"];
export type CalendarEvent = Database["public"]["Tables"]["espaco360_calendar_events"]["Row"];
export type Espaco360Task = Database["public"]["Tables"]["espaco360_tasks"]["Row"];
export type MonthlyTracking = Database["public"]["Tables"]["espaco360_monthly_tracking"]["Row"];
export type Meeting = Database["public"]["Tables"]["espaco360_meetings"]["Row"];
export type MeetingTask = Database["public"]["Tables"]["espaco360_meeting_tasks"]["Row"];
export type Channel = Database["public"]["Tables"]["espaco360_channels"]["Row"];

export const PRIORITIES = [
  { key: "imediato", label: "Imediato" },
  { key: "curto_prazo", label: "Curto prazo" },
  { key: "medio_prazo", label: "Médio prazo" },
  { key: "longo_prazo", label: "Longo prazo" },
  { key: "sem_prioridade", label: "Sem prioridade" },
] as const;

// Status da ESTRATÉGIA/INICIATIVA definida no Plano.
export const INITIATIVE_STATUSES = [
  { key: "em_andamento", label: "Em andamento" },
  { key: "concluida", label: "Concluída" },
  { key: "nao_concluida", label: "Não concluída" },
] as const;

// Horizonte de execução — substitui a antiga organização por semestre/ano.
export const HORIZONS = [
  { key: "imediato", label: "Imediato" },
  { key: "curto_prazo", label: "Curto prazo" },
  { key: "medio_prazo", label: "Médio prazo" },
  { key: "longo_prazo", label: "Longo prazo" },
  { key: "sem_prioridade", label: "Sem horizonte" },
] as const;

/** Progresso executivo do plano: % de estratégias concluídas (ignora as não concluídas do denominador não — elas contam como não entregues). */
export function strategyProgress(initiatives: { status: string }[]) {
  const total = initiatives.length;
  if (!total) return { total: 0, done: 0, running: 0, missed: 0, percent: 0 };
  const done = initiatives.filter((i) => i.status === "concluida").length;
  const missed = initiatives.filter((i) => i.status === "nao_concluida").length;
  return { total, done, running: total - done - missed, missed, percent: Math.round((done / total) * 100) };
}

export const TASK_SCOPES = [
  { key: "agencia", label: "Agência" },
  { key: "cliente", label: "Cliente" },
  { key: "compartilhada", label: "Compartilhada" },
] as const;

export const TASK_STATUSES = [
  { key: "a_fazer", label: "A fazer" },
  { key: "em_andamento", label: "Em andamento" },
  { key: "concluida", label: "Concluída" },
] as const;

export const CHANNEL_STATUSES = [
  { key: "ativo", label: "Ativo" },
  { key: "em_teste", label: "Em teste" },
  { key: "planejado", label: "Planejado" },
  { key: "pausado", label: "Pausado" },
] as const;

async function selectAll<T>(table: string, brandId: string, order: string): Promise<T[]> {
  const { data, error } = await supabase.from(table as any).select("*").eq("brand_id", brandId).order(order as any);
  if (error) throw error;
  return (data ?? []) as T[];
}

export const listInitiatives = (brandId: string) => selectAll<Initiative>("espaco360_initiatives", brandId, "order_index");
export const listCampaigns = (brandId: string) => selectAll<Campaign>("espaco360_campaigns", brandId, "start_date");
export const listCalendarEvents = (brandId: string) => selectAll<CalendarEvent>("espaco360_calendar_events", brandId, "event_date");
export const listTasks = (brandId: string) => selectAll<Espaco360Task>("espaco360_tasks", brandId, "created_at");
export const listMonthlyTracking = (brandId: string) => selectAll<MonthlyTracking>("espaco360_monthly_tracking", brandId, "created_at");
export const listMeetings = (brandId: string) => selectAll<Meeting>("espaco360_meetings", brandId, "meeting_date");
export const listChannels = (brandId: string) => selectAll<Channel>("espaco360_channels", brandId, "order_index");

export async function listMeetingTasks(meetingId: string): Promise<MeetingTask[]> {
  const { data, error } = await supabase.from("espaco360_meeting_tasks").select("*").eq("meeting_id", meetingId).order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function createInitiative(input: Database["public"]["Tables"]["espaco360_initiatives"]["Insert"]) {
  const { data, error } = await supabase.from("espaco360_initiatives").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateInitiative(id: string, patch: Database["public"]["Tables"]["espaco360_initiatives"]["Update"]) {
  const { error } = await supabase.from("espaco360_initiatives").update(patch).eq("id", id);
  if (error) throw error;
}

export async function createTask(input: Database["public"]["Tables"]["espaco360_tasks"]["Insert"]) {
  const { data, error } = await supabase.from("espaco360_tasks").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateTask(id: string, patch: Database["public"]["Tables"]["espaco360_tasks"]["Update"]) {
  const { error } = await supabase.from("espaco360_tasks").update(patch).eq("id", id);
  if (error) throw error;
}

export async function createChannel(input: Database["public"]["Tables"]["espaco360_channels"]["Insert"]) {
  const { data, error } = await supabase.from("espaco360_channels").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateChannel(id: string, patch: Database["public"]["Tables"]["espaco360_channels"]["Update"]) {
  const { error } = await supabase.from("espaco360_channels").update(patch).eq("id", id);
  if (error) throw error;
}

export async function createCampaign(input: Database["public"]["Tables"]["espaco360_campaigns"]["Insert"]) {
  const { data, error } = await supabase.from("espaco360_campaigns").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function createCalendarEvent(input: Database["public"]["Tables"]["espaco360_calendar_events"]["Insert"]) {
  const { data, error } = await supabase.from("espaco360_calendar_events").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function upsertMonthlyTracking(input: Database["public"]["Tables"]["espaco360_monthly_tracking"]["Insert"]) {
  const { data, error } = await supabase
    .from("espaco360_monthly_tracking")
    .upsert(input, { onConflict: "brand_id,month_ref" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createMeeting(input: Database["public"]["Tables"]["espaco360_meetings"]["Insert"]) {
  const { data, error } = await supabase.from("espaco360_meetings").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function createMeetingTask(input: Database["public"]["Tables"]["espaco360_meeting_tasks"]["Insert"]) {
  const { data, error } = await supabase.from("espaco360_meeting_tasks").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateMeetingTaskStatus(id: string, status: string) {
  const { error } = await supabase.from("espaco360_meeting_tasks").update({ status }).eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Biblioteca Criativa — funil Pilares → Categorias → Banco de Ideias (Fase 3)
// ---------------------------------------------------------------------------

export type Pilar = Database["public"]["Tables"]["biblioteca_pilares"]["Row"];
export type Categoria = Database["public"]["Tables"]["biblioteca_categorias"]["Row"];
export type Ideia = Database["public"]["Tables"]["biblioteca_ideias"]["Row"];

// Status da IDEIA (fluxo de trabalho da ideia) — não confundir com o status de
// produção do conteúdo (CONTEUDO_STATUSES).
export const IDEIA_STATUSES = [
  { key: "a_fazer", label: "A fazer" },
  { key: "fazendo", label: "Fazendo" },
  { key: "feita", label: "Feita" },
  { key: "concluido", label: "Concluído" },
] as const;

/** Formatos de conteúdo suportados no Banco de Ideias. */
export const IDEIA_FORMATOS = [
  { key: "Reels", label: "Reels", icon: "▶" },
  { key: "Estático", label: "Estático", icon: "▣" },
  { key: "Carrossel", label: "Carrossel", icon: "❐" },
  { key: "Stories", label: "Stories", icon: "◍" },
  { key: "TikTok", label: "TikTok", icon: "♪" },
] as const;

/** Níveis de prioridade da ideia. */
export const IDEIA_PRIORIDADES = [
  { key: "alta", label: "Alta", tone: "rose" },
  { key: "media", label: "Média", tone: "amber" },
  { key: "baixa", label: "Baixa", tone: "mint" },
] as const;


export async function listPilares(brandId: string): Promise<Pilar[]> {
  const { data, error } = await supabase.from("biblioteca_pilares").select("*").eq("brand_id", brandId).order("order_index");
  if (error) throw error;
  return data ?? [];
}

export async function listCategorias(brandId: string): Promise<Categoria[]> {
  const { data, error } = await supabase.from("biblioteca_categorias").select("*").eq("brand_id", brandId).order("order_index");
  if (error) throw error;
  return data ?? [];
}

export async function listIdeias(brandId: string): Promise<Ideia[]> {
  const { data, error } = await supabase.from("biblioteca_ideias").select("*").eq("brand_id", brandId).order("order_index");
  if (error) throw error;
  return data ?? [];
}

export async function createPilar(input: Database["public"]["Tables"]["biblioteca_pilares"]["Insert"]) {
  const { data, error } = await supabase.from("biblioteca_pilares").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function createCategoria(input: Database["public"]["Tables"]["biblioteca_categorias"]["Insert"]) {
  const { data, error } = await supabase.from("biblioteca_categorias").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function createIdeia(input: Database["public"]["Tables"]["biblioteca_ideias"]["Insert"]) {
  const { data, error } = await supabase.from("biblioteca_ideias").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateIdeia(id: string, patch: Database["public"]["Tables"]["biblioteca_ideias"]["Update"]) {
  const { error } = await supabase.from("biblioteca_ideias").update(patch).eq("id", id);
  if (error) throw error;
}

export async function updatePilar(id: string, patch: Database["public"]["Tables"]["biblioteca_pilares"]["Update"]) {
  const { error } = await supabase.from("biblioteca_pilares").update(patch).eq("id", id);
  if (error) throw error;
}

export async function updateCategoria(id: string, patch: Database["public"]["Tables"]["biblioteca_categorias"]["Update"]) {
  const { error } = await supabase.from("biblioteca_categorias").update(patch).eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Reestruturação: Objetivo -> Iniciativa -> Campanha -> Tarefa -> Entrega -> Resultado
// ---------------------------------------------------------------------------

export type Objective = Database["public"]["Tables"]["objectives"]["Row"];
export type Delivery = Database["public"]["Tables"]["deliveries"]["Row"];
export type Kpi = Database["public"]["Tables"]["kpis"]["Row"];
export type Solicitacao = Database["public"]["Tables"]["solicitacoes"]["Row"];
export type Conteudo = Database["public"]["Tables"]["conteudos"]["Row"];

export const OBJECTIVE_PERIODS = [
  { key: "anual", label: "Anual", plural: "Anuais" },
  { key: "trimestral", label: "Trimestral", plural: "Trimestrais" },
  { key: "mensal", label: "Mensal", plural: "Mensais" },
] as const;

export const OBJECTIVE_STATUSES = [
  { key: "planejado", label: "Planejado" },
  { key: "em_andamento", label: "Em andamento" },
  { key: "atingido", label: "Atingido" },
  { key: "nao_atingido", label: "Não atingido" },
] as const;

export const CAMPAIGN_STAGES = [
  { key: "planejamento", label: "Planejamento" },
  { key: "preparacao", label: "Preparação" },
  { key: "producao", label: "Produção" },
  { key: "aprovacao", label: "Aprovação" },
  { key: "publicacao", label: "Publicação" },
  { key: "acompanhamento", label: "Acompanhamento" },
  { key: "encerramento", label: "Encerramento" },
  { key: "analise", label: "Análise" },
] as const;

// Fonte de verdade: o campo "status" (planejada/em_andamento/concluida/cancelada) usado pelos
// contadores de Início, Espaço 360 e Resultados é derivado automaticamente da etapa do ciclo
// (stage), que é o único campo que o usuário de fato edita na aba "Ciclo" da campanha.
// Isso evita que "status" fique parado no valor padrão para sempre.
export function deriveCampaignStatus(stage: string): "planejada" | "em_andamento" | "concluida" {
  if (stage === "planejamento") return "planejada";
  if (stage === "encerramento" || stage === "analise") return "concluida";
  return "em_andamento";
}

export const CAMPAIGN_STATUSES = [
  { key: "planejada", label: "Planejada" },
  { key: "em_andamento", label: "Em andamento" },
  { key: "concluida", label: "Concluída" },
  { key: "cancelada", label: "Cancelada" },
] as const;

export const DELIVERY_STATUSES = [
  { key: "pendente", label: "Pendente" },
  { key: "em_producao", label: "Em produção" },
  { key: "em_aprovacao", label: "Em aprovação" },
  { key: "entregue", label: "Entregue" },
  { key: "publicado", label: "Publicado" },
] as const;

export const SOLICITACAO_STATUSES = [
  { key: "nova", label: "Nova" },
  { key: "em_analise", label: "Em análise" },
  { key: "aprovada", label: "Aprovada" },
  { key: "em_execucao", label: "Em execução" },
  { key: "aguardando_cliente", label: "Aguardando cliente" },
  { key: "concluida", label: "Concluída" },
  { key: "cancelada", label: "Cancelada" },
] as const;

// Status de PRODUÇÃO do conteúdo — independente do status da ideia.
export const CONTEUDO_STATUSES = [
  { key: "rascunho", label: "Rascunho" },
  { key: "aprovada", label: "Aprovada" },
  { key: "produzida", label: "Produzida" },
  { key: "publicada", label: "Publicada" },
] as const;


export const CONTEUDO_FORMATOS = ["Reels", "Feed", "Carrossel", "Stories", "Live", "WhatsApp", "TikTok", "Outro"] as const;

// Mapa central de rótulos de status/etapa: usado pelo StatusChip como fallback sempre que uma
// tela não informar um label explícito, para nunca exibir a chave crua do banco (ex.: "preparacao")
// na interface. Reúne todas as listas de status/etapa já existentes num único lugar.
export const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  [
    ...PRIORITIES,
    ...INITIATIVE_STATUSES,
    ...TASK_SCOPES,
    ...TASK_STATUSES,
    ...CHANNEL_STATUSES,
    ...IDEIA_STATUSES,
    ...OBJECTIVE_STATUSES,
    ...CAMPAIGN_STAGES,
    ...CAMPAIGN_STATUSES,
    ...DELIVERY_STATUSES,
    ...SOLICITACAO_STATUSES,
    ...CONTEUDO_STATUSES,
  ].map((s) => [s.key, s.label] as const)
);

async function selectAllBy<T>(table: string, brandId: string, order: string): Promise<T[]> {
  const { data, error } = await supabase.from(table as any).select("*").eq("brand_id", brandId).order(order as any);
  if (error) throw error;
  return (data ?? []) as T[];
}

export const listObjectives = (brandId: string) => selectAllBy<Objective>("objectives", brandId, "order_index");
export const listDeliveries = (brandId: string) => selectAllBy<Delivery>("deliveries", brandId, "created_at");
export const listKpis = (brandId: string) => selectAllBy<Kpi>("kpis", brandId, "created_at");
export const listSolicitacoes = (brandId: string) => selectAllBy<Solicitacao>("solicitacoes", brandId, "created_at");
export const listConteudos = (brandId: string) => selectAllBy<Conteudo>("conteudos", brandId, "created_at");

export async function createObjective(input: Database["public"]["Tables"]["objectives"]["Insert"]) {
  const { data, error } = await supabase.from("objectives").insert(input).select().single();
  if (error) throw error;
  return data;
}
export async function updateObjective(id: string, patch: Database["public"]["Tables"]["objectives"]["Update"]) {
  const { error } = await supabase.from("objectives").update(patch).eq("id", id);
  if (error) throw error;
}

export async function updateCampaign(id: string, patch: Database["public"]["Tables"]["espaco360_campaigns"]["Update"]) {
  const { error } = await supabase.from("espaco360_campaigns").update(patch).eq("id", id);
  if (error) throw error;
}
export async function getCampaign(id: string): Promise<Campaign | null> {
  const { data, error } = await supabase.from("espaco360_campaigns").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createDelivery(input: Database["public"]["Tables"]["deliveries"]["Insert"]) {
  const { data, error } = await supabase.from("deliveries").insert(input).select().single();
  if (error) throw error;
  return data;
}
export async function updateDelivery(id: string, patch: Database["public"]["Tables"]["deliveries"]["Update"]) {
  const { error } = await supabase.from("deliveries").update(patch).eq("id", id);
  if (error) throw error;
}

export async function createKpi(input: Database["public"]["Tables"]["kpis"]["Insert"]) {
  const { data, error } = await supabase.from("kpis").insert(input).select().single();
  if (error) throw error;
  return data;
}
export async function updateKpi(id: string, patch: Database["public"]["Tables"]["kpis"]["Update"]) {
  const { error } = await supabase.from("kpis").update(patch).eq("id", id);
  if (error) throw error;
}

export async function createSolicitacao(input: Database["public"]["Tables"]["solicitacoes"]["Insert"]) {
  const { data, error } = await supabase.from("solicitacoes").insert(input).select().single();
  if (error) throw error;
  return data;
}
export async function updateSolicitacao(id: string, patch: Database["public"]["Tables"]["solicitacoes"]["Update"]) {
  const { error } = await supabase.from("solicitacoes").update(patch).eq("id", id);
  if (error) throw error;
}
export async function convertSolicitacaoToTask(solicitacao: Solicitacao) {
  // O trigger do banco cria a tarefa na própria transação da solicitação.
  // Esta função também recupera o vínculo de registros antigos, com bloqueio
  // de linha no UPDATE para que cliques simultâneos não criem tarefas extras.
  const { data: linked, error: linkError } = await supabase
    .from("solicitacoes")
    .update({ status: solicitacao.status === "concluida" || solicitacao.status === "cancelada"
      ? solicitacao.status : "em_execucao" })
    .eq("id", solicitacao.id)
    .eq("brand_id", solicitacao.brand_id)
    .select("task_id")
    .single();
  if (linkError) throw linkError;
  if (!linked.task_id) throw new Error("A tarefa não foi vinculada. Aplique a migração do Espaço 360.");
  const { data: task, error: taskError } = await supabase
    .from("espaco360_tasks")
    .select("*")
    .eq("id", linked.task_id)
    .eq("brand_id", solicitacao.brand_id)
    .single();
  if (taskError) throw taskError;
  return task;
}

export async function createConteudo(input: Database["public"]["Tables"]["conteudos"]["Insert"]) {
  const { data, error } = await supabase.from("conteudos").insert(input).select().single();
  if (error) throw error;
  return data;
}
export async function updateConteudo(id: string, patch: Database["public"]["Tables"]["conteudos"]["Update"]) {
  const { error } = await supabase.from("conteudos").update(patch).eq("id", id);
  if (error) throw error;
}
/**
 * "Usar ideia": cria uma INSTÂNCIA de conteúdo em produção a partir da ideia,
 * preservando a ideia original (nada nela é alterado ou movido). O vínculo
 * Ideia original → Conteúdo em produção fica em `conteudos.ideia_id`.
 */
export async function createConteudoFromIdeia(ideia: Ideia, brandId: string, campaignId?: string) {
  const existing = await supabase
    .from("conteudos")
    .select("id")
    .eq("ideia_id", ideia.id)
    .limit(1)
    .maybeSingle();
  if (existing.error) throw existing.error;

  return createConteudo({
    brand_id: brandId,
    ideia_id: ideia.id,
    campaign_id: campaignId ?? (ideia as any).campaign_id ?? null,
    title: existing.data ? `${ideia.title} (nova versão)` : ideia.title,
    briefing: ideia.description ?? null,
    formato: ideia.format,
    responsible: (ideia as any).responsible ?? null,
    status: "rascunho",
  });
}


export async function updateBrand(id: string, patch: Database["public"]["Tables"]["brands"]["Update"]) {
  const { error } = await supabase.from("brands").update(patch).eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Operação: notas, lembretes, avisos e datas importantes
// ---------------------------------------------------------------------------

export type Nota = {
  id: string;
  brand_id: string;
  kind: "nota" | "lembrete" | "aviso" | "data_importante";
  title: string;
  content: string | null;
  note_date: string | null;
  pinned: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export const NOTE_KINDS = [
  { key: "nota", label: "Nota" },
  { key: "lembrete", label: "Lembrete" },
  { key: "aviso", label: "Aviso" },
  { key: "data_importante", label: "Data importante" },
] as const;

export async function listNotas(brandId: string): Promise<Nota[]> {
  const { data, error } = await supabase
    .from("espaco360_notes" as any)
    .select("*")
    .eq("brand_id", brandId)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Nota[];
}

export async function createNota(input: Partial<Nota> & { brand_id: string; title: string }) {
  const { data, error } = await supabase.from("espaco360_notes" as any).insert(input as any).select().single();
  if (error) throw error;
  return data as unknown as Nota;
}

export async function updateNota(id: string, patch: Partial<Nota>) {
  const { error } = await supabase.from("espaco360_notes" as any).update(patch as any).eq("id", id);
  if (error) throw error;
}

export async function deleteNota(id: string) {
  const { error } = await supabase.from("espaco360_notes" as any).delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Cadastro de equipe / pessoas
// ---------------------------------------------------------------------------

export type TeamMember = {
  id: string;
  user_id: string | null;
  name: string;
  email: string | null;
  job_title: string | null;
  avatar_url: string | null;
  kind: string;
  brand_id: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export const TEAM_KINDS = [
  { key: "equipe", label: "Equipe Reach" },
  { key: "cliente", label: "Cliente" },
  { key: "convidado", label: "Convidado" },
] as const;

export async function listTeamMembers(brandId?: string): Promise<TeamMember[]> {
  let query = supabase.from("team_members" as any).select("*").eq("active", true).order("name");
  if (brandId) query = query.or(`brand_id.is.null,brand_id.eq.${brandId}`);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as TeamMember[];
}

export async function createTeamMember(input: Partial<TeamMember> & { name: string }) {
  const { myOrganizationId } = await import("@/lib/agency-data");
  const organization_id = input.brand_id ? undefined : await myOrganizationId();
  const { data, error } = await supabase.from("team_members" as any).insert({ ...input, organization_id } as any).select().single();
  if (error) throw error;
  return data as unknown as TeamMember;
}

export async function updateTeamMember(id: string, patch: Partial<TeamMember>) {
  const { error } = await supabase.from("team_members" as any).update(patch as any).eq("id", id);
  if (error) throw error;
}

export async function deleteTeamMember(id: string) {
  const { error } = await supabase.from("team_members" as any).delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Reuniões com participantes
// ---------------------------------------------------------------------------

export type MeetingParticipant = { name: string; role?: string | null };

export function meetingParticipants(meeting: Meeting): MeetingParticipant[] {
  const raw = (meeting as any).participants;
  return Array.isArray(raw) ? (raw as MeetingParticipant[]) : [];
}

export async function updateMeeting(id: string, patch: Record<string, unknown>) {
  const { error } = await supabase.from("espaco360_meetings").update(patch as any).eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Helpers de conteúdo / produção
// ---------------------------------------------------------------------------

export type FileRef = { name: string; url: string; path?: string };

export function fileRefs(value: unknown): FileRef[] {
  return Array.isArray(value) ? (value as FileRef[]) : [];
}

export function nextConteudoStatus(status: string) {
  const idx = CONTEUDO_STATUSES.findIndex((s) => s.key === status);
  return CONTEUDO_STATUSES[Math.min(idx + 1, CONTEUDO_STATUSES.length - 1)].key;
}

export async function getConteudo(id: string): Promise<Conteudo | null> {
  const { data, error } = await supabase.from("conteudos").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Cliente modular: módulos habilitados, status e contratação
// ---------------------------------------------------------------------------

export type BrandModules = {
  biblioteca: boolean;
  plano: boolean;
  espaco360: boolean;
  workspace: boolean;
  /** Like: aprovação de materiais pelo cliente (desligado até ser contratado). */
  like: boolean;
};

export const DEFAULT_MODULES: BrandModules = { biblioteca: true, plano: false, espaco360: false, workspace: true, like: false };

export const MODULE_DEFS = [
  { key: "biblioteca", label: "Biblioteca de Conteúdo", description: "Banco de ideias, categorias, roteiros e conteúdos. Funciona sem Plano 360." },
  { key: "espaco360", label: "Espaço 360", description: "Plano, estratégias, campanhas, tarefas, reuniões e acompanhamento." },
  { key: "workspace", label: "Reach Workspace", description: "Integração operacional: envia criações e solicitações ao Workspace." },
  { key: "like", label: "Like", description: "Aprovação de posts, roteiros, peças e vídeos pelo cliente." },
] as const satisfies readonly { key: keyof BrandModules; label: string; description: string }[];

/** Lê os módulos habilitados de uma marca, com fallback seguro para marcas antigas. */
export function brandModules(brand: Pick<Brand, "id"> & { modules?: unknown } | null | undefined): BrandModules {
  const raw = (brand as any)?.modules;
  if (!raw || typeof raw !== "object") return { ...DEFAULT_MODULES };
  return {
    biblioteca: raw.biblioteca !== false,
    plano: raw.plano === true,
    espaco360: raw.espaco360 === true,
    workspace: raw.workspace !== false,
    like: raw.like === true,
  };
}

export const CLIENT_STATUSES = [
  { key: "ativo", label: "Ativo" },
  { key: "onboarding", label: "Onboarding" },
  { key: "pausado", label: "Pausado" },
  { key: "encerrado", label: "Encerrado" },
] as const;

export const CONTRACT_TYPES = [
  { key: "recorrente", label: "Recorrente" },
  { key: "projeto", label: "Projeto" },
  { key: "consultoria", label: "Consultoria" },
  { key: "pontual", label: "Pontual" },
] as const;

// ---------------------------------------------------------------------------
// Integração com o Reach Workspace
// ---------------------------------------------------------------------------

export type WorkspaceDispatch = {
  id: string;
  brand_id: string;
  origin: "criacao" | "solicitacao" | string;
  source_table: string | null;
  source_id: string | null;
  title: string;
  payload: Record<string, unknown>;
  status: string;
  response: string | null;
  external_id: string | null;
  created_at: string;
  updated_at: string;
};

export const DISPATCH_STATUSES = [
  { key: "pendente", label: "Pendente" },
  { key: "enviado", label: "Enviado" },
  { key: "erro", label: "Erro" },
] as const;

export async function listWorkspaceDispatches(brandId?: string): Promise<WorkspaceDispatch[]> {
  let q = supabase.from("workspace_dispatches" as any).select("*").order("created_at", { ascending: false }).limit(200);
  if (brandId) q = q.eq("brand_id", brandId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as WorkspaceDispatch[];
}

export function workspaceConnection(brand: Brand | null | undefined) {
  const b = brand as any;
  return {
    connected: !!b?.workspace_connected,
    url: (b?.workspace_url as string | null) ?? null,
    clientId: (b?.workspace_client_id as string | null) ?? null,
  };
}

/**
 * Envia uma criação ou solicitação para o Reach Workspace preservando o vínculo
 * entre os dois sistemas. O registro é sempre gravado em `workspace_dispatches`
 * (origem, cliente e payload). Se a marca tiver um endpoint do Workspace
 * configurado, o payload é entregue via POST e o estado é atualizado.
 */
export async function dispatchToWorkspace(input: {
  brand: Brand;
  origin: "criacao" | "solicitacao";
  title: string;
  sourceTable: string;
  sourceId: string;
  payload: Record<string, unknown>;
}): Promise<WorkspaceDispatch> {
  const conn = workspaceConnection(input.brand);
  const body = {
    source: "reach-brand",
    origin: input.origin,
    client: { id: input.brand.id, slug: input.brand.slug, name: input.brand.name, workspace_client_id: conn.clientId },
    title: input.title,
    reference: { table: input.sourceTable, id: input.sourceId },
    data: input.payload,
  };

  const { data, error } = await supabase
    .from("workspace_dispatches" as any)
    .insert({
      brand_id: input.brand.id,
      origin: input.origin,
      source_table: input.sourceTable,
      source_id: input.sourceId,
      title: input.title,
      payload: body as any,
      status: "pendente",
    } as any)
    .select()
    .single();
  if (error) throw error;
  const row = data as unknown as WorkspaceDispatch;

  if (!conn.connected || !conn.url) return row;

  try {
    const res = await fetch(conn.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let externalId: string | null = null;
    try {
      externalId = (JSON.parse(text)?.id as string) ?? null;
    } catch {
      externalId = null;
    }
    await supabase
      .from("workspace_dispatches" as any)
      .update({ status: res.ok ? "enviado" : "erro", response: text.slice(0, 2000), external_id: externalId })
      .eq("id", row.id);
    return { ...row, status: res.ok ? "enviado" : "erro", response: text, external_id: externalId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao contatar o Workspace";
    await supabase.from("workspace_dispatches" as any).update({ status: "erro", response: message }).eq("id", row.id);
    return { ...row, status: "erro", response: message };
  }
}

// ---------------------------------------------------------------------------
// Agenda: compromissos com horário, responsável e data final de entrega
// ---------------------------------------------------------------------------

export type CalendarEventFull = CalendarEvent & {
  start_time: string | null;
  end_time: string | null;
  responsible: string | null;
  status: string;
  delivery_date: string | null;
  delivery_title: string | null;
};

export const EVENT_TYPES = [
  { key: "compromisso", label: "Compromisso" },
  { key: "reuniao", label: "Reunião" },
  { key: "gravacao", label: "Gravação" },
  { key: "publicacao", label: "Publicação" },
  { key: "prazo", label: "Prazo" },
] as const;

export const EVENT_STATUSES = [
  { key: "agendado", label: "Agendado" },
  { key: "confirmado", label: "Confirmado" },
  { key: "concluido", label: "Concluído" },
  { key: "cancelado", label: "Cancelado" },
] as const;

export async function updateCalendarEvent(id: string, patch: Record<string, unknown>) {
  const { error } = await supabase.from("espaco360_calendar_events").update(patch as any).eq("id", id);
  if (error) throw error;
}

export async function deleteCalendarEvent(id: string) {
  const { error } = await supabase.from("espaco360_calendar_events").delete().eq("id", id);
  if (error) throw error;
}

export async function updateSectionTitle(sectionId: string, title: string) {
  const { error } = await supabase.from("brand_home_sections").update({ title }).eq("id", sectionId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Acessos: convites e histórico
// ---------------------------------------------------------------------------

export type BrandInvite = {
  id: string;
  brand_id: string;
  email: string;
  name: string | null;
  member_role: string;
  status: string;
  invited_by: string | null;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
  is_admin?: boolean;
  permissions?: string[];
};

export type BrandMemberRow = {
  brand_id: string;
  user_id: string;
  member_role: string;
  is_admin: boolean;
  permissions: string[];
  created_at: string;
  profile: { display_name: string | null; email: string | null; active: boolean } | null;
};

/** Membros de um cliente (marca), com dados do perfil já resolvidos — usado
 * na gestão "Configurações → Clientes → Usuários". */
export async function listBrandMembersFull(brandId: string): Promise<BrandMemberRow[]> {
  const { data, error } = await (supabase as any)
    .from("brand_members")
    .select("brand_id, user_id, member_role, is_admin, permissions, created_at, profiles!brand_members_user_id_profiles_fkey(display_name, email, active)")
    .eq("brand_id", brandId)
    .order("created_at");
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => ({
    brand_id: r.brand_id,
    user_id: r.user_id,
    member_role: r.member_role,
    is_admin: !!r.is_admin,
    permissions: r.permissions ?? [],
    created_at: r.created_at,
    profile: r.profiles ?? null,
  }));
}

export async function updateBrandMemberAccess(brandId: string, userId: string, patch: { is_admin?: boolean; permissions?: string[] }) {
  const { error } = await (supabase as any)
    .from("brand_members")
    .update(patch)
    .eq("brand_id", brandId)
    .eq("user_id", userId);
  if (error) throw error;
}

/** Ativa/desativa o próprio usuário (perfil) — usado por admin de agência ou
 * admin do cliente para gerenciar colaboradores; a RLS/trigger no banco é
 * quem decide se o chamador tem autorização real. */
export async function setProfileActive(userId: string, active: boolean) {
  const { error } = await (supabase as any).from("profiles").update({ active }).eq("id", userId);
  if (error) throw error;
}

export type BrandAccessLog = {
  id: string;
  brand_id: string;
  user_id: string | null;
  user_email: string | null;
  event: string;
  context: string | null;
  status: string;
  created_at: string;
};

export const ACCESS_ROLES = [
  { key: "agency", label: "Agência" },
  { key: "client", label: "Cliente" },
  { key: "viewer", label: "Visualizador" },
] as const;

export async function listBrandInvites(brandId: string): Promise<BrandInvite[]> {
  const { data, error } = await (supabase as any)
    .from("brand_invites")
    .select("*")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BrandInvite[];
}

export async function cancelBrandInvite(id: string) {
  const { error } = await (supabase as any).from("brand_invites").delete().eq("id", id);
  if (error) throw error;
}

export async function reopenBrandInvite(id: string) {
  const { error } = await (supabase as any).from("brand_invites").update({ status: "pendente" }).eq("id", id);
  if (error) throw error;
}

export async function listBrandAccessLogs(brandId: string, limit = 60): Promise<BrandAccessLog[]> {
  const { data, error } = await (supabase as any)
    .from("brand_access_logs")
    .select("*")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as BrandAccessLog[];
}

/** Registra o acesso do usuário atual ao ambiente do cliente (1x por sessão/marca). */
export async function logBrandAccess(brandId: string, event = "acesso", context?: string | null) {
  if (typeof window !== "undefined") {
    const key = `reach:access:${brandId}:${event}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  }
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return;
  await (supabase as any).from("brand_access_logs").insert({
    brand_id: brandId,
    user_id: user.id,
    user_email: user.email ?? null,
    event,
    context: context ?? null,
    status: "sucesso",
  });
}
