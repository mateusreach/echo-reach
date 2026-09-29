import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { ReachBackground } from "@/components/reach/background";
import { ReachMark } from "@/components/reach/ui";
import { ReachIconAnimation } from "@/components/reach/reach-icon-animation";
import { supabase } from "@/integrations/supabase/client";
import { useAppSettings, applyTheme, getStoredTheme } from "@/lib/branding";
import { getAccess } from "@/lib/agency-data";
import { withTimeout } from "@/lib/with-timeout";
import { myBrands } from "@/lib/reach-data";
import { cn } from "@/lib/utils";

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
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    applyTheme(getStoredTheme());
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await withTimeout(supabase.auth.getSession(), 8000, "A verificação da sessão demorou demais.");
      if (!alive) return;
      if (!data.session) {
        navigate({ to: "/auth" });
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

  if (accessError) {
    return <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="max-w-lg text-sm text-destructive">Não foi possível abrir a agência: {accessError}</p>
      <button type="button" onClick={() => window.location.reload()} className="text-sm underline">Tentar novamente</button>
      <Link to="/auth" className="text-sm underline">Ir para o login</Link>
    </div>;
  }

  if (checking) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <ReachIconAnimation size={48} context="boot" />
        <p className="text-sm text-muted-foreground">Carregando área da Reach…</p>
      </div>
    );
  }

  const agencyName = (settings as any)?.agency_name || "Reach";

  return (
    <div className="relative min-h-screen">
      <ReachBackground />
      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
        <header className="glass mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-3xl px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            {(settings as any)?.logo_url ? (
              <img src={(settings as any).logo_url} alt={agencyName} className="h-8 w-auto max-w-[120px] shrink-0 object-contain" />
            ) : (
              <ReachMark className="h-9 w-9 shrink-0 text-base" />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">Área da {agencyName}</p>
              <p className="truncate text-[11.5px] text-muted-foreground">Centro de comando operacional</p>
            </div>
          </div>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border text-muted-foreground md:hidden"
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </header>

        <nav className={cn("mb-6 gap-1.5 overflow-x-auto pb-1", menuOpen ? "grid" : "hidden md:flex")}>
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: (item as any).exact ?? false }}
              onClick={() => setMenuOpen(false)}
              className="shrink-0 rounded-full px-4 py-2 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-[status=active]:bg-primary data-[status=active]:text-primary-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <Outlet />

        <p className="mt-10 text-center text-xs text-muted-foreground">
          <span className="text-gradient-brand font-semibold">Parte do ecossistema Reach</span> · plataforma parceira Reach Workspace
        </p>
      </div>
    </div>
  );
}
