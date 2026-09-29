// ---------------------------------------------------------------------------
// AGÊNCIA — Equipe, colaborador e permissões (página 07)
//
// Uma pessoa da equipe = perfil (profiles + user_roles) somado ao cadastro
// operacional (team_members: paleta, liderança). A carga vem das tarefas do
// Workspace (owner_id / owner_name) e dos itens do Espaço 360. Sem banco, usa
// um conjunto de exemplo em memória.
// ---------------------------------------------------------------------------
import { supabase } from "@/integrations/supabase/client";
import {
  cancelAgencyInvite,
  listAgencyInvites,
  listUserPermissions,
  listWorkItems,
  modulePermissionKey,
  PERMISSION_MODULES,
  setUserPermissions,
  setUserRole,
  updateProfileRow,
  type AgencyInvite,
  type AppRole,
  type PermissionAction,
} from "@/lib/agency-data";
import { addDays, toISO, today } from "@/lib/workspace-data";
import { isDemoMode } from "@/lib/home-data";
import type { PathKey } from "@/components/echo/appearance";

const db = supabase as any;

export type TeamItem = { id: string; kind: "tarefa" | "solicitacao" | "campanha" | "entrega"; title: string; brandId: string | null; brandName: string; status: string; dueDate: string | null; late: boolean; sector: string | null };
export type TeamPerson = {
  id: string;
  memberId: string | null;
  name: string;
  email: string | null;
  jobTitle: string | null;
  avatarUrl: string | null;
  palette: PathKey;
  leader: boolean;
  active: boolean;
  role: AppRole;
  sectors: string[];
  clients: { id: string; name: string; slug: string }[];
  items: TeamItem[];
  open: number;
  late: number;
  weekDue: number;
  lastSeen: string | null;
  history: { text: string; at: string }[];
};
export type TeamData = { people: TeamPerson[]; invites: AgencyInvite[]; sectors: string[]; unassigned: TeamItem[]; adminCount: number };
export type PersonInput = { id: string; memberId: string | null; name: string; jobTitle: string; palette: PathKey; leader: boolean; active: boolean; role: AppRole; permissions: string[] };
export type InviteInput = { email: string; name: string; jobTitle: string; role: AppRole; permissions: string[] };

export const PALETTE_FROM_DB: Record<string, PathKey> = { blue: "ceu", pink: "blush", purple: "iris", orange: "solar" };
export const PALETTE_TO_DB: Record<PathKey, string> = { ceu: "blue", blush: "pink", iris: "purple", solar: "orange" };
const DONE = new Set(["Concluído", "concluida", "concluido", "cancelada", "cancelado", "entregue"]);
const iso = (n: number) => toISO(addDays(today(), n));

// ----- Perfis de permissão -----------------------------------------------------

const all = (m: string, acts: PermissionAction[]) => acts.filter((a) => PERMISSION_MODULES.find((x) => x.key === m)?.actions.includes(a)).map((a) => modulePermissionKey(m, a));
const everyModule = (acts: PermissionAction[], skip: string[] = []) => PERMISSION_MODULES.filter((m) => !skip.includes(m.key)).flatMap((m) => all(m.key, acts));

export const PERMISSION_PRESETS: { key: string; label: string; desc: string; perms: () => string[] }[] = [
  { key: "leitura", label: "Somente leitura", desc: "Vê todos os módulos, não altera nada.", perms: () => everyModule(["visualizar"]) },
  { key: "atendimento", label: "Atendimento", desc: "Clientes, Espaço 360, Like e calendário.", perms: () => [...everyModule(["visualizar"]), ...all("clientes", ["criar", "editar"]), ...all("espaco360", ["criar", "editar"]), ...all("like", ["criar", "editar", "comentar"]), ...all("calendario", ["criar", "editar"]), ...all("comunicacao", ["criar"])] },
  { key: "criacao", label: "Criação", desc: "Biblioteca, referências, plano e envio ao Like.", perms: () => [...everyModule(["visualizar"], ["equipe", "configuracoes"]), ...all("biblioteca", ["criar", "editar", "excluir"]), ...all("referencias", ["criar", "editar", "excluir"]), ...all("plano", ["criar", "editar"]), ...all("like", ["criar", "editar", "comentar"])] },
  { key: "gestao", label: "Gestão", desc: "Tudo, exceto administrar a agência.", perms: () => everyModule(["visualizar", "criar", "editar", "excluir", "comentar"]) },
];

