// ---------------------------------------------------------------------------
// ESPAÇO 360 — lista de espaços e Centro operacional (página 16)
//
// Estratégias, campanhas, tarefas, solicitações, entregas, reuniões, notas,
// revisões mensais e canais. Caminho Solicitação → Tarefa (mesmo id) → Entrega.
// Sem banco, roda em memória e compartilha objetivos/estratégias/campanhas com o Plano.
// ---------------------------------------------------------------------------
import { supabase } from "@/integrations/supabase/client";
import {
  brandModules, createCampaign, createInitiative, createMeeting, createMeetingTask, createNota, createSolicitacao, createTask, deleteNota, getBrandBySlug, getBrandMembership,
  listBrands, myBrands, strategyProgress, updateInitiative, updateMeetingTaskStatus, updateNota, updateSolicitacao, updateTask, upsertMonthlyTracking,
} from "@/lib/reach-data";
import { getAccess, modulePermissionKey } from "@/lib/agency-data";
import { ROSTER } from "@/lib/clients-data";
import { demoOps } from "@/lib/ops-data";
import { demoPlanStore } from "@/lib/plan-data";
import { addDays, toISO, today } from "@/lib/workspace-data";
import { isDemoMode } from "@/lib/home-data";
import { isViewingAsClient } from "@/lib/view-as";

