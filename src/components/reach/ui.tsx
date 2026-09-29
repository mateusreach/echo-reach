import { useAppSettings } from "@/lib/branding";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import reachIcon from "@/assets/reach-brand/icon.svg";

export function ReachMark({ className }: { className?: string }) {
  const settings = useAppSettings();

  if (settings?.logo_url) {
    return (
      <span className={cn("grid shrink-0 place-items-center overflow-hidden rounded-2xl", className ?? "h-9 w-9")}>
        <img
          src={settings.logo_url}
          alt={settings.agency_name ?? "Logo"}
          className="h-full w-full object-contain"
          style={{
            transform: `translate(${settings.logo_offset_x ?? 0}px, ${settings.logo_offset_y ?? 0}px) scale(${settings.logo_scale ?? 1})`,
          }}
        />
      </span>
    );
  }

  // Ícone oficial Reach Brand (asset estático) — marca padrão quando a
  // agência ainda não configurou um logo próprio.
  return (
    <span className={cn("grid shrink-0 place-items-center", className ?? "h-9 w-9")}>
      <img src={reachIcon} alt="Reach Brand" className="h-full w-full object-contain" />
    </span>
  );
}

export const pillButton = cva(
  "inline-flex items-center justify-center gap-2 rounded-full text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground shadow-glow hover:bg-primary-hover",
        secondary: "border border-border bg-card text-foreground hover:bg-muted",
        ghost: "text-muted-foreground hover:text-foreground hover:bg-muted",
        icon: "border border-border bg-card text-foreground hover:bg-muted",
      },
      size: {
        sm: "h-8 px-3 text-[12.5px]",
        md: "h-9 px-4",
        lg: "h-10 px-5",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export function PillButton({
  className,
  variant,
  size,
  ...props
}: ComponentProps<"button"> & VariantProps<typeof pillButton>) {
  return <button className={cn(pillButton({ variant, size }), className)} {...props} />;
}

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("surface rounded-2xl p-5 sm:p-6", className)}>
      {title && (
        <header className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <h2 className="truncate text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {title}
          </h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Chip({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "brand" | "success" | "warning" }) {
  const tones = {
    muted: "bg-muted text-muted-foreground",
    brand: "bg-primary-soft text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/12 text-warning",
  } as const;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[11.5px] font-medium", tones[tone])}>
      {children}
    </span>
  );
}

export function Meter({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${value}%` }} />
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:flex-wrap sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</p>
        )}
        <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
