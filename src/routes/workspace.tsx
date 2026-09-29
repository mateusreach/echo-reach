import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RefreshCw, Rocket } from "lucide-react";
import { ReachIconAnimation } from "@/components/reach/reach-icon-animation";
import { Btn } from "@/components/ui-reach/primitives";
import { supabase } from "@/integrations/supabase/client";
import { getFullAccess, WORKSPACE_DENY_PERMISSION } from "@/lib/agency-data";
import { withTimeout } from "@/lib/with-timeout";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/workspace")({ component: WorkspaceLayout });

/** Navegação principal do Workspace — execução e operação do Reach Echo. */
const PRIMARY = [
  { to: "/workspace", label: "Visão geral", exact: true },
  { to: "/workspace/controle", label: "Controle" },
  { to: "/workspace/clientes", label: "Clientes" },
  { to: "/workspace/rotinas", label: "Rotinas" },
  { to: "/workspace/metas", label: "Metas" },
  { to: "/workspace/agenda", label: "Minha agenda" },
  { to: "/workspace/cronograma", label: "Calendário" },
] as const;

/** Ações secundárias: continuam acessíveis, sem disputar a navegação principal. */
const SECONDARY = [
  { to: "/workspace/demandas", label: "Demandas" },
  { to: "/workspace/avaliacoes", label: "Avaliações" },
  { to: "/workspace/meu-acesso", label: "Meu acesso" },
] as const;

/**
 * Shell nativo do Workspace (React/TanStack): mesma sessão, mesmo design system
 * e mesmos dados do Reach Echo. Equipe e configurações globais ficam no Echo.
 */
function WorkspaceLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoadError("");
    (async () => {
      try {
        const { data } = await withTimeout(
          supabase.auth.getSession(),
          8000,
          "A verificação da sessão demorou demais. Abra o login e tente novamente.",
        );
        if (!active) return;
        if (!data.session) {
          navigate({ to: "/auth" });
          return;
        }
        const access = await withTimeout(
          getFullAccess(),
          12000,
          "A verificação do seu acesso demorou demais. Tente novamente.",
        );
        if (!active) return;
        if (!access.isAgency) {
          setLoadError("O Workspace é interno da agência. Sua conta não tem acesso a esta área.");
          return;
        }
        if (access.permissions.includes(WORKSPACE_DENY_PERMISSION)) {
          setLoadError("O acesso ao Workspace foi desativado para este colaborador nas permissões da equipe.");
          return;
        }
        setReady(true);
      } catch (error) {
        if (active) setLoadError(`Não foi possível abrir o Workspace: ${(error as Error).message}`);
      }
    })();
    return () => {
      active = false;
    };
  }, [navigate, retry]);

  if (loadError)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="max-w-xl text-sm">{loadError}</p>
        <Btn variant="outline" onClick={() => setRetry((value) => value + 1)}>
          <RefreshCw className="h-4 w-4" /> Tentar novamente
        </Btn>
        <Link to="/" className="text-sm underline">
          Voltar ao Reach Echo
        </Link>
      </div>
    );

  if (!ready)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <ReachIconAnimation size={48} context="boot" />
        <p className="text-sm text-muted-foreground">Carregando Workspace…</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-2 sm:px-6 sm:py-3">
          <Link to="/" className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold tracking-tight">
            <Rocket className="h-4 w-4 text-primary" aria-hidden />
            Reach Echo <span className="text-muted-foreground">· Workspace</span>
          </Link>
          <nav aria-label="Workspace" className="scrollbar-none -mx-4 flex items-center gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-1 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
            {PRIMARY.map((item) => {
              const active = "exact" in item ? pathname === item.to : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full px-4 text-[13px] font-medium transition-colors sm:min-h-0 sm:px-3 sm:py-1.5 sm:text-[12.5px]",
                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
            {/* No celular as ações secundárias entram na mesma faixa, sem segunda linha. */}
            <span className="mx-1 h-5 w-px shrink-0 bg-border sm:hidden" aria-hidden />
            {SECONDARY.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full px-4 text-[13px] transition-colors sm:hidden",
                  pathname.startsWith(item.to) ? "bg-muted text-foreground" : "text-muted-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="hidden items-center gap-1 sm:flex">
            {SECONDARY.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "rounded-full px-2.5 py-1.5 text-[12px] transition-colors",
                  pathname.startsWith(item.to)
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
