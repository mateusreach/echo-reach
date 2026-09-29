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

// ----- Campanha (página 17) --------------------------------------------------------------

export type CampaignFull = SCampaign & {
  priority: string; objective_id: string | null; opportunity: string | null; message: string | null; offer: string | null; products: string | null;
  target_audience: string | null; context: string | null; channels: string[]; learnings: { date: string; text: string }[]; materials: { title: string; url: string }[];
};
export type LikeMaterial = { id: string; title: string; format: string; status: "aguardando" | "aprovado" | "ajustes" | "rascunho"; round: number; campaign_id: string | null; front: string | null };
const campExtra = new Map<string, Partial<CampaignFull>>();

export async function loadCampaign(slug: string, id: string): Promise<{ space: Space; campaign: CampaignFull; likeMaterials: LikeMaterial[] } | null> {
  const space = await loadSpace(slug);
  if (!space) return null;
  if (isDemoMode()) {
    const base = space.campaigns.find((c) => c.id === id);
    if (!base) return null;
    const ex = campExtra.get(`${slug}:${id}`) ?? (id === "cp1" ? { opportunity: "Outono é a estação de maior busca por fragrâncias quentes.", message: "Sinta a origem do outono.", offer: "Pré-venda com 15% e kit de amostras.", products: "Âmbar & Figo, Couro & Baunilha, Chá Preto", target_audience: "Clientes recorrentes e presenteadores", channels: ["Instagram", "TikTok", "Loja virtual"], learnings: [{ date: iso(-4), text: "Carrossel com notas olfativas teve 2× mais salvamentos." }], materials: [{ title: "Moodboard da coleção", url: "https://example.com/moodboard" }] } : {});
    return {
      space,
      campaign: { priority: "alta", objective_id: null, opportunity: null, message: null, offer: null, products: null, target_audience: null, context: null, channels: [], learnings: [], materials: [], ...base, ...ex },
      likeMaterials: demoLike(slug).filter((m) => m.campaign_id === id),
    };
  }
  const { data } = await db.from("espaco360_campaigns").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  return {
    space,
    campaign: { ...data, channels: data.channels ?? [], learnings: Array.isArray(data.learnings) ? data.learnings : [], materials: Array.isArray(data.materials) ? data.materials : [] },
    likeMaterials: [], // Vínculo com o Like chega nas páginas 18–19.
  };
}

export async function saveCampaign(slug: string, id: string, patch: Partial<CampaignFull>) {
  const { deriveCampaignStatus } = await import("@/lib/reach-data");
  const withStatus = patch.stage ? { ...patch, status: deriveCampaignStatus(patch.stage) } : patch;
  if (isDemoMode()) {
    const p = demoPlanStore(slug);
    const base: Record<string, unknown> = {};
    for (const k of ["title", "stage", "status", "start_date", "end_date", "initiative_id", "description", "responsible", "objective_id"] as const) if (k in withStatus) base[k] = (withStatus as never)[k];
    p.campaigns = p.campaigns.map((c) => (c.id === id ? { ...c, ...base } : c));
    const key = `${slug}:${id}`;
    campExtra.set(key, { ...(campExtra.get(key) ?? {}), ...withStatus });
    return;
  }
  const { error } = await db.from("espaco360_campaigns").update(withStatus).eq("id", id);
  if (error) throw error;
}

// ----- Like no 360: materiais e histórico de decisões (demo até as páginas 18–23) --------

export type LikeDecision = { id: string; material: string; front: string; decision: "aprovado" | "ajustes"; sentAt: string; decidedAt: string; round: number };
const likeStore = new Map<string, { materials: LikeMaterial[]; decisions: LikeDecision[] }>();
function likeDemo(slug: string) {
  if (likeStore.has(slug)) return likeStore.get(slug)!;
  const at = (d: number, h = 10) => new Date(Date.now() + d * 86400e3 + (h - 12) * 3600e3).toISOString();
  const decisions: LikeDecision[] = [
    { id: "ld1", material: "Guia: como guardar seu perfume", front: "Feed", decision: "ajustes", sentAt: at(-14), decidedAt: at(-13, 16), round: 1 },
    { id: "ld2", material: "Guia: como guardar seu perfume", front: "Feed", decision: "aprovado", sentAt: at(-12), decidedAt: at(-12, 18), round: 2 },
    { id: "ld3", material: "Série educativa · episódio 4", front: "Feed", decision: "aprovado", sentAt: at(-7), decidedAt: at(-6), round: 1 },
    { id: "ld4", material: "Reels bastidores", front: "TikTok", decision: "aprovado", sentAt: at(-5), decidedAt: at(-4, 14), round: 1 },
    { id: "ld5", material: "Stories da semana", front: "Stories", decision: "ajustes", sentAt: at(-3), decidedAt: at(-2), round: 1 },
    { id: "ld6", material: "Stories da semana", front: "Stories", decision: "aprovado", sentAt: at(-2, 15), decidedAt: at(-1), round: 2 },
  ];
  const materials: LikeMaterial[] = [
    { id: "lm1", title: "Carrossel “Notas de outono”", format: "Carrossel", status: "aguardando", round: 1, campaign_id: "cp1", front: "Feed" },
    { id: "lm2", title: "Reels de lançamento", format: "Vídeo", status: "ajustes", round: 1, campaign_id: "cp1", front: "TikTok" },
    { id: "lm3", title: "Teaser da coleção", format: "Stories", status: "aprovado", round: 2, campaign_id: "cp1", front: "Stories" },
    { id: "lm4", title: "Convite do evento", format: "Post", status: "rascunho", round: 0, campaign_id: "cp1", front: "Feed" },
  ];
  likeStore.set(slug, { materials, decisions });
  return likeStore.get(slug)!;
}
const demoLike = (slug: string) => likeDemo(slug).materials;
export const likeDecisionsDemo = (slug: string) => likeDemo(slug).decisions;

