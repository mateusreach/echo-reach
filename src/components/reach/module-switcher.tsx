import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Home } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MODULES,
  moduleEntryPath,
  moduleForPath,
  moduleOrigin,
  setClientContext,
  type EcosystemModule,
} from "@/lib/ecosystem";

/**
 * Switcher global do Reach Echo — flutuante, compacto, na base da interface.
 * Preserva o cliente selecionado ao trocar entre os três ambientes.
 * Só aparece dentro de um módulo (nunca na Home nem no login).
 */
export function ModuleSwitcher() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current = moduleForPath(pathname);

  if (!current) return null;

  function go(m: EcosystemModule) {
    const clientSlug = pathname.match(/^\/(?:b|e360)\/([^/]+)/)?.[1]
      ?? pathname.match(/^\/workspace\/cliente\/([^/]+)/)?.[1]
      ?? null;
    if (clientSlug) setClientContext(clientSlug);
    const target = moduleEntryPath(m, clientSlug);
    const origin = moduleOrigin(m);
    // Domínio próprio configurado → navegação entre domínios do mesmo
    // ecossistema (a sessão é compartilhada, sem novo login).
    if (origin) {
      window.location.href = `${origin}${target}`;
      return;
    }
    navigate({ to: target });
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div
        role="navigation"
        aria-label="Trocar de ambiente no Reach Echo"
        className="glass pointer-events-auto flex items-center gap-1 rounded-full border border-border/70 p-1.5 shadow-glow backdrop-blur-xl"
      >
        <button
          type="button"
          onClick={() => navigate({ to: "/" })}
          title="Reach Echo — início do ecossistema"
          className="inline-flex h-9 items-center gap-2 rounded-full px-3 text-[12.5px] font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
        >
          <Home className="h-4 w-4 shrink-0" aria-hidden />
          <span className="hidden sm:inline">Echo</span>
          <span className="sr-only sm:hidden">Reach Echo</span>
        </button>
        <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />
        {MODULES.map((m) => {
          const active = m.id === current.id;
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => !active && go(m)}
              aria-current={active ? "page" : undefined}
              title={`${m.name} — ${m.tagline}`}
              className={cn(
                "group relative inline-flex h-9 items-center gap-2 rounded-full px-3 text-[12.5px] font-medium transition-all",
                active
                  ? "bg-primary text-primary-foreground shadow-glow"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="hidden sm:inline">{m.name}</span>
              <span className="sr-only sm:hidden">{m.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
