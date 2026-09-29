// ---------------------------------------------------------------------------
// Echo · Componentes básicos (mesma marcação e classes da Biblioteca Echo)
// ---------------------------------------------------------------------------
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Icon, type IconName } from "./icon";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "tonal" | "danger" | "danger-soft";
  size?: "sm" | "md" | "lg";
  icon?: IconName;
  iconRight?: IconName;
  iconOnly?: boolean;
  loading?: boolean;
  block?: boolean;
  kbd?: string;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", icon, iconRight, iconOnly, loading, block, kbd, className = "", children, type = "button", ...rest },
  ref,
) {
  const cls = ["e-btn", variant, size === "md" ? "" : size, iconOnly ? "icon" : "", block ? "block" : "", loading ? "is-loading" : "", className]
    .filter(Boolean)
    .join(" ");
  return (
    <button ref={ref} type={type} className={cls} aria-busy={loading || undefined} {...rest}>
      {icon && <Icon name={icon} />}
      {!iconOnly && children}
      {iconRight && <Icon name={iconRight} />}
      {kbd && <span className="e-kbd">{kbd}</span>}
    </button>
  );
});

export type Tone = "draft" | "todo" | "doing" | "review" | "adjust" | "blocked" | "done" | "approved" | "late";

export function Badge({ children, tone, dot, icon, className = "" }: { children: ReactNode; tone?: Tone | "glass" | "grad"; dot?: boolean; icon?: IconName; className?: string }) {
  const toneCls = tone === "glass" || tone === "grad" ? tone : tone ? `st-${tone}` : "";
  return (
    <span className={`e-badge ${toneCls} ${className}`}>
      {dot && <i className="d" />}
      {icon && <Icon name={icon} />}
      {children}
    </span>
  );
}

export function Avatar({ name, gradient, size, status }: { name: string; gradient?: string; size?: "xs" | "sm" | "lg" | "xl"; status?: "on" | "busy" | "away" | "off" }) {
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <span className={`e-av ${size ?? ""}`} style={gradient ? ({ "--av": gradient } as React.CSSProperties) : undefined} role="img" aria-label={name} title={name}>
      {initials}
      {status && <i className={`dot ${status}`} />}
    </span>
  );
}

/** Logo do cliente: imagem quando existir, senão a inicial sobre o degradê do cliente. */
export function ClientLogo({ name, logoUrl, gradient, size }: { name: string; logoUrl?: string | null; gradient?: string; size?: "sm" | "lg" }) {
  if (logoUrl)
    return (
      <span className={`e-logo ${size ?? ""}`} style={{ background: "var(--glass-strong)", overflow: "hidden" }}>
        <img src={logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </span>
    );
  return (
    <span className={`e-logo ${size ?? ""}`} style={gradient ? ({ "--lg": gradient } as React.CSSProperties) : undefined} aria-hidden="true">
      {name.trim()[0]?.toUpperCase()}
    </span>
  );
}

export function Skeleton({ w = "100%", h = 12, r = 10 }: { w?: number | string; h?: number; r?: number }) {
  return <div className="e-skel" style={{ width: w, height: h, borderRadius: r }} />;
}

export function EmptyState({
  kind = "empty",
  icon,
  title,
  text,
  actions,
  compact,
}: {
  kind?: "empty" | "search" | "lock" | "error" | "ok";
  icon?: IconName;
  title: string;
  text?: string;
  actions?: ReactNode;
  compact?: boolean;
}) {
  const ic = icon ?? ({ empty: "inbox", search: "search", lock: "lock", error: "cloudOff", ok: "checkCircle" } as const)[kind];
  const cls = kind === "error" ? " danger" : kind === "lock" ? " lock" : "";
  return (
    <div className={`e-state${cls}`} style={compact ? { padding: "20px 12px" } : undefined}>
      <span className="art" style={kind === "ok" ? ({ "--c": "var(--ok)" } as React.CSSProperties) : undefined}>
        <Icon name={ic} />
      </span>
      <h4>{title}</h4>
      {text && <p>{text}</p>}
      {actions && <div className="acts">{actions}</div>}
    </div>
  );
}

export function ProgressRing({ value, size = 64, label }: { value: number; size?: number; label?: string }) {
  const r = 15.5;
  const c = 2 * Math.PI * r;
  return (
    <div className="e-ring" style={{ ["--sz" as string]: `${size}px` }} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <svg viewBox="0 0 36 36">
        <defs>
          <linearGradient id="e-grad-stroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: "var(--p1)" }} />
            <stop offset=".55" style={{ stopColor: "var(--p2)" }} />
            <stop offset="1" style={{ stopColor: "var(--mix)" }} />
          </linearGradient>
        </defs>
        <circle className="bg" cx="18" cy="18" r={r} fill="none" strokeWidth="3" />
        <circle className="fg" cx="18" cy="18" r={r} fill="none" strokeWidth="3" strokeLinecap="round" strokeDasharray={c.toFixed(2)} strokeDashoffset={(c * (1 - value / 100)).toFixed(2)} />
      </svg>
      <b>{value}%</b>
    </div>
  );
}
