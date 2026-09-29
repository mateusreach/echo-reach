import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, ArrowUpRight, BookOpen, Building2, Rocket, Settings, Users } from "lucide-react";
import { ReachIconAnimation } from "@/components/reach/reach-icon-animation";
import { ReachMark } from "@/components/reach/ui";
import { supabase } from "@/integrations/supabase/client";
import { getAccess } from "@/lib/agency-data";
import { brandModules, myBrands } from "@/lib/reach-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Reach Echo" },
      { name: "description", content: "Branding Space, Espaço 360 e Workspace em um só lugar." },
      { property: "og:title", content: "Reach Echo" },
      { property: "og:description", content: "O ecossistema de clientes e operação da Reach." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EchoHome,
});

function EchoHome() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        navigate({ to: "/auth" });
        return;
      }
      const access = await getAccess();
      if (cancelled) return;
      if (!access.isAgency) {
        const brands = await myBrands().catch(() => []);
        if (cancelled) return;
        const first = brands.find((brand) => brandModules(brand).espaco360) ?? brands[0];
        if (!first) navigate({ to: "/auth" });
        else if (brandModules(first).espaco360)
          navigate({ to: "/e360/$brandSlug", params: { brandSlug: first.slug }, search: { tab: undefined, filtro: undefined } });
        else navigate({ to: "/b/$brandSlug/biblioteca", params: { brandSlug: first.slug }, search: { tab: undefined } });
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, email")
        .eq("id", access.userId!)
        .maybeSingle();
      if (cancelled) return;
      setName(profile?.display_name || profile?.email || data.session.user.email || "");
      setChecking(false);
    })().catch(() => { if (!cancelled) navigate({ to: "/auth" }); });
    return () => { cancelled = true; };
  }, [navigate]);

  if (checking) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <ReachIconAnimation size={48} context="boot" />
      <p className="text-sm text-muted-foreground">Carregando Reach Echo…</p>
    </div>
  );

  const spaces = [
    { to: "/agencia/clientes", label: "Branding Space", description: "Biblioteca de conteúdo e referências de cada cliente.", icon: BookOpen, color: "bg-reach-blue-soft text-reach-blue" },
    { to: "/e360", label: "Espaço 360", description: "Plano, estratégias, tarefas e acompanhamento dos clientes habilitados.", icon: Activity, color: "bg-reach-coral-soft text-reach-coral" },
    { to: "/workspace", label: "Workspace", description: "Produção, entregas e controle de cobertura de conteúdo.", icon: Rocket, color: "bg-reach-violet-soft text-reach-violet" },
  ] as const;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-4 py-14 sm:px-6">
      <header className="flex items-center gap-3">
        <ReachMark className="h-11 w-11" />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Reach Echo</h1>
          <p className="truncate text-sm text-muted-foreground">{name ? `Conectado como ${name}` : "Ecossistema da Reach"}</p>
        </div>
      </header>

      <main className="mt-8 grid gap-4 md:grid-cols-3">
        {spaces.map((space) => {
          const Icon = space.icon;
          return (
            <Link key={space.to} to={space.to} className="surface group flex min-h-56 flex-col rounded-3xl p-6 transition-all hover:shadow-glow">
              <span className={`grid h-11 w-11 place-items-center rounded-2xl ${space.color}`}><Icon className="h-5 w-5" aria-hidden /></span>
              <h2 className="mt-5 flex items-center gap-2 text-lg font-semibold tracking-tight">{space.label}<ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden /></h2>
              <p className="mt-1 text-sm text-muted-foreground">{space.description}</p>
            </Link>
          );
        })}
      </main>

      <nav aria-label="Administração do ecossistema" className="mt-6 flex flex-wrap gap-2">
        <Link to="/agencia/clientes" className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-[12.5px] font-medium transition-colors hover:bg-muted"><Building2 className="h-4 w-4" aria-hidden /> Clientes</Link>
        <Link to="/agencia/equipe" className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-[12.5px] font-medium transition-colors hover:bg-muted"><Users className="h-4 w-4" aria-hidden /> Equipe</Link>
        <Link to="/agencia/configuracoes" className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-[12.5px] font-medium transition-colors hover:bg-muted"><Settings className="h-4 w-4" aria-hidden /> Configurações</Link>
      </nav>
    </div>
  );
}
