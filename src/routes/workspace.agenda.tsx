import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/reach/ui";
import { EmptyState, StatusBadge } from "@/components/reach/workspace-ui";
import { supabase } from "@/integrations/supabase/client";
import { listMyTasks } from "@/lib/workspace-data";

export const Route = createFileRoute("/workspace/agenda")({
  head: () => ({
    meta: [
      { title: "Minha agenda — Reach Workspace" },
      { name: "description", content: "Demandas e compromissos do usuário logado no Workspace da Reach." },
      { property: "og:title", content: "Minha agenda — Reach Workspace" },
      { property: "og:description", content: "O que é seu, por prazo e prioridade." },
    ],
  }),
  component: MyAgenda,
});

/** MINHA AGENDA — demandas do usuário logado, pelo perfil único do ecossistema. */
function MyAgenda() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const tasks = useQuery({
    queryKey: ["ws-my-tasks", userId],
    queryFn: () => listMyTasks(userId!),
    enabled: !!userId,
  });

  const list = tasks.data ?? [];
  const withDate = list.filter((t) => t.due_date).sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1));
  const noDate = list.filter((t) => !t.due_date);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="Minha agenda"
        description="Tudo que está sob sua responsabilidade e ainda não foi concluído."
      />

      {tasks.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando sua agenda…</p>
      ) : list.length === 0 ? (
        <EmptyState
          title="Nenhuma demanda aberta para você."
          description="Quando alguém atribuir uma demanda ao seu nome, ela aparece aqui."
        />
      ) : (
        <>
          <Section title="Com prazo" items={withDate} />
          <Section title="Sem prazo definido" items={noDate} />
        </>
      )}
    </div>
  );
}

function Section({ title, items }: { title: string; items: { id: string; title: string; status: string; due_date: string | null; sector: string | null; brands?: { name: string } | null }[] }) {
  if (items.length === 0) return null;
  return (
    <section className="surface rounded-2xl p-5 sm:p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</h2>
      <ul className="space-y-2">
        {items.map((t) => (
          <li
            key={t.id}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border/70 bg-card px-4 py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{t.title}</p>
              <p className="truncate text-[12.5px] text-muted-foreground">
                {[t.brands?.name, t.sector, t.due_date ? `prazo ${t.due_date.split("-").reverse().join("/")}` : null].filter(Boolean).join(" · ") || "—"}
              </p>
            </div>
            <StatusBadge status={t.status} />
          </li>
        ))}
      </ul>
    </section>
  );
}
