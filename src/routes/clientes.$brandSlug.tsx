import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Brain, Rocket, Settings2, Sparkles } from "lucide-react";
import { EmptyState, RiskBadge } from "@/components/reach/workspace-ui";
import { Btn } from "@/components/ui-reach/primitives";
import { setClientContext } from "@/lib/ecosystem";
import {
  brandModules,
  getBrandBySlug,
  listCampaigns,
  listChannels,
  listIdeias,
  listSolicitacoes,
} from "@/lib/reach-data";
import { frontPeriod, frontRisk, listFronts, listTasks, RECURRENCES, toISO, today } from "@/lib/workspace-data";
import { listWorkOrders, workOrderProgress } from "@/lib/work-orders";

const approvedDate = (date: string | null) => date ? date.split("-").reverse().join("/") : "—";

export const Route = createFileRoute("/clientes/$brandSlug")({
  head: () => ({
    meta: [
      { title: "Cliente — Reach Echo" },
      { name: "description", content: "Visão única do cliente no Reach Echo: biblioteca no Brand, plano no Espaço 360 e execução no Workspace." },
      { property: "og:title", content: "Cliente — Reach Echo" },
      { property: "og:description", content: "Plano, Biblioteca, Espaço 360, cobertura e entregas do cliente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClientDetail,
});

/** Ficha única do cliente, compartilhada entre os ambientes do Echo. */
function ClientDetail() {
  const { brandSlug } = useParams({ from: "/clientes/$brandSlug" });
  useEffect(() => {
    setClientContext(brandSlug);
  }, [brandSlug]);

  const brand = useQuery({ queryKey: ["brand", brandSlug], queryFn: () => getBrandBySlug(brandSlug) });
  const id = brand.data?.id;
  const on = { enabled: !!id };

  const campaigns = useQuery({ queryKey: ["campaigns", id], queryFn: () => listCampaigns(id!), ...on });
  const requests = useQuery({ queryKey: ["solicitacoes", id], queryFn: () => listSolicitacoes(id!), ...on });
  const ideias = useQuery({ queryKey: ["ideias", id], queryFn: () => listIdeias(id!), ...on });
  const channels = useQuery({ queryKey: ["brand-channels", id], queryFn: () => listChannels(id!), ...on });
  const fronts = useQuery({ queryKey: ["ws-fronts", id], queryFn: () => listFronts(id!), ...on });
  const tasks = useQuery({ queryKey: ["ws-tasks", id], queryFn: () => listTasks({ brandId: id! }), ...on });
  const orders = useQuery({ queryKey: ["ws-orders", id], queryFn: () => listWorkOrders({ brandId: id! }), ...on });

  if (brand.isLoading) return <p className="p-6 text-sm text-muted-foreground">Carregando cliente…</p>;
  if (!brand.data) return <EmptyState title="Cliente não encontrado." />;

  const mods = brandModules(brand.data);
  const open = (tasks.data ?? []).filter((t) => t.status !== "Concluído");
  const late = open.filter((t) => t.due_date && t.due_date < toISO(today()));
  const nextDue = open.map((t) => t.due_date).filter(Boolean).sort()[0];
  const openRequests = (requests.data ?? []).filter((r) => r.status !== "concluida");

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <Link to="/clientes" className="text-sm font-semibold tracking-tight">
            Reach Echo <span className="text-muted-foreground">· Clientes</span>
          </Link>
          <span className="truncate text-sm text-muted-foreground">/ {brand.data.name}</span>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/b/$brandSlug" params={{ brandSlug }}>
              <Btn variant="outline" size="sm">
                <Brain className="h-3.5 w-3.5" aria-hidden /> Abrir Brand
              </Btn>
            </Link>
            {mods.workspace && (
              <Link to="/workspace/cliente/$brandSlug" params={{ brandSlug }}>
                <Btn variant="primary" size="sm">
                  <Rocket className="h-3.5 w-3.5" aria-hidden /> Abrir operação
                </Btn>
              </Link>
            )}
            {mods.espaco360 && (
              <Link to="/e360/$brandSlug" params={{ brandSlug }} search={{ tab: undefined, filtro: undefined } as never}>
                <Btn variant="outline" size="sm">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden /> Espaço 360
                </Btn>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 sm:px-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{brand.data.name}</h1>
          <p className="text-sm text-muted-foreground">
            {[brand.data.segment, brand.data.contract_type].filter(Boolean).join(" · ") || "Cliente do Reach Echo"}
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="surface space-y-3 rounded-2xl p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <Brain className="h-4 w-4" aria-hidden /> Brand
            </h2>
            <ul className="space-y-2 text-sm">
              <Row label="Biblioteca" value={mods.biblioteca ? `${ideias.data?.length ?? 0} ideia(s)` : "Não ativada"} />
            </ul>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link to="/b/$brandSlug/biblioteca" params={{ brandSlug }} search={{} as never}>
                <Btn variant="ghost" size="sm">Abrir biblioteca</Btn>
              </Link>
            </div>
          </section>

          <section className="surface space-y-3 rounded-2xl p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <Rocket className="h-4 w-4" aria-hidden /> Operação
            </h2>
            <ul className="space-y-2 text-sm">
              <Row label="Frentes" value={`${fronts.data?.length ?? 0}`} />
              <Row label="Entregas em aberto" value={`${(orders.data ?? []).filter((o) => o.status !== "Concluída").length}`} />
              <Row label="Tarefas abertas" value={`${open.length}`} />
              <Row label="Atrasadas" value={`${late.length}`} />
              <Row label="Próximo prazo" value={nextDue ?? "—"} />
            </ul>
            {(fronts.data ?? []).length > 0 && (
              <ul className="space-y-2 pt-1">
                {(fronts.data ?? []).map((f) => {
                  const { level } = frontRisk(f);
                  const p = frontPeriod(f);
                  const order = (orders.data ?? []).find(
                    (o) => o.front_id === f.id && o.period_start === p.start && o.period_end === p.end,
                  );
                  const progress = order
                    ? workOrderProgress((tasks.data ?? []).filter((t) => t.work_order_id === order.id))
                    : null;
                  return (
                    <li
                      key={f.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border/70 bg-card px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium">{f.name}</p>
                        <p className="truncate text-[12px] text-muted-foreground">
                          {RECURRENCES[f.recurrence as keyof typeof RECURRENCES]} · aprovado até {approvedDate(f.approved_until)}
                          {progress ? ` · entrega ${progress.done}/${progress.total}` : " · sem entrega criada"}
                        </p>
                      </div>
                      <RiskBadge level={level} />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {mods.espaco360 && (
          <section className="surface space-y-3 rounded-2xl p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <Sparkles className="h-4 w-4" aria-hidden /> Espaço 360
            </h2>
            <ul className="grid gap-2 text-sm sm:grid-cols-3">
              <Row label="Plano" value="Ativo" />
              <Row label="Campanhas" value={`${campaigns.data?.length ?? 0} registrada(s)`} />
              <Row label="Solicitações abertas" value={`${openRequests.length}`} />
              <Row label="Canais" value={`${channels.data?.length ?? 0}`} />
            </ul>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link to="/e360/$brandSlug/plano" params={{ brandSlug }} search={{ tab: undefined } as never}>
                <Btn variant="ghost" size="sm">Abrir plano</Btn>
              </Link>
              <Link to="/e360/$brandSlug" params={{ brandSlug }} search={{ tab: undefined, filtro: undefined } as never}>
                <Btn variant="ghost" size="sm">Abrir espaço</Btn>
              </Link>
            </div>
          </section>
        )}

        <section className="surface rounded-2xl p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <Settings2 className="h-4 w-4" aria-hidden /> Acessos e configurações
          </h2>
          <div className="flex flex-wrap gap-2">
            <Link to="/b/$brandSlug/configuracoes" params={{ brandSlug }} search={{ tab: undefined } as never}>
              <Btn variant="outline" size="sm">Configurações do cliente</Btn>
            </Link>
            <Link to="/agencia/equipe">
              <Btn variant="ghost" size="sm">Equipe Reach</Btn>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
      <span className="truncate text-muted-foreground">{label}</span>
      <span className="shrink-0 font-medium">{value}</span>
    </li>
  );
}
