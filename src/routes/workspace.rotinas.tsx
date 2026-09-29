import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/reach/ui";
import { EmptyState, StatusBadge } from "@/components/reach/workspace-ui";
import { SelectInput } from "@/components/ui-reach/primitives";
import { cn } from "@/lib/utils";
import { listBrands } from "@/lib/reach-data";
import { listWorkOrders } from "@/lib/work-orders";
import { addDays, listTasks, toISO, today, WORK_STATUSES, type WorkTask } from "@/lib/workspace-data";

export const Route = createFileRoute("/workspace/rotinas")({
  head: () => ({
    meta: [
      { title: "Rotinas — Reach Echo · Workspace" },
      { name: "description", content: "A rotina da equipe Reach: as mesmas tarefas vistas por dia, semana, mês, pessoa, setor ou cliente." },
      { property: "og:title", content: "Rotinas — Reach Echo · Workspace" },
      { property: "og:description", content: "Perspectivas da mesma operação: status, equipe, setor, cliente e período." },
    ],
  }),
  component: Routines,
});

const PERIODS = { hoje: "Hoje", semana: "Semana", mes: "Mês", todos: "Tudo em aberto" } as const;
const GROUPS = { status: "Status", pessoa: "Pessoa", setor: "Setor", cliente: "Cliente" } as const;

/**
 * ROTINAS — perspectivas da MESMA tarefa. Nenhuma cópia é criada: muda apenas
 * o recorte (período) e o agrupamento.
 */
function Routines() {
  const tasks = useQuery({ queryKey: ["ws-tasks-all"], queryFn: () => listTasks() });
  const brands = useQuery({ queryKey: ["brands-all"], queryFn: listBrands });
  const orders = useQuery({ queryKey: ["ws-orders-all"], queryFn: () => listWorkOrders() });
  const [period, setPeriod] = useState<keyof typeof PERIODS>("semana");
  const [group, setGroup] = useState<keyof typeof GROUPS>("status");

  const now = today();
  const iso = toISO(now);
  const brandName = useMemo(
    () => new Map((brands.data ?? []).map((b) => [b.id, { name: b.name, slug: b.slug }])),
    [brands.data],
  );
  const orderTitle = useMemo(() => new Map((orders.data ?? []).map((o) => [o.id, o.title])), [orders.data]);

  const open = (tasks.data ?? []).filter((t) => t.status !== "Concluído");
  const limits: Record<keyof typeof PERIODS, string | null> = {
    hoje: iso,
    semana: toISO(addDays(now, 7)),
    mes: toISO(addDays(now, 30)),
    todos: null,
  };
  const limit = limits[period];
  const visible = limit ? open.filter((t) => t.due_date && t.due_date <= limit) : open;

  const buckets = new Map<string, WorkTask[]>();
  for (const task of visible) {
    const key =
      group === "status"
        ? task.status
        : group === "pessoa"
          ? task.owner_name || "Sem responsável"
          : group === "setor"
            ? task.sector || "Sem setor"
            : brandName.get(task.brand_id)?.name || "Cliente";
    buckets.set(key, [...(buckets.get(key) ?? []), task]);
  }
  const keys =
    group === "status"
      ? WORK_STATUSES.filter((s) => buckets.has(s))
      : [...buckets.keys()].sort((a, b) => a.localeCompare(b, "pt-BR"));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="Rotinas"
        description="O trabalho da equipe em aberto. Troque a perspectiva sem duplicar nenhuma tarefa."
      />

      <div className="flex flex-wrap gap-2">
        <SelectInput value={period} onChange={(e) => setPeriod(e.target.value as keyof typeof PERIODS)} aria-label="Período">
          {Object.entries(PERIODS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </SelectInput>
        <SelectInput value={group} onChange={(e) => setGroup(e.target.value as keyof typeof GROUPS)} aria-label="Agrupar por">
          {Object.entries(GROUPS).map(([key, label]) => (
            <option key={key} value={key}>Agrupar por {label.toLocaleLowerCase("pt-BR")}</option>
          ))}
        </SelectInput>
        <span className="self-center text-sm text-muted-foreground">{visible.length} tarefa(s)</span>
      </div>

      {tasks.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando rotinas…</p>
      ) : visible.length === 0 ? (
        <EmptyState
          title="Nada em aberto neste recorte."
          description="Troque o período para ver mais adiante, ou crie as entregas dos próximos ciclos no Controle."
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {keys.map((key) => {
            const list = (buckets.get(key) ?? []).sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
            return (
              <section key={key} className="surface rounded-2xl p-5">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {key} · {list.length}
                </h2>
                <ul className="space-y-2">
                  {list.map((t) => {
                    const brand = brandName.get(t.brand_id);
                    const late = t.due_date && t.due_date < iso;
                    return (
                      <li key={t.id} className="rounded-xl border border-border/70 bg-card px-3 py-2">
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                          <p className="truncate text-[13px] font-medium">{t.title}</p>
                          <StatusBadge status={t.status} />
                        </div>
                        <p className="truncate text-[11.5px] text-muted-foreground">
                          {brand ? (
                            <Link to="/workspace/cliente/$brandSlug" params={{ brandSlug: brand.slug }} search={{}} className="hover:text-primary">
                              {brand.name}
                            </Link>
                          ) : null}
                          {t.work_order_id && orderTitle.get(t.work_order_id) ? ` · ${orderTitle.get(t.work_order_id)}` : ""}
                          {t.owner_name ? ` · ${t.owner_name}` : " · sem responsável"}
                        </p>
                        <p className={cn("text-[11.5px]", late ? "text-destructive" : "text-muted-foreground")}>
                          {t.due_date ? `prazo ${t.due_date}${late ? " (atrasada)" : ""}` : "sem prazo"}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
