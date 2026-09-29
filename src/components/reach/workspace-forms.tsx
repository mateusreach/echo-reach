// Formulários de criação e edição do Workspace. Reaproveitam o FormModal e as
// primitivas do Brand — nenhum design system paralelo.
import { useState } from "react";
import { toast } from "sonner";
import { FormModal } from "@/components/reach/form-modal";
import { Btn, Field, SelectInput, TextArea, TextInput } from "@/components/ui-reach/primitives";
import {
  RECURRENCES,
  WORK_STATUSES,
  createFront,
  createTask,
  deleteFront,
  deleteTask,
  toISO,
  today,
  updateFront,
  updateTask,
  type Front,
  type WorkTask,
} from "@/lib/workspace-data";
import { dispatchBrandItemToWorkspace, type BrandWorkspaceDispatchInput } from "@/lib/workspace-bridge";
import {
  CHANNEL_STATUSES,
  DEFAULT_MODULES,
  MODULE_DEFS,
  brandModules,
  createBrand,
  createChannel,
  updateBrand,
  updateChannel,
  type Brand,
  type BrandModules,
  type Channel,
  type TeamMember,
} from "@/lib/reach-data";

/* ── Frente de conteúdo ─────────────────────────────────────── */

export function FrontFormModal({
  brandId,
  front,
  onClose,
  onSaved,
}: {
  brandId: string;
  front?: Front | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(front?.name ?? "");
  const [recurrence, setRecurrence] = useState<string>(front?.recurrence ?? "weekly");
  const [leadDays, setLeadDays] = useState(String(front?.lead_days ?? 3));
  const [approvedUntil, setApprovedUntil] = useState(front?.approved_until ?? toISO(today()));
  const [pendingStart, setPendingStart] = useState(front?.pending_start ?? "");
  const [pendingEnd, setPendingEnd] = useState(front?.pending_end ?? "");
  const [oneOffDate, setOneOffDate] = useState(front?.one_off_date ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const payload = {
        brand_id: brandId,
        name: name.trim(),
        recurrence,
        lead_days: Number(leadDays) || 0,
        approved_until: approvedUntil || null,
        pending_start: pendingStart || null,
        pending_end: pendingEnd || null,
        one_off_date: recurrence === "oneoff" ? oneOffDate || null : null,
      };
      if (front) await updateFront(front.id, payload);
      else await createFront(payload as never);
      onSaved();
      onClose();
    } catch (e) {
      toast.error(`Não foi possível salvar a frente: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!front) return;
    setBusy(true);
    try {
      await deleteFront(front.id);
      onSaved();
      onClose();
    } catch (e) {
      toast.error(`Não foi possível excluir a frente: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormModal
      title={front ? "Editar frente" : "Nova frente de conteúdo"}
      description="A frente define o ritmo do cliente e até quando ele está coberto."
      onClose={onClose}
      footer={
        <>
          {front && (
            <Btn variant="danger" onClick={remove} disabled={busy} className="mr-auto">
              Excluir
            </Btn>
          )}
          <Btn variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Btn>
          <Btn variant="primary" onClick={save} disabled={busy || !name.trim()}>
            {busy ? "Salvando…" : "Salvar"}
          </Btn>
        </>
      }
    >
      <Field label="Nome da frente">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Feed Instagram" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Recorrência">
          <SelectInput value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
            {Object.entries(RECURRENCES).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Antecedência (dias)" hint="Tempo mínimo de produção antes de o conteúdo ir ao ar.">
          <TextInput type="number" min={0} value={leadDays} onChange={(e) => setLeadDays(e.target.value)} />
        </Field>
        <Field label="Aprovado até" hint="Até quando o cliente já tem conteúdo garantido.">
          <TextInput type="date" value={approvedUntil} onChange={(e) => setApprovedUntil(e.target.value)} />
        </Field>
        {recurrence === "oneoff" ? (
          <Field label="Data da entrega avulsa">
            <TextInput type="date" value={oneOffDate} onChange={(e) => setOneOffDate(e.target.value)} />
          </Field>
        ) : (
          <Field label="Início do ciclo pendente" hint="Opcional — calculado automaticamente se vazio.">
            <TextInput type="date" value={pendingStart} onChange={(e) => setPendingStart(e.target.value)} />
          </Field>
        )}
        {recurrence !== "oneoff" && (
          <Field label="Fim do ciclo pendente" hint="Opcional.">
            <TextInput type="date" value={pendingEnd} onChange={(e) => setPendingEnd(e.target.value)} />
          </Field>
        )}
      </div>
    </FormModal>
  );
}

/* ── Demanda ────────────────────────────────────────────────── */

export function TaskFormModal({
  brandId,
  task,
  workOrderId,
  defaultFrontId,
  defaultDueDate,
  fronts,
  sectors,
  team,
  onClose,
  onSaved,
}: {
  brandId: string;
  task?: WorkTask | null;
  /** Nova tarefa criada DENTRO de uma entrega. */
  workOrderId?: string | null;
  defaultFrontId?: string | null;
  defaultDueDate?: string | null;
  fronts: Front[];
  sectors: { id: string; name: string }[];
  team: Pick<TeamMember, "name" | "user_id">[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [frontId, setFrontId] = useState(task?.front_id ?? defaultFrontId ?? "");
  const [sector, setSector] = useState(task?.sector ?? "");
  const [ownerName, setOwnerName] = useState(task?.owner_name ?? "");
  const [status, setStatus] = useState<string>(task?.status ?? "Parada");
  const [priority, setPriority] = useState(String(task?.priority ?? 2));
  const [dueDate, setDueDate] = useState(task?.due_date ?? defaultDueDate ?? "");
  const [month, setMonth] = useState(task?.month ?? "");
  const [urgency, setUrgency] = useState(task?.urgency ?? "");
  const [highlighted, setHighlighted] = useState(task?.highlighted ?? false);
  const [pinned, setPinned] = useState(task?.pinned ?? false);
  const [requiresReview, setRequiresReview] = useState(task?.requires_review ?? false);
  const [reviewText, setReviewText] = useState(task?.review_text ?? "");
  const [reviewChecklist, setReviewChecklist] = useState(task?.review_checklist ?? "");
  const [eventTime, setEventTime] = useState(task?.event_time ?? "");
  const [location, setLocation] = useState(task?.location ?? "");
  const [note, setNote] = useState(task?.note ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const owner = team.find((m) => m.name === ownerName);
      const payload = {
        brand_id: brandId,
        front_id: frontId || null,
        work_order_id: task ? task.work_order_id : (workOrderId ?? null),
        title: title.trim(),
        sector: sector || null,
        owner_name: ownerName || null,
        owner_id: owner?.user_id ?? null,
        status,
        priority: Number(priority) || 2,
        due_date: dueDate || null,
        month: month || dueDate.slice(0, 7) || null,
        urgency: urgency || null,
        highlighted,
        pinned,
        requires_review: requiresReview,
        review_text: requiresReview ? reviewText || null : null,
        review_checklist: requiresReview ? reviewChecklist || null : null,
        event_time: eventTime || null,
        location: location || null,
        note: note || null,
      };
      if (task) await updateTask(task.id, payload);
      else await createTask(payload as never);
      onSaved();
      onClose();
    } catch (e) {
      toast.error(`Não foi possível salvar a demanda: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!task) return;
    setBusy(true);
    try {
      await deleteTask(task.id);
      onSaved();
      onClose();
    } catch (e) {
      toast.error(`Não foi possível excluir a demanda: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormModal
      title={task ? "Editar tarefa" : workOrderId ? "Nova tarefa da entrega" : "Nova demanda"}
      description="O status é a etapa do processo — nunca a prioridade."
      onClose={onClose}
      size="lg"
      footer={
        <>
          {task && (
            <Btn variant="danger" onClick={remove} disabled={busy} className="mr-auto">
              Excluir
            </Btn>
          )}
          <Btn variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Btn>
          <Btn variant="primary" onClick={save} disabled={busy || !title.trim()}>
            {busy ? "Salvando…" : "Salvar"}
          </Btn>
        </>
      }
    >
      <Field label="Título">
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Carrossel de lançamento" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Frente">
          <SelectInput value={frontId} onChange={(e) => setFrontId(e.target.value)}>
            <option value="">Sem frente</option>
            {fronts.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Setor">
          <SelectInput value={sector} onChange={(e) => setSector(e.target.value)}>
            <option value="">Sem setor</option>
            {sectors.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Responsável">
          <SelectInput value={ownerName} onChange={(e) => setOwnerName(e.target.value)}>
            <option value="">Sem responsável</option>
            {team.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name}
                {m.user_id ? "" : " (sem acesso)"}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Etapa">
          <SelectInput value={status} onChange={(e) => setStatus(e.target.value)}>
            {WORK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Prioridade" hint="1 = primeiro da fila.">
          <TextInput type="number" min={1} value={priority} onChange={(e) => setPriority(e.target.value)} />
        </Field>
        <Field label="Prazo">
          <TextInput type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
        <Field label="Mês de produção">
          <TextInput type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </Field>
        <Field label="Urgência">
          <SelectInput value={urgency} onChange={(e) => setUrgency(e.target.value)}>
            <option value="">Normal</option>
            <option value="baixa">Baixa</option>
            <option value="média">Média</option>
            <option value="alta">Alta</option>
            <option value="crítica">Crítica</option>
          </SelectInput>
        </Field>
        <Field label="Horário">
          <TextInput type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} />
        </Field>
        <Field label="Local">
          <TextInput value={location} onChange={(e) => setLocation(e.target.value)} />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} /> Fixar na fila</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={highlighted} onChange={(e) => setHighlighted(e.target.checked)} /> Destacar</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={requiresReview} onChange={(e) => setRequiresReview(e.target.checked)} /> Requer avaliação</label>
      </div>
      {requiresReview && <div className="grid gap-4">
        <Field label="Instruções para avaliação"><TextArea rows={2} value={reviewText} onChange={(e) => setReviewText(e.target.value)} /></Field>
        <Field label="Checklist de avaliação"><TextArea rows={2} value={reviewChecklist} onChange={(e) => setReviewChecklist(e.target.value)} /></Field>
      </div>}
      <Field label="Observação">
        <TextArea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </FormModal>
  );
}

/* ── Envio contextual do Brand ─────────────────────────────── */

/**
 * O modal é usado dentro do Brand/Espaço 360. Ele não cria um cadastro de
 * cliente paralelo: a demanda recebe o mesmo `brand_id` do item de origem.
 */
export function SendToWorkspaceModal({
  source,
  sectors,
  team,
  onClose,
  onSent,
}: {
  source: Omit<BrandWorkspaceDispatchInput, "sector" | "ownerId" | "ownerName" | "dueDate" | "priority" | "note">;
  sectors: { id: string; name: string }[];
  team: TeamMember[];
  onClose: () => void;
  onSent?: (result: { workspaceTaskId: string; created: boolean }) => void;
}) {
  const [title, setTitle] = useState(source.title);
  const [sector, setSector] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("999");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const owner = team.find((member) => member.name === ownerName);
      const result = await dispatchBrandItemToWorkspace({
        ...source,
        title: title.trim(),
        sector,
        ownerId: owner?.user_id ?? null,
        ownerName,
        dueDate,
        priority: Number(priority) || 999,
        note,
      });
      toast.success(result.created ? "Demanda enviada ao Workspace." : "Esta demanda já estava no Workspace.");
      onSent?.(result);
      onClose();
    } catch (error) {
      toast.error(`Não foi possível enviar ao Workspace: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormModal
      title="Enviar para o Workspace"
      description="A demanda será criada para este mesmo cliente e ficará vinculada ao item de origem."
      onClose={onClose}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Btn>
          <Btn variant="primary" onClick={send} disabled={busy || !title.trim()}>{busy ? "Enviando…" : "Enviar demanda"}</Btn>
        </>
      }
    >
      <Field label="Título"><TextInput value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Setor">
          <SelectInput value={sector} onChange={(event) => setSector(event.target.value)}>
            <option value="">Sem setor</option>
            {sectors.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
          </SelectInput>
        </Field>
        <Field label="Responsável">
          <SelectInput value={ownerName} onChange={(event) => setOwnerName(event.target.value)}>
            <option value="">Distribuir depois</option>
            {team.map((member) => <option key={member.id} value={member.name}>{member.name}</option>)}
          </SelectInput>
        </Field>
        <Field label="Prazo"><TextInput type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></Field>
        <Field label="Prioridade" hint="1 = primeiro na fila."><TextInput type="number" min={1} value={priority} onChange={(event) => setPriority(event.target.value)} /></Field>
      </div>
      {source.description && <Field label="Contexto de origem"><TextArea rows={3} value={source.description} readOnly /></Field>}
      <Field label="Observação para a equipe"><TextArea rows={3} value={note} onChange={(event) => setNote(event.target.value)} /></Field>
    </FormModal>
  );
}

/* ── Cliente (cadastro único do ecossistema) ────────────────── */

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Cadastro de cliente visto pelo Workspace. É o MESMO registro do Brand
 * (`brands`): criar aqui faz o cliente aparecer nos dois módulos, e os
 * módulos marcados controlam onde ele fica ativo. Nunca duplica cliente.
 */
export function ClientFormModal({
  brand,
  onClose,
  onSaved,
}: {
  brand?: Brand | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(brand?.name ?? "");
  const [slug, setSlug] = useState(brand?.slug ?? "");
  const [segment, setSegment] = useState(brand?.segment ?? "");
  const [modules, setModules] = useState<BrandModules>(
    brand ? brandModules(brand) : { ...DEFAULT_MODULES, workspace: true },
  );
  const [busy, setBusy] = useState(false);

  async function save() {
    const finalSlug = (slug.trim() || slugify(name)).trim();
    if (!name.trim() || !finalSlug) return;
    setBusy(true);
    try {
      if (brand) {
        await updateBrand(brand.id, {
          name: name.trim(),
          slug: finalSlug,
          segment: segment.trim() || null,
          modules: modules as never,
        });
      } else {
        await createBrand({
          name: name.trim(),
          slug: finalSlug,
          segment: segment.trim() || undefined,
          modules: modules as unknown as Record<string, boolean>,
        });
      }
      toast.success(brand ? "Cliente atualizado." : "Cliente cadastrado nos dois módulos.");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(`Não foi possível salvar o cliente: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormModal
      title={brand ? "Editar cliente" : "Novo cliente"}
      description="O cadastro é único: o mesmo cliente aparece no Brand e no Workspace."
      onClose={onClose}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Btn>
          <Btn variant="primary" onClick={save} disabled={busy || !name.trim()}>
            {busy ? "Salvando…" : "Salvar"}
          </Btn>
        </>
      }
    >
      <Field label="Nome do cliente">
        <TextInput
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!brand) setSlug(slugify(e.target.value));
          }}
          placeholder="Ex.: Fina Fragrância"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Endereço do cliente" hint="Usado no link das páginas dele.">
          <TextInput value={slug} onChange={(e) => setSlug(slugify(e.target.value))} />
        </Field>
        <Field label="Segmento">
          <TextInput value={segment} onChange={(e) => setSegment(e.target.value)} placeholder="Ex.: Perfumaria" />
        </Field>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-xs text-muted-foreground">Onde este cliente está ativo</legend>
        <p className="text-[11px] text-muted-foreground">O plano é configurado dentro do Espaço 360 quando esse espaço estiver ativo.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {MODULE_DEFS.map((m) => (
            <label key={m.key} className="flex cursor-pointer items-start gap-2 rounded-2xl border border-border bg-card p-3">
              <input
                type="checkbox"
                checked={modules[m.key]}
                onChange={(e) => setModules({ ...modules, [m.key]: e.target.checked })}
                className="mt-0.5 h-4 w-4 accent-[var(--reach-coral)]"
              />
              <span className="min-w-0">
                <span className="block text-[12.5px] font-medium">{m.label}</span>
                <span className="block text-[11px] leading-snug text-muted-foreground">{m.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </FormModal>
  );
}

/* ── Canal do cliente (mesma lista do Brand) ────────────────── */

/** Canais são compartilhados com o Brand (Espaço 360 → Canais): editar aqui
 *  atualiza lá, e vice-versa. */
export function ChannelFormModal({
  brandId,
  channel,
  orderIndex,
  onClose,
  onSaved,
}: {
  brandId: string;
  channel?: Channel | null;
  orderIndex: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(channel?.name ?? "");
  const [type, setType] = useState(channel?.channel_type ?? "");
  const [status, setStatus] = useState(channel?.status ?? CHANNEL_STATUSES[0].key);
  const [description, setDescription] = useState(channel?.description ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
        channel_type: type.trim() || null,
        status,
        description: description.trim() || null,
      };
      if (channel) await updateChannel(channel.id, payload);
      else await createChannel({ ...payload, brand_id: brandId, order_index: orderIndex });
      onSaved();
      onClose();
    } catch (e) {
      toast.error(`Não foi possível salvar o canal: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormModal
      title={channel ? "Editar canal" : "Novo canal"}
      description="Os canais são os mesmos do Brand — o acompanhamento fica igual nos dois sistemas."
      onClose={onClose}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Btn>
          <Btn variant="primary" onClick={save} disabled={busy || !name.trim()}>
            {busy ? "Salvando…" : "Salvar"}
          </Btn>
        </>
      }
    >
      <Field label="Nome do canal">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Instagram" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo">
          <TextInput value={type} onChange={(e) => setType(e.target.value)} placeholder="Ex.: Rede social" />
        </Field>
        <Field label="Situação">
          <SelectInput value={status} onChange={(e) => setStatus(e.target.value)}>
            {CHANNEL_STATUSES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>
      <Field label="Observação">
        <TextArea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
    </FormModal>
  );
}