const db = supabase as any;
const iso = (n: number) => toISO(addDays(today(), n));
const now = () => new Date().toISOString();
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`;

export type SObjective = { id: string; title: string; status: string; period_type: string };
export type SInitiative = { id: string; title: string; description: string | null; priority: string; status: string; objective_id: string | null };
export type SCampaign = { id: string; title: string; stage: string; status: string; start_date: string | null; end_date: string | null; initiative_id: string | null; description: string | null; responsible: string | null };
export type STask = { id: string; title: string; description: string | null; status: string; owner_scope: string; priority: string; due_date: string | null; campaign_id: string | null; initiative_id: string | null; is_required: boolean; created_at: string };
export type SRequest = { id: string; title: string; tipo: string | null; description: string | null; status: string; priority: string; due_date: string | null; campaign_id: string | null; initiative_id: string | null; task_id: string | null; created_at: string; attachments?: string[] };
export type SDelivery = { id: string; title: string; status: string; delivered_at: string | null; task_id: string | null; campaign_id: string | null; delivery_type: string | null; file_url: string | null; like?: boolean };
export type SMeeting = { id: string; title: string; meeting_date: string; notes: string | null; participants: string[]; tasks: { id: string; description: string; assignee: string | null; due_date: string | null; status: string }[] };
export type SNote = { id: string; title: string; content: string | null; kind: string; note_date: string | null; pinned: boolean; created_at: string };
export type SMonthly = { id: string; month_ref: string; resultados_internos: string | null; insights: string | null; ponto_atencao: string | null; decisoes_tomadas: string | null };
export type SChannel = { id: string; name: string; channel_type: string | null; status: string };
export type Space = {
  brand: { id: string; name: string; slug: string; logoUrl: string | null; coverUrl: string | null; primary: string | null; accent: string | null };
  canEdit: boolean;
  isTeam: boolean;
  objectives: SObjective[]; initiatives: SInitiative[]; campaigns: SCampaign[]; tasks: STask[]; requests: SRequest[]; deliveries: SDelivery[];
  meetings: SMeeting[]; notes: SNote[]; monthly: SMonthly[]; channels: SChannel[];
  likePending: number;
};
export type SpaceCard = { slug: string; name: string; logoUrl: string | null; progress: number; campaigns: number; pending: number };

/** Notas são internas da equipe; lembretes, avisos e datas também aparecem para o cliente. */
export const INTERNAL_NOTE_KIND = "nota";

// ----- exemplo em memória -----------------------------------------------------

type DemoSpace = Omit<Space, "brand" | "canEdit" | "isTeam" | "objectives" | "initiatives" | "campaigns" | "likePending">;
const store = new Map<string, DemoSpace>();
const has360 = (slug: string) => !!ROSTER.find((r) => r[1] === slug)?.[2];
const nameOf = (slug: string) => ROSTER.find((r) => r[1] === slug)?.[0] ?? slug;

function demo(slug: string): DemoSpace {
  if (store.has(slug)) return store.get(slug)!;
  const t = now();
  const task = (id: string, title: string, status: string, scope: string, due: number | null, extra: Partial<STask> = {}): STask => ({ id, title, description: null, status, owner_scope: scope, priority: "media", due_date: due === null ? null : iso(due), campaign_id: null, initiative_id: null, is_required: false, created_at: t, ...extra });
  const s: DemoSpace = {
    tasks: [
      task("st1", "Aprovar paleta da coleção", "a_fazer", "cliente", 1, { campaign_id: "cp1", is_required: true, initiative_id: "in2" }),
      task("st2", "Enviar fotos dos frascos", "em_andamento", "cliente", -1, { campaign_id: "cp1", is_required: true, initiative_id: "in2" }),
      task("st3", "Roteiro do Reels de lançamento", "em_andamento", "agencia", 2, { campaign_id: "cp1", initiative_id: "in2", is_required: true }),
      task("st4", "Planejar evento no ateliê", "a_fazer", "compartilhada", 9, { campaign_id: "cp1", initiative_id: "in2" }),
      task("sol1", "Cardápio de fragrâncias para o Natal", "a_fazer", "agencia", 12, { description: "Criado a partir da solicitação." }),
      task("st5", "Série educativa · episódio 4", "concluida", "agencia", -6, { initiative_id: "in4" }),
    ],
    requests: [{ id: "sol1", title: "Cardápio de fragrâncias para o Natal", tipo: "Conteúdo", description: "Um carrossel com sugestões de presente por perfil.", status: "em_execucao", priority: "media", due_date: iso(12), campaign_id: null, initiative_id: null, task_id: "sol1", created_at: new Date(Date.now() - 2 * 86400e3).toISOString() }],
    deliveries: [
      { id: "dl1", title: "Série educativa · episódio 4", status: "entregue", delivered_at: iso(-5), task_id: "st5", campaign_id: null, delivery_type: "Reels", file_url: null, like: true },
      { id: "dl2", title: "Guia: como guardar seu perfume", status: "publicado", delivered_at: iso(-12), task_id: null, campaign_id: null, delivery_type: "Carrossel", file_url: null, like: true },
    ],
    meetings: [{ id: "mt1", title: "Alinhamento de outubro", meeting_date: iso(-3), notes: "Validar datas do lançamento; Carla pediu foco em presentes.", participants: ["Carla Mendes", "Rafael Monteiro", "Júlia Castro"], tasks: [{ id: "mtt1", description: "Enviar cronograma revisado", assignee: "Rafael Monteiro", due_date: iso(1), status: "a_fazer" }, { id: "mtt2", description: "Confirmar local do evento", assignee: "Carla Mendes", due_date: iso(4), status: "a_fazer" }] }],
    notes: [
      { id: "n1", title: "Cliente prefere aprovar às terças", content: "Evitar enviar materiais na sexta.", kind: "nota", note_date: null, pinned: true, created_at: t },
      { id: "n2", title: "Pré-venda começa dia 10", content: null, kind: "data_importante", note_date: iso(11), pinned: false, created_at: t },
      { id: "n3", title: "Fotos novas na pasta compartilhada", content: "Pasta “Outono 2026”.", kind: "aviso", note_date: null, pinned: false, created_at: t },
    ],
    monthly: [{ id: "m1", month_ref: toISO(new Date(today().getFullYear(), today().getMonth() - 1, 1)).slice(0, 7), resultados_internos: "Alcance +18%; salvamentos em alta nos carrosséis educativos.", insights: "Conteúdo de bastidores gera mais comentários.", ponto_atencao: "Stories com poucas respostas.", decisoes_tomadas: "Manter série educativa e testar enquetes nos Stories." }],
    channels: [{ id: "c1", name: "Instagram", channel_type: "Rede social", status: "ativo" }, { id: "c2", name: "TikTok", channel_type: "Rede social", status: "em_teste" }, { id: "c3", name: "Loja virtual", channel_type: "Site", status: "ativo" }, { id: "c4", name: "Pinterest", channel_type: "Rede social", status: "planejado" }],
  };
  store.set(slug, s);
  return s;
}

// ----- leitura ----------------------------------------------------------------

export async function listSpaces(): Promise<{ spaces: SpaceCard[]; single: string | null }> {
  if (isDemoMode()) {
    const viewAs = isViewingAsClient();
    const spaces = ROSTER.filter((r) => r[2]).map(([name, slug]) => {
      const p = demoPlanStore(slug);
      const d = demo(slug);
      return { slug, name, logoUrl: null, progress: strategyProgress(p.initiatives).percent, campaigns: p.campaigns.filter((c) => c.status === "em_andamento").length, pending: d.tasks.filter((t) => t.owner_scope === "cliente" && t.status !== "concluida").length };
    });
    return { spaces: viewAs ? spaces.slice(0, 1) : spaces, single: viewAs ? spaces[0]?.slug ?? null : null };
  }
  const access = await getAccess();
  const list = (access.isAgency ? await listBrands() : await myBrands()).filter((b) => brandModules(b).espaco360);
  const ids = list.map((b) => b.id);
  const [ini, camp, tasks] = ids.length ? await Promise.all([
    db.from("espaco360_initiatives").select("brand_id, status").in("brand_id", ids),
    db.from("espaco360_campaigns").select("brand_id, status").in("brand_id", ids),
    db.from("espaco360_tasks").select("brand_id, status, owner_scope").in("brand_id", ids),
  ]) : [{ data: [] }, { data: [] }, { data: [] }];
  const spaces = list.map((b) => ({
    slug: b.slug, name: b.name, logoUrl: b.logo_url ?? null,
    progress: strategyProgress(((ini.data ?? []) as any[]).filter((x) => x.brand_id === b.id)).percent,
    campaigns: ((camp.data ?? []) as any[]).filter((x) => x.brand_id === b.id && x.status === "em_andamento").length,
    pending: ((tasks.data ?? []) as any[]).filter((x) => x.brand_id === b.id && x.owner_scope === "cliente" && x.status !== "concluida").length,
  }));
  return { spaces, single: !access.isAgency && spaces.length === 1 ? spaces[0].slug : null };
}

/** null = sem acesso (módulo desligado ou sem permissão). */
export async function loadSpace(slug: string): Promise<Space | null> {
  if (isDemoMode()) {
    if (!has360(slug)) return null;
    const p = demoPlanStore(slug);
    const d = demo(slug);
    // Sugestões feitas no Plano entram como solicitações (e o gatilho cria a tarefa).
    for (const sug of p.solicitacoes) {
      if (d.requests.some((r) => r.id === sug.id)) continue;
      d.requests.unshift({ id: sug.id, title: sug.title, tipo: "Plano", description: sug.description, status: "nova", priority: "media", due_date: null, campaign_id: null, initiative_id: null, task_id: sug.id, created_at: sug.created_at });
      d.tasks.push({ id: sug.id, title: sug.title, description: sug.description, status: "a_fazer", owner_scope: "agencia", priority: "media", due_date: null, campaign_id: null, initiative_id: null, is_required: false, created_at: sug.created_at });
    }
    const viewAs = isViewingAsClient();
    const likePending = demoOps().tasks.filter((t) => t.brand.slug === slug && t.status === "Avaliação externa").length;
    return structuredClone({
      brand: { id: `b-${slug}`, name: nameOf(slug), slug, logoUrl: null, coverUrl: null, primary: null, accent: null },
      canEdit: true, isTeam: !viewAs,
      objectives: p.objectives.map((o) => ({ id: o.id, title: o.title, status: o.status, period_type: o.period_type })),
      initiatives: p.initiatives.map((i) => ({ id: i.id, title: i.title, description: i.description, priority: i.priority, status: i.status, objective_id: i.objective_id })),
      campaigns: p.campaigns.map((c) => ({ id: c.id, title: c.title, stage: c.stage ?? "planejamento", status: c.status, start_date: c.start_date ?? null, end_date: c.end_date ?? null, initiative_id: c.initiative_id, description: c.description ?? null, responsible: c.responsible ?? null })),
      ...d,
      notes: viewAs ? d.notes.filter((n) => n.kind !== INTERNAL_NOTE_KIND) : d.notes,
      likePending,
    });
  }
  const b = (await getBrandBySlug(slug)) as any;
  if (!b || !brandModules(b).espaco360) return null;
  const access = await getAccess();
  const membership = access.isAgency ? null : await getBrandMembership(b.id);
  if (!access.isAgency && !membership?.isAdmin && !membership?.permissions.includes(modulePermissionKey("espaco360", "visualizar"))) return null;
  const isTeam = access.isAgency && !isViewingAsClient();
  const q = (t: string, order = "created_at") => db.from(t).select("*").eq("brand_id", b.id).order(order);
  const [obj, ini, camp, tasks, sol, del, meet, mtt, notes, mon, ch, like] = await Promise.all([
    q("objectives", "order_index"), q("espaco360_initiatives", "order_index"), q("espaco360_campaigns"), q("espaco360_tasks"), q("solicitacoes"), q("deliveries"),
    q("espaco360_meetings", "meeting_date"), q("espaco360_meeting_tasks"), q("espaco360_notes"), q("espaco360_monthly_tracking", "month_ref"), q("espaco360_channels", "order_index"),
    db.from("workspace_tasks").select("id", { count: "exact", head: true }).eq("brand_id", b.id).eq("status", "Avaliação externa"),
  ]);
  const mTasks = (mtt.data ?? []) as any[];
  return {
    brand: { id: b.id, name: b.name, slug: b.slug, logoUrl: b.logo_url ?? null, coverUrl: b.cover_url ?? null, primary: b.primary_color ?? null, accent: b.accent_color ?? null },
    canEdit: !isViewingAsClient() && (access.isAgency || !!membership?.isAdmin || !!membership?.permissions.includes(modulePermissionKey("espaco360", "editar"))),
    isTeam,
    objectives: obj.data ?? [], initiatives: ini.data ?? [], campaigns: camp.data ?? [], tasks: tasks.data ?? [], requests: sol.data ?? [], deliveries: del.data ?? [],
    meetings: ((meet.data ?? []) as any[]).reverse().map((m) => ({ ...m, participants: Array.isArray(m.participants) ? m.participants : [], tasks: mTasks.filter((t) => t.meeting_id === m.id) })),
    notes: ((notes.data ?? []) as SNote[]).filter((n) => isTeam || n.kind !== INTERNAL_NOTE_KIND),
    monthly: ((mon.data ?? []) as SMonthly[]).reverse(), channels: ch.data ?? [], likePending: like.count ?? 0,
  };
}

// ----- escrita ----------------------------------------------------------------

export async function saveInitiativeS(slug: string, brandId: string, id: string | null, patch: Partial<SInitiative> & { title: string }) {
  if (isDemoMode()) {
    const p = demoPlanStore(slug);
    if (id) p.initiatives = p.initiatives.map((i) => (i.id === id ? { ...i, ...patch } : i));
    else p.initiatives.push({ id: uid("in"), brand_id: brandId, description: null, objective_id: null, priority: "curto_prazo", status: "em_andamento", semester: null, order_index: p.initiatives.length, created_at: now(), updated_at: now(), ...patch } as never);
    return;
  }
  if (id) await updateInitiative(id, patch as never); else await createInitiative({ brand_id: brandId, ...patch } as never);
}

export async function createCampaignS(slug: string, brandId: string, input: { title: string; initiative_id: string | null; start_date: string | null; end_date: string | null; description: string | null }) {
  if (isDemoMode()) { demoPlanStore(slug).campaigns.push({ id: uid("cp"), status: "planejada", stage: "planejamento", responsible: null, objective_id: null, ...input }); return; }
  await createCampaign({ brand_id: brandId, stage: "planejamento", status: "planejada", ...input } as never);
}

export async function saveTaskS(slug: string, brandId: string, id: string | null, patch: Partial<STask> & { title?: string }) {
  if (isDemoMode()) {
    const d = demo(slug);
    if (id) {
      const before = d.tasks.find((t) => t.id === id);
      d.tasks = d.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t));
      // Gatilho: tarefa concluída vira entrega; solicitação ligada é concluída.
      if (before && before.status !== "concluida" && patch.status === "concluida") {
        if (!d.deliveries.some((x) => x.task_id === id)) d.deliveries.unshift({ id: uid("dl"), title: before.title, status: "entregue", delivered_at: iso(0), task_id: id, campaign_id: before.campaign_id, delivery_type: null, file_url: null });
        d.requests = d.requests.map((r) => (r.task_id === id ? { ...r, status: "concluida" } : r));
      }
    } else d.tasks.push({ id: uid("st"), description: null, status: "a_fazer", owner_scope: "agencia", priority: "media", due_date: null, campaign_id: null, initiative_id: null, is_required: false, created_at: now(), title: "Nova tarefa", ...patch });
    return;
  }
  if (id) await updateTask(id, patch as never); else await createTask({ brand_id: brandId, ...patch } as never);
}

/** Cria a solicitação. Enviada (não rascunho), o gatilho cria a tarefa com o mesmo id. */
export async function createRequest(slug: string, brandId: string, input: Omit<SRequest, "id" | "task_id" | "created_at" | "status"> & { draft: boolean }) {
  const status = input.draft ? "rascunho" : "nova";
  if (isDemoMode()) {
    const d = demo(slug);
    const id = uid("sol");
    const { draft, ...rest } = input;
    d.requests.unshift({ ...rest, id, status, task_id: draft ? null : id, created_at: now() });
    if (!draft) d.tasks.push({ id, title: input.title, description: input.description, status: "a_fazer", owner_scope: "agencia", priority: input.priority, due_date: input.due_date, campaign_id: input.campaign_id, initiative_id: input.initiative_id, is_required: false, created_at: now() });
    return id;
  }
  const { draft: _d, attachments: _a, ...row } = input;
  const r = await createSolicitacao({ brand_id: brandId, ...row, status } as never);
  return (r as any).id as string;
}

export async function sendDraft(slug: string, id: string) {
  if (isDemoMode()) {
    const d = demo(slug);
    const r = d.requests.find((x) => x.id === id);
    if (!r) return;
    r.status = "nova"; r.task_id = r.id;
    d.tasks.push({ id: r.id, title: r.title, description: r.description, status: "a_fazer", owner_scope: "agencia", priority: r.priority, due_date: r.due_date, campaign_id: r.campaign_id, initiative_id: r.initiative_id, is_required: false, created_at: now() });
    return;
  }
  await updateSolicitacao(id, { status: "nova" } as never);
}

export async function setRequestStatus(slug: string, id: string, status: string) {
  if (isDemoMode()) { const d = demo(slug); d.requests = d.requests.map((r) => (r.id === id ? { ...r, status } : r)); if (status === "em_execucao") d.tasks = d.tasks.map((t) => (t.id === id && t.status === "a_fazer" ? { ...t, status: "em_andamento" } : t)); return; }
  await updateSolicitacao(id, { status } as never);
}

export async function createMeetingS(slug: string, brandId: string, input: { title: string; meeting_date: string; notes: string | null; participants: string[] }) {
  if (isDemoMode()) { demo(slug).meetings.unshift({ id: uid("mt"), tasks: [], ...input }); return; }
  await createMeeting({ brand_id: brandId, ...input } as never);
}

export async function addMeetingTask(slug: string, brandId: string, meetingId: string, input: { description: string; assignee: string | null; due_date: string | null }) {
  if (isDemoMode()) { demo(slug).meetings.find((m) => m.id === meetingId)?.tasks.push({ id: uid("mtt"), status: "a_fazer", ...input }); return; }
  await createMeetingTask({ brand_id: brandId, meeting_id: meetingId, status: "a_fazer", ...input } as never);
}

export async function setMeetingTaskStatus(slug: string, meetingId: string, id: string, status: string) {
  if (isDemoMode()) { const m = demo(slug).meetings.find((x) => x.id === meetingId); if (m) m.tasks = m.tasks.map((t) => (t.id === id ? { ...t, status } : t)); return; }
  await updateMeetingTaskStatus(id, status);
}

export async function saveNote(slug: string, brandId: string, id: string | null, patch: Partial<SNote> & { title?: string }) {
  if (isDemoMode()) { const d = demo(slug); if (id) d.notes = d.notes.map((n) => (n.id === id ? { ...n, ...patch } : n)); else d.notes.unshift({ id: uid("n"), content: null, kind: "nota", note_date: null, pinned: false, created_at: now(), title: "Nota", ...patch }); return; }
  if (id) await updateNota(id, patch as never); else await createNota({ brand_id: brandId, title: patch.title ?? "Nota", ...patch } as never);
}

export async function removeNote(slug: string, id: string) {
  if (isDemoMode()) { const d = demo(slug); d.notes = d.notes.filter((n) => n.id !== id); return; }
  await deleteNota(id);
}

export async function saveMonthly(slug: string, brandId: string, input: Omit<SMonthly, "id">) {
  if (isDemoMode()) { const d = demo(slug); const ex = d.monthly.find((m) => m.month_ref === input.month_ref); if (ex) Object.assign(ex, input); else d.monthly.unshift({ id: uid("m"), ...input }); return; }
  await upsertMonthlyTracking({ brand_id: brandId, ...input } as never);
}

export async function saveChannelS(slug: string, brandId: string, id: string | null, patch: Partial<SChannel>) {
  if (isDemoMode()) { const d = demo(slug); if (id) d.channels = d.channels.map((c) => (c.id === id ? { ...c, ...patch } : c)); else d.channels.push({ id: uid("c"), name: "Canal", channel_type: null, status: "planejado", ...patch }); return; }
  if (id) await db.from("espaco360_channels").update(patch).eq("id", id);
  else await db.from("espaco360_channels").insert({ brand_id: brandId, name: patch.name ?? "Canal", channel_type: patch.channel_type ?? null, status: patch.status ?? "planejado" });
}
