import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Gift, Pencil, Plus, Repeat, Trash2, Trophy } from "lucide-react";
import { PageHeader } from "@/components/reach/ui";
import { EmptyState } from "@/components/reach/workspace-ui";
import { FormModal } from "@/components/reach/form-modal";
import { Btn, Field, SelectInput, TextInput } from "@/components/ui-reach/primitives";
import { cn } from "@/lib/utils";
import { listWorkOrders } from "@/lib/work-orders";
import {
  addDays,
  deleteGoal,
  formatDateBR,
  goalAppliesToWeek,
  goalProgress,
  listAssignableMembers,
  listGoals,
  listTasks,
  listTemplates,
  listWorkspaceBrands,
  localDate,
  saveGoal,
  templateTasks,
  toISO,
  weekStartISO,
  type WorkGoal,
} from "@/lib/workspace-data";

export const Route = createFileRoute("/workspace/metas")({
  head: () => ({
    meta: [
      { title: "Metas semanais — Reach Echo · Workspace" },
      { name: "description", content: "Metas semanais de entregas e de tarefas específicas, com benefício para a equipe." },
      { property: "og:title", content: "Metas semanais — Reach Echo · Workspace" },
      { property: "og:description", content: "Defina o que a equipe precisa entregar na semana e o benefício de bater a meta." },
    ],
  }),
  component: GoalsPage,
});

