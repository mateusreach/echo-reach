import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/reach/ui";
import { EmptyState, RiskBadge, StatCard, StatusBadge } from "@/components/reach/workspace-ui";
import { supabase } from "@/integrations/supabase/client";
import {
  listFrontsWithRisk,
  listTasks,
  listTasksInReview,
  listWorkspaceBrands,
  toISO,
  today,
  type WorkTask,
} from "@/lib/workspace-data";

export const Route = createFileRoute("/workspace/")({
  head: () => ({
    meta: [
      { title: "Visão geral — Reach Echo · Workspace" },
      {
        name: "description",
        content: "O que precisa ser executado hoje: suas demandas, atrasos, triagem e clientes que pedem atenção.",
      },
      { property: "og:title", content: "Visão geral — Reach Echo · Workspace" },
      { property: "og:description", content: "Abra e saiba imediatamente o que fazer hoje." },
    ],
  }),
  component: Overview,
});

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

/** VISÃO GERAL — a página do dia a dia de cada colaborador. */
function Overview() {
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return;
      setUserId(user.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();
      setDisplayName(profile?.display_name || user.email || "");
    })();
  }, []);

  const tasks = useQuery({ queryKey: ["ws-tasks-all"], queryFn: () => listTasks() });
  const review = useQuery({ queryKey: ["ws-review"], queryFn: listTasksInReview });
  const fronts = useQuery({ queryKey: ["ws-fronts-risk"], queryFn: listFrontsWithRisk });
  const brands = useQuery({ queryKey: ["ws-brands"], queryFn: listWorkspaceBrands });

  const brandById = useMemo(
    () => new Map((brands.data ?? []).map((brand) => [brand.id, brand])),
    [brands.data],
  );
  const iso = toISO(today());
  const open = (tasks.data ?? []).filter((task) => task.status !== "Concluído");
  const mine = open.filter((task) => task.owner_id === userId);
  const myToday = mine.filter((task) => task.due_date && task.due_date <= iso);
  const myNext = mine.filter((task) => task.due_date && task.due_date > iso).slice(0, 6);
  const late = open.filter((task) => task.due_date && task.due_date < iso);
  const intake = open.filter((task) => !task.owner_id);
  const attention = (fronts.data ?? []).filter((f) => f.level === "red" || f.level === "orange");

  const taskRow = (task: WorkTask) => {
    const brand = brandById.get(task.brand_id);
    return (
      <li
        key={task.id}
        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border/70 bg-card px-4 py-3"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{task.title}</p>
          <p className="truncate text-[12.5px] text-muted-foreground">
            {brand?.name ?? "Cliente"} · {task.due_date ? `prazo ${task.due_date}` : "sem prazo"}
            {task.sector ? ` · ${task.sector}` : ""}
          </p>
        </div>
        <StatusBadge status={task.status} />
      </li>
    );
  };

  const section = (title: string, items: WorkTask[], empty: string) => (
    <section className="surface rounded-2xl p-5 sm:p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {title} · {items.length}
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2">{items.map(taskRow)}</ul>
      )}
    </section>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title={`${greeting()}${displayName ? `, ${displayName.split(" ")[0]}` : ""}`}
        description="O que precisa da sua atenção hoje, o que está atrasado e o que ainda não tem responsável."
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Minhas de hoje" value={myToday.length} hint="Com prazo até hoje" />
        <StatCard label="Atrasadas" value={late.length} hint="Toda a operação" />
        <StatCard label="Sem responsável" value={intake.length} hint="Entrada para triagem" />
        <StatCard label="Em avaliação" value={review.data?.length ?? 0} hint="Interna ou externa" />
      </div>

      {tasks.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando a operação…</p>
      ) : open.length === 0 ? (
        <EmptyState
          title="Nenhuma demanda em aberto."
          description="Quando uma ideia, campanha ou solicitação do Brand for enviada para execução, ela aparece aqui."
        />
      ) : (
        <>
          {section("Minhas demandas de hoje", myToday, "Nada com prazo para hoje.")}
          {section("Entrada para triagem", intake, "Tudo distribuído.")}
          {section("Atrasadas", late, "Nenhum atraso na operação.")}
          {section("Próximas entregas suas", myNext, "Sem próximas entregas com prazo.")}
        </>
      )}

      {attention.length > 0 && (
        <section className="surface rounded-2xl p-5 sm:p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Clientes que precisam de atenção
          </h2>
          <ul className="space-y-2">
            {attention.map(({ front, brand, level }) => (
              <li
                key={front.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border/70 bg-card px-4 py-3"
              >
                <div className="min-w-0">
                  <Link
                    to="/workspace/cliente/$brandSlug"
                    params={{ brandSlug: brand.slug }}
                    className="block truncate text-sm font-medium hover:text-primary"
                  >
                    {brand.name} · {front.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    aprovado até {front.approved_until ? front.approved_until.split("-").reverse().join("/") : "—"}
                  </p>
                </div>
                <RiskBadge level={level} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
