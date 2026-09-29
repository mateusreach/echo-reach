import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/reach/app-shell";
import { Chip, Meter, PageHeader, Panel } from "@/components/reach/ui";
import { brand, fixedFormats, pillars } from "@/lib/brand-data";

export const Route = createFileRoute("/editorial")({
  head: () => ({
    meta: [
      { title: "Biblioteca Editorial — Fina Fragrância | Reach Brand OS" },
      {
        name: "description",
        content: "Cinco pilares narrativos da Fina Fragrância e os 10 quadros fixos de conteúdo recorrente.",
      },
      { property: "og:title", content: "Biblioteca Editorial — Fina Fragrância" },
      { property: "og:description", content: "Pilares narrativos, jornada de conteúdo e quadros fixos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Editorial,
});

function Editorial() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Narrativas"
        title="Biblioteca Editorial"
        description="Pilares narrativos e séries recorrentes que traduzem a estratégia em conteúdo."
      />
      <div className="flex flex-wrap gap-2">
        <Chip tone="brand">{brand.name}</Chip>
        <Chip>{brand.valueConcept}</Chip>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {pillars.map((p) => (
          <Panel key={p.name}>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <h3 className="min-w-0 text-base font-medium">{p.name}</h3>
              <Chip>{p.share}%</Chip>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{p.desc}</p>
            <div className="mt-3">
              <Meter value={p.share * 4} />
            </div>
            <p className="mt-4 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Jornada</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {p.categories.map((c) => (
                <Chip key={c}>{c}</Chip>
              ))}
            </div>
          </Panel>
        ))}
      </div>

      <Panel title="Quadros fixos">
        <p className="text-sm text-muted-foreground">
          Dez séries recorrentes que sustentam o calendário de conteúdo ao longo de 2026.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {fixedFormats.map((f) => (
            <Chip key={f}>{f}</Chip>
          ))}
        </div>
      </Panel>
    </AppShell>
  );
}
