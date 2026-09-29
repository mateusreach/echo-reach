import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { goToLogin } from "@/lib/login-redirect";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppSettings } from "@/lib/branding";
import { EchoBlocked, EchoLayout, EchoLoading, EchoSubnav } from "@/components/echo/layout";
import { getAccess } from "@/lib/agency-data";
import { withTimeout } from "@/lib/with-timeout";
import { myBrands } from "@/lib/reach-data";

export const Route = createFileRoute("/agencia")({
  component: AgencyLayout,
});

const NAV = [
  { to: "/agencia", label: "Home", exact: true },
  { to: "/agencia/equipe", label: "Equipe" },
  { to: "/agencia/clientes", label: "Clientes" },

  { to: "/agencia/calendario", label: "Calendário" },
  { to: "/agencia/comunicacao", label: "Comunicação" },
  { to: "/agencia/modelos", label: "Modelos de Plano" },
  { to: "/agencia/configuracoes", label: "Configurações" },
] as const;

function AgencyLayout() {
  const navigate = useNavigate();
  const settings = useAppSettings();
  const [checking, setChecking] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);


  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await withTimeout(supabase.auth.getSession(), 8000, "A verificação da sessão demorou demais.");
      if (!alive) return;
      if (!data.session) {
        goToLogin(navigate as never);
        return;
      }
      // Guarda de rota: a área da agência é exclusiva de quem tem papel de
      // agência (admin/membro) — nunca liberada por esconder botões na UI.
      // Um cliente que tentar acessar /agencia diretamente é levado para o
      // ambiente do próprio cliente, sem depender de e-mail/ID hardcoded.
      const access = await withTimeout(getAccess(), 12000, "A verificação do acesso demorou demais.");
      if (!alive) return;
      if (!access.isAgency) {
        const brands = await myBrands().catch(() => []);
        navigate(brands[0] ? { to: "/b/$brandSlug", params: { brandSlug: brands[0].slug } } : { to: "/auth" });
        return;
      }
      setChecking(false);
    })().catch((error) => {
      if (alive) {
        setAccessError(error instanceof Error ? error.message : "Não foi possível verificar o acesso à agência.");
        setChecking(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [navigate]);

  if (accessError) return <EchoBlocked title="Não foi possível abrir a Agência" text={accessError} onRetry={() => window.location.reload()} />;

  if (checking) return <EchoLoading label="Carregando a área da Reach…" />;

  const agencyName = (settings as any)?.agency_name || "Reach";
  return (
    <EchoLayout
      eyebrow="Administração"
      title={`Agência ${agencyName}`}
      nav={<EchoSubnav label="Agência" items={NAV.map((i) => ({ ...i }))} />}
    >
      <Outlet />
    </EchoLayout>
  );
}
