import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { EchoLayout } from "@/components/echo/layout";
import { Badge, Button, ClientLogo, EmptyState, ProgressRing, Skeleton } from "@/components/echo/primitives";
import { Icon } from "@/components/echo/icon";
import { stagger } from "@/components/echo/motion";
import { listSpaces } from "@/lib/space-data";

export const Route = createFileRoute("/e360/")({
  head: () => ({ meta: [{ title: "Espaço 360 · Echo" }, { name: "description", content: "Planos, campanhas e execução com cada cliente." }] }),
  component: SpaceIndex,
});

function SpaceIndex() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const grid = useRef<HTMLDivElement>(null);
  useEffect(() => setReady(true), []);
  const q = useQuery({ queryKey: ["spaces"], queryFn: listSpaces, enabled: ready });
  // Cliente com um único espaço entra direto nele.
  useEffect(() => { if (q.data?.single) navigate({ to: "/e360/$brandSlug", params: { brandSlug: q.data.single }, search: { tab: undefined, filtro: undefined }, replace: true }); }, [q.data?.single]);
  useEffect(() => { if (grid.current && q.data) stagger(grid.current.querySelectorAll(".space-card"), { y: 10, dur: 420 }, 40); }, [!!q.data]);
  return (
    <EchoLayout env="e360" wide demoData eyebrow="Espaço 360" title="Espaços dos clientes">
      {!ready || q.isLoading ? <div className="space-grid">{[0, 1, 2].map((i) => <Skeleton key={i} h={190} r={24} />)}</div>
        : q.isError ? <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState kind="error" title="Não foi possível carregar os espaços" actions={<Button variant="secondary" icon="refresh" onClick={() => q.refetch()}>Tentar novamente</Button>} /></div>
        : (q.data?.spaces ?? []).length === 0 ? <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState icon="orbit" title="Nenhum Espaço 360 disponível" text="O Espaço 360 é ligado por cliente, no hub de Clientes." actions={<Link to="/clientes" className="e-btn secondary">Abrir clientes</Link>} /></div>
        : (
          <div className="space-grid" ref={grid}>
            {q.data!.spaces.map((s) => (
              <Link key={s.slug} to="/e360/$brandSlug" params={{ brandSlug: s.slug }} search={{ tab: undefined, filtro: undefined }} className="space-card e-glass">
                <div className="e-row between" style={{ gap: 10 }}>
                  <ClientLogo name={s.name} logoUrl={s.logoUrl} size="lg" />
                  <ProgressRing value={s.progress} size={56} label="Plano" />
                </div>
                <b className="space-name">{s.name}</b>
                <div className="e-row wrap" style={{ gap: 6 }}>
                  <Badge tone="glass" icon="megaphone">{s.campaigns} {s.campaigns === 1 ? "campanha" : "campanhas"} em andamento</Badge>
                  {s.pending > 0 && <Badge tone="review" icon="user">{s.pending} com o cliente</Badge>}
                </div>
                <span className="space-open">Abrir espaço <Icon name="arrowRight" size="sm" /></span>
              </Link>
            ))}
          </div>
        )}
    </EchoLayout>
  );
}
