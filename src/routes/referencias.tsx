import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/reach/app-shell";
import { Chip, PageHeader, Panel } from "@/components/reach/ui";
import { competitors, marketOpportunity } from "@/lib/brand-data";

export const Route = createFileRoute("/referencias")({
  head: () => ({
    meta: [
      { title: "Referências — Fina Fragrância | Reach Brand OS" },
      {
        name: "description",
        content: "Cases e benchmarks do mercado de essências que orientam as decisões da Fina Fragrância.",
      },
      { property: "og:title", content: "Referências — Fina Fragrância" },
      { property: "og:description", content: "Benchmarks do setor de essências: forças, fraquezas e aprendizados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Referencias,
});

function Referencias() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Benchmarks"
        title="Referências"
        description="Quatro cases observados no mercado de essências e perfumaria artesanal."
      />
      <div className="grid gap-5 md:grid-cols-2">
        {competitors.map((c) => (
          <Panel key={c.name}>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <h3 className="min-w-0 text-base font-medium">{c.name}</h3>
              <Chip>{c.tag}</Chip>
            </div>
            <p className="mt-4 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">O que aprender</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {c.strengths.map((s) => (
                <li key={s}>· {s}</li>
              ))}
            </ul>
            <p className="mt-4 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">O que evitar</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {c.weaknesses.map((w) => (
                <li key={w}>· {w}</li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>
      <Panel title="Síntese">
        <p className="text-sm leading-relaxed">{marketOpportunity}</p>
      </Panel>
    </AppShell>
  );
}
