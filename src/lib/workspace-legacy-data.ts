import { supabase } from "@/integrations/supabase/client";

const SNAPSHOT_AUTHOR = "__reach_workspace_zip_snapshot_v1__";

export type WorkspaceSnapshot = {
  clients: Array<Record<string, unknown>>;
  team: Array<Record<string, unknown>>;
  templates: Array<Record<string, unknown>>;
  notes: Array<Record<string, unknown>>;
  sectors: string[];
};

export function workspaceStoreKey(organizationId: string) {
  return `reach-workspace-v1:${organizationId}`;
}

export function parseWorkspaceSnapshot(value: unknown): WorkspaceSnapshot {
  if (!value || typeof value !== "object") throw new Error("Dados do Workspace inválidos.");
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.clients)) throw new Error("A lista de clientes está ausente.");
  const clients = record.clients.filter((item) => item && typeof item === "object") as Array<
    Record<string, unknown>
  >;
  if (clients.length !== record.clients.length)
    throw new Error("Há clientes inválidos nos dados do Workspace.");
  if (
    clients.some(
      (client) =>
        typeof client.id !== "string" ||
        typeof client.name !== "string" ||
        !Array.isArray(client.fronts),
    )
  ) {
    throw new Error("Há clientes sem identificação, nome ou frentes nos dados do Workspace.");
  }
  return {
    clients: clients.map((client) => ({
      ...client,
      team: Array.isArray(client.team) ? client.team : [],
      fronts: (client.fronts as Array<Record<string, unknown>>).map((front) => ({
        ...front,
        leadDays: front.leadDays ?? 3,
        approvedUntil: front.approvedUntil || new Date().toISOString().slice(0, 10),
        tasks: Array.isArray(front.tasks) ? front.tasks : [],
      })),
    })),
    team: Array.isArray(record.team) ? (record.team as Array<Record<string, unknown>>) : [],
    templates: Array.isArray(record.templates)
      ? (record.templates as Array<Record<string, unknown>>)
      : [],
    notes: Array.isArray(record.notes) ? (record.notes as Array<Record<string, unknown>>) : [],
    sectors: Array.isArray(record.sectors)
      ? record.sectors.filter((item): item is string => typeof item === "string")
      : [],
  };
}

function sameEntity(a: Record<string, unknown>, b: Record<string, unknown>) {
  if (a.id && b.id && a.id === b.id) return true;
  const aName = a.name ?? a.title;
  const bName = b.name ?? b.title;
  return (
    typeof aName === "string" &&
    typeof bName === "string" &&
    aName.trim().toLocaleLowerCase("pt-BR") === bName.trim().toLocaleLowerCase("pt-BR")
  );
}

function mergeRecords(
  current: Array<Record<string, unknown>>,
  incoming: Array<Record<string, unknown>>,
  matchByName = true,
) {
  const result = current.map((item) => ({ ...item }));
  for (const item of incoming) {
    const existing = result.find(
      (entry) =>
        (entry.id && item.id && entry.id === item.id) || (matchByName && sameEntity(entry, item)),
    );
    if (existing) Object.assign(existing, item, { id: existing.id });
    else result.push({ ...item });
  }
  return result;
}

async function agencyTeam(organizationId: string): Promise<Array<Record<string, unknown>>> {
  const [{ data: profiles, error: profilesError }, { data: roles, error: rolesError }] = await Promise.all([
    supabase.from("profiles").select("id, display_name, job_title, avatar_url, active").eq("organization_id", organizationId),
    supabase.from("user_roles").select("user_id, role").eq("organization_id", organizationId),
  ]);
  if (profilesError) throw profilesError;
  if (rolesError) throw rolesError;
  const agencyIds = new Set((roles ?? []).filter((row) => row.role === "agency_admin" || row.role === "agency_member").map((row) => row.user_id));
  return (profiles ?? [])
    .filter((profile) => profile.active !== false && agencyIds.has(profile.id))
    .map((profile) => ({
      id: profile.id,
      name: profile.display_name || "Colaborador",
      role: profile.job_title ?? "",
      photo: profile.avatar_url ?? "",
    }));
}

