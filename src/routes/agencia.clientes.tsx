import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Building2, Eye, Plus, Search, Settings2, Workflow } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { listBrands, brandModules, type Brand } from "@/lib/reach-data";
import { isLate, listWorkItems, type WorkItem } from "@/lib/agency-data";
import { startViewAsClient } from "@/lib/view-as";
import { restoreFinaFragrancia } from "@/lib/fina-restore.functions";
import { supabase } from "@/integrations/supabase/client";

type ApprovedFront = { brand_id: string; name: string; approved_until: string | null };

export const Route = createFileRoute("/agencia/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes da Reach — Reach Brand OS" },
      { name: "description", content: "Gestão de clientes da Reach: acessos, responsáveis, campanhas e marcos." },
      { property: "og:title", content: "Clientes da Reach" },
      { property: "og:description", content: "Panorama de cada cliente com campanhas e demandas em aberto." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClientesPage,
});

function ClientesPage() {
  const navigate = useNavigate();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [items, setItems] = useState<WorkItem[]>([]);
  const [approvedFronts, setApprovedFronts] = useState<ApprovedFront[]>([]);
  const [query, setQuery] = useState("");
  const [restoringFina, setRestoringFina] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([listBrands(), listWorkItems()])
      .then(([b, w]) => {
        if (!alive) return;
        setBrands(b);
        setItems(w);
        if (b.length) {
          void supabase.from("workspace_fronts").select("brand_id, name, approved_until").in("brand_id", b.map((brand) => brand.id))
            .then(({ data, error }) => { if (alive && !error) setApprovedFronts(data ?? []); });
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter((b) => `${b.name} ${b.segment ?? ""}`.toLowerCase().includes(q));
  }, [brands, query]);

  async function restoreFina() {
    setRestoringFina(true);
    setRestoreError(null);
    try {
      const result = await restoreFinaFragrancia();
      const refreshed = await listBrands();
      setBrands(refreshed);
      navigate({ to: "/b/$brandSlug", params: { brandSlug: result.slug } });
    } catch (error) {
      setRestoreError(error instanceof Error ? error.message : "Não foi possível restaurar a Fina Fragrância.");
    } finally {
      setRestoringFina(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight">Clientes</h1>
          <p className="truncate text-sm text-muted-foreground">Panorama operacional de cada marca atendida.</p>
        </div>
        <Link to="/agencia/configuracoes" search={{ tab: "marcas", novo: "1" } as any} className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs text-foreground hover:bg-muted">
          <Plus className="h-3.5 w-3.5" /> Novo cliente
        </Link>
      </header>

      <label className="surface flex items-center gap-2 rounded-full px-4 py-2">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar cliente…" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
      </label>

      {!brands.some((brand) => brand.slug === "fina-fragrancia") && (
        <section className="surface flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5">
          <div>
            <p className="text-sm font-semibold">Restaurar Fina Fragrância</p>
            <p className="mt-1 text-xs text-muted-foreground">Recupera o Plano e o Espaço 360 históricos nesta agência, sem apagar dados existentes.</p>
            {restoreError && <p className="mt-2 text-xs text-destructive">{restoreError}</p>}
          </div>
          <button
            type="button"
            onClick={restoreFina}
            disabled={restoringFina}
            className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60"
          >
            {restoringFina ? "Restaurando…" : "Restaurar Fina"}
          </button>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((b) => {
          const own = items.filter((i) => i.brandId === b.id);
          const abertos = own.filter((i) => !["concluida", "concluido", "cancelada", "entregue"].includes(i.status)).length;
          const atrasados = own.filter(isLate).length;
          const campanhas = own.filter((i) => i.kind === "campanha").length;
          const fronts = approvedFronts.filter((front) => front.brand_id === b.id && front.approved_until);
          return (
            <div key={b.id} className="surface flex flex-col gap-3 rounded-2xl p-5">
              <Link to="/b/$brandSlug" params={{ brandSlug: b.slug }} className="group flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl gradient-brand text-primary-foreground">
                  {b.logo_url ? <img src={b.logo_url} alt={b.name} className="h-full w-full object-cover" /> : <Building2 className="h-5 w-5" />}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{b.name}</p>
                  {b.segment && <p className="truncate text-xs text-muted-foreground">{b.segment}</p>}
                </div>
                <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>

              <div className="flex flex-wrap gap-1.5 text-[10.5px]">
                {brandModules(b).workspace && <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-primary"><Workflow className="h-3 w-3" /> Workspace ativo</span>}
                <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">{campanhas} campanha(s)</span>
                <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">{abertos} em aberto</span>
                {atrasados > 0 && <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-destructive">{atrasados} atrasado(s)</span>}
              </div>

              {fronts.length > 0 && <div className="flex flex-wrap gap-1.5 text-[10.5px]" aria-label="Últimos conteúdos aprovados">
                {fronts.map((front) => <span key={`${front.brand_id}-${front.name}`} className="rounded-md border border-border px-2.5 py-1 text-muted-foreground">{front.name}: aprovado até {front.approved_until!.split("-").reverse().join("/")}</span>)}
              </div>}

              <div className="mt-auto flex flex-wrap items-center gap-2 text-[11.5px]">
                {brandModules(b).workspace && <Link to="/workspace/cliente/$brandSlug" params={{ brandSlug: b.slug }} className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-muted-foreground hover:text-foreground"><Workflow className="h-3 w-3" /> Abrir no Work</Link>}
                {brandModules(b).espaco360 && (
                  <Link to="/e360/$brandSlug" params={{ brandSlug: b.slug }} search={{ tab: undefined, filtro: undefined }} className="rounded-full border border-border px-2.5 py-1 text-muted-foreground hover:text-foreground">
                    Espaço 360
                  </Link>
                )}
                <Link to="/b/$brandSlug/configuracoes" params={{ brandSlug: b.slug }} search={{ tab: undefined }} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-muted-foreground hover:text-foreground">
                  <Settings2 className="h-3 w-3" /> Acessos
                </Link>
                <button
                  onClick={() => {
                    startViewAsClient(b.name);
                    navigate({ to: "/b/$brandSlug", params: { brandSlug: b.slug } });
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Eye className="h-3.5 w-3.5" /> Ver como cliente
                </button>
              </div>
            </div>
          );
        })}
        {visible.length === 0 && <p className="text-sm text-muted-foreground">Nenhum cliente encontrado.</p>}
      </div>
    </div>
  );
}