/** O que cada ação libera, para explicar a matriz. */
export const ACTION_HELP: Record<string, string> = {
  visualizar: "Abre o módulo e lê o conteúdo.",
  criar: "Cadastra itens novos.",
  editar: "Altera itens existentes.",
  excluir: "Remove itens (com confirmação).",
  administrar: "Configura o módulo e gerencia acessos.",
  comentar: "Comenta materiais no Like.",
  aprovar: "Aprova ou pede ajustes no Like.",
};

// ----- exemplo em memória -----------------------------------------------------

type DemoPerson = Omit<TeamPerson, "items" | "open" | "late" | "weekDue" | "clients" | "sectors"> & { perms: string[] };
type DemoState = { people: DemoPerson[]; invites: AgencyInvite[]; items: (TeamItem & { owner: string | null })[] };
const DEMO_BRANDS = [
  { id: "b-fina", name: "Fina Fragrância", slug: "fina-fragrancia" },
  { id: "b-zelus", name: "Zelus", slug: "zelus" },
  { id: "b-eliza", name: "Eliza", slug: "eliza" },
  { id: "b-giuliana", name: "Dra. Giuliana", slug: "dra-giuliana" },
  { id: "b-isabela", name: "Isabela Gomes", slug: "isabela-gomes" },
  { id: "b-spirale", name: "Spirale", slug: "spirale" },
];
let demoState: DemoState | null = null;
function demo(): DemoState {
  if (demoState) return demoState;
  const p = (id: string, name: string, jobTitle: string, palette: PathKey, role: AppRole, extra: Partial<DemoPerson> = {}): DemoPerson => ({
    id, memberId: `m-${id}`, name, email: `${name.split(" ")[0].toLowerCase()}@reach.com.br`, jobTitle, avatarUrl: null, palette, leader: false, active: true, role, lastSeen: iso(0), history: [], perms: [], ...extra,
  });
  const gestao = PERMISSION_PRESETS[3].perms();
  const criacao = PERMISSION_PRESETS[2].perms();
  const atendimento = PERMISSION_PRESETS[1].perms();
  const people: DemoPerson[] = [
    p("u-helena", "Helena Duarte", "Diretora de Atendimento", "iris", "agency_admin", { leader: true, history: [{ text: "Aprovou o plano de outubro da Zelus", at: iso(0) }, { text: "Convidou Lara Pires para a equipe", at: iso(-2) }] }),
    p("u-rafael", "Rafael Monteiro", "Estrategista", "ceu", "agency_member", { perms: gestao, history: [{ text: "Enviou o carrossel “Notas de outono” ao cliente", at: iso(0) }, { text: "Atualizou a estratégia do trimestre da Fina", at: iso(-5) }] }),
    p("u-camila", "Camila Rocha", "Redatora", "blush", "agency_member", { perms: criacao, history: [{ text: "Criou 3 ideias no pilar “Bastidores”", at: iso(-1) }] }),
    p("u-bruno", "Bruno Tavares", "Diretor de Arte", "solar", "agency_member", { leader: true, perms: gestao, lastSeen: iso(-1), history: [{ text: "Enviou o carrossel para avaliação interna", at: iso(-3) }] }),
    p("u-marina", "Marina Lopes", "Designer", "blush", "agency_member", { perms: criacao, lastSeen: iso(-1), history: [{ text: "Concluiu as artes dos Stories da Eliza", at: iso(-1) }] }),
    p("u-theo", "Theo Almeida", "Editor de Vídeo", "ceu", "agency_member", { perms: criacao, lastSeen: iso(-2), history: [{ text: "Iniciou o Reels de lançamento da Zelus", at: iso(-3) }] }),
    p("u-julia", "Júlia Castro", "Atendimento", "iris", "agency_member", { perms: atendimento, history: [{ text: "Abriu a solicitação “Cardápio de outubro”", at: iso(0) }] }),
    p("u-andre", "André Nogueira", "Social media", "solar", "agency_member", { active: false, perms: criacao, lastSeen: iso(-48), history: [{ text: "Publicou o último post da Spirale", at: iso(-50) }] }),
  ];
  const t = (id: string, title: string, owner: string | null, b: number, sector: string, due: number, status = "Iniciada", kind: TeamItem["kind"] = "tarefa") => ({
    id, kind, title, owner, brandId: DEMO_BRANDS[b].id, brandName: DEMO_BRANDS[b].name, status, dueDate: iso(due), late: due < 0 && !DONE.has(status), sector,
  });
  const items = [
    t("t1", "Carrossel “Notas de outono”", "u-rafael", 0, "Estratégia", 1, "Avaliação externa"),
    t("t2", "Roteiro do Reels de lançamento", "u-rafael", 1, "Estratégia", -1),
    t("t3", "Plano de conteúdo de novembro", "u-rafael", 3, "Estratégia", 4),
    t("t4", "Legendas do Feed · semana 40", "u-camila", 3, "Redação", 0, "Ajuste"),
    t("t5", "Textos do TikTok · Fina", "u-camila", 0, "Redação", 2),
    t("t6", "Bio e destaques", "u-camila", 4, "Redação", -2),
    t("t7", "Artes do carrossel da Fina", "u-bruno", 0, "Arte", 0, "Avaliação interna"),
    t("t8", "Direção de fotos da coleção", "u-bruno", 5, "Arte", 5),
    t("t9", "Stories da semana", "u-marina", 2, "Arte", 0),
    t("t10", "Capa dos destaques", "u-marina", 4, "Arte", 3, "Parada"),
    t("t11", "Adaptação para Stories", "u-marina", 1, "Arte", -1),
    t("t12", "Reels de lançamento", "u-theo", 1, "Vídeo", 2),
    t("t13", "Cortes do podcast", "u-theo", 4, "Vídeo", 6, "Parada"),
    t("t14", "Retorno do cardápio de outubro", "u-julia", 1, "Atendimento", 1, "Aguardando retorno externo", "solicitacao"),
    t("t15", "Reunião de alinhamento mensal", "u-helena", 0, "Atendimento", 3, "Iniciada", "campanha"),
    t("t16", "Post de boas-vindas da Spirale", "u-andre", 5, "Redação", -40, "Concluído"),
    t("t17", "Fotos da coleção nova", null, 0, "Arte", 4, "Parada", "solicitacao"),
    t("t18", "Revisar pauta de novembro", null, 2, "Estratégia", 6, "Parada"),
  ];
  const now = new Date().toISOString();
  const invites: AgencyInvite[] = [
    { id: "i-lara", email: "lara@reach.com.br", name: "Lara Pires", role: "agency_member", job_title: "Designer júnior", permissions: criacao, status: "pendente", invited_by: "u-helena", accepted_at: null, created_at: iso(-2) + "T10:00:00Z", updated_at: now },
  ];
  demoState = { people, invites, items };
  return demoState;
}

