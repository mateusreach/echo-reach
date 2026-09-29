import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, CheckCircle2, Inbox, Megaphone } from "lucide-react";
import { listBrands, type Brand } from "@/lib/reach-data";
import {
  addDaysISO,
  isLate,
  listAgencyEvents,
  listAgencyPosts,
  listWorkItems,
  todayISO,
  type AgencyEvent,
  type AgencyPost,
  type WorkItem,
} from "@/lib/agency-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/agencia/")({
  head: () => ({
    meta: [
      { title: "Home da Agência — Reach Brand OS" },
      { name: "description", content: "Visão operacional da Reach: campanhas, tarefas, solicitações e marcos do mês." },
      { property: "og:title", content: "Home da Agência — Reach Brand OS" },
      { property: "og:description", content: "Centro de comando operacional da Reach." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AgencyHome,
});

function AgencyHome() {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [events, setEvents] = useState<AgencyEvent[]>([]);
  const [posts, setPosts] = useState<AgencyPost[]>([]);

  useEffect(() => {
    let alive = true;
    Promise.all([listWorkItems(), listBrands(), listAgencyEvents(), listAgencyPosts()])
      .then(([w, b, e, p]) => {
        if (!alive) return;
        setItems(w);
        setBrands(b);
        setEvents(e);
        setPosts(p);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const brandName = useMemo(() => new Map(brands.map((b) => [b.id, b.name])), [brands]);
  const late = items.filter(isLate);
  const soon = items.filter((i) => i.dueDate && i.dueDate >= todayISO() && i.dueDate <= addDaysISO(7) && !isLate(i));
  const requests = items.filter((i) => i.kind === "solicitacao" && !["concluida", "cancelada"].includes(i.status));
  const campaigns = items.filter((i) => i.kind === "campanha");
  const upcoming = events.filter((e) => e.event_date >= todayISO()).slice(0, 6);

  const kpis = [
    { label: "Clientes ativos", value: brands.length, icon: CheckCircle2 },
    { label: "Campanhas", value: campaigns.length, icon: Megaphone },
    { label: "Solicitações abertas", value: requests.length, icon: Inbox },
    { label: "Itens atrasados", value: late.length, icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Home da Agência</h1>
        <p className="text-sm text-muted-foreground">O que está acontecendo hoje na operação da Reach.</p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="surface rounded-2xl p-4">
            <k.icon className="h-4 w-4 text-muted-foreground" />
            <p className="mt-2 text-2xl font-semibold tabular-nums">{k.value}</p>
            <p className="text-xs text-muted-foreground">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <WorkList title="Atrasados" items={late} brandName={brandName} tone="danger" />
        <WorkList title="Próximos 7 dias" items={soon} brandName={brandName} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="surface space-y-3 rounded-2xl p-5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <h2 className="truncate text-sm font-semibold">Próximos marcos</h2>
            <Link to="/agencia/calendario" className="shrink-0 text-xs text-brand">Calendário</Link>
          </div>
          {upcoming.length === 0 && <p className="text-sm text-muted-foreground">Nenhum marco agendado.</p>}
          {upcoming.map((e) => (
            <div key={e.id} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-border px-3 py-2">
              <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="truncate text-sm">{e.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {formatDate(e.event_date)}
                  {e.brand_id ? ` · ${brandName.get(e.brand_id) ?? "Cliente"}` : " · Reach"}
                </p>
              </div>
            </div>
          ))}
        </section>

        <section className="surface space-y-3 rounded-2xl p-5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <h2 className="truncate text-sm font-semibold">Comunicação interna</h2>
            <Link to="/agencia/comunicacao" className="shrink-0 text-xs text-brand">Ver mural</Link>
          </div>
          {posts.length === 0 && <p className="text-sm text-muted-foreground">Nenhum comunicado publicado.</p>}
          {posts.slice(0, 5).map((p) => (
            <div key={p.id} className="rounded-2xl border border-border px-3 py-2">
              <p className="truncate text-sm font-medium">{p.title}</p>
              {p.content && <p className="line-clamp-2 text-xs text-muted-foreground">{p.content}</p>}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

function WorkList({
  title,
  items,
  brandName,
  tone,
}: {
  title: string;
  items: WorkItem[];
  brandName: Map<string, string>;
  tone?: "danger";
}) {
  return (
    <section className="surface space-y-3 rounded-2xl p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      {items.length === 0 && <p className="text-sm text-muted-foreground">Nada por aqui.</p>}
      {items.slice(0, 8).map((i) => (
        <div key={`${i.kind}-${i.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm">{i.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {i.kind} · {i.brandId ? brandName.get(i.brandId) ?? "Cliente" : "Reach"}
              {i.responsible ? ` · ${i.responsible}` : ""}
            </p>
          </div>
          {i.dueDate && (
            <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[10.5px]", tone === "danger" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")}>
              {formatDate(i.dueDate)}
            </span>
          )}
        </div>
      ))}
    </section>
  );
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}