export function mergeWorkspaceSnapshots(
  current: WorkspaceSnapshot,
  incoming: WorkspaceSnapshot,
): WorkspaceSnapshot {
  const clients = current.clients.map((client) => ({ ...client }));
  for (const client of incoming.clients) {
    const existing = clients.find((entry) => sameEntity(entry, client));
    if (!existing) {
      clients.push({ ...client });
      continue;
    }
    const fronts = (existing.fronts as Array<Record<string, unknown>>).map((front) => ({
      ...front,
    }));
    for (const front of client.fronts as Array<Record<string, unknown>>) {
      const oldFront = fronts.find((entry) => sameEntity(entry, front));
      if (oldFront) {
        const tasks = mergeRecords(
          Array.isArray(oldFront.tasks) ? (oldFront.tasks as Array<Record<string, unknown>>) : [],
          Array.isArray(front.tasks) ? (front.tasks as Array<Record<string, unknown>>) : [],
          false,
        );
        Object.assign(oldFront, front, { id: oldFront.id, tasks });
      } else fronts.push({ ...front });
    }
    Object.assign(existing, client, {
      id: existing.id,
      fronts,
      team: [
        ...new Set([...((existing.team as string[]) ?? []), ...((client.team as string[]) ?? [])]),
      ],
    });
  }
  return {
    clients,
    team: mergeRecords(current.team, incoming.team),
    templates: mergeRecords(current.templates, incoming.templates),
    notes: mergeRecords(current.notes, incoming.notes),
    sectors: [...new Set([...current.sectors, ...incoming.sectors])],
  };
}

