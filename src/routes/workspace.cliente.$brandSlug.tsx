import { createFileRoute, Link, useParams, useSearch } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Brain, ExternalLink, Pencil, Plus, Rocket, Wand2 } from "lucide-react";
import { PageHeader, PillButton } from "@/components/reach/ui";
import { EmptyState, RiskBadge, StatusSelect } from "@/components/reach/workspace-ui";
import { ChannelFormModal, FrontFormModal, TaskFormModal } from "@/components/reach/workspace-forms";
import { ClientTaskOwners } from "@/components/reach/client-task-owners";
import { FormModal } from "@/components/reach/form-modal";
import { Btn, Field, SelectInput, TextInput } from "@/components/ui-reach/primitives";
import { cn } from "@/lib/utils";
import { CHANNEL_STATUSES, getBrandBySlug, listChannels, listTeamMembers, type Channel } from "@/lib/reach-data";
import { setClientContext } from "@/lib/ecosystem";
import {
  applyTemplateToWorkOrder,
  ensureFrontWorkOrder,
  listWorkOrders,
  listWorkOrderSources,
  updateWorkOrder,
  workOrderKindLabel,
  workOrderProgress,
  type WorkOrder,
} from "@/lib/work-orders";
import {
  changeTaskStatus,
  formatDateBR,
  frontPeriod,
  frontRisk,
  listFronts,
  listSectors,
  listTasks,
  listAssignableMembers,
  listTemplates,
  templateTasks,
  updateFront,
  RECURRENCES,
  RISK_LABELS,
  type Front,
  type WorkStatus,
  type WorkTask,
  type WorkTemplate,
} from "@/lib/workspace-data";

type Search = { frente?: string };

export const Route = createFileRoute("/workspace/cliente/$brandSlug")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    frente: typeof search['frente'] === "string" ? (search['frente'] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Operação do cliente — Reach Echo · Workspace" },
      { name: "description", content: "Frentes, entregas e tarefas de execução de um cliente da Reach." },
      { property: "og:title", content: "Operação do cliente — Reach Echo · Workspace" },
      { property: "og:description", content: "Cobertura, pautas recorrentes e demandas avulsas do cliente." },
    ],
  }),
  component: WorkspaceClient,
});

/**
 * OPERAÇÃO DESTE CLIENTE — não é outro cadastro de cliente.
 * Estrutura real do trabalho: FRENTE → ENTREGA (ciclo) → TAREFAS.
 */
