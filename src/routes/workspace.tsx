import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { goToLogin } from "@/lib/login-redirect";
import { useEffect, useState } from "react";
import { EchoBlocked, EchoLayout, EchoLoading, EchoSubnav } from "@/components/echo/layout";
import { supabase } from "@/integrations/supabase/client";
import { getFullAccess, WORKSPACE_DENY_PERMISSION } from "@/lib/agency-data";
import { withTimeout } from "@/lib/with-timeout";
import { isDemoMode } from "@/lib/home-data";

/** Telas do Workspace que já funcionam no modo demonstração. */
const DEMO_READY = ["/workspace", "/workspace/controle", "/workspace/equipe", "/workspace/configuracoes"];

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
] as const;

/**
 * Shell nativo do Workspace (React/TanStack): mesma sessão, mesmo design system
 * e mesmos dados do Reach Echo. Equipe e configurações globais ficam no Echo.
 */
function WorkspaceLayout() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [demo, setDemo] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    let active = true;
    setLoadError("");
    if (isDemoMode()) { setDemo(true); setReady(true); return; }
    (async () => {
      try {
        const { data } = await withTimeout(
          supabase.auth.getSession(),
          8000,
          "A verificação da sessão demorou demais. Abra o login e tente novamente.",
        );
        if (!active) return;
        if (!data.session) {
          goToLogin(navigate as never);
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

  if (loadError) return <EchoBlocked title="Não foi possível abrir o Workspace" text={loadError} onRetry={() => setRetry((value) => value + 1)} />;

  if (!ready) return <EchoLoading label="Carregando Workspace…" />;
  if (demo && !DEMO_READY.includes(path.replace(/\/$/, ""))) return <EchoBlocked title="Banco não conectado" text="Esta tela do Workspace ainda depende do Supabase. No modo demonstração, abra Equipe ou Configurações." />;

  return (
    <EchoLayout
      env="workspace"
      wide
      demoData={demo}
      nav={<EchoSubnav label="Workspace" items={PRIMARY.map((i) => ({ ...i }))} secondary={SECONDARY.map((i) => ({ ...i }))} />}
    >
      <Outlet />
    </EchoLayout>
  );
}
