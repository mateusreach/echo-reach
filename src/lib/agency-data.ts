// Camada de dados do ambiente da Agência (Reach): papéis, equipe, clientes,
// comunicação interna, calendário e referências. RLS garante as permissões.
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

// ---------------------------------------------------------------------------
// Papéis — Usuário → Organização → Papel → Permissões
// ---------------------------------------------------------------------------

export type AppRole = "agency_admin" | "agency_member" | "client";

export const ROLE_LABELS: Record<AppRole, string> = {
  agency_admin: "Administrador da Agência",
  agency_member: "Equipe da Agência",
  client: "Cliente",
};

export type UserRole = { id: string; user_id: string; role: AppRole; created_at: string };

export async function listUserRoles(): Promise<UserRole[]> {
  const { data, error } = await db.from("user_roles").select("*");
  if (error) throw error;
  return (data ?? []) as UserRole[];
}

export async function myRoles(): Promise<AppRole[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user.id;
  if (!uid) return [];
  const { data, error } = await db.from("user_roles").select("role").eq("user_id", uid);
  if (error) return [];
  return ((data ?? []) as { role: AppRole }[]).map((r) => r.role);
}

export type Access = {
  userId: string | null;
  organizationId: string | null;
  roles: AppRole[];
  isAgency: boolean;
  isAdmin: boolean;
  isClient: boolean;
};

/** Fonte única de verdade sobre o que a pessoa autenticada pode acessar. */
export async function getAccess(): Promise<Access> {
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user.id ?? null;
  if (!uid) return { userId: null, organizationId: null, roles: [], isAgency: false, isAdmin: false, isClient: false };

  const [{ data: roleRows, error: rolesError }, { data: profile, error: profileError }] = await Promise.all([
    db.from("user_roles").select("role").eq("user_id", uid),
    db.from("profiles").select("role, organization_id").eq("id", uid).maybeSingle(),
  ]);
  if (rolesError) throw rolesError;
  if (profileError) throw profileError;

  const roles = ((roleRows ?? []) as { role: AppRole }[]).map((r) => r.role);
  // Compatibilidade: contas antigas marcadas como "agency" no perfil.
  if (roles.length === 0 && (profile as any)?.role === "agency") roles.push("agency_member");
  if (roles.length === 0) roles.push("client");

  const isAdmin = roles.includes("agency_admin");
  const isAgency = isAdmin || roles.includes("agency_member");
  const organizationId = (profile as any)?.organization_id ?? null;
  return { userId: uid, organizationId, roles, isAgency, isAdmin, isClient: !isAgency };
}

let cachedOrgId: string | null | undefined;
/** Organização (agência) do usuário autenticado — cacheada na sessão do navegador. Toda linha criada por um usuário de agência deve carregar este valor. */
export async function myOrganizationId(): Promise<string | null> {
  if (cachedOrgId !== undefined) return cachedOrgId;
  const access = await getAccess();
  cachedOrgId = access.organizationId;
  return cachedOrgId;
}

export async function setUserRole(userId: string, role: AppRole) {
  const { error: delError } = await db.from("user_roles").delete().eq("user_id", userId);
  if (delError) throw delError;
  const { error } = await db.from("user_roles").insert({ user_id: userId, role });
  if (error) throw error;
}

export type ProfileRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  role: string;
  job_title: string | null;
  avatar_url: string | null;
};

export async function listProfiles(): Promise<ProfileRow[]> {
  const { data, error } = await db.from("profiles").select("*").order("display_name");
  if (error) throw error;
  return (data ?? []) as ProfileRow[];
}

// ---------------------------------------------------------------------------
// Convites de equipe da agência — separado de brand_invites (que é só para
// convidar pessoas a um cliente/marca específico). Um novo colaborador da
// agência nunca "existe" solto no banco: ele só ganha papel/permissões
// quando aceita um convite (handle_new_user() no banco cuida disso).
// ---------------------------------------------------------------------------

