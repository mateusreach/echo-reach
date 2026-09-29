// ---------------------------------------------------------------------------
// Echo · Blocos de página reutilizáveis (indicador, painel, linha de agenda,
// carga da pessoa). Montados com os componentes básicos da biblioteca.
// ---------------------------------------------------------------------------
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./icon";
import { Avatar, Badge, type Tone } from "./primitives";
import { useCountUp } from "./motion";
import { toISO, today } from "@/lib/workspace-data";

export const WORK_TONE: Record<string, Tone> = {
  Parada: "todo", Iniciada: "doing", "Avaliação interna": "review", "Aguardando retorno externo": "adjust", Ajuste: "adjust", "Avaliação externa": "review", Concluído: "done",
  nova: "todo", em_analise: "review", aprovada: "approved", em_execucao: "doing", aguardando_cliente: "adjust", a_fazer: "todo", em_andamento: "doing",
};
export const STATUS_LABEL: Record<string, string> = { nova: "Nova", em_analise: "Em análise", aprovada: "Aprovada", em_execucao: "Em execução", aguardando_cliente: "Aguardando cliente", a_fazer: "A fazer", em_andamento: "Em andamento" };

export function entryTone(date: string): "late" | "soon" | "ok" {
  const t = toISO(today());
  return date < t ? "late" : date <= toISO(new Date(Date.now() + 86_400_000)) ? "soon" : "ok";
}


export function StatTile({ label, value, icon, to, tone, hint }: { label: string; value: number; icon: IconName; to?: string; tone?: string; hint?: string }) {
  const n = useCountUp(value);
  const body = (
    <>
      <span className="stat-ic" style={tone ? ({ "--c": tone } as React.CSSProperties) : undefined}><Icon name={icon} size="sm" /></span>
      <span className="e-kpi tnum">{n}</span>
      <span className="stat-lbl">{label}{hint && <small>{hint}</small>}</span>
    </>
  );
  return to ? <Link to={to as never} className="stat-tile e-glass">{body}</Link> : <div className="stat-tile e-glass">{body}</div>;
}

export function Panel({ title, icon, count, tone, action, children, className = "" }: { title: string; icon: IconName; count?: number; tone?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`now-panel e-glass ${className}`} style={tone ? ({ "--c": tone } as React.CSSProperties) : undefined}>
      <header>
        <span className="now-ic"><Icon name={icon} size="sm" /></span>
        <h3>{title}</h3>
        {count !== undefined && <span className="e-badge glass tnum">{count}</span>}
        {action}
      </header>
      <div className="now-body">{children}</div>
    </section>
  );
}

const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Data em bloco (dia grande + mês), com tom de urgência. */
export function DateBlock({ iso, tone }: { iso: string; tone?: "late" | "soon" | "ok" }) {
  const [, m, d] = iso.split("-");
  return (
    <span className={`date-block ${tone ?? ""}`} aria-hidden="true">
      <b>{d}</b>
      <span>{MES[Number(m) - 1]}</span>
    </span>
  );
}

export function AgendaRow({ date, tone, title, meta, badge, color, to, onClick }: { date: string; tone?: "late" | "soon" | "ok"; title: string; meta?: string; badge?: { label: string; tone: Tone }; color?: string; to?: string; onClick?: () => void }) {
  const inner = (
    <>
      <DateBlock iso={date} tone={tone} />
      <span className="now-main" style={color ? { borderLeft: `2px solid ${color}`, paddingLeft: 10 } : undefined}>
        <b className="e-ellipsis">{title}</b>
        {meta && <span className="e-ellipsis">{meta}</span>}
      </span>
      {badge && <span className="now-side"><Badge tone={badge.tone} dot>{badge.label}</Badge></span>}
    </>
  );
  if (to) return <Link to={to as never} className="now-row agenda-row">{inner}</Link>;
  if (onClick) return <button type="button" className="now-row agenda-row" onClick={onClick}>{inner}</button>;
  return <div className="now-row agenda-row">{inner}</div>;
}

export function PersonLoad({ name, role, open, late, max, leader }: { name: string; role?: string | null; open: number; late: number; max: number; leader?: boolean }) {
  const pct = max ? Math.round((open / max) * 100) : 0;
  const cls = late > 0 ? "danger" : pct > 80 ? "warn" : "ok";
  return (
    <div className="person-load">
      <Avatar name={name} size="sm" />
      <div style={{ minWidth: 0 }}>
        <div className="e-row" style={{ gap: 6 }}><b className="e-ellipsis" style={{ fontSize: 13.5 }}>{name}</b>{leader && <Badge tone="glass">Liderança</Badge>}</div>
        <span className="e-caption e-ellipsis" style={{ display: "block" }}>{role ?? "Equipe"}</span>
      </div>
      <div className="load">
        <div className={`e-bar sm ${cls}`} role="progressbar" aria-valuenow={open} aria-valuemin={0} aria-valuemax={max} aria-label={`Carga de ${name}`}><i style={{ ["--v" as string]: `${pct}%` }} /></div>
        <span className="e-caption tnum">{open} {open === 1 ? "item" : "itens"}{late ? ` · ${late} atrasado${late > 1 ? "s" : ""}` : ""}</span>
      </div>
    </div>
  );
}