function GoalsPage() {
  const qc = useQueryClient();
  const [week, setWeek] = useState(weekStartISO());
  const [form, setForm] = useState<{ open: boolean; goal?: WorkGoal | null }>({ open: false });

  const goals = useQuery({ queryKey: ["ws-goals"], queryFn: listGoals });
  const tasks = useQuery({ queryKey: ["ws-tasks-all"], queryFn: () => listTasks() });
  const orders = useQuery({ queryKey: ["ws-orders-all"], queryFn: () => listWorkOrders() });
  const brands = useQuery({ queryKey: ["ws-brands"], queryFn: listWorkspaceBrands });
  const members = useQuery({ queryKey: ["ws-assignable"], queryFn: listAssignableMembers });
  const templates = useQuery({ queryKey: ["ws-templates"], queryFn: listTemplates });

  const weekEnd = toISO(addDays(localDate(week), 6));
  const isCurrent = week === weekStartISO();
  const active = (goals.data ?? []).filter((g) => goalAppliesToWeek(g, week));
  const brandName = (id: string | null) => (brands.data ?? []).find((b) => b.id === id)?.name;

  const progress = (g: WorkGoal) => goalProgress(g, week, tasks.data ?? [], orders.data ?? []);
  const reached = active.filter((g) => progress(g).reached).length;

  // Concluídas na semana por pessoa — quem está puxando a fila.
  const weekTasks = (tasks.data ?? []).filter((t) => t.status === "Concluído" && t.completed_at && t.completed_at >= week && t.completed_at <= weekEnd);
  const byMember = new Map<string, number>();
  for (const t of weekTasks) byMember.set(t.owner_name ?? "Sem responsável", (byMember.get(t.owner_name ?? "Sem responsável") ?? 0) + 1);
  const ranking = [...byMember.entries()].sort((a, b) => b[1] - a[1]);

  async function remove(g: WorkGoal) {
    try {
      await deleteGoal(g.id);
      toast.success("Meta removida.");
      qc.invalidateQueries({ queryKey: ["ws-goals"] });
    } catch (e) {
      toast.error(`Não foi possível remover: ${(e as Error).message}`);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Workspace"
        title="Metas semanais"
        description="Defina quantas entregas e tarefas a equipe precisa concluir por semana e o benefício de bater a meta."
        actions={
          <Btn variant="primary" onClick={() => setForm({ open: true, goal: null })}>
            <Plus className="h-4 w-4" aria-hidden /> Nova meta
          </Btn>
        }
      />

      <div className="surface flex items-center justify-between gap-2 rounded-2xl p-2">
        <Btn variant="ghost" aria-label="Semana anterior" onClick={() => setWeek(toISO(addDays(localDate(week), -7)))}>
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </Btn>
        <div className="text-center">
          <p className="text-sm font-semibold tabular-nums">
            {formatDateBR(week).slice(0, 5)} – {formatDateBR(weekEnd).slice(0, 5)}
          </p>
          <p className="text-[11.5px] text-muted-foreground">
            {isCurrent ? "Semana atual" : "Semana"} · {reached}/{active.length} meta(s) batida(s)
          </p>
        </div>
        <div className="flex items-center gap-1">
          {!isCurrent && (
            <Btn variant="ghost" size="sm" onClick={() => setWeek(weekStartISO())}>
              Hoje
            </Btn>
          )}
          <Btn variant="ghost" aria-label="Próxima semana" onClick={() => setWeek(toISO(addDays(localDate(week), 7)))}>
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Btn>
        </div>
      </div>

      {goals.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando metas…</p>
      ) : active.length === 0 ? (
        <EmptyState
          title="Nenhuma meta para esta semana."
          description="Crie uma meta geral (ex.: 10 entregas) ou de uma tarefa específica (ex.: 8 Artes) e defina o benefício da equipe."
          action={
            <Btn variant="primary" onClick={() => setForm({ open: true, goal: null })}>
              Criar primeira meta
            </Btn>
          }
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {active.map((g) => {
            const p = progress(g);
            return (
              <li key={g.id} className={cn("surface space-y-3 rounded-2xl p-4 sm:p-5", p.reached && "ring-2 ring-success/50")}>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold leading-snug">{g.title}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
                      <span className="rounded-full bg-muted px-2 py-0.5">
                        {g.scope === "tarefa" ? `Tarefa: ${g.task_title}` : g.metric === "entregas" ? "Entregas gerais" : "Tarefas gerais"}
                      </span>
                      {g.brand_id && <span>{brandName(g.brand_id) ?? "Cliente"}</span>}
                      {(g.member_name || g.member_id) && <span>{g.member_name ?? "Pessoa"}</span>}
                      {g.recurring && (
                        <span className="inline-flex items-center gap-1">
                          <Repeat className="h-3 w-3" aria-hidden /> toda semana
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Btn variant="ghost" size="sm" aria-label="Editar meta" onClick={() => setForm({ open: true, goal: g })}>
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                    </Btn>
                    <Btn variant="ghost" size="sm" aria-label="Remover meta" onClick={() => remove(g)}>
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </Btn>
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex items-baseline justify-between">
                    <span className="text-2xl font-semibold tabular-nums">
                      {p.done}
                      <span className="text-base font-normal text-muted-foreground"> / {p.target}</span>
                    </span>
                    <span className="text-[12px] tabular-nums text-muted-foreground">{p.percent}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full transition-all", p.reached ? "bg-success" : "bg-primary")} style={{ width: `${p.percent}%` }} />
                  </div>
                </div>

                {g.reward && (
                  <p
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-3 py-2 text-[12.5px]",
                      p.reached ? "bg-success/12 text-success" : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Gift className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="min-w-0">
                      {p.reached ? "Benefício conquistado: " : "Benefício: "}
                      <strong className="font-medium">{g.reward}</strong>
                    </span>
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <section className="surface space-y-3 rounded-2xl p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <Trophy className="h-4 w-4" aria-hidden /> Tarefas concluídas na semana, por pessoa
        </h2>
        {ranking.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma tarefa concluída nesta semana ainda.</p>
        ) : (
          <ol className="space-y-2">
            {ranking.map(([name, n], i) => (
              <li key={name} className="flex items-center gap-3 rounded-xl border border-border/70 bg-card px-3 py-2.5">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-muted text-[12px] font-semibold tabular-nums">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-[13.5px]">{name}</span>
                <span className="text-sm font-semibold tabular-nums">{n}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {form.open && (
        <GoalForm
          goal={form.goal}
          week={week}
          taskTitles={[...new Set((templates.data ?? []).flatMap((t) => templateTasks(t).map((x) => x.title)))]}
          brands={brands.data ?? []}
          members={members.data ?? []}
          onClose={() => setForm({ open: false })}
          onSaved={() => qc.invalidateQueries({ queryKey: ["ws-goals"] })}
        />
      )}
    </div>
  );
}

function GoalForm({
  goal,
  week,
  taskTitles,
  brands,
  members,
  onClose,
  onSaved,
}: {
  goal?: WorkGoal | null;
  week: string;
  taskTitles: string[];
  brands: { id: string; name: string }[];
  members: { name: string; user_id: string | null }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [scope, setScope] = useState<"geral" | "tarefa">((goal?.scope as "geral" | "tarefa") ?? "geral");
  const [metric, setMetric] = useState<"tarefas" | "entregas">((goal?.metric as "tarefas" | "entregas") ?? "entregas");
  const [title, setTitle] = useState(goal?.title ?? "");
  const [taskTitle, setTaskTitle] = useState(goal?.task_title ?? taskTitles[0] ?? "");
  const [brandId, setBrandId] = useState(goal?.brand_id ?? "");
  const [memberName, setMemberName] = useState(goal?.member_name ?? "");
  const [target, setTarget] = useState(String(goal?.target ?? 5));
  const [reward, setReward] = useState(goal?.reward ?? "");
  const [weekStart, setWeekStart] = useState(goal?.week_start ?? week);
  const [recurring, setRecurring] = useState(goal?.recurring ?? true);
  const [busy, setBusy] = useState(false);

  const effectiveMetric = scope === "tarefa" ? "tarefas" : metric;
  const autoTitle =
    scope === "tarefa"
      ? `${target || "?"} × ${taskTitle || "tarefa"} na semana`
      : `${target || "?"} ${effectiveMetric === "entregas" ? "entregas" : "tarefas"} na semana`;

  async function save() {
    const n = Number(target);
    if (!n || n < 1) return toast.error("Informe uma meta maior que zero.");
    if (scope === "tarefa" && !taskTitle.trim()) return toast.error("Escolha a tarefa da meta.");
    setBusy(true);
    try {
      const member = members.find((m) => m.name === memberName);
      await saveGoal({
        id: goal?.id,
        title: title.trim() || autoTitle,
        scope,
        metric: effectiveMetric,
        task_title: scope === "tarefa" ? taskTitle.trim() : null,
        brand_id: brandId || null,
        member_name: memberName || null,
        member_id: member?.user_id ?? null,
        target: n,
        reward: reward.trim() || null,
        week_start: weekStartISO(localDate(weekStart)),
        recurring,
      });
      toast.success("Meta salva.");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(`Não foi possível salvar a meta: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormModal
      title={goal ? "Editar meta" : "Nova meta semanal"}
      description="Meta geral conta todas as tarefas ou entregas concluídas; meta de tarefa conta só a tarefa escolhida."
      onClose={onClose}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Btn>
          <Btn variant="primary" onClick={save} disabled={busy}>
            {busy ? "Salvando…" : "Salvar meta"}
          </Btn>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo de meta">
          <SelectInput value={scope} onChange={(e) => setScope(e.target.value as "geral" | "tarefa")}>
            <option value="geral">Geral (toda a equipe)</option>
            <option value="tarefa">Tarefa específica</option>
          </SelectInput>
        </Field>
        {scope === "geral" ? (
          <Field label="O que contar">
            <SelectInput value={metric} onChange={(e) => setMetric(e.target.value as "tarefas" | "entregas")}>
              <option value="entregas">Entregas concluídas</option>
              <option value="tarefas">Tarefas concluídas</option>
            </SelectInput>
          </Field>
        ) : (
          <Field label="Tarefa">
            {taskTitles.length > 0 ? (
              <SelectInput value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)}>
                {taskTitles.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </SelectInput>
            ) : (
              <TextInput value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Ex.: Artes" />
            )}
          </Field>
        )}
        <Field label="Meta da semana" hint="Quantidade a concluir.">
          <TextInput type="number" min={1} value={target} onChange={(e) => setTarget(e.target.value)} />
        </Field>
        <Field label="Semana inicial">
          <TextInput type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
        </Field>
        <Field label="Cliente (opcional)">
          <SelectInput value={brandId} onChange={(e) => setBrandId(e.target.value)}>
            <option value="">Todos os clientes</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Pessoa (opcional)" hint="Vazio = meta da equipe toda." >
          <SelectInput value={memberName} onChange={(e) => setMemberName(e.target.value)} disabled={scope === "geral" && metric === "entregas"}>
            <option value="">Toda a equipe</option>
            {members.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>
      <Field label="Benefício ao bater a meta" hint="Ex.: sexta de folga, bônus, almoço da equipe.">
        <TextInput value={reward} onChange={(e) => setReward(e.target.value)} placeholder="Ex.: Sexta-feira com saída às 15h" />
      </Field>
      <Field label="Título" hint={`Se vazio: “${autoTitle}”.`}>
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} /> Repetir toda semana
      </label>
    </FormModal>
  );
}
