import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";
import { PageHeader } from "@/components/reach/ui";
import { EmptyState, StatusSelect } from "@/components/reach/workspace-ui";
import { TaskFormModal } from "@/components/reach/workspace-forms";
import { Btn, SelectInput, TextInput } from "@/components/ui-reach/primitives";
import { listTeamMembers } from "@/lib/reach-data";
import { listWorkspaceTaskSources } from "@/lib/workspace-bridge";
import {
  WORK_STATUSES,
  changeTaskStatus,
  listFronts,
  listSectors,
  listTasks,
  listWorkspaceBrands,
  type WorkStatus,
  type WorkTask,
} from "@/lib/workspace-data";

export const Route = createFileRoute("/workspace/demandas")({
  head: () => ({ meta: [{ title: "Demandas — Reach Workspace" }] }),
  component: WorkspaceTasks,
});

function WorkspaceTasks() {
  const qc = useQueryClient();
  const brands = useQuery({ queryKey: ["ws-brands"], queryFn: listWorkspaceBrands });
  const tasks = useQuery({ queryKey: ["ws-tasks-all"], queryFn: () => listTasks() });
  const taskSources = useQuery({
    queryKey: ["ws-task-sources-all", (tasks.data ?? []).map((task) => task.id).join(",")],
    queryFn: () => listWorkspaceTaskSources((tasks.data ?? []).map((task) => task.id)),
    enabled: !!tasks.data?.length,
  });
  const sectors = useQuery({ queryKey: ["ws-sectors"], queryFn: listSectors });
  const team = useQuery({ queryKey: ["team-members"], queryFn: () => listTeamMembers() });
  const [brandId, setBrandId] = useState("");
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<WorkTask | null>(null);
  const [creating, setCreating] = useState(false);
  const formBrandId = editing?.brand_id ?? (brandId || (brands.data?.length === 1 ? brands.data[0].id : ""));
  const fronts = useQuery({
    queryKey: ["ws-fronts", formBrandId],
    queryFn: () => listFronts(formBrandId),
    enabled: !!formBrandId && (creating || !!editing),
  });

  const brandById = useMemo(() => new Map((brands.data ?? []).map((brand) => [brand.id, brand])), [brands.data]);
  const sourceByTaskId = useMemo(
    () => new Map((taskSources.data ?? []).map((source) => [source.workspace_task_id, source])),
    [taskSources.data],
  );
  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return (tasks.data ?? [])
      .filter((task) => !brandId || task.brand_id === brandId)
      .filter((task) => !status || task.status === status)
      .filter((task) => !term || [task.title, task.owner_name, task.sector, brandById.get(task.brand_id)?.name]
        .some((value) => value?.toLocaleLowerCase("pt-BR").includes(term)))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || Number(b.highlighted) - Number(a.highlighted)
        || (a.due_date ?? "9999-12-31").localeCompare(b.due_date ?? "9999-12-31") || a.priority - b.priority);
  }, [tasks.data, brandId, status, query, brandById]);

  function refresh() {
    qc.invalidateQueries({ queryKey: ["ws-tasks-all"] });
    qc.invalidateQueries({ queryKey: ["ws-tasks"] });
    qc.invalidateQueries({ queryKey: ["ws-review"] });
    qc.invalidateQueries({ queryKey: ["ws-schedule"] });
  }

  async function setTaskStatus(task: WorkTask, next: WorkStatus) {
    try {
      await changeTaskStatus(task, next);
      refresh();
    } catch (error) {
      toast.error(`Não foi possível alterar o status: ${(error as Error).message}`);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="Demandas"
        description="Tarefas de todos os clientes, responsáveis e prazos em um só lugar."
        actions={<Btn variant="primary" size="sm" disabled={!formBrandId} title={!formBrandId ? "Selecione um cliente para criar a demanda" : undefined} onClick={() => setCreating(true)}>
          <Plus className="h-3.5 w-3.5" aria-hidden /> Nova demanda
        </Btn>}
      />

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,220px)_minmax(0,220px)]">
        <TextInput aria-label="Buscar demandas" placeholder="Buscar demanda, responsável ou setor" value={query} onChange={(event) => setQuery(event.target.value)} />
        <SelectInput aria-label="Filtrar por cliente" value={brandId} onChange={(event) => setBrandId(event.target.value)}>
          <option value="">Todos os clientes</option>
          {(brands.data ?? []).map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
        </SelectInput>
        <SelectInput aria-label="Filtrar por status" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Todos os status</option>
          {WORK_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
        </SelectInput>
      </div>

      {(tasks.isError || brands.isError) ? (
        <EmptyState title="Não foi possível carregar as demandas." description="Confira a conexão e tente novamente." action={<Btn variant="outline" onClick={() => { tasks.refetch(); brands.refetch(); }}>Tentar novamente</Btn>} />
      ) : tasks.isLoading || brands.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando demandas…</p>
      ) : (brands.data?.length ?? 0) === 0 ? (
        <EmptyState title="Nenhum cliente ativo no Workspace." description="Cadastre ou ative um cliente para começar a organizar as demandas." action={<Link to="/workspace/clientes"><Btn variant="primary">Abrir clientes</Btn></Link>} />
      ) : visible.length === 0 ? (
        <EmptyState title={tasks.data?.length ? "Nenhuma demanda neste filtro." : "Nenhuma demanda cadastrada."} description={tasks.data?.length ? "Altere a busca ou os filtros." : "Selecione um cliente e crie a primeira demanda."} />
      ) : (
        <ul className="space-y-2">
          {visible.map((task) => {
            const brand = brandById.get(task.brand_id);
            const source = sourceByTaskId.get(task.id);
            return <li key={task.id} className="grid gap-3 rounded-xl border border-border/70 bg-card px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{task.title}</p>
                <p className="truncate text-[12.5px] text-muted-foreground">
                  {brand ? <Link to="/workspace/cliente/$brandSlug" params={{ brandSlug: brand.slug }} className="hover:text-foreground">{brand.name}</Link> : "Cliente indisponível"}
                  {task.sector ? ` · ${task.sector}` : ""}{task.owner_name ? ` · ${task.owner_name}` : ""}{task.due_date ? ` · prazo ${task.due_date}` : ""}{task.urgency ? ` · urgência ${task.urgency}` : ""}
                </p>
                {source && <a href={source.source_url ?? "/agencia"} className="mt-1 inline-flex text-[11px] text-primary hover:underline">Origem: Reach Brand · abrir item original</a>}
              </div>
              <div className="flex items-center gap-2">
                <StatusSelect value={task.status} onChange={(next) => setTaskStatus(task, next)} />
                <Btn variant="ghost" size="sm" aria-label={`Editar ${task.title}`} onClick={() => setEditing(task)}><Pencil className="h-3.5 w-3.5" aria-hidden /></Btn>
              </div>
            </li>;
          })}
        </ul>
      )}

      {(creating || editing) && formBrandId && <TaskFormModal
        brandId={formBrandId}
        task={editing}
        fronts={fronts.data ?? []}
        sectors={sectors.data ?? []}
        team={team.data ?? []}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSaved={refresh}
      />}
    </div>
  );
}
