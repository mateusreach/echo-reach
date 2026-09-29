// ---------------------------------------------------------------------------
// Echo · Layout dos ambientes
// Barra superior do Echo + navegação interna do ambiente + conteúdo. As guardas
// de acesso continuam nos layouts de cada ambiente; aqui só a moldura.
// ---------------------------------------------------------------------------
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./icon";
import { OrbitLoader } from "./logo";
import { Button, EmptyState } from "./primitives";
import { EchoTopbar, type EnvDef } from "./shell";
import { isViewingAsClient, stopViewAsClient, viewingAsClientBrandName } from "@/lib/view-as";

export type SubnavItem = { to: string; label: string; exact?: boolean; icon?: IconName; params?: Record<string, string>; search?: Record<string, unknown> };

export function EchoSubnav({ items, secondary, label }: { items: SubnavItem[]; secondary?: SubnavItem[]; label: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const resolve = (it: SubnavItem) => Object.entries(it.params ?? {}).reduce((p, [k, v]) => p.replace(`$${k}`, v), it.to);
  const isOn = (it: SubnavItem) => { const href = resolve(it); return it.exact ? pathname === href || pathname === `${href}/` : pathname === href || pathname.startsWith(`${href}/`); };
  const link = (it: SubnavItem, cls: string) => (
    <Link key={it.to + it.label} to={it.to as never} params={it.params as never} search={it.search as never} className={`${cls}${isOn(it) ? " on" : ""}`} aria-current={isOn(it) ? "page" : undefined}>
      {it.icon && <Icon name={it.icon} size="sm" />}{it.label}
    </Link>
  );
  return (
    <nav className="echo-subnav" aria-label={label}>
      <div className="echo-subnav-main">{items.map((it) => link(it, "echo-sublink"))}</div>
      {secondary && secondary.length > 0 && <div className="echo-subnav-side">{secondary.map((it) => link(it, "echo-sublink ghost"))}</div>}
    </nav>
  );
}

/** Faixa do modo "Ver como cliente": sempre visível enquanto ativo. */
export function ViewAsBanner() {
  const navigate = useNavigate();
  if (typeof window === "undefined" || !isViewingAsClient()) return null;
  return (
    <div className="echo-viewas" role="status">
      <Icon name="eye" size="sm" />
      <span>Visualizando como <b>{viewingAsClientBrandName() ?? "cliente"}</b>. Nada é gravado em nome do cliente.</span>
      <span className="sp" />
      <Button size="sm" variant="secondary" onClick={() => { stopViewAsClient(); navigate({ to: "/clientes" as never }); }}>Sair da visão do cliente</Button>
    </div>
  );
}

export function EchoLayout({
  env,
  eyebrow,
  title,
  titleAside,
  nav,
  children,
  wide,
}: {
  env?: EnvDef["id"];
  eyebrow?: ReactNode;
  title?: ReactNode;
  titleAside?: ReactNode;
  nav?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="echo-app">
      <EchoTopbar activeEnv={env} />
      <div className={`echo-frame${wide ? " wide" : ""}`}>
        <ViewAsBanner />
        {(title || eyebrow) && (
          <div className="echo-envhead">
            <div style={{ minWidth: 0 }}>
              {eyebrow && <span className="e-label">{eyebrow}</span>}
              {title && <h1 className="e-h2">{title}</h1>}
            </div>
            {titleAside}
          </div>
        )}
        {nav}
        <main className="echo-main">{children}</main>
      </div>
    </div>
  );
}

export function EchoLoading({ label }: { label: string }) {
  return (
    <div className="echo-app">
      <div className="echo-center">
        <OrbitLoader size={96} label={label} />
        <p className="e-small">{label}</p>
      </div>
    </div>
  );
}

export function EchoBlocked({ title, text, onRetry, homeLabel = "Voltar ao Echo" }: { title: string; text: string; onRetry?: () => void; homeLabel?: string }) {
  return (
    <div className="echo-app">
      <EchoTopbar />
      <div className="echo-center">
        <div className="e-glass" style={{ borderRadius: "var(--r-2xl)", maxWidth: 520, width: "100%" }}>
          <EmptyState
            kind={onRetry ? "error" : "lock"}
            title={title}
            text={text}
            actions={
              <>
                {onRetry && <Button variant="secondary" icon="refresh" onClick={onRetry}>Tentar novamente</Button>}
                <Link to="/" className="e-btn ghost">{homeLabel}</Link>
              </>
            }
          />
        </div>
      </div>
    </div>
  );
}
