import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/reach/ui";
import { Btn } from "@/components/ui-reach/primitives";
import { EmptyState, StatusBadge } from "@/components/reach/workspace-ui";
import { listTasksInRange, toISO } from "@/lib/workspace-data";

export const Route = createFileRoute("/workspace/cronograma")({
  head: () => ({
    meta: [
      { title: "Cronograma — Reach Workspace" },
      { name: "description", content: "Cronograma mensal das entregas da Reach, por dia e por cliente." },
      { property: "og:title", content: "Cronograma — Reach Workspace" },
      { property: "og:description", content: "Todas as entregas do mês, dia a dia." },
    ],
  }),
  component: Schedule,
});

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** CRONOGRAMA — o mês inteiro da operação, dia a dia. */
function Schedule() {
  const now = new Date();
  const [cursor, setCursor] = useState(new Date(now.getFullYear(), now.getMonth(), 1));

  const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const startISO = toISO(start);
  const endISO = toISO(end);

  const tasks = useQuery({
    queryKey: ["ws-schedule", startISO],
    queryFn: () => listTasksInRange(startISO, endISO),
  });

  const days = Array.from({ length: end.getDate() }, (_, i) => toISO(new Date(cursor.getFullYear(), cursor.getMonth(), i + 1)));
  const byDay = new Map<string, NonNullable<typeof tasks.data>>();
  for (const t of tasks.data ?? []) {
    if (!t.due_date) continue;
    const list = byDay.get(t.due_date) ?? [];
    list.push(t);
    byDay.set(t.due_date, list);
  }
  const daysWithTasks = days.filter((d) => byDay.has(d));

  function shift(n: number) {
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="Cronograma"
        description="Todas as entregas com prazo no mês, na ordem em que precisam acontecer."
        actions={
          <div className="flex items-center gap-2">
            <Btn variant="outline" size="sm" onClick={() => shift(-1)} aria-label="Mês anterior">
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
            </Btn>
            <span className="min-w-36 text-center text-sm font-medium">
              {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
            </span>
            <Btn variant="outline" size="sm" onClick={() => shift(1)} aria-label="Próximo mês">
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </Btn>
          </div>
        }
      />

      {tasks.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando cronograma…</p>
      ) : daysWithTasks.length === 0 ? (
        <EmptyState
          title="Nenhuma entrega com prazo neste mês."
          description="Defina o prazo das demandas para elas aparecerem aqui."
        />
      ) : (
        <div className="space-y-3">
          {daysWithTasks.map((day) => (
            <section key={day} className="surface rounded-2xl p-4 sm:p-5">
              <h2 className="mb-3 text-sm font-semibold tracking-tight">
                {Number(day.slice(8, 10))} de {MONTHS[cursor.getMonth()].toLowerCase()}
                <span className="ml-2 text-[12px] font-normal text-muted-foreground">
                  {byDay.get(day)!.length} entrega(s)
                </span>
              </h2>
              <ul className="space-y-2">
                {byDay.get(day)!.map((t) => (
                  <li
                    key={t.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border/70 bg-card px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{t.title}</p>
                      <p className="truncate text-[12.5px] text-muted-foreground">
                        {t.brands ? (
                          <Link
                            to="/workspace/cliente/$brandSlug"
                            params={{ brandSlug: t.brands.slug }}
                            className="hover:underline"
                          >
                            {t.brands.name}
                          </Link>
                        ) : (
                          "Cliente"
                        )}
                        {[t.sector, t.owner_name].filter(Boolean).length > 0 &&
                          ` · ${[t.sector, t.owner_name].filter(Boolean).join(" · ")}`}
                      </p>
                    </div>
                    <StatusBadge status={t.status} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
