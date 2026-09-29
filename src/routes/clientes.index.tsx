import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Brain, Building2, Plus, Rocket, Search, Sparkles } from "lucide-react";
import { ClientFormModal } from "@/components/reach/workspace-forms";
import { EmptyState, RiskBadge } from "@/components/reach/workspace-ui";
import { Btn } from "@/components/ui-reach/primitives";
import { brandModules, listBrands, type Brand } from "@/lib/reach-data";
import { listFrontsWithRisk, listTasks, toISO, today } from "@/lib/workspace-data";

const approvedDate = (date: string | null) => date ? date.split("-").reverse().join("/") : "—";

export const Route = createFileRoute("/clientes/")({
  head: () => ({
    meta: [
      { title: "Clientes — Reach Echo" },
      { name: "description", content: "Todos os clientes do Reach Echo: planejamento no Brand e execução no Workspace." },
      { property: "og:title", content: "Clientes — Reach Echo" },
      { property: "og:description", content: "Um único cadastro de cliente para todo o ecossistema Reach." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClientHub,
});

/**
 * CLIENT HUB — a única lista de clientes do Reach Echo.
 * Não existe "cliente do Brand" nem "cliente do Workspace": é o mesmo registro
 * em `brands`, visto por dois ângulos.
 */
function ClientHub() {
  const qc = useQueryClient();
  const brands = useQuery({ queryKey: ["brands-all"], queryFn: listBrands });
  const fronts = useQuery({ queryKey: ["ws-fronts-risk"], queryFn: listFrontsWithRisk });
  const tasks = useQuery({ queryKey: ["ws-tasks-all"], queryFn: () => listTasks() });
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<{ open: boolean; brand?: Brand | null }>({ open: false });

  const all = brands.data ?? [];
  const visible = all.filter((b) =>
    `${b.name} ${b.segment ?? ""}`.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR")),
  );
  const frontsOf = (id: string) => (fronts.data ?? []).filter((f) => f.brand.id === id);
  const openTasks = (id: string) => (tasks.data ?? []).filter((t) => t.brand_id === id && t.status !== "Concluído");
  const nextDue = (id: string) =>
    openTasks(id)
      .map((t) => t.due_date)
      .filter(Boolean)
      .sort()[0] as string | undefined;

  function refresh() {
    qc.invalidateQueries({ queryKey: ["brands-all"] });
    qc.invalidateQueries({ queryKey: ["ws-fronts-risk"] });
    qc.invalidateQueries({ queryKey: ["ws-tasks-all"] });
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link to="/" className="text-sm font-semibold tracking-tight">
            Reach Echo <span className="text-muted-foreground">· Clientes</span>
          </Link>
          <Btn variant="primary" size="sm" className="ml-auto" onClick={() => setForm({ open: true, brand: null })}>
            <Plus className="h-3.5 w-3.5" aria-hidden /> Novo cliente
          </Btn>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 sm:px-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Clientes do Reach Echo</h1>
          <p className="text-sm text-muted-foreground">
            Um cadastro só. O Brand planeja, o Workspace executa — sempre o mesmo cliente.
          </p>
        </div>

        <label className="surface flex items-center gap-2 rounded-full px-4 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar cliente…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            aria-label="Buscar cliente"
          />
        </label>

        {brands.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando clientes…</p>
        ) : visible.length === 0 ? (
          <EmptyState
            title={all.length === 0 ? "Nenhum cliente cadastrado ainda." : "Nenhum cliente encontrado."}
            description={
              all.length === 0
                ? "Cadastre o cliente uma única vez: ele passa a existir no Brand e no Workspace."
                : "Altere a busca para ver outros clientes."
            }
            action={
              all.length === 0 ? (
                <Btn variant="primary" onClick={() => setForm({ open: true, brand: null })}>
                  Cadastrar cliente
                </Btn>
              ) : undefined
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((b) => {
              const mods = brandModules(b);
              const list = frontsOf(b.id);
              const worst = list[0];
              const due = nextDue(b.id);
              const late = openTasks(b.id).filter((t) => t.due_date && t.due_date < toISO(today())).length;
              return (
                <article key={b.id} className="surface flex flex-col gap-3 rounded-2xl p-5">
                  <Link to="/clientes/$brandSlug" params={{ brandSlug: b.slug }} className="flex items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl gradient-brand text-primary-foreground">
                      {b.logo_url ? (
                        <img src={b.logo_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Building2 className="h-5 w-5" aria-hidden />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{b.name}</span>
                      {b.segment && <span className="block truncate text-xs text-muted-foreground">{b.segment}</span>}
                    </span>
                  </Link>

                  <div className="rounded-xl border border-border/70 bg-card px-3 py-2">
                    <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      <Brain className="h-3 w-3" aria-hidden /> Brand
                    </p>
                    <p className="mt-1 text-[12.5px] text-muted-foreground">
                      {mods.biblioteca ? "Biblioteca de conteúdo ativa" : "Biblioteca não ativada"}
                    </p>
                  </div>

                  {mods.espaco360 && (
                    <Link to="/e360/$brandSlug" params={{ brandSlug: b.slug }} search={{ tab: undefined, filtro: undefined } as never} className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 hover:border-primary/60">
                      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-primary">
                        <Sparkles className="h-3 w-3" aria-hidden /> Espaço 360
                      </p>
                      <p className="mt-1 text-[12.5px] text-muted-foreground">Plano, estratégias e solicitações</p>
                    </Link>
                  )}

                  <div className="rounded-xl border border-border/70 bg-card px-3 py-2">
                    <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      <Rocket className="h-3 w-3" aria-hidden /> Operação
                    </p>
                    <p className="mt-1 truncate text-[12.5px] text-muted-foreground">
                      {mods.workspace
                        ? `${list.length} frente(s) · ${openTasks(b.id).length} em aberto${due ? ` · próximo prazo ${due}` : ""}`
                        : "Workspace não ativado"}
                    </p>
                    {late > 0 && <p className="mt-1 text-[12px] text-destructive">{late} tarefa(s) atrasada(s)</p>}
                    {list.length > 0 && (
                      <ul className="mt-2 space-y-1 border-t border-border/70 pt-2 text-[12px]">
                        {list.map(({ front }) => (
                          <li key={front.id} className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-muted-foreground">{front.name}</span>
                            <span className="shrink-0 font-medium">aprovado até {approvedDate(front.approved_until)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="mt-auto flex flex-wrap items-center gap-2">
                    {worst && <RiskBadge level={worst.level} />}
                    <Link to="/b/$brandSlug" params={{ brandSlug: b.slug }} className="ml-auto">
                      <Btn variant="ghost" size="sm" aria-label={`Abrir ${b.name} no Brand`}>
                        <Brain className="h-3.5 w-3.5" aria-hidden /> Brand
                      </Btn>
                    </Link>
                    {mods.workspace && (
                      <Link to="/workspace/cliente/$brandSlug" params={{ brandSlug: b.slug }}>
                        <Btn variant="ghost" size="sm" aria-label={`Abrir operação de ${b.name}`}>
                          <Rocket className="h-3.5 w-3.5" aria-hidden /> Operação
                        </Btn>
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {form.open && <ClientFormModal brand={form.brand} onClose={() => setForm({ open: false })} onSaved={refresh} />}
    </div>
  );
}