export type AgencyInvite = {
  id: string;
  email: string;
  name: string | null;
  role: AppRole;
  job_title: string | null;
  permissions: PermissionKey[];
  status: "pendente" | "aceito" | "cancelado";
  invited_by: string | null;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function listAgencyInvites(): Promise<AgencyInvite[]> {
  const { data, error } = await db.from("agency_invites").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as AgencyInvite[];
}

export async function createAgencyInvite(input: {
  email: string;
  name?: string | null;
  role?: AppRole;
  job_title?: string | null;
  permissions?: PermissionKey[];
}) {
  const { data: sessionData } = await supabase.auth.getSession();
  const { data, error } = await db
    .from("agency_invites")
    .insert({
      email: input.email.trim().toLowerCase(),
      name: input.name?.trim() || null,
      role: input.role ?? "agency_member",
      job_title: input.job_title?.trim() || null,
      permissions: input.permissions ?? [],
      invited_by: sessionData.session?.user.id ?? null,
      organization_id: await myOrganizationId(),
    })
    .select()
    .single();
  if (error) throw error;
  return data as AgencyInvite;
}

export async function cancelAgencyInvite(id: string) {
  const { error } = await db.from("agency_invites").update({ status: "cancelado" }).eq("id", id);
  if (error) throw error;
}

/** Reenviar convite: reabre um convite cancelado (o e-mail volta a poder ser usado no cadastro). */
export async function reopenAgencyInvite(id: string) {
  const { error } = await db.from("agency_invites").update({ status: "pendente" }).eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Comunicação interna da agência
// ---------------------------------------------------------------------------

export type AgencyPost = {
  id: string;
  kind: string;
  title: string;
  content: string | null;
  pinned: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export const POST_KINDS = [
  { key: "aviso", label: "Aviso" },
  { key: "atualizacao", label: "Atualização" },
  { key: "comunicado", label: "Comunicado" },
  { key: "nota", label: "Nota interna" },
] as const;

export async function listAgencyPosts(): Promise<AgencyPost[]> {
  const { data, error } = await db
    .from("agency_posts")
    .select("*")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as AgencyPost[];
}

export async function createAgencyPost(input: Partial<AgencyPost> & { title: string }) {
  const { data: sessionData } = await supabase.auth.getSession();
  const { data, error } = await db
    .from("agency_posts")
    .insert({ ...input, created_by: sessionData.session?.user.id ?? null, organization_id: await myOrganizationId() })
    .select()
    .single();
  if (error) throw error;
  return data as AgencyPost;
}

export async function updateAgencyPost(id: string, patch: Partial<AgencyPost>) {
  const { error } = await db.from("agency_posts").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteAgencyPost(id: string) {
  const { error } = await db.from("agency_posts").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Calendário da agência
// ---------------------------------------------------------------------------

export type AgencyEvent = {
  id: string;
  title: string;
  event_date: string;
  event_time: string | null;
  category: string;
  brand_id: string | null;
  responsible: string | null;
  description: string | null;
  status: string;
  notes: string | null;
  created_at: string;
};

export const EVENT_CATEGORIES = [
  { key: "feriado", label: "Feriado", color: "var(--reach-amber)" },
  { key: "campanha", label: "Campanha", color: "var(--reach-blue)" },
  { key: "reuniao", label: "Reunião", color: "var(--reach-violet)" },
  { key: "entrega", label: "Entrega", color: "var(--reach-mint)" },
  { key: "evento", label: "Evento", color: "var(--reach-rose)" },
  { key: "interno", label: "Interno", color: "var(--muted-foreground)" },
] as const;

export const EVENT_STATUSES = [
  { key: "planejado", label: "Planejado" },
  { key: "confirmado", label: "Confirmado" },
  { key: "concluido", label: "Concluído" },
  { key: "cancelado", label: "Cancelado" },
] as const;

export async function listAgencyEvents(): Promise<AgencyEvent[]> {
  const { data, error } = await db.from("agency_events").select("*").order("event_date");
  if (error) throw error;
  return (data ?? []) as AgencyEvent[];
}

export async function createAgencyEvent(input: Partial<AgencyEvent> & { title: string; event_date: string }) {
  const { data: sessionData } = await supabase.auth.getSession();
  const { data, error } = await db
    .from("agency_events")
    .insert({ ...input, created_by: sessionData.session?.user.id ?? null, organization_id: await myOrganizationId() })
    .select()
    .single();
  if (error) throw error;
  return data as AgencyEvent;
}

export async function updateAgencyEvent(id: string, patch: Partial<AgencyEvent>) {
  const { error } = await db.from("agency_events").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteAgencyEvent(id: string) {
  const { error } = await db.from("agency_events").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Referências (Biblioteca)
// ---------------------------------------------------------------------------

export type RefLink = { label?: string; url: string };
export type RefAttachment = { name: string; url: string; type?: string };

export type Referencia = {
  id: string;
  brand_id: string | null;
  channel_id?: string | null;
  model_id?: string | null;
  active?: boolean;
  title: string;
  description: string | null;
  category: string;
  tags: string[];
  purpose: string | null;
  when_to_use: string | null;
  usage_notes: string | null;
  links: RefLink[];
  attachments: RefAttachment[];
  cover_url: string | null;
  created_at: string;
  updated_at: string;
};

export const REF_PURPOSES = [
  "Inspiração visual",
  "Criar conteúdo",
  "Desenvolver campanha",
  "Criar identidade",
  "Referência de abordagem",
  "Estudar concorrente",
  "Estruturar estratégia",
  "Criar roteiro",
  "Criar copy",
  "Outro",
] as const;

export const REF_WHEN = [
  "Sempre",
  "Quando necessário",
  "Em campanhas",
  "Em conteúdos específicos",
  "Para determinado cliente",
  "Em determinado projeto",
  "Não aplicável",
] as const;

export type RefCategoria = { id: string; name: string; order_index: number };

export async function listRefCategorias(): Promise<RefCategoria[]> {
  const { data, error } = await db.from("referencia_categorias").select("*").order("order_index");
  if (error) throw error;
  return (data ?? []) as RefCategoria[];
}

export async function createRefCategoria(name: string, orderIndex = 99) {
  const { data, error } = await db
    .from("referencia_categorias")
    .insert({ name, order_index: orderIndex })
    .select()
    .single();
  if (error) throw error;
  return data as RefCategoria;
}

export async function listReferencias(brandId?: string, opts?: { channelId?: string; modelId?: string }): Promise<Referencia[]> {
  let q = db.from("referencias").select("*").order("created_at", { ascending: false });
  if (brandId) q = q.eq("brand_id", brandId);
  if (opts?.channelId) q = q.eq("channel_id", opts.channelId);
  if (opts?.modelId) q = q.eq("model_id", opts.modelId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Referencia[];
}

export async function createReferencia(input: Partial<Referencia> & { title: string }) {
  const { data: sessionData } = await supabase.auth.getSession();
  const { data, error } = await db
    .from("referencias")
    .insert({ ...input, created_by: sessionData.session?.user.id ?? null, organization_id: await myOrganizationId() })
    .select()
    .single();
  if (error) throw error;
  return data as Referencia;
}

export async function updateReferencia(id: string, patch: Partial<Referencia>) {
  const { error } = await db.from("referencias").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteReferencia(id: string) {
  const { error } = await db.from("referencias").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Visão operacional — "quem está fazendo o quê"
// ---------------------------------------------------------------------------

export type WorkItem = {
  id: string;
  kind: "tarefa" | "solicitacao" | "campanha" | "entrega";
  title: string;
  brandId: string | null;
  responsible: string | null;
  status: string;
  dueDate: string | null;
  priority: string | null;
};

export async function listWorkItems(): Promise<WorkItem[]> {
  const [tasks, sols, camps, dels, profiles] = await Promise.all([
    db.from("espaco360_tasks").select("*"),
    db.from("solicitacoes").select("*"),
    db.from("espaco360_campaigns").select("*"),
    db.from("deliveries").select("*"),
    db.from("profiles").select("id, display_name"),
  ]);

  const nameById = new Map<string, string>(
    ((profiles.data ?? []) as any[]).map((p) => [p.id, p.display_name ?? ""]),
  );

  const items: WorkItem[] = [];
  for (const t of (tasks.data ?? []) as any[]) {
    items.push({
      id: t.id,
      kind: "tarefa",
      title: t.title,
      brandId: t.brand_id,
      responsible: t.assignee_id ? nameById.get(t.assignee_id) ?? null : null,
      status: t.status,
      dueDate: t.due_date,
      priority: t.priority,
    });
  }
  for (const s of (sols.data ?? []) as any[]) {
    items.push({
      id: s.id,
      kind: "solicitacao",
      title: s.title,
      brandId: s.brand_id,
      responsible: null,
      status: s.status,
      dueDate: s.due_date,
      priority: s.priority,
    });
  }
  for (const c of (camps.data ?? []) as any[]) {
    items.push({
      id: c.id,
      kind: "campanha",
      title: c.title,
      brandId: c.brand_id,
      responsible: c.responsible ?? null,
      status: c.status,
      dueDate: c.end_date,
      priority: c.priority,
    });
  }
  for (const d of (dels.data ?? []) as any[]) {
    items.push({
      id: d.id,
      kind: "entrega",
      title: d.title,
      brandId: d.brand_id,
      responsible: null,
      status: d.status,
      dueDate: d.due_date,
      priority: null,
    });
  }
  return items;
}

export function isLate(item: { dueDate: string | null; status: string }) {
  if (!item.dueDate) return false;
  if (["concluida", "concluido", "cancelada", "cancelado", "entregue"].includes(item.status)) return false;
  return item.dueDate < todayISO();
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Confirmações de leitura dos comunicados ("Ciente")
// ---------------------------------------------------------------------------

export type PostAck = { id: string; post_id: string; user_id: string; created_at: string };

export async function listPostAcks(postId?: string): Promise<PostAck[]> {
  let q = db.from("agency_post_acks").select("*").order("created_at", { ascending: false });
  if (postId) q = q.eq("post_id", postId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as PostAck[];
}

export async function ackPost(postId: string) {
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user.id;
  if (!uid) throw new Error("Sessão expirada.");
  const { error } = await db.from("agency_post_acks").insert({ post_id: postId, user_id: uid });
  if (error && !`${error.message}`.includes("duplicate")) throw error;
}

export async function unackPost(postId: string) {
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData.session?.user.id;
  if (!uid) return;
  const { error } = await db.from("agency_post_acks").delete().eq("post_id", postId).eq("user_id", uid);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Permissões por colaborador — Agência → Equipe → Colaborador → Permissões
// ---------------------------------------------------------------------------

// Chaves legadas: mantidas porque já são checadas literalmente em RLS no banco
// (ex.: plan_templates usa has_permission(auth.uid(), 'modelos_plano.gerenciar')).
// Continuam disponíveis para concessão, e cada uma corresponde 1:1 a uma célula
// "administrar" da matriz módulo × ação abaixo.
export type LegacyPermissionKey =
  | "clientes.gerenciar"
  | "equipe.gerenciar"
  | "modelos_plano.gerenciar"
  | "referencias.gerenciar"
  | "comunicados.publicar"
  | "calendario.gerenciar"
  | "identidade.gerenciar";

export const LEGACY_PERMISSION_DEFS: { key: LegacyPermissionKey; label: string; description: string }[] = [
  { key: "clientes.gerenciar", label: "Gerenciar clientes", description: "Criar, editar e configurar clientes e seus acessos." },
  { key: "equipe.gerenciar", label: "Gerenciar equipe", description: "Cadastrar, editar, ativar/desativar colaboradores e papéis." },
  { key: "modelos_plano.gerenciar", label: "Gerenciar modelos de plano", description: "Criar, editar, duplicar e ativar modelos de plano." },
  { key: "referencias.gerenciar", label: "Gerenciar referências", description: "Adicionar, editar e excluir referências dos clientes." },
  { key: "comunicados.publicar", label: "Publicar comunicados", description: "Criar, fixar e excluir comunicados internos." },
  { key: "calendario.gerenciar", label: "Gerenciar calendário", description: "Criar, editar e excluir eventos do calendário da agência." },
  { key: "identidade.gerenciar", label: "Gerenciar identidade", description: "Alterar logo, ícone, favicon e identidade do sistema." },
];

// Matriz granular módulo × ação. Cada módulo abaixo é uma área real e já
// existente do sistema (levantada a partir das rotas de /agencia/* e /b/$brandSlug/*),
// não uma lista fictícia. As ações disponíveis variam conforme o que faz sentido
// para cada módulo (ex.: dashboard não tem "excluir").
export const PERMISSION_ACTIONS = [
  { key: "visualizar", label: "Visualizar" },
  { key: "criar", label: "Criar" },
  { key: "editar", label: "Editar" },
  { key: "excluir", label: "Excluir" },
  { key: "administrar", label: "Administrar" },
] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number]["key"];

export const PERMISSION_MODULES: { key: string; label: string; actions: PermissionAction[] }[] = [
  { key: "clientes", label: "Clientes", actions: ["visualizar", "criar", "editar", "excluir", "administrar"] },
  { key: "equipe", label: "Equipe", actions: ["visualizar", "criar", "editar", "excluir", "administrar"] },
  { key: "plano", label: "Plano", actions: ["visualizar", "criar", "editar", "excluir"] },
  { key: "biblioteca", label: "Biblioteca", actions: ["visualizar", "criar", "editar", "excluir"] },
  { key: "espaco360", label: "Espaço 360", actions: ["visualizar", "criar", "editar", "excluir"] },
  { key: "modelos", label: "Modelos de plano", actions: ["visualizar", "criar", "editar", "excluir", "administrar"] },
  { key: "comunicacao", label: "Comunicação", actions: ["visualizar", "criar", "excluir"] },
  { key: "calendario", label: "Calendário", actions: ["visualizar", "criar", "editar", "excluir"] },
  { key: "referencias", label: "Referências", actions: ["visualizar", "criar", "editar", "excluir"] },
  { key: "configuracoes", label: "Configurações", actions: ["visualizar", "administrar"] },
];

export function modulePermissionKey(moduleKey: string, action: PermissionAction): string {
  return `${moduleKey}.${action}`;
}

// Subconjunto de módulos relevante para permissões de usuários DO CLIENTE
// (dentro do próprio ambiente da marca) — "clientes" e "equipe" são áreas da
// agência e não fazem sentido aqui.
export const CLIENT_PERMISSION_MODULE_KEYS = ["plano", "biblioteca", "espaco360", "referencias", "calendario", "configuracoes"];
export const CLIENT_PERMISSION_MODULES = PERMISSION_MODULES.filter((m) => CLIENT_PERMISSION_MODULE_KEYS.includes(m.key));

// Uma chave de permissão pode ser tanto "modulo.acao" (matriz nova) quanto uma
// chave legada — o mecanismo de checagem (has_permission / access.can) é o
// mesmo: comparação literal de string, então qualquer uma funciona.
export type PermissionKey = LegacyPermissionKey | string;
export const WORKSPACE_DENY_PERMISSION = "workspace.bloqueado";

// Mantido por compatibilidade com código existente que importa PERMISSION_DEFS;
// aponta para as chaves legadas (as únicas que possuem label/description fixos
// fora da matriz — a matriz é renderizada module × action diretamente na UI).
export const PERMISSION_DEFS = LEGACY_PERMISSION_DEFS;

export type UserPermission = { id: string; user_id: string; permission: PermissionKey; created_at: string };

export async function listUserPermissions(userId?: string): Promise<UserPermission[]> {
  let q = db.from("user_permissions").select("*");
  if (userId) q = q.eq("user_id", userId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as UserPermission[];
}

/** Substitui o conjunto de permissões de um colaborador. */
export async function setUserPermissions(userId: string, permissions: PermissionKey[]) {
  const { error: delError } = await db.from("user_permissions").delete().eq("user_id", userId);
  if (delError) throw delError;
  if (permissions.length === 0) return;
  const { error } = await db
    .from("user_permissions")
    .insert(permissions.map((permission) => ({ user_id: userId, permission })));
  if (error) throw error;
}

export type FullAccess = Access & {
  permissions: PermissionKey[];
  can: (permission: PermissionKey) => boolean;
};

/** Acesso completo: papel + permissões efetivas (admin tem todas). */
export async function getFullAccess(): Promise<FullAccess> {
  const access = await getAccess();
  let permissions: PermissionKey[] = [];
  if (access.userId) {
    if (access.isAdmin) permissions = PERMISSION_DEFS.map((p) => p.key);
    else permissions = (await listUserPermissions(access.userId).catch(() => [])).map((p) => p.permission);
  }
  return { ...access, permissions, can: (p) => access.isAdmin || permissions.includes(p) };
}

// ---------------------------------------------------------------------------
// Colaboradores (perfis da agência)
// ---------------------------------------------------------------------------

export type ProfilePatch = {
  display_name?: string | null;
  job_title?: string | null;
  avatar_url?: string | null;
  active?: boolean;
};

export async function updateProfileRow(id: string, patch: ProfilePatch) {
  const { error } = await db.from("profiles").update(patch).eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Modelos de Plano — construtor estruturado: Tipo de Planejamento -> Etapas
// -> Seções -> Campos. Gera o Plano (brand_home_sections) de um cliente.
// ---------------------------------------------------------------------------

export type TemplateFieldType =
  | "texto_curto"
  | "texto_longo"
  | "numero"
  | "data"
  | "selecao"
  | "selecao_multipla"
  | "sim_nao"
  | "escala"
  | "lista"
  | "imagem"
  | "arquivo"
  | "pilares"
  | "categorias"
  | "canais";

export const TEMPLATE_FIELD_TYPES: { key: TemplateFieldType; label: string; hasOptions?: boolean }[] = [
  { key: "texto_curto", label: "Texto curto" },
  { key: "texto_longo", label: "Texto longo" },
  { key: "numero", label: "Número" },
  { key: "data", label: "Data" },
  { key: "selecao", label: "Seleção", hasOptions: true },
  { key: "selecao_multipla", label: "Seleção múltipla", hasOptions: true },
  { key: "sim_nao", label: "Sim / Não" },
  { key: "escala", label: "Escala (1-5)" },
  { key: "lista", label: "Lista de itens" },
  { key: "imagem", label: "Imagem" },
  { key: "arquivo", label: "Arquivo" },
  { key: "pilares", label: "Pilares (da Biblioteca)" },
  { key: "categorias", label: "Categorias (da Biblioteca)" },
  { key: "canais", label: "Canais (do Espaço 360)" },
];

// Campos legados ("text"/"textarea"/"image"/"file") de modelos antigos são
// normalizados para os tipos novos ao carregar — nenhum modelo existente
// deixa de funcionar.
const LEGACY_FIELD_TYPE_MAP: Record<string, TemplateFieldType> = {
  text: "texto_curto",
  textarea: "texto_longo",
  image: "imagem",
  file: "arquivo",
};

export type TemplateField = {
  key: string;
  label: string;
  type: TemplateFieldType;
  value: string;
  required?: boolean;
  help?: string | null;
  placeholder?: string | null;
  options?: string[];
};

export type TemplateSection = { key: string; title: string; description?: string | null; fields: TemplateField[] };
export type TemplateStage = { key: string; title: string; description?: string | null; sections: TemplateSection[] };

export type PlanningTypeKey = "comunicacao" | "conteudo" | "campanha" | "publicitario" | "estrategico" | "redes_sociais" | "outro";

export const PLANNING_TYPES: { key: PlanningTypeKey; label: string; description: string }[] = [
  { key: "comunicacao", label: "Planejamento de Comunicação", description: "Marca, posicionamento, público, concorrência, mercado, tom de voz e pilares." },
  { key: "conteudo", label: "Planejamento de Conteúdo", description: "Pilares, categorias, formatos, linhas editoriais, calendário e distribuição." },
  { key: "campanha", label: "Planejamento de Campanha", description: "Contexto, conceito, mensagem, oferta, mídia, cronograma e mensuração." },
  { key: "publicitario", label: "Planejamento Publicitário", description: "Diagnóstico, estratégia, conceito, mídia, conteúdo e orçamento." },
  { key: "estrategico", label: "Planejamento Estratégico", description: "Diagnóstico, cenário, objetivos, estratégias, iniciativas e indicadores." },
  { key: "redes_sociais", label: "Planejamento de Redes Sociais", description: "Plataformas, pilares, formatos, calendário e métricas." },
  { key: "outro", label: "Outro", description: "Tipo personalizado — defina a estrutura do zero." },
];

export function planningTypeLabel(key: string | null | undefined) {
  return PLANNING_TYPES.find((t) => t.key === key)?.label ?? "Não definido";
}

export type PlanTemplate = {
  id: string;
  name: string;
  description: string | null;
  type: string | null;
  objective: string | null;
  audience: string | null;
  notes: string | null;
  active: boolean;
  stages: TemplateStage[];
  created_at: string;
  updated_at: string;
};

/** Fase do Plano do cliente (brand_home_sections.stage) — mantido para compatibilidade com Planos já existentes. */
export const TEMPLATE_STAGES = [
  { key: "alicerce", label: "Alicerce" },
  { key: "estrutura", label: "Estrutura" },
  { key: "acabamento", label: "Acabamento" },
  { key: "comunicacao", label: "Comunicação" },
  { key: "conhecimento", label: "Diagnóstico e Estudos" },
] as const;

/**
 * O Plano do cliente (brand_home_sections.stage) só aceita um conjunto fixo
 * de fases no banco (constraint de integridade). Etapas de um Modelo de
 * Plano com Tipo de Planejamento (Comunicação, Conteúdo, Campanha etc.) que
 * não sejam uma dessas fases caem todas na fase "conhecimento" — a Seção
 * mantém seu próprio título, então nada se perde, só se agrupa.
 */
export function resolveBrandStage(etapaKey: string): string {
  return TEMPLATE_STAGES.some((s) => s.key === etapaKey) ? etapaKey : "conhecimento";
}

export function slugKey(label: string) {
  return (
    label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || `item_${Date.now()}`
  );
}

function normalizeField(f: any): TemplateField {
  return {
    key: f.key,
    label: f.label,
    type: LEGACY_FIELD_TYPE_MAP[f.type] ?? (f.type as TemplateFieldType) ?? "texto_curto",
    value: f.value ?? "",
    required: !!f.required,
    help: f.help ?? null,
    placeholder: f.placeholder ?? null,
    options: Array.isArray(f.options) ? f.options : undefined,
  };
}

/**
 * A coluna no banco chama-se "sections" por razões históricas, mas guarda a
 * estrutura em 3 níveis (Etapas -> Seções -> Campos). Modelos antigos (2
 * níveis: seção com "stage" direto) são normalizados em uma Etapa por fase
 * na leitura, para nunca quebrar um modelo já existente.
 */
function normalizeStages(raw: unknown): TemplateStage[] {
  const arr = Array.isArray(raw) ? raw : [];
  if (arr.length === 0) return [];
  if ((arr[0] as any)?.sections) {
    return (arr as any[]).map((st) => ({
      key: st.key,
      title: st.title,
      description: st.description ?? null,
      sections: (st.sections ?? []).map((s: any) => ({
        key: s.key,
        title: s.title,
        description: s.description ?? null,
        fields: (s.fields ?? []).map(normalizeField),
      })),
    }));
  }
  // Formato legado: lista plana de seções com "stage" e "fields" direto.
  const byStage = new Map<string, TemplateStage>();
  for (const s of arr as any[]) {
    const stageKey = s.stage ?? "geral";
    if (!byStage.has(stageKey)) {
      byStage.set(stageKey, {
        key: stageKey,
        title: TEMPLATE_STAGES.find((t) => t.key === stageKey)?.label ?? stageKey,
        sections: [],
      });
    }
    byStage.get(stageKey)!.sections.push({ key: s.key, title: s.title, fields: (s.fields ?? []).map(normalizeField) });
  }
  return Array.from(byStage.values());
}

export async function listPlanTemplates(): Promise<PlanTemplate[]> {
  const { data, error } = await db.from("plan_templates").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as any[]).map((t) => ({ ...t, stages: normalizeStages(t.sections) }));
}

export async function getPlanTemplate(id: string): Promise<PlanTemplate | null> {
  const { data, error } = await db.from("plan_templates").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...(data as any), stages: normalizeStages((data as any).sections) };
}

export type PlanTemplateInput = {
  name: string;
  description?: string | null;
  type?: string | null;
  objective?: string | null;
  audience?: string | null;
  notes?: string | null;
  stages?: TemplateStage[];
};

export async function createPlanTemplate(input: PlanTemplateInput) {
  const { data: sessionData } = await supabase.auth.getSession();
  const { data, error } = await db
    .from("plan_templates")
    .insert({
      name: input.name,
      description: input.description ?? null,
      type: input.type ?? null,
      objective: input.objective ?? null,
      audience: input.audience ?? null,
      notes: input.notes ?? null,
      sections: input.stages ?? [],
      created_by: sessionData.session?.user.id ?? null,
      organization_id: await myOrganizationId(),
    })
    .select()
    .single();
  if (error) throw error;
  return { ...(data as any), stages: normalizeStages((data as any).sections) } as PlanTemplate;
}

export async function updatePlanTemplate(id: string, patch: Partial<PlanTemplateInput> & { active?: boolean }) {
  const row: Record<string, unknown> = { ...patch };
  if ("stages" in row) {
    row.sections = row.stages;
    delete row.stages;
  }
  const { error } = await db.from("plan_templates").update(row).eq("id", id);
  if (error) throw error;
}

export async function deletePlanTemplate(id: string) {
  const { error } = await db.from("plan_templates").delete().eq("id", id);
  if (error) throw error;
}

export async function duplicatePlanTemplate(template: PlanTemplate) {
  return createPlanTemplate({
    name: `${template.name} (cópia)`,
    description: template.description,
    type: template.type,
    objective: template.objective,
    audience: template.audience,
    notes: template.notes,
    stages: template.stages,
  });
}

/**
 * Gera as seções do Plano de um cliente a partir de um modelo: cada Seção de
 * cada Etapa vira uma linha em brand_home_sections (stage = chave da Etapa).
 * O modelo original permanece intacto — apenas cópias são gravadas no cliente.
 */
export async function applyTemplateToBrand(template: PlanTemplate, brandId: string) {
  const { data: existing } = await db.from("brand_home_sections").select("section_key, stage, order_index").eq("brand_id", brandId);
  const taken = new Set(((existing ?? []) as any[]).map((s) => `${s.stage}:${s.section_key}`));
  const baseOrder = new Map<string, number>();
  for (const s of (existing ?? []) as any[]) {
    baseOrder.set(s.stage, Math.max(baseOrder.get(s.stage) ?? 0, (s.order_index ?? 0) + 1));
  }

  const rows: Record<string, unknown>[] = [];
  for (const stage of template.stages) {
    const brandStage = resolveBrandStage(stage.key);
    for (const section of stage.sections) {
      if (taken.has(`${brandStage}:${section.key}`)) continue;
      const order = baseOrder.get(brandStage) ?? 0;
      baseOrder.set(brandStage, order + 1);
      rows.push({
        brand_id: brandId,
        stage: brandStage,
        section_key: section.key,
        title: section.title,
        order_index: order,
        fields: section.fields.map((f) => ({ ...f, value: "" })),
      });
    }
  }

  if (rows.length === 0) return 0;
  const { error } = await db.from("brand_home_sections").insert(rows);
  if (error) throw error;
  return rows.length;
}

// ---------------------------------------------------------------------------
// Modelos-base: ponto de partida para cada Tipo de Planejamento, e exemplo
// de como o construtor funciona. Não duplica: só cria os que ainda não
// existem (por nome).
// ---------------------------------------------------------------------------

function field(label: string, type: TemplateFieldType, extra?: Partial<TemplateField>): TemplateField {
  return { key: slugKey(label), label, type, value: "", ...extra };
}
function section(title: string, fields: TemplateField[]): TemplateSection {
  return { key: slugKey(title), title, fields };
}
function stage(title: string, sections: TemplateSection[]): TemplateStage {
  return { key: slugKey(title), title, sections };
}

function baseTemplateDefs(): { name: string; type: PlanningTypeKey; description: string; objective: string; stages: TemplateStage[] }[] {
  return [
    {
      name: "Planejamento de Comunicação",
      type: "comunicacao",
      description: "Marca, posicionamento, público, concorrência, mercado, tom de voz e pilares de comunicação.",
      objective: "Estruturar a comunicação da marca de ponta a ponta antes de partir para conteúdo e campanhas.",
      stages: [
        stage("Diagnóstico", [
          section("Marca", [
            field("Posicionamento atual", "texto_longo", { required: true }),
            field("Proposta de valor", "texto_longo"),
            field("Diferenciais", "texto_longo"),
          ]),
          section("Público", [
            field("Público-alvo", "texto_longo", { required: true }),
            field("Dores e desejos", "texto_longo"),
          ]),
          section("Mercado e concorrência", [
            field("Cenário de mercado", "texto_longo"),
            field("Principais concorrentes", "texto_longo"),
            field("Oportunidades", "texto_longo"),
          ]),
        ]),
        stage("Estratégia", [
          section("Direcionamento", [
            field("Objetivos de comunicação", "texto_longo", { required: true }),
            field("Tom de voz", "texto_longo"),
            field("Mensagens-chave", "texto_longo"),
          ]),
          section("Pilares", [field("Pilares estratégicos", "pilares"), field("Canais prioritários", "canais")]),
        ]),
      ],
    },
    {
      name: "Planejamento de Conteúdo",
      type: "conteudo",
      description: "Pilares, categorias, formatos, linhas editoriais, calendário e distribuição.",
      objective: "Organizar a produção de conteúdo a partir da estratégia da marca.",
      stages: [
        stage("Base estratégica", [
          section("Direcionamento", [
            field("Objetivo do conteúdo", "texto_longo", { required: true }),
            field("Público", "texto_longo"),
            field("Posicionamento", "texto_longo"),
          ]),
        ]),
        stage("Estrutura editorial", [
          section("Pilares e categorias", [field("Pilares", "pilares", { required: true }), field("Categorias", "categorias")]),
          section("Formatos e ritmo", [
            field("Formatos prioritários", "selecao_multipla", { options: ["Reels", "Carrossel", "Estático", "Stories", "TikTok"] }),
            field("Frequência de publicação", "texto_curto"),
            field("Canais", "canais"),
          ]),
        ]),
      ],
    },
    {
      name: "Planejamento de Campanha",
      type: "campanha",
      description: "Contexto, conceito, mensagem, oferta, mídia, cronograma e mensuração.",
      objective: "Estruturar uma campanha específica do conceito à mensuração de resultado.",
      stages: [
        stage("Contexto", [
          section("Diagnóstico", [
            field("Problema ou oportunidade", "texto_longo", { required: true }),
            field("Público da campanha", "texto_longo"),
            field("Concorrência relevante", "texto_longo"),
          ]),
        ]),
        stage("Estratégia da campanha", [
          section("Conceito", [
            field("Conceito criativo", "texto_longo", { required: true }),
            field("Mensagem principal", "texto_longo"),
            field("Oferta", "texto_longo"),
          ]),
          section("Execução", [
            field("Canais", "canais"),
            field("Período", "texto_curto"),
            field("Investimento previsto", "numero"),
          ]),
        ]),
        stage("Mensuração", [section("Indicadores", [field("KPIs da campanha", "texto_longo"), field("Meta de resultado", "texto_longo")])]),
      ],
    },
    {
      name: "Planejamento Publicitário",
      type: "publicitario",
      description: "Diagnóstico, estratégia, conceito, mídia, conteúdo, campanha e orçamento — visão completa.",
      objective: "Planejamento publicitário integrado, do diagnóstico à mídia.",
      stages: [
        stage("Diagnóstico", [
          section("Cenário", [
            field("Mercado e concorrência", "texto_longo", { required: true }),
            field("Público-alvo", "texto_longo"),
            field("Posicionamento", "texto_longo"),
          ]),
        ]),
        stage("Estratégia", [
          section("Direcionamento", [
            field("Objetivos", "texto_longo", { required: true }),
            field("Conceito de comunicação", "texto_longo"),
          ]),
        ]),
        stage("Execução", [
          section("Mídia e conteúdo", [field("Canais e mídia", "canais"), field("Cronograma", "texto_longo"), field("Orçamento", "numero")]),
        ]),
      ],
    },
    {
      name: "Planejamento Estratégico",
      type: "estrategico",
      description: "Diagnóstico, cenário, objetivos, estratégias, iniciativas, indicadores e cronograma.",
      objective: "Base estratégica de médio/longo prazo da marca, conectada a Objetivos e Estratégias do Espaço 360.",
      stages: [
        stage("Diagnóstico", [
          section("Contexto", [
            field("Cenário atual", "texto_longo", { required: true }),
            field("Mercado e concorrência", "texto_longo"),
            field("Público-alvo", "texto_longo"),
          ]),
        ]),
        stage("Direcionamento estratégico", [
          section("Prioridades", [
            field("Objetivos estratégicos", "texto_longo", { required: true }),
            field("Prioridades", "selecao", { options: ["Imediato", "Curto prazo", "Médio prazo", "Longo prazo"] }),
          ]),
          section("Indicadores", [field("Indicadores-chave", "texto_longo"), field("Responsáveis", "texto_curto")]),
        ]),
      ],
    },
    {
      name: "Planejamento de Redes Sociais",
      type: "redes_sociais",
      description: "Plataformas, pilares, formatos, calendário, campanhas e métricas.",
      objective: "Planejamento operacional das redes sociais da marca.",
      stages: [
        stage("Diagnóstico", [
          section("Base", [field("Público nas redes", "texto_longo", { required: true }), field("Posicionamento", "texto_longo")]),
        ]),
        stage("Operação", [
          section("Plataformas e pilares", [
            field("Plataformas", "selecao_multipla", { options: ["Instagram", "TikTok", "LinkedIn", "YouTube", "Facebook", "X"] }),
            field("Pilares", "pilares"),
            field("Formatos", "selecao_multipla", { options: ["Reels", "Carrossel", "Estático", "Stories", "Live"] }),
          ]),
          section("Calendário", [field("Frequência", "texto_curto"), field("Canais", "canais")]),
        ]),
      ],
    },
  ];
}

/** Cria os modelos-base que ainda não existem (comparação por nome). Não duplica. */
export async function seedBaseTemplates(): Promise<number> {
  const existing = await listPlanTemplates();
  const existingNames = new Set(existing.map((t) => t.name));
  const defs = baseTemplateDefs().filter((d) => !existingNames.has(d.name));
  for (const d of defs) {
    await createPlanTemplate({
      name: d.name,
      description: d.description,
      type: d.type,
      objective: d.objective,
      stages: d.stages,
    });
  }
  return defs.length;
}