function assemble(people: Omit<TeamPerson, "items" | "open" | "late" | "weekDue" | "clients" | "sectors">[], items: (TeamItem & { owner: string | null })[], brandSlug: Map<string, string>): TeamData {
  const weekEnd = iso(7);
  const out: TeamPerson[] = people.map((p) => {
    const own = items.filter((i) => i.owner === p.id);
    const open = own.filter((i) => !DONE.has(i.status));
    const clients = new Map<string, { id: string; name: string; slug: string }>();
    for (const i of open) if (i.brandId) clients.set(i.brandId, { id: i.brandId, name: i.brandName, slug: brandSlug.get(i.brandId) ?? "" });
    const sectorCount = new Map<string, number>();
    for (const i of own) if (i.sector) sectorCount.set(i.sector, (sectorCount.get(i.sector) ?? 0) + 1);
    return {
      ...p,
      items: own.sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999")),
      open: open.length,
      late: open.filter((i) => i.late).length,
      weekDue: open.filter((i) => i.dueDate && i.dueDate <= weekEnd).length,
      clients: [...clients.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      sectors: [...sectorCount.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s),
    };
  });
  out.sort((a, b) => Number(b.active) - Number(a.active) || Number(b.leader) - Number(a.leader) || a.name.localeCompare(b.name, "pt-BR"));
  const sectors = [...new Set(items.map((i) => i.sector).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return {
    people: out,
    invites: [],
    sectors,
    unassigned: items.filter((i) => !i.owner && !DONE.has(i.status)),
    adminCount: out.filter((p) => p.role === "agency_admin" && p.active).length,
  };
}

// ----- leitura ----------------------------------------------------------------

export async function loadTeam(): Promise<TeamData> {
  if (isDemoMode()) {
    const s = demo();
    const data = assemble(s.people, s.items, new Map(DEMO_BRANDS.map((b) => [b.id, b.slug])));
    return { ...data, invites: s.invites.filter((i) => i.status === "pendente") };
  }
  const [profiles, roles, members, tasks, work, brands, invites, sectors] = await Promise.all([
    db.from("profiles").select("id, display_name, email, job_title, avatar_url, active"),
    db.from("user_roles").select("user_id, role"),
    db.from("team_members").select("id, name, user_id, palette, is_leader, active, job_title").eq("kind", "agency"),
    db.from("workspace_tasks").select("id, title, brand_id, owner_id, owner_name, status, due_date, sector"),
    listWorkItems().catch(() => []),
    db.from("brands").select("id, name, slug"),
    listAgencyInvites().catch(() => []),
    db.from("workspace_sectors").select("name").order("order_index"),
  ]);
  const roleOf = new Map<string, AppRole>(((roles.data ?? []) as any[]).map((r) => [r.user_id, r.role]));
  const brandName = new Map<string, string>(((brands.data ?? []) as any[]).map((b) => [b.id, b.name]));
  const brandSlug = new Map<string, string>(((brands.data ?? []) as any[]).map((b) => [b.id, b.slug]));
  const team = ((profiles.data ?? []) as any[]).filter((p) => (roleOf.get(p.id) ?? "client") !== "client");
  const memberOf = (p: any) => ((members.data ?? []) as any[]).find((m) => m.user_id === p.id || (!m.user_id && p.display_name && m.name.toLowerCase() === String(p.display_name).toLowerCase()));
  const people = team.map((p) => {
    const m = memberOf(p);
    return {
      id: p.id as string,
      memberId: (m?.id as string) ?? null,
      name: (p.display_name || m?.name || p.email || "Sem nome") as string,
      email: p.email as string | null,
      jobTitle: (p.job_title || m?.job_title || null) as string | null,
      avatarUrl: p.avatar_url as string | null,
      palette: PALETTE_FROM_DB[m?.palette ?? "purple"] ?? "iris",
      leader: !!m?.is_leader,
      active: p.active !== false,
      role: roleOf.get(p.id) ?? "agency_member",
      lastSeen: null,
      history: [],
    };
  });
  const byName = new Map(people.map((p) => [p.name.toLowerCase(), p.id]));
  const items: (TeamItem & { owner: string | null })[] = [];
  for (const t of (tasks.data ?? []) as any[]) {
    const owner = t.owner_id && people.some((p) => p.id === t.owner_id) ? t.owner_id : t.owner_name ? byName.get(String(t.owner_name).toLowerCase()) ?? null : null;
    items.push({ id: t.id, kind: "tarefa", title: t.title, owner, brandId: t.brand_id, brandName: brandName.get(t.brand_id) ?? "Cliente", status: t.status, dueDate: t.due_date, late: !!t.due_date && t.due_date < iso(0) && !DONE.has(t.status), sector: t.sector });
  }
  for (const w of work as any[]) {
    const owner = w.responsible ? byName.get(String(w.responsible).toLowerCase()) ?? null : null;
    items.push({ id: `${w.kind}-${w.id}`, kind: w.kind, title: w.title, owner, brandId: w.brandId, brandName: w.brandId ? brandName.get(w.brandId) ?? "Cliente" : "Reach", status: w.status, dueDate: w.dueDate, late: !!w.dueDate && w.dueDate < iso(0) && !DONE.has(w.status), sector: null });
  }
  const data = assemble(people, items, brandSlug);
  const known = ((sectors.data ?? []) as any[]).map((s) => s.name as string);
  return { ...data, sectors: [...new Set([...known, ...data.sectors])], invites: (invites as AgencyInvite[]).filter((i) => i.status === "pendente") };
}

export async function loadPermissions(userId: string): Promise<string[]> {
  if (isDemoMode()) return [...(demo().people.find((p) => p.id === userId)?.perms ?? [])];
  return (await listUserPermissions(userId)).map((r) => r.permission);
}

/** Pessoas que podem ser escolhidas como responsáveis: só ativas. */
export type Pickable = { id: string; name: string; jobTitle: string | null; palette: PathKey; sectors: string[]; open: number; late: number };
export async function listPickable(): Promise<Pickable[]> {
  const { people } = await loadTeam();
  return people.filter((p) => p.active).map((p) => ({ id: p.id, name: p.name, jobTitle: p.jobTitle, palette: p.palette, sectors: p.sectors, open: p.open, late: p.late }));
}

// ----- escrita ----------------------------------------------------------------

export async function savePerson(input: PersonInput, before: TeamPerson, adminCount: number) {
  const losingAdmin = before.role === "agency_admin" && before.active && (input.role !== "agency_admin" || !input.active);
  if (losingAdmin && adminCount <= 1) throw new Error("A agência precisa de pelo menos um administrador ativo.");
  const perms = input.role === "agency_admin" ? [] : input.permissions;
  if (isDemoMode()) {
    const s = demo();
    s.people = s.people.map((p) => (p.id === input.id ? { ...p, name: input.name, jobTitle: input.jobTitle || null, palette: input.palette, leader: input.leader, active: input.active, role: input.role, perms } : p));
    return;
  }
  await updateProfileRow(input.id, { display_name: input.name.trim() || null, job_title: input.jobTitle.trim() || null, active: input.active });
  const member = { name: input.name.trim(), job_title: input.jobTitle.trim() || null, palette: PALETTE_TO_DB[input.palette], is_leader: input.leader, active: input.active };
  if (input.memberId) await db.from("team_members").update(member).eq("id", input.memberId);
  else await db.from("team_members").insert({ ...member, kind: "agency", user_id: input.id, email: before.email });
  if (input.role !== before.role) await setUserRole(input.id, input.role);
  await setUserPermissions(input.id, perms);
}

export async function setPersonActive(person: TeamPerson, active: boolean, adminCount: number) {
  if (!active && person.role === "agency_admin" && adminCount <= 1) throw new Error("A agência precisa de pelo menos um administrador ativo.");
  if (isDemoMode()) {
    const s = demo();
    s.people = s.people.map((p) => (p.id === person.id ? { ...p, active } : p));
    return;
  }
  await updateProfileRow(person.id, { active });
  if (person.memberId) await db.from("team_members").update({ active }).eq("id", person.memberId);
}

export async function invitePerson(input: InviteInput): Promise<{ sent: boolean; linked?: boolean; warning?: string }> {
  const email = input.email.trim().toLowerCase();
  const permissions = input.role === "agency_admin" ? [] : input.permissions;
  if (isDemoMode()) {
    const s = demo();
    if (s.people.some((p) => p.email === email)) throw new Error("Esta pessoa já faz parte da equipe.");
    s.invites = s.invites.filter((i) => i.email !== email);
    s.invites.unshift({ id: `i${Date.now()}`, email, name: input.name.trim() || null, role: input.role, job_title: input.jobTitle.trim() || null, permissions, status: "pendente", invited_by: "u-helena", accepted_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    return { sent: true };
  }
  const { inviteAgencyUser } = await import("@/lib/invites.functions");
  const r = await inviteAgencyUser({ data: { email, name: input.name.trim() || undefined, role: input.role, jobTitle: input.jobTitle.trim() || undefined, permissions, redirectTo: `${window.location.origin}/auth` } });
  return { sent: !!r.sent, linked: "linked" in r ? !!r.linked : false, warning: "warning" in r ? (r.warning as string | undefined) : undefined };
}

export async function resendInvite(id: string): Promise<{ sent: boolean; warning?: string }> {
  if (isDemoMode()) return { sent: true };
  const { resendInviteEmail } = await import("@/lib/invites.functions");
  const r = await resendInviteEmail({ data: { kind: "agency", inviteId: id, redirectTo: `${window.location.origin}/auth` } });
  return { sent: !!r.sent, warning: "warning" in r ? (r.warning as string | undefined) : undefined };
}

export async function cancelInvite(id: string) {
  if (isDemoMode()) {
    const s = demo();
    s.invites = s.invites.map((i) => (i.id === id ? { ...i, status: "cancelado" } : i));
    return;
  }
  await cancelAgencyInvite(id);
}
