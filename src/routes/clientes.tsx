import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EchoBlocked, EchoLayout, EchoLoading } from "@/components/echo/layout";
import { getAccess } from "@/lib/agency-data";
import { myBrands, brandModules } from "@/lib/reach-data";
import { isDemoMode } from "@/lib/home-data";
import { goToLogin } from "@/lib/login-redirect";
import { withTimeout } from "@/lib/with-timeout";

export const Route = createFileRoute("/clientes")({ component: ClientsLayout });

/** Carteira e hub do cliente: área da equipe. Um cliente é levado ao próprio espaço. */
function ClientsLayout() {
  const navigate = useNavigate();
  const [state, setState] = useState<"checking" | "ok" | { error: string }>("checking");

  useEffect(() => {
    let alive = true;
    if (isDemoMode()) { setState("ok"); return; }
    (async () => {
      const { data } = await withTimeout(supabase.auth.getSession(), 8000, "A verificação da sessão demorou demais.");
      if (!alive) return;
      if (!data.session) { goToLogin(navigate as never); return; }
      const access = await withTimeout(getAccess(), 12000, "A verificação do acesso demorou demais.");
      if (!alive) return;
      if (!access.isAgency) {
        const brands = await myBrands().catch(() => []);
        const first = brands.find((b) => brandModules(b).espaco360) ?? brands[0];
        navigate({ to: (first ? `/e360/${first.slug}` : "/") as never });
        return;
      }
      setState("ok");
    })().catch((e) => { if (alive) setState({ error: e instanceof Error ? e.message : "Não foi possível verificar o acesso." }); });
    return () => { alive = false; };
  }, [navigate]);

  if (typeof state === "object") return <EchoBlocked title="Não foi possível abrir os clientes" text={state.error} onRetry={() => window.location.reload()} />;
  if (state === "checking") return <EchoLoading label="Carregando clientes…" />;
  return (
    <EchoLayout wide demoData>
      <Outlet />
    </EchoLayout>
  );
}