/** Indicadores do Like calculados do histórico de decisões. */
export function likeIndicators(decisions: LikeDecision[], monthPrefix: string) {
  const inMonth = decisions.filter((d) => d.decidedAt.slice(0, 7) === monthPrefix);
  const approved = inMonth.filter((d) => d.decision === "aprovado");
  const byFront = new Map<string, number>();
  for (const d of approved) byFront.set(d.front, (byFront.get(d.front) ?? 0) + 1);
  const hours = inMonth.map((d) => (new Date(d.decidedAt).getTime() - new Date(d.sentAt).getTime()) / 3600e3);
  const materials = [...new Set(inMonth.map((d) => d.material))];
  const adjustments = inMonth.filter((d) => d.decision === "ajustes").length;
  return {
    approved: approved.length,
    byFront: [...byFront.entries()].sort((a, b) => b[1] - a[1]),
    avgHours: hours.length ? Math.round(hours.reduce((a, b) => a + b, 0) / hours.length) : null,
    adjustmentsPerMaterial: materials.length ? Math.round((adjustments / materials.length) * 10) / 10 : 0,
    decisions: inMonth.length,
  };
}

// ----- Agenda (página 17) -----------------------------------------------------------------

export type AgendaItem = { id: string; kind: "compromisso" | "reuniao" | "gravacao" | "publicacao" | "prazo" | "campanha" | "entrega"; title: string; date: string; start?: string | null; end?: string | null; status: string; responsible?: string | null; deliveryTitle?: string | null; deliveryDate?: string | null; auto?: boolean };
const eventStore = new Map<string, AgendaItem[]>();

export async function loadAgenda(slug: string): Promise<{ space: Space; items: AgendaItem[] } | null> {
  const space = await loadSpace(slug);
  if (!space) return null;
  let events: AgendaItem[] = [];
  let pubs: AgendaItem[] = [];
  if (isDemoMode()) {
    if (!eventStore.has(slug)) eventStore.set(slug, [
      { id: "ev1", kind: "gravacao", title: "Gravação do Reels no ateliê", date: iso(2), start: "14:00", end: "16:00", status: "confirmado", responsible: "Theo Almeida", deliveryTitle: "Reels de lançamento", deliveryDate: iso(6) },
      { id: "ev2", kind: "compromisso", title: "Visita à loja", date: iso(5), start: "10:00", end: "11:00", status: "agendado", responsible: "Júlia Castro" },
    ]);
    events = structuredClone(eventStore.get(slug)!);
    pubs = [{ id: "pub1", kind: "publicacao", title: "Teaser da coleção", date: iso(1), status: "agendado", auto: true }, { id: "pub2", kind: "publicacao", title: "Guia: como guardar seu perfume", date: iso(4), status: "agendado", auto: true }];
  } else {
    const [ev, cont] = await Promise.all([
      db.from("espaco360_calendar_events").select("*").eq("brand_id", space.brand.id),
      db.from("conteudos").select("id, title, publish_date, status").eq("brand_id", space.brand.id).in("status", ["aprovada", "produzida", "publicada"]).not("publish_date", "is", null),
    ]);
    events = ((ev.data ?? []) as any[]).map((e) => ({ id: e.id, kind: e.event_type, title: e.title, date: e.event_date, start: e.start_time, end: e.end_time, status: e.status, responsible: e.responsible, deliveryTitle: e.delivery_title, deliveryDate: e.delivery_date }));
    pubs = ((cont.data ?? []) as any[]).map((c) => ({ id: c.id, kind: "publicacao", title: c.title, date: String(c.publish_date).slice(0, 10), status: c.status === "publicada" ? "concluido" : "agendado", auto: true }));
  }
  const items: AgendaItem[] = [
    ...events, ...pubs,
    ...space.meetings.map((m) => ({ id: m.id, kind: "reuniao" as const, title: m.title, date: m.meeting_date.slice(0, 10), status: m.meeting_date.slice(0, 10) < iso(0) ? "concluido" : "agendado", auto: true })),
    ...space.tasks.filter((t) => t.due_date).map((t) => ({ id: t.id, kind: "prazo" as const, title: t.title, date: t.due_date!, status: t.status === "concluida" ? "concluido" : "agendado", auto: true })),
    ...space.deliveries.filter((d) => d.delivered_at).map((d) => ({ id: d.id, kind: "entrega" as const, title: d.title, date: d.delivered_at!.slice(0, 10), status: "concluido", auto: true })),
    ...space.campaigns.flatMap((c) => [c.start_date && { id: `${c.id}-s`, kind: "campanha" as const, title: `Início: ${c.title}`, date: c.start_date, status: "agendado", auto: true }, c.end_date && { id: `${c.id}-e`, kind: "campanha" as const, title: `Fim: ${c.title}`, date: c.end_date, status: "agendado", auto: true }].filter(Boolean) as AgendaItem[]),
  ];
  return { space, items: items.sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? "").localeCompare(b.start ?? "")) };
}

