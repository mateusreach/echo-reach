import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { goToLogin } from "@/lib/login-redirect";
import { useEffect, useState } from "react";
import { ArrowLeft, Target } from "lucide-react";
import { ReachBackground } from "@/components/reach/background";
import { ReachMark } from "@/components/reach/ui";
import { getAccess } from "@/lib/agency-data";
import { brandModules, listBrands, myBrands, type Brand } from "@/lib/reach-data";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/e360/")({ component: SpaceIndex });

function SpaceIndex() {
  const navigate = useNavigate();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { goToLogin(navigate as never); return; }
      const access = await getAccess();
      const list = access.isAgency ? await listBrands() : await myBrands();
      if (active) setBrands(list.filter((brand) => brandModules(brand).espaco360));
    })().catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Não foi possível carregar os espaços."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [navigate]);
  return <div className="relative min-h-screen"><ReachBackground /><main className="relative z-10 mx-auto max-w-5xl px-4 py-8 sm:px-8">
    <header className="flex items-center gap-3"><ReachMark className="h-10 w-10" /><div><h1 className="text-2xl font-semibold">Espaço 360</h1><p className="text-sm text-muted-foreground">Planos, estratégias e execução por cliente.</p></div></header>
    <Link to="/" className="mt-5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Home do Echo</Link>
    {loading && <p className="mt-8 text-sm text-muted-foreground">Carregando espaços…</p>}
    {error && <p role="alert" className="mt-8 text-sm text-destructive">{error}</p>}
    {!loading && !error && <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {brands.map((brand) => <Link key={brand.id} to="/e360/$brandSlug" params={{ brandSlug: brand.slug }} search={{ tab: undefined, filtro: undefined }} className="surface group rounded-3xl p-5 transition-shadow hover:shadow-glow">
        <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-2xl bg-primary/10 text-primary">{brand.logo_url ? <img src={brand.logo_url} alt="" className="h-full w-full object-cover" /> : <Target className="h-5 w-5" />}</span>
        <h2 className="mt-3 text-base font-semibold">{brand.name}</h2><p className="mt-1 text-xs text-muted-foreground">Abrir plano e execução</p>
      </Link>)}
      {brands.length === 0 && <p className="text-sm text-muted-foreground">Nenhum Espaço 360 habilitado para sua conta.</p>}
    </div>}
  </main></div>;
}
