import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { RISK_LABELS, WORK_STATUSES, type RiskLevel, type WorkStatus } from "@/lib/workspace-data";

/** Selo de risco da frente de conteúdo, na linguagem visual do Brand. */
export function RiskBadge({ level }: { level: RiskLevel }) {
  const tones: Record<RiskLevel, string> = {
    red: "bg-destructive/12 text-destructive",
    orange: "bg-warning/15 text-warning",
    yellow: "bg-warning/10 text-warning",
    green: "bg-success/12 text-success",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[11.5px] font-medium", tones[level])}>
      {RISK_LABELS[level]}
    </span>
  );
}

/** Etapa atual da tarefa. Status nunca representa prioridade. */
export function StatusBadge({ status }: { status: string }) {
  const done = status === "Concluído";
  const review = status === "Avaliação interna" || status === "Avaliação externa";
  const waiting = status === "Aguardando retorno externo" || status === "Ajuste";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11.5px] font-medium",
        done
          ? "bg-success/12 text-success"
          : review
            ? "bg-primary-soft text-primary"
            : waiting
              ? "bg-warning/12 text-warning"
              : "bg-muted text-muted-foreground",
      )}
    >
      {status}
    </span>
  );
}

export function StatusSelect({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (status: WorkStatus) => void;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as WorkStatus)}
      className={cn(
        "h-9 rounded-full border border-border bg-card px-3 text-[12.5px] font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {WORK_STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="surface rounded-2xl px-6 py-12 text-center">
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      {description && <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="surface rounded-2xl p-4">
      <p className="text-[11.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-[12px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
