import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/reach/app-shell";
import { Chip, PageHeader, Panel } from "@/components/reach/ui";
import { competitors, marketOpportunity } from "@/lib/brand-data";

export const Route = createFileRoute("/mercado")({
  head: () => ({
    meta: [
      { title: "Mercado — Fina Fragrância | Reach Brand OS" },
      {
        name: "description",
        content: "Concorrência da Fina Fragrância: forças, fraquezas e a oportunidade estratégica de 2026.",
      },
      { property: "og:title", content: "Mercado — Fina Fragrância" },
      { property: "og:description", content: "Análise competitiva e território de posicionamento da marca." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Mercado,
});

function Mercado() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Competição"
        title="Mercado"
        description="Onde a Fina Fragrância joga e como se diferencia na perfumaria artesanal."
      />
      <div className="grid gap-5 md:grid-cols-2">
        {competitors.map((c) => (
          <Panel key={c.name}>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <h3 className="min-w-0 text-base font-medium">{c.name}</h3>
              <Chip>{c.tag}</Chip>
            </div>
            <p className="mt-4 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Forças</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {c.strengths.map((s) => (
                <Chip key={s} tone="success">
                  {s}
                </Chip>
              ))}
            </div>
            <p className="mt-4 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Fraquezas / diferencial
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {c.weaknesses.map((w) => (
                <Chip key={w} tone="warning">
                  {w}
                </Chip>
              ))}
            </div>
          </Panel>
        ))}
      </div>
      <Panel title="Oportunidade estratégica">
        <p className="text-sm leading-relaxed">{marketOpportunity}</p>
      </Panel>
    </AppShell>
  );
}
