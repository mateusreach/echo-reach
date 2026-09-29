// ---------------------------------------------------------------------------
// WORKSPACE — Operação do cliente (página 13)
//
// Frente → Entrega → Tarefas, mais demandas avulsas; responsáveis e
// antecedência por cliente; aplicar modelo de execução com prévia.
// ---------------------------------------------------------------------------
import { supabase } from "@/integrations/supabase/client";
import { brandModules, createChannel, getBrandBySlug, updateChannel, type BrandModules } from "@/lib/reach-data";
import { addDays, createFront, frontPeriod, frontRisk, localDate, saveClientTaskOwner, toISO, today, updateFront, WORK_STATUSES, type Front, type FrontWithRisk, type WorkStatus } from "@/lib/workspace-data";
import { applyTemplateToWorkOrder, externalStatus, workOrderKindLabel } from "@/lib/work-orders";
import { demoOps, DONE, listOpsTasks, type OpsTask } from "@/lib/ops-data";
import { listExecTemplates, type ExecItem, type ExecTemplate } from "@/lib/settings-data";
import { isDemoMode } from "@/lib/home-data";

const db = supabase as any;
const iso = (n: number) => toISO(addDays(today(), n));
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}`;

export type OrderSource = { module: string; type: string; title: string; status: string; url: string | null };
export type Order = { id: string; title: string; kind: string; kindLabel: string; frontId: string | null; periodStart: string | null; periodEnd: string | null; due: string | null; tasks: OpsTask[]; progress: { done: number; total: number; percent: number }; external: string; source: OrderSource | null };
export type Owner = { task_title: string; owner_name: string | null; days_before: number | null };
export type Channel = { id: string; name: string; status: string };
export type ClientOps = {
  brand: { id: string; name: string; slug: string; logoUrl: string | null; primary: string | null; accent: string | null };
  modules: BrandModules;
  channels: Channel[];
  fronts: FrontWithRisk[];
  orders: Order[];
  loose: OpsTask[];
  owners: Owner[];
  templates: ExecTemplate[];
};

const progressOf = (tasks: OpsTask[]) => { const done = tasks.filter((t) => t.status === DONE).length; return { done, total: tasks.length, percent: tasks.length ? Math.round((done / tasks.length) * 100) : 0 }; };

// ----- exemplo em memória -----------------------------------------------------

type DemoClient = { orders: Omit<Order, "tasks" | "progress" | "external">[]; owners: Owner[]; channels: Channel[] };
const store = new Map<string, DemoClient>();
function demoClient(slug: string, brandId: string, name: string): DemoClient {
  if (store.has(slug)) return store.get(slug)!;
  const ops = demoOps();
  const fronts = ops.fronts.filter((f) => f.brand.slug === slug);
  const orders: DemoClient["orders"] = fronts.map((f) => {
    const p = frontPeriod(f.front);
    return { id: `wo-${f.front.id}`, title: `${f.front.name} · ${p.start.slice(8, 10)}/${p.start.slice(5, 7)} a ${p.end.slice(8, 10)}/${p.end.slice(5, 7)}`, kind: "content_cycle", kindLabel: workOrderKindLabel("content_cycle"), frontId: f.front.id, periodStart: p.start, periodEnd: p.end, due: p.end, source: null };
  });
  const req = { id: `wo-${slug}-req`, title: "Fotos da coleção nova", kind: "brand_request", kindLabel: workOrderKindLabel("brand_request"), frontId: null, periodStart: null, periodEnd: null, due: iso(4), source: { module: "espaco360", type: "solicitacao", title: "Fotos da coleção nova", status: "Em execução", url: `/e360/${slug}` } };
  const manual = { id: `wo-${slug}-avulso`, title: "Cartão de fim de ano", kind: "manual", kindLabel: workOrderKindLabel("manual"), frontId: null, periodStart: null, periodEnd: null, due: iso(10), source: null };
  orders.push(req, manual);
  const brand = { id: brandId, name, slug };
  const mk = (title: string, woId: string | null, status: WorkStatus, owner: string | null, due: string, extra: Partial<OpsTask> = {}): OpsTask => ({ id: uid("t"), title, brand, frontId: null, frontName: null, workOrderId: woId, status, owner, due, sector: "Criação / Entrega", note: null, requiresReview: false, since: new Date().toISOString(), remindedAt: null, likeMaterial: null, ...extra });
  ops.tasks.push(
    mk("Briefing das fotos", req.id, DONE, "Júlia Castro", iso(-2)),
    mk("Direção de fotos", req.id, "Iniciada", "Bruno Tavares", iso(3), { requiresReview: true, reviewChecklist: "Luz natural\nProduto em destaque\nFundo em pedra ou linho" }),
    mk("Responder direct sobre refil", null, "Parada", null, iso(1), { sector: "Atendimento" }),
    mk("Separar amostras para influenciadoras", null, "Iniciada", "Júlia Castro", iso(2), { sector: "Atendimento", pinned: true }),
  );
  const TEAM = ["Rafael Monteiro", "Camila Rocha", "Rafael Monteiro", "Bruno Tavares", "Marina Lopes", "Theo Almeida", "Camila Rocha"];
  const client: DemoClient = {
    orders,
    owners: ["Estratégia", "Roteiros", "Pré produção", "Briefing", "Artes", "Vídeos", "Legendas"].map((t, i) => ({ task_title: t, owner_name: TEAM[i], days_before: [5, 4, 3, 3, 2, 2, 1][i] })),
    channels: [{ id: "c1", name: "Instagram", status: "ativo" }, { id: "c2", name: "TikTok", status: "ativo" }, { id: "c3", name: "Pinterest", status: "planejado" }],
  };
  store.set(slug, client);
  return client;
}

// ----- leitura ----------------------------------------------------------------

export async function loadClientOps(slug: string): Promise<ClientOps | null> {
  if (isDemoMode()) {
    const ops = demoOps();
    const f0 = ops.fronts.find((f) => f.brand.slug === slug);
    const name = f0?.brand.name ?? slug;
    const brandId = f0?.brand.id ?? `b-${slug}`;
    if (!f0) return null;
    const c = demoClient(slug, brandId, name);
    const tasks = ops.tasks.filter((t) => t.brand.slug === slug);
    const orders = c.orders.map((o) => { const ts = tasks.filter((t) => t.workOrderId === o.id); return { ...o, tasks: ts, progress: progressOf(ts), external: externalStatus(ts) }; });
    // Gatilho do piloto: entrega vinda do 360 concluída conclui a origem.
    for (const o of orders) if (o.source && o.tasks.length && o.tasks.every((t) => t.status === DONE)) o.source.status = "Concluída";
    return {
      brand: { id: brandId, name, slug, logoUrl: null, primary: null, accent: null },
      modules: { biblioteca: true, plano: true, workspace: true, espaco360: true, like: true } as BrandModules,
      channels: structuredClone(c.channels),
      fronts: structuredClone(ops.fronts.filter((f) => f.brand.slug === slug)).map((f) => ({ ...f, ...frontRisk(f.front), period: frontPeriod(f.front) })),
      orders: structuredClone(orders),
      loose: structuredClone(tasks.filter((t) => !t.workOrderId)),
      owners: structuredClone(c.owners),
      templates: await listExecTemplates(),
    };
  }
  const b = (await getBrandBySlug(slug)) as any;
  if (!b) return null;
  const [fr, wo, src, ch, ow, templates, all] = await Promise.all([
    db.from("workspace_fronts").select("*").eq("brand_id", b.id).order("order_index"),
    db.from("workspace_work_orders").select("*").eq("brand_id", b.id).order("period_start", { ascending: false }),
    db.from("workspace_work_order_sources").select("*").eq("brand_id", b.id),
    db.from("espaco360_channels").select("id, name, status").eq("brand_id", b.id).order("order_index"),
    db.from("workspace_client_task_owners").select("task_title, owner_name, days_before").eq("brand_id", b.id),
    listExecTemplates(),
    listOpsTasks(),
  ]);
  const tasks = all.filter((t) => t.brand.id === b.id);
  const brand = { id: b.id, name: b.name, slug: b.slug, logo_url: b.logo_url ?? null };
  const sources = (src.data ?? []) as any[];
  const orders: Order[] = ((wo.data ?? []) as any[]).map((o) => {
    const ts = tasks.filter((t) => t.workOrderId === o.id);
    const s = sources.find((x) => x.work_order_id === o.id);
    return {
      id: o.id, title: o.title, kind: o.kind, kindLabel: workOrderKindLabel(o.kind), frontId: o.front_id, periodStart: o.period_start, periodEnd: o.period_end, due: o.internal_due_date ?? o.requested_due_date ?? o.period_end,
      tasks: ts, progress: progressOf(ts), external: externalStatus(ts),
      source: s ? { module: s.source_module, type: s.source_type, title: o.title, status: o.status, url: s.source_url } : null,
    };
  });
  return {
    brand: { id: b.id, name: b.name, slug: b.slug, logoUrl: b.logo_url ?? null, primary: b.primary_color ?? null, accent: b.accent_color ?? null },
    modules: brandModules(b),
    channels: ch.data ?? [],
    fronts: ((fr.data ?? []) as Front[]).map((f) => ({ front: f, brand, ...frontRisk(f), period: frontPeriod(f) })),
    orders, loose: tasks.filter((t) => !t.workOrderId), owners: ow.data ?? [], templates,
  };
}

/** Prévia do modelo numa entrega: responsável e prazo pelo que o cliente definiu. */
export function previewTemplate(template: ExecTemplate, owners: Owner[], due: string | null) {
  return template.tasks.map((item: ExecItem) => {
    const cfg = owners.find((o) => o.task_title.toLowerCase() === item.title.toLowerCase());
    const days = cfg?.days_before ?? item.days_before ?? 0;
    return { title: item.title, sector: item.sector, owner: cfg?.owner_name ?? null, due: due ? toISO(addDays(localDate(due), -days)) : null, like: !!item.like_approval, material: item.material_type ?? null };
  });
}

// ----- escrita ----------------------------------------------------------------

export async function applyExecTemplate(d: ClientOps, order: Order, template: ExecTemplate) {
  if (isDemoMode()) {
    const ops = demoOps();
    const rows = previewTemplate(template, d.owners, order.due);
    const front = d.fronts.find((f) => f.front.id === order.frontId);
    for (const r of rows) ops.tasks.push({ id: uid("t"), title: r.title, brand: { id: d.brand.id, name: d.brand.name, slug: d.brand.slug }, frontId: order.frontId, frontName: front?.front.name ?? null, workOrderId: order.id, status: "Parada", owner: r.owner, due: r.due, sector: r.sector, note: null, requiresReview: r.like, since: new Date().toISOString(), remindedAt: null, likeMaterial: r.material });
    return rows.length;
  }
  return applyTemplateToWorkOrder(template as never, { brandId: d.brand.id, workOrderId: order.id, frontId: order.frontId, dueDate: order.due });
}

export async function createOrder(d: ClientOps, input: { title: string; due: string | null; kind: string }) {
  if (isDemoMode()) { demoClient(d.brand.slug, d.brand.id, d.brand.name).orders.unshift({ id: uid("wo"), title: input.title, kind: input.kind, kindLabel: workOrderKindLabel(input.kind), frontId: null, periodStart: null, periodEnd: null, due: input.due, source: null }); return; }
  const { error } = await db.from("workspace_work_orders").insert({ brand_id: d.brand.id, title: input.title, kind: input.kind, internal_due_date: input.due, status: "recebido" });
  if (error) throw error;
}

export async function addTask(d: ClientOps, orderId: string | null, title: string) {
  if (isDemoMode()) { demoOps().tasks.push({ id: uid("t"), title, brand: { id: d.brand.id, name: d.brand.name, slug: d.brand.slug }, frontId: null, frontName: null, workOrderId: orderId, status: "Parada", owner: null, due: null, sector: null, note: null, requiresReview: false, since: new Date().toISOString(), remindedAt: null, likeMaterial: null }); return; }
  const { error } = await db.from("workspace_tasks").insert({ brand_id: d.brand.id, work_order_id: orderId, title, status: "Parada" });
  if (error) throw error;
}

export type FrontInput = { name: string; recurrence: string; lead_days: number; approved_until: string | null; pending_start: string | null; pending_end: string | null; one_off_date: string | null; template_id: string | null };
export async function saveFront(d: ClientOps, id: string | null, input: FrontInput) {
  if (isDemoMode()) {
    const ops = demoOps();
    if (id) { const f = ops.fronts.find((x) => x.front.id === id); if (f) Object.assign(f.front, input); return; }
    const front = { id: uid("fr"), brand_id: d.brand.id, order_index: d.fronts.length, created_at: "", updated_at: "", ...input } as Front;
    ops.fronts.push({ front, brand: { id: d.brand.id, name: d.brand.name, slug: d.brand.slug, logo_url: null }, ...frontRisk(front), period: frontPeriod(front) });
    return;
  }
  if (id) await updateFront(id, input as never);
  else await createFront({ brand_id: d.brand.id, ...input } as never);
}

export async function saveOwners(d: ClientOps, rows: Owner[]) {
  if (isDemoMode()) { demoClient(d.brand.slug, d.brand.id, d.brand.name).owners = structuredClone(rows); return; }
  for (const r of rows) await saveClientTaskOwner({ brandId: d.brand.id, taskTitle: r.task_title, ownerName: r.owner_name, ownerId: null, daysBefore: r.days_before });
}

export async function saveChannel(d: ClientOps, id: string | null, patch: { name?: string; status?: string }) {
  if (isDemoMode()) {
    const c = demoClient(d.brand.slug, d.brand.id, d.brand.name);
    if (id) c.channels = c.channels.map((x) => (x.id === id ? { ...x, ...patch } : x));
    else c.channels.push({ id: uid("c"), name: patch.name ?? "Canal", status: patch.status ?? "planejado" });
    return;
  }
  if (id) await updateChannel(id, patch as never);
  else await createChannel({ brand_id: d.brand.id, name: patch.name ?? "Canal", status: patch.status ?? "planejado", order_index: d.channels.length } as never);
}

export { WORK_STATUSES };