export async function saveEvent(slug: string, brandId: string, id: string | null, e: Omit<AgendaItem, "id" | "auto">) {
  if (isDemoMode()) { const list = eventStore.get(slug) ?? []; if (id) eventStore.set(slug, list.map((x) => (x.id === id ? { ...x, ...e } : x))); else list.push({ ...e, id: uid("ev") }); if (!eventStore.has(slug)) eventStore.set(slug, list); return; }
  const row = { brand_id: brandId, title: e.title, event_type: e.kind, event_date: e.date, start_time: e.start ?? null, end_time: e.end ?? null, status: e.status, responsible: e.responsible ?? null, delivery_title: e.deliveryTitle ?? null, delivery_date: e.deliveryDate ?? null };
  const { error } = id ? await db.from("espaco360_calendar_events").update(row).eq("id", id) : await db.from("espaco360_calendar_events").insert(row);
  if (error) throw error;
}

// ----- Resultados (página 17) ------------------------------------------------------------

export type Kpi = { id: string; name: string; source: string; target: number | null; value: number; unit: string | null; period: string | null; campaign_id: string | null };
const kpiStore = new Map<string, Kpi[]>();
export async function loadResults(slug: string) {
  const space = await loadSpace(slug);
  if (!space) return null;
  if (isDemoMode()) {
    if (!kpiStore.has(slug)) kpiStore.set(slug, [
      { id: "k1", name: "Alcance mensal", source: "plataforma", target: 120000, value: 98000, unit: "pessoas", period: "Setembro", campaign_id: null },
      { id: "k2", name: "Vendas da pré-venda", source: "planilha", target: 300, value: 96, unit: "pedidos", period: "Outono", campaign_id: "cp1" },
      { id: "k3", name: "Taxa de salvamento", source: "manual", target: 4, value: 5.2, unit: "%", period: "Setembro", campaign_id: null },
    ]);
    const p = demoPlanStore(slug);
    return { space, objectives: structuredClone(p.objectives), kpis: structuredClone(kpiStore.get(slug)!), decisions: likeDecisionsDemo(slug) };
  }
  const [obj, k] = await Promise.all([db.from("objectives").select("*").eq("brand_id", space.brand.id), db.from("kpis").select("*").eq("brand_id", space.brand.id)]);
  return {
    space, objectives: obj.data ?? [],
    kpis: ((k.data ?? []) as any[]).map((x) => ({ id: x.id, name: x.name, source: x.source, target: x.target_value, value: x.value, unit: x.unit, period: x.period_label, campaign_id: x.campaign_id })),
    decisions: [] as LikeDecision[], // Histórico real chega com o Like.
  };
}

export async function saveKpi(slug: string, brandId: string, id: string | null, k: Omit<Kpi, "id">) {
  if (isDemoMode()) { const list = kpiStore.get(slug) ?? []; if (id) kpiStore.set(slug, list.map((x) => (x.id === id ? { ...x, ...k } : x))); else list.push({ ...k, id: uid("k") }); return; }
  const row = { brand_id: brandId, name: k.name, source: k.source, target_value: k.target, value: k.value, unit: k.unit, period_label: k.period, campaign_id: k.campaign_id };
  const { error } = id ? await db.from("kpis").update(row).eq("id", id) : await db.from("kpis").insert(row);
  if (error) throw error;
}
