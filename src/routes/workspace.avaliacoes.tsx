import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader, PillButton } from "@/components/reach/ui";
import { EmptyState, StatusBadge } from "@/components/reach/workspace-ui";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  changeTaskStatus,
  createReview,
  listTasksInReview,
  REVIEW_PHRASES,
  type WorkTask,
} from "@/lib/workspace-data";

export const Route = createFileRoute("/workspace/avaliacoes")({
  head: () => ({
    meta: [
      { title: "Avaliações — Reach Workspace" },
      { name: "description", content: "Avaliação interna e externa das entregas da Reach, com checklist e frases rápidas." },
      { property: "og:title", content: "Avaliações — Reach Workspace" },
      { property: "og:description", content: "Aprovar, pedir ajuste e devolver para produção." },
    ],
  }),
  component: Reviews,
});

/** AVALIAÇÕES — checklist, frases rápidas, aprovação e retorno para produção. */
function Reviews() {
  const qc = useQueryClient();
  const tasks = useQuery({ queryKey: ["ws-review"], queryFn: listTasksInReview });
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="Avaliações"
        description="Entregas paradas em avaliação interna ou externa, esperando aprovação ou ajuste."
      />

      {tasks.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando avaliações…</p>
      ) : (tasks.data?.length ?? 0) === 0 ? (
        <EmptyState
          title="Nada aguardando avaliação."
          description="Quando uma demanda entrar em avaliação interna ou externa, ela aparece aqui."
        />
      ) : (
        <div className="space-y-3">
          {tasks.data!.map((t) => (
            <ReviewCard
              key={t.id}
              task={t}
              open={open === t.id}
              onToggle={() => setOpen(open === t.id ? null : t.id)}
              onDone={() => {
                qc.invalidateQueries({ queryKey: ["ws-review"] });
                qc.invalidateQueries({ queryKey: ["ws-tasks"] });
                setOpen(null);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewCard({
  task,
  open,
  onToggle,
  onDone,
}: {
  task: WorkTask;
  open: boolean;
  onToggle: () => void;
  onDone: () => void;
}) {
  const [phrases, setPhrases] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const checklist = (task.review_checklist ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  async function submit(decision: "aprovado" | "ajuste") {
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      await createReview({
        task_id: task.id,
        brand_id: task.brand_id,
        scope: task.status === "Avaliação externa" ? "externa" : "interna",
        decision,
        phrases,
        comment: comment || null,
        reviewer_id: auth.user?.id ?? null,
      });
      // Aprovado segue o fluxo; ajuste devolve a demanda para produção.
      await changeTaskStatus(
        task,
        decision === "aprovado"
          ? task.status === "Avaliação interna"
            ? "Avaliação externa"
            : "Concluído"
          : "Ajuste",
      );
      toast.success(decision === "aprovado" ? "Entrega aprovada." : "Ajuste solicitado.");
      onDone();
    } catch (e) {
      toast.error("Não foi possível registrar a avaliação.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="surface rounded-2xl p-4 sm:p-5">
      <button
        type="button"
        onClick={onToggle}
        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-left"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight">{task.title}</p>
          <p className="truncate text-[12.5px] text-muted-foreground">
            {[task.sector, task.owner_name].filter(Boolean).join(" · ") || "Sem responsável"}
          </p>
        </div>
        <StatusBadge status={task.status} />
      </button>

      {open && (
        <div className="mt-4 space-y-4 border-t border-border/70 pt-4">
          {checklist.length > 0 && (
            <div>
              <p className="mb-2 text-[11.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Checklist
              </p>
              <ul className="space-y-1.5">
                {checklist.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <input type="checkbox" className="mt-1 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="mb-2 text-[11.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Frases rápidas
            </p>
            <div className="flex flex-wrap gap-1.5">
              {REVIEW_PHRASES.map((p) => {
                const on = phrases.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPhrases(on ? phrases.filter((x) => x !== p) : [...phrases, p])}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
                      on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="Observações da avaliação"
            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />

          <div className="flex flex-wrap gap-2">
            <PillButton type="button" disabled={saving} onClick={() => submit("aprovado")}>
              Aprovar
            </PillButton>
            <PillButton type="button" variant="secondary" disabled={saving} onClick={() => submit("ajuste")}>
              Solicitar ajuste
            </PillButton>
          </div>
        </div>
      )}
    </article>
  );
}
