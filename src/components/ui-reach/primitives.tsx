import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/reach-data";
import { ReachIconAnimation } from "@/components/reach/reach-icon-animation";

/* ── Botão padrão da plataforma ───────────────────────────── */
type BtnVariant = "primary" | "ghost" | "outline" | "danger";
type BtnSize = "sm" | "md";

export function Btn({
  variant = "outline",
  size = "md",
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: BtnSize }) {
  const variants: Record<BtnVariant, string> = {
    primary: "bg-primary text-primary-foreground shadow-glow hover:bg-primary-hover",
    ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
    outline: "border border-border bg-card text-foreground hover:bg-muted",
    danger: "border border-destructive/20 bg-destructive/8 text-destructive hover:bg-destructive/12",
  };
  const sizes: Record<BtnSize, string> = {
    sm: "px-2.5 py-1.5 text-[12px] gap-1.5 rounded-lg max-sm:min-h-10 max-sm:px-3.5",
    md: "px-3.5 py-2 text-[13px] gap-2 rounded-xl max-sm:min-h-11 max-sm:px-4",
  };
  return (
    <button
      {...rest}
      className={cn(
        "inline-flex items-center justify-center font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ── Campos de formulário ─────────────────────────────────── */
export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11.5px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn("input-reach", props.className)} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn("input-reach resize-y", props.className)} />;
}

export function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cn("input-reach appearance-none pr-8", props.className)}>
      {props.children}
    </select>
  );
}

/* ── Skeleton ─────────────────────────────────────────────── */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-muted", className)} />;
}

export function SkeletonList({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2.5", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

/* ── Estados ──────────────────────────────────────────────── */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="glass-1 rounded-2xl p-8 text-center">
      <div className="text-label mb-2 text-reach-rose">Erro</div>
      <p className="text-[14px] text-muted-foreground">{message}</p>
      {onRetry && (
        <Btn className="mt-5" variant="outline" onClick={onRetry}>
          Tentar novamente
        </Btn>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon = true,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  /** Ícone discreto do Reach Brand acima do título. Ativo por padrão. */
  icon?: boolean;
}) {
  return (
    <div className="glass-1 rounded-2xl p-10 text-center">
      {icon && (
        <ReachIconAnimation size={28} play={false} context="empty-state" className="mx-auto mb-3 opacity-60" />
      )}
      <div className="text-title mb-1">{title}</div>
      {description && <p className="mx-auto max-w-sm text-[13px] text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ── Status chip ──────────────────────────────────────────── */
const STATUS_ACCENT: Record<string, string> = {
  "planejado": "amber",
  "planejamento": "amber",
  "em andamento": "blue",
  "em execução": "blue",
  "em revisão": "amber",
  "preparação": "blue",
  "concluído": "mint",
  "concluída": "mint",
  "encerrada": "mint",
  "bloqueada": "rose",
  "a fazer": "violet",
  "a_fazer": "violet",
  "em_andamento": "blue",
  "concluida": "mint",
  "rascunho": "violet",
  "aprovada": "amber",
  "produzida": "blue",
  "publicada": "mint",
  "ativo": "mint",
  "em_teste": "amber",
  "planejado_": "violet",
  "pausado": "rose",
};

const CHIP_CLASSES: Record<string, string> = {
  coral: "bg-reach-coral-soft text-reach-coral",
  violet: "bg-reach-violet-soft text-reach-violet",
  blue: "bg-reach-blue-soft text-reach-blue",
  amber: "bg-reach-amber-soft text-reach-amber",
  mint: "bg-reach-mint-soft text-reach-mint",
  rose: "bg-reach-rose-soft text-reach-rose",
};

export function StatusChip({ status, label }: { status: string; label?: string }) {
  const key = status.toLowerCase().replace(/_/g, " ");
  const accent = STATUS_ACCENT[status] ?? STATUS_ACCENT[key] ?? "coral";
  const resolvedLabel = label ?? STATUS_LABELS[status] ?? status;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium", CHIP_CLASSES[accent])}>
      {resolvedLabel}
    </span>
  );
}