export async function loadWorkspaceSnapshot(organizationId: string): Promise<WorkspaceSnapshot> {
  const { data: stored, error: storedError } = await supabase
    .from("workspace_notes")
    .select("text")
    .eq("id", organizationId)
    .eq("organization_id", organizationId)
    .eq("author", SNAPSHOT_AUTHOR)
    .maybeSingle();
  if (storedError) throw storedError;
  if (stored?.text) {
    const snapshot = parseWorkspaceSnapshot(JSON.parse(stored.text));
    snapshot.team = mergeRecords(snapshot.team, await agencyTeam(organizationId));
    const { data: newBrands, error: newBrandsError } = await supabase
      .from("brands")
      .select("id, name, modules")
      .eq("organization_id", organizationId)
      .order("name");
    if (newBrandsError) throw newBrandsError;
    const disabledBrandIds = new Set((newBrands ?? [])
      .filter((brand) => (brand.modules as Record<string, unknown> | null)?.workspace === false)
      .map((brand) => brand.id));
    snapshot.clients = snapshot.clients.filter((client) => !disabledBrandIds.has(String(client.id)));
    for (const brand of newBrands ?? []) {
      const modules = brand.modules as Record<string, unknown> | null;
      if (modules?.workspace === false) continue;
      const existing = snapshot.clients.find(
        (client) => client.id === brand.id || sameEntity(client, brand),
      );
      if (existing) {
        existing.id = brand.id;
        existing.name = brand.name;
        continue;
      }
      snapshot.clients.push({ id: brand.id, name: brand.name, team: [], fronts: [] });
    }
    const brandIds = (newBrands ?? []).map((brand) => brand.id);
    if (brandIds.length) {
      // As datas e frentes provisionadas no cadastro central precisam aparecer
      // também no Workspace antigo, mesmo quando já existe um snapshot salvo.
      const { data: coreFronts, error: frontsError } = await supabase
        .from("workspace_fronts")
        .select("*")
        .in("brand_id", brandIds);
      if (frontsError) throw frontsError;
      for (const front of coreFronts ?? []) {
        const client = snapshot.clients.find((item) => item.id === front.brand_id);
        if (!client) continue;
        const fronts = client.fronts as Array<Record<string, unknown>>;
        const existing = fronts.find((item) => item.id === front.id || sameEntity(item, front));
        if (existing) {
          existing.id = front.id;
          existing.name = front.name;
          existing.recurrence = front.recurrence;
          existing.leadDays = front.lead_days;
          const snapshotDate = typeof existing.approvedUntil === "string" ? existing.approvedUntil : "";
          const coreDate = front.approved_until ?? "";
          existing.approvedUntil = snapshotDate > coreDate ? snapshotDate : coreDate;
        } else {
          fronts.push({
            id: front.id,
            name: front.name,
            recurrence: front.recurrence,
            leadDays: front.lead_days,
            approvedUntil: front.approved_until ?? new Date().toISOString().slice(0, 10),
            pendingStart: front.pending_start ?? "",
            pendingEnd: front.pending_end ?? "",
            oneOffDate: front.one_off_date ?? "",
            templateId: front.template_id ?? "",
            tasks: [],
          });
        }
      }
      // A tabela de origem é opcional: a operação deve continuar funcionando
      // mesmo quando a migração de rastreabilidade ainda não foi aplicada.
      const { data: coreTasks, error: tasksError } = await supabase
        .from("workspace_tasks")
        .select("*")
        .in("brand_id", brandIds);
      if (tasksError) throw tasksError;
      for (const task of coreTasks ?? []) {
        const client = snapshot.clients.find((item) => item.id === task.brand_id);
        if (!client) continue;
        const fronts = client.fronts as Array<Record<string, unknown>>;
        const existingTask = fronts.flatMap((front) => Array.isArray(front.tasks) ? front.tasks as Array<Record<string, unknown>> : [])
          .find((item) => item.id === task.id);
        const taskData = {
          id: task.id,
          title: task.title ?? "Demanda",
          owner: task.owner_name ?? "",
          status: task.status ?? "Parada",
          sector: task.sector ?? "",
          month: task.month ?? "",
          priority: task.priority ?? 999,
          dueDate: task.due_date ?? "",
          note: task.note ?? "",
          highlighted: !!task.highlighted,
          pinned: !!task.pinned,
          requiresReview: !!task.requires_review,
          reviewText: task.review_text ?? "",
          reviewChecklist: task.review_checklist ?? "",
          startTime: task.event_time ?? "",
          location: task.location ?? "",
          attachments: Array.isArray(task.attachments) ? task.attachments.join(", ") : "",
        };
        if (existingTask) {
          Object.assign(existingTask, taskData);
          continue;
        }
        let targetFront = task.front_id ? fronts.find((front) => front.id === task.front_id) : null;
        if (!targetFront) targetFront = fronts.find((front) => front.id === task.brand_id && front.name === "Demandas sem frente");
        if (!targetFront) {
          targetFront = {
            id: task.brand_id,
            name: "Demandas sem frente",
            recurrence: "oneoff",
            leadDays: 0,
            approvedUntil: new Date().toISOString().slice(0, 10),
            tasks: [],
          };
          fronts.push(targetFront);
        }
        (targetFront.tasks as Array<Record<string, unknown>>).push(taskData);
      }
    }
    return snapshot;
  }

  const { data: brands, error: brandsError } = await supabase
    .from("brands")
    .select("id, name, modules")
    .eq("organization_id", organizationId)
    .order("name");
  if (brandsError) throw brandsError;

  const ids = (brands ?? []).map((brand) => brand.id);
  const [frontResult, taskResult, teamResult, templateResult, sectorResult, noteResult] =
    await Promise.all([
      ids.length
        ? supabase.from("workspace_fronts").select("*").in("brand_id", ids)
        : Promise.resolve({ data: [], error: null }),
      ids.length
        ? supabase.from("workspace_tasks").select("*").in("brand_id", ids)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("team_members")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("active", true),
      supabase.from("workspace_templates").select("*").eq("organization_id", organizationId),
      supabase
        .from("workspace_sectors")
        .select("*")
        .eq("organization_id", organizationId)
        .order("order_index"),
      supabase.from("workspace_notes").select("*").eq("organization_id", organizationId),
    ]);
  for (const result of [
    frontResult,
    taskResult,
    teamResult,
    templateResult,
    sectorResult,
    noteResult,
  ]) {
    if (result.error) throw result.error;
  }

  const fronts = frontResult.data ?? [];
  const tasks = taskResult.data ?? [];
  const today = new Date().toISOString().slice(0, 10);
  return {
    clients: (brands ?? [])
      .filter((brand) => (brand.modules as Record<string, unknown> | null)?.workspace !== false)
      .map((brand) => ({
        id: brand.id,
        name: brand.name,
        team: [],
        fronts: [
          ...fronts.filter((front) => front.brand_id === brand.id),
          ...(tasks.some((task) => task.brand_id === brand.id && !task.front_id)
            ? [
                {
                  id: brand.id,
                  brand_id: brand.id,
                  name: "Demandas sem frente",
                  recurrence: "oneoff",
                  lead_days: 0,
                  approved_until: today,
                  pending_start: null,
                  pending_end: null,
                  one_off_date: null,
                  template_id: null,
                },
              ]
            : []),
        ].map((front) => ({
          id: front.id,
          name: front.name,
          recurrence: front.recurrence,
          leadDays: front.lead_days,
          approvedUntil: front.approved_until ?? today,
          pendingStart: front.pending_start ?? "",
          pendingEnd: front.pending_end ?? "",
          oneOffDate: front.one_off_date ?? "",
          templateId: front.template_id ?? "",
          tasks: tasks
            .filter(
              (task) =>
                task.brand_id === brand.id &&
                (task.front_id === front.id || (front.id === brand.id && !task.front_id)),
            )
            .map((task) => ({
              id: task.id,
              title: task.title,
              owner: task.owner_name ?? "",
              status: task.status,
              sector: task.sector ?? "",
              month: task.month ?? "",
              priority: task.priority,
              dueDate: task.due_date ?? "",
              note: task.note ?? "",
              highlighted: task.highlighted,
              pinned: task.pinned,
              urgent: task.urgency === "alta" || task.urgency === "crítica",
              requiresReview: task.requires_review,
              reviewText: task.review_text ?? "",
              reviewChecklist: task.review_checklist ?? "",
              startTime: task.event_time ?? "",
              location: task.location ?? "",
              attachments: Array.isArray(task.attachments) ? task.attachments.join(", ") : "",
            })),
        })),
      })),
    team: mergeRecords((teamResult.data ?? []).map((member) => ({
      id: member.id,
      name: member.name,
      role: member.job_title ?? "",
      palette: member.palette,
      isLeader: member.is_leader,
      photo: member.avatar_url ?? "",
    })), await agencyTeam(organizationId)),
    templates: (templateResult.data ?? []).map((template) => ({
      id: template.id,
      name: template.name,
      kind: template.kind,
      tasks: template.tasks,
    })),
    sectors: (sectorResult.data ?? []).map((sector) => sector.name),
    notes: (noteResult.data ?? [])
      .filter((note) => note.author !== SNAPSHOT_AUTHOR)
      .map((note) => ({
        id: note.id,
        text: note.text,
        author: note.author ?? "",
        likes: note.likes,
      })),
  };
}