function WorkspaceClient() {
  const { brandSlug } = useParams({ from: "/workspace/cliente/$brandSlug" });
  const { frente } = useSearch({ from: "/workspace/cliente/$brandSlug" });
  const qc = useQueryClient();

  useEffect(() => {
    setClientContext(brandSlug);
  }, [brandSlug]);

  const brand = useQuery({ queryKey: ["brand", brandSlug], queryFn: () => getBrandBySlug(brandSlug) });
  const brandId = brand.data?.id;
  const on = { enabled: !!brandId };

  const fronts = useQuery({ queryKey: ["ws-fronts", brandId], queryFn: () => listFronts(brandId!), ...on });
  const tasks = useQuery({ queryKey: ["ws-tasks", brandId], queryFn: () => listTasks({ brandId: brandId! }), ...on });
  const orders = useQuery({ queryKey: ["ws-orders", brandId], queryFn: () => listWorkOrders({ brandId: brandId! }), ...on });
  const orderSources = useQuery({
    queryKey: ["ws-order-sources", (orders.data ?? []).map((o) => o.id).join(",")],
    queryFn: () => listWorkOrderSources((orders.data ?? []).map((o) => o.id)),
    enabled: (orders.data ?? []).length > 0,
  });
  const sectors = useQuery({ queryKey: ["ws-sectors"], queryFn: listSectors });
  const templates = useQuery({ queryKey: ["ws-templates"], queryFn: listTemplates });
  const team = useQuery({ queryKey: ["ws-assignable"], queryFn: listAssignableMembers });
  const channels = useQuery({ queryKey: ["brand-channels", brandId], queryFn: () => listChannels(brandId!), ...on });

  const [frontForm, setFrontForm] = useState<{ open: boolean; front?: Front | null }>({ open: false });
  const [taskForm, setTaskForm] = useState<{ open: boolean; task?: WorkTask | null; order?: WorkOrder | null }>({ open: false });
  const [channelForm, setChannelForm] = useState<{ open: boolean; channel?: Channel | null }>({ open: false });
  const [applyTo, setApplyTo] = useState<WorkOrder | null>(null);

  function refresh() {
    qc.invalidateQueries({ queryKey: ["ws-fronts", brandId] });
    qc.invalidateQueries({ queryKey: ["ws-tasks", brandId] });
    qc.invalidateQueries({ queryKey: ["ws-orders", brandId] });
    qc.invalidateQueries({ queryKey: ["ws-fronts-risk"] });
    qc.invalidateQueries({ queryKey: ["ws-schedule"] });
    qc.invalidateQueries({ queryKey: ["brand-channels", brandId] });
  }

  async function setStatus(task: WorkTask, status: WorkStatus) {
    await changeTaskStatus(task, status);
    qc.invalidateQueries({ queryKey: ["ws-tasks", brandId] });
    qc.invalidateQueries({ queryKey: ["ws-review"] });
  }

  async function materialize(front: Front) {
    try {
      const { created } = await ensureFrontWorkOrder(front);
      toast.success(created ? "Entrega do próximo ciclo criada." : "Esta entrega já existia — nada foi duplicado.");
      refresh();
    } catch (e) {
      toast.error(`Não foi possível criar a entrega: ${(e as Error).message}`);
    }
  }

  async function approveCoverage(front: Front, until: string) {
    try {
      await updateFront(front.id, { approved_until: until, pending_start: null, pending_end: null });
      toast.success(`Cobertura atualizada até ${until}.`);
      refresh();
    } catch (e) {
      toast.error(`Não foi possível atualizar a cobertura: ${(e as Error).message}`);
    }
  }

  if (brand.isLoading) return <p className="text-sm text-muted-foreground">Carregando cliente…</p>;
  if (!brand.data) return <EmptyState title="Cliente não encontrado." />;

  const allTasks = tasks.data ?? [];
  const allOrders = orders.data ?? [];
  const sourceByOrder = new Map((orderSources.data ?? []).map((s) => [s.work_order_id, s]));
  const tasksOf = (orderId: string) => allTasks.filter((t) => t.work_order_id === orderId);
  // Toda entrega aparece: as do ciclo atual de cada frente ficam no cartão da frente;
  // as demais (sem frente, de outro período, avulsas) entram em "Outras entregas".
  const frontOrderIds = new Set(
    (fronts.data ?? [])
      .map((f) => {
        const p = frontPeriod(f);
        return allOrders.find((o) => o.front_id === f.id && o.period_start === p.start && o.period_end === p.end)?.id;
      })
      .filter(Boolean),
  );
  const looseOrders = allOrders.filter((o) => !frontOrderIds.has(o.id));
  const looseTasks = allTasks.filter((t) => !t.work_order_id);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace · Operação deste cliente"
        title={brand.data.name}
        description="Frentes recorrentes, entregas em produção e demandas avulsas. O cadastro do cliente fica no Reach Echo."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/clientes/$brandSlug" params={{ brandSlug }}>
              <PillButton variant="secondary" type="button">Ficha do cliente</PillButton>
            </Link>
            <Link to="/b/$brandSlug" params={{ brandSlug }}>
              <PillButton variant="secondary" type="button">
                <Brain className="h-4 w-4" aria-hidden /> Consultar Brand
              </PillButton>
            </Link>
          </div>
        }
      />

      {/* ---------- PAUTAS / ENTREGAS RECORRENTES ---------- */}
      <section className="space-y-3">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <h2 className="truncate text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Pautas recorrentes
          </h2>
          <Btn variant="outline" size="sm" onClick={() => setFrontForm({ open: true, front: null })}>
            <Plus className="h-3.5 w-3.5" aria-hidden /> Nova frente
          </Btn>
        </header>

        {(fronts.data?.length ?? 0) === 0 ? (
          <p className="surface rounded-2xl p-5 text-sm text-muted-foreground">
            Nenhuma frente cadastrada. A frente é a regra recorrente (Feed, Stories, TikTok…) que precisa continuar coberta.
          </p>
        ) : (
          fronts.data!.map((f) => {
            const { level } = frontRisk(f);
            const period = frontPeriod(f);
            const order = allOrders.find(
              (o) => o.front_id === f.id && o.period_start === period.start && o.period_end === period.end,
            );
            const orderTasks = order ? tasksOf(order.id) : [];
            const progress = workOrderProgress(orderTasks);
            const finished = orderTasks.length > 0 && progress.done === progress.total;
            return (
              <article
                key={f.id}
                className={cn(
                  "surface space-y-3 rounded-2xl p-5",
                  frente === f.id && "ring-2 ring-primary/60",
                )}
                id={`frente-${f.id}`}
              >
                <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold tracking-tight">{f.name}</p>
                    <p className="truncate text-[12.5px] text-muted-foreground">
                      {RECURRENCES[f.recurrence as keyof typeof RECURRENCES]} · aprovado até {formatDateBR(f.approved_until)} ·
                      antecedência {f.lead_days ?? 0} dia(s) · próximo período {formatDateBR(period.start)} a {formatDateBR(period.end)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <RiskBadge level={level} />
                    <Btn variant="ghost" size="sm" aria-label={`Editar ${f.name}`} onClick={() => setFrontForm({ open: true, front: f })}>
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                    </Btn>
                  </div>
                </header>

                {!order ? (
                  <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3">
                    <p className="min-w-0 flex-1 text-[12.5px] text-muted-foreground">
                      {RISK_LABELS[level]} · a entrega deste ciclo ainda não foi criada.
                    </p>
                    <Btn variant="primary" size="sm" onClick={() => materialize(f)}>
                      Criar entrega do ciclo
                    </Btn>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border/70 bg-card p-4">
                    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium">{order.title}</p>
                        <p className="truncate text-[12px] text-muted-foreground">
                          {progress.done}/{progress.total} tarefa(s) concluída(s) · {progress.percent}%
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Btn variant="outline" size="sm" onClick={() => setTaskForm({ open: true, task: null, order })}>
                          <Plus className="h-3.5 w-3.5" aria-hidden /> Tarefa
                        </Btn>
                        <Btn variant="outline" size="sm" onClick={() => setApplyTo(order)}>
                          <Wand2 className="h-3.5 w-3.5" aria-hidden /> Aplicar modelo
                        </Btn>
                        {finished && order.period_end && (
                          <Btn variant="primary" size="sm" onClick={() => approveCoverage(f, order.period_end!)}>
                            Marcar pauta aprovada até {order.period_end}
                          </Btn>
                        )}
                      </div>
                    </header>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-primary" style={{ width: `${progress.percent}%` }} />
                    </div>
                    {orderTasks.length === 0 ? (
                      <p className="mt-3 text-[12.5px] text-muted-foreground">
                        Nenhuma tarefa nesta entrega ainda. Use "Aplicar modelo" para gerar as etapas do cliente ou "Tarefa" para adicionar uma.
                      </p>
                    ) : (
                      <ul className="mt-3 space-y-2">
                        {orderTasks.map((t) => (
                          <TaskRow key={t.id} task={t} onStatus={setStatus} onEdit={() => setTaskForm({ open: true, task: t })} />
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </article>
            );
          })
        )}
      </section>

      {brandId && <ClientTaskOwners brandId={brandId} templates={templates.data ?? []} />}

      {/* ---------- DEMANDAS AVULSAS ---------- */}
      <section className="surface space-y-3 rounded-2xl p-5">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Outras entregas e demandas
            </h2>
            <p className="truncate text-[12.5px] text-muted-foreground">
              Vindas do Espaço 360, de campanhas, de reuniões ou criadas internamente.
            </p>
          </div>
          <Btn variant="primary" size="sm" onClick={() => setTaskForm({ open: true, task: null })}>
            <Plus className="h-3.5 w-3.5" aria-hidden /> Nova demanda
          </Btn>
        </header>

        {looseOrders.length === 0 && looseTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma outra entrega ou demanda no momento.</p>
        ) : (
          <div className="space-y-3">
            {looseOrders.map((o) => {
              const list = tasksOf(o.id);
              const progress = workOrderProgress(list);
              const source = sourceByOrder.get(o.id);
              return (
                <div key={o.id} className="rounded-xl border border-border/70 bg-card p-4">
                  <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium">{o.title}</p>
                      <p className="truncate text-[12px] text-muted-foreground">
                        {workOrderKindLabel(o.kind)}
                        {o.period_start && o.period_end ? ` · ${formatDateBR(o.period_start)} a ${formatDateBR(o.period_end)}` : ""}
                        {o.requested_due_date ? ` · pedido para ${o.requested_due_date}` : ""}
                        {list.length ? ` · ${progress.done}/${progress.total} tarefa(s)` : " · sem tarefas ainda"}
                      </p>
                      {source?.source_url && (
                        <a href={source.source_url} className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
                          <Brain className="h-3 w-3" aria-hidden /> Ver contexto no Brand
                          <ExternalLink className="h-3 w-3" aria-hidden />
                        </a>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Btn variant="outline" size="sm" onClick={() => setTaskForm({ open: true, task: null, order: o })}>
                        <Plus className="h-3.5 w-3.5" aria-hidden /> Tarefa
                      </Btn>
                      <Btn variant="outline" size="sm" onClick={() => setApplyTo(o)}>
                        <Wand2 className="h-3.5 w-3.5" aria-hidden /> Aplicar modelo
                      </Btn>
                    </div>
                  </header>
                  {list.length > 0 && (
                    <ul className="mt-3 space-y-2">
                      {list.map((t) => (
                        <TaskRow key={t.id} task={t} onStatus={setStatus} onEdit={() => setTaskForm({ open: true, task: t })} />
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}

            {looseTasks.length > 0 && (
              <div className="rounded-xl border border-border/70 bg-card p-4">
                <p className="mb-2 text-[12px] uppercase tracking-[0.14em] text-muted-foreground">
                  Tarefas sem entrega
                </p>
                <ul className="space-y-2">
                  {looseTasks.map((t) => (
                    <TaskRow key={t.id} task={t} onStatus={setStatus} onEdit={() => setTaskForm({ open: true, task: t })} />
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ---------- CANAIS ---------- */}
      <section className="surface rounded-2xl p-5">
        <header className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Canais</h2>
            <p className="truncate text-[12.5px] text-muted-foreground">Mesma lista do Brand — atualizar aqui atualiza lá.</p>
          </div>
          <Btn variant="outline" size="sm" onClick={() => setChannelForm({ open: true, channel: null })}>
            <Plus className="h-3.5 w-3.5" aria-hidden /> Novo canal
          </Btn>
        </header>
        {(channels.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum canal cadastrado para este cliente ainda.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {channels.data!.map((c) => (
              <li key={c.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border/70 bg-card px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <p className="truncate text-[12.5px] text-muted-foreground">
                    {[c.channel_type, CHANNEL_STATUSES.find((s) => s.key === c.status)?.label ?? c.status].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <Btn variant="ghost" size="sm" aria-label={`Editar ${c.name}`} onClick={() => setChannelForm({ open: true, channel: c })}>
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                </Btn>
              </li>
            ))}
          </ul>
        )}
      </section>

      {frontForm.open && brandId && (
        <FrontFormModal brandId={brandId} front={frontForm.front} onClose={() => setFrontForm({ open: false })} onSaved={refresh} />
      )}
      {taskForm.open && brandId && (
        <TaskFormModal
          brandId={brandId}
          task={taskForm.task}
          workOrderId={taskForm.order?.id ?? null}
          defaultFrontId={taskForm.order?.front_id ?? null}
          defaultDueDate={taskForm.order?.internal_due_date ?? taskForm.order?.period_end ?? taskForm.order?.requested_due_date ?? null}
          fronts={fronts.data ?? []}
          sectors={sectors.data ?? []}
          team={team.data ?? []}
          onClose={() => setTaskForm({ open: false })}
          onSaved={refresh}
        />
      )}
      {channelForm.open && brandId && (
        <ChannelFormModal
          brandId={brandId}
          channel={channelForm.channel}
          orderIndex={channels.data?.length ?? 0}
          onClose={() => setChannelForm({ open: false })}
          onSaved={refresh}
        />
      )}
      {applyTo && brandId && (
        <ApplyTemplateModal
          brandId={brandId}
          order={applyTo}
          templates={templates.data ?? []}
          onClose={() => setApplyTo(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}

function TaskRow({
  task,
  onStatus,
  onEdit,
}: {
  task: WorkTask;
  onStatus: (task: WorkTask, status: WorkStatus) => void;
  onEdit: () => void;
}) {
  return (
    <li className="grid gap-2 rounded-lg border border-border/60 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <p className="truncate text-[13px]">{task.title}</p>
        <p className="truncate text-[11.5px] text-muted-foreground">
          {[task.sector, task.owner_name, task.due_date ? `prazo ${task.due_date}` : "sem prazo"].filter(Boolean).join(" · ")}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <StatusSelect value={task.status} onChange={(s) => onStatus(task, s)} />
        <Btn variant="ghost" size="sm" aria-label={`Editar ${task.title}`} onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" aria-hidden />
        </Btn>
      </div>
    </li>
  );
}

/** Gera as etapas do modelo DENTRO da entrega — nunca tarefas soltas. */
function ApplyTemplateModal({
  brandId,
  order,
  templates,
  onClose,
  onSaved,
}: {
  brandId: string;
  order: WorkOrder;
  templates: WorkTemplate[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [dueDate, setDueDate] = useState(order.internal_due_date ?? order.period_end ?? order.requested_due_date ?? "");
  const [busy, setBusy] = useState(false);
  const selected = templates.find((t) => t.id === templateId);

  async function apply() {
    if (!selected) return;
    setBusy(true);
    try {
      const count = await applyTemplateToWorkOrder(selected, {
        brandId,
        workOrderId: order.id,
        frontId: order.front_id,
        dueDate: dueDate || null,
      });
      if (dueDate && dueDate !== order.internal_due_date) await updateWorkOrder(order.id, { internal_due_date: dueDate });
      toast.success(`${count} tarefa(s) criadas nesta entrega.`);
      onSaved();
      onClose();
    } catch (e) {
      toast.error(`Não foi possível aplicar o modelo: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormModal
      title="Aplicar modelo de execução"
      description={`As etapas serão criadas dentro da entrega "${order.title}".`}
      onClose={onClose}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Btn>
          <Btn variant="primary" onClick={apply} disabled={busy || !selected}>
            {busy ? "Criando…" : "Criar tarefas"}
          </Btn>
        </>
      }
    >
      {templates.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum modelo cadastrado ainda. Crie modelos em Configurações.</p>
      ) : (
        <>
          <Field label="Modelo">
            <SelectInput value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Prazo final da entrega" hint="As etapas com antecedência definida no modelo recuam a partir desta data.">
            <TextInput type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
          {selected && (
            <div className="rounded-xl border border-border/70 bg-card px-4 py-3">
              <p className="mb-2 text-[11.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Serão criadas</p>
              <ul className="space-y-1 text-sm">
                {templateTasks(selected).map((item, i) => (
                  <li key={i} className="truncate">
                    {i + 1}. {item.title}
                    {item.sector ? ` · ${item.sector}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </FormModal>
  );
}