export async function saveWorkspaceSnapshot(organizationId: string, value: unknown) {
  const snapshot = parseWorkspaceSnapshot(value);
  const { error } = await supabase.from("workspace_notes").upsert({
    id: organizationId,
    organization_id: organizationId,
    author: SNAPSHOT_AUTHOR,
    text: JSON.stringify(snapshot),
  });
  if (error) throw error;
}

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Keep the shared client catalog and operational tables aligned with the ZIP UI. */
export async function mirrorWorkspaceToCore(
  organizationId: string,
  value: unknown,
  previous?: WorkspaceSnapshot | null,
) {
  const snapshot = parseWorkspaceSnapshot(value);
  const { data: existingBrands, error: brandReadError } = await supabase
    .from("brands")
    .select("id, name, modules")
    .eq("organization_id", organizationId);
  if (brandReadError) throw brandReadError;
  const brandById = new Map((existingBrands ?? []).map((brand) => [brand.id, brand]));

  for (const client of snapshot.clients) {
    const id = asText(client.id);
    const name = asText(client.name);
    if (!id || !name) continue;
    const existing = brandById.get(id);
    if (existing) {
      if (existing.name !== name) {
        const { error } = await supabase.from("brands").update({ name }).eq("id", id);
        if (error) throw error;
      }
    } else {
      const { error } = await supabase.from("brands").insert({
        id,
        organization_id: organizationId,
        name,
        slug: `${slugify(name) || "cliente"}-${id.slice(0, 8)}`,
        modules: { biblioteca: true, plano: false, espaco360: false, workspace: true },
      } as never);
      if (error) throw error;
    }
  }

  const frontRows: Array<Record<string, unknown>> = [];
  const taskRows: Array<Record<string, unknown>> = [];
  for (const client of snapshot.clients) {
    const brandId = asText(client.id);
    for (const front of client.fronts as Array<Record<string, unknown>>) {
      const frontId = asText(front.id);
      if (!frontId) continue;
      const isUnassigned = frontId === brandId && front.name === "Demandas sem frente";
      if (!isUnassigned)
        frontRows.push({
          id: frontId,
          brand_id: brandId,
          name: asText(front.name) || "Frente de conteúdo",
          recurrence: ["weekly", "biweekly", "monthly", "oneoff"].includes(asText(front.recurrence))
            ? front.recurrence
            : "weekly",
          lead_days: Number(front.leadDays) || 0,
          approved_until: asText(front.approvedUntil) || null,
          pending_start: asText(front.pendingStart) || null,
          pending_end: asText(front.pendingEnd) || null,
          one_off_date: asText(front.oneOffDate) || null,
        });
      for (const task of front.tasks as Array<Record<string, unknown>>) {
        const taskId = asText(task.id);
        if (!taskId) continue;
        taskRows.push({
          id: taskId,
          brand_id: brandId,
          front_id: isUnassigned ? null : frontId,
          title: asText(task.title) || "Demanda",
          sector: asText(task.sector) || null,
          owner_name: asText(task.owner) || null,
          status: asText(task.status) || "Parada",
          priority: Number(task.priority) || 999,
          due_date: asText(task.dueDate) || null,
          month: asText(task.month) || null,
          note: asText(task.note) || null,
          highlighted: Boolean(task.highlighted),
          pinned: Boolean(task.pinned),
          urgency: task.urgent ? "alta" : null,
          requires_review: Boolean(task.requiresReview),
          review_text: asText(task.reviewText) || null,
          review_checklist: asText(task.reviewChecklist) || null,
          event_time: asText(task.startTime) || null,
          location: asText(task.location) || null,
          attachments: task.attachments ?? [],
        });
      }
    }
  }

  for (let index = 0; index < frontRows.length; index += 100) {
    const { error } = await supabase
      .from("workspace_fronts")
      .upsert(frontRows.slice(index, index + 100) as never, { onConflict: "id" });
    if (error) throw error;
  }
  for (let index = 0; index < taskRows.length; index += 100) {
    const { error } = await supabase
      .from("workspace_tasks")
      .upsert(taskRows.slice(index, index + 100) as never, { onConflict: "id" });
    if (error) throw error;
  }

  if (!previous) return;
  const nextTaskIds = new Set(taskRows.map((task) => task.id));
  const nextFrontIds = new Set(frontRows.map((front) => front.id));
  const nextClientIds = new Set(snapshot.clients.map((client) => client.id));
  const removedTasks: string[] = [];
  const removedFronts: string[] = [];
  for (const client of previous.clients) {
    for (const front of client.fronts as Array<Record<string, unknown>>) {
      if (front.id !== client.id && typeof front.id === "string" && !nextFrontIds.has(front.id))
        removedFronts.push(front.id);
      for (const task of front.tasks as Array<Record<string, unknown>>) {
        if (typeof task.id === "string" && !nextTaskIds.has(task.id)) removedTasks.push(task.id);
      }
    }
  }
  for (let index = 0; index < removedTasks.length; index += 100) {
    const { error } = await supabase
      .from("workspace_tasks")
      .delete()
      .in("id", removedTasks.slice(index, index + 100));
    if (error) throw error;
  }
  for (let index = 0; index < removedFronts.length; index += 100) {
    const { error } = await supabase
      .from("workspace_fronts")
      .delete()
      .in("id", removedFronts.slice(index, index + 100));
    if (error) throw error;
  }
  for (const client of previous.clients) {
    if (typeof client.id !== "string" || nextClientIds.has(client.id)) continue;
    const brand = brandById.get(client.id);
    if (!brand) continue;
    const modules =
      brand.modules && typeof brand.modules === "object" && !Array.isArray(brand.modules)
        ? brand.modules
        : {};
    const { error } = await supabase
      .from("brands")
      .update({ modules: { ...modules, workspace: false } })
      .eq("id", client.id);
    if (error) throw error;
  }
}
