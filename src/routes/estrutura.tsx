import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/reach/app-shell";
import { Chip, PageHeader, Panel } from "@/components/reach/ui";
import { brand } from "@/lib/brand-data";

export const Route = createFileRoute("/estrutura")({
  head: () => ({
    meta: [
      { title: "Estrutura da Marca — Fina Fragrância | Reach Brand OS" },
      {
        name: "description",
        content: "Fundação da Fina Fragrância: propósito, DNA, arquétipos, personalidade, personas e tom de voz.",
      },
      { property: "og:title", content: "Estrutura da Marca — Fina Fragrância" },
      { property: "og:description", content: "Propósito, arquétipos, atributos, personas e territórios de valor." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Estrutura,
});

function Estrutura() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Fundação"
        title="Estrutura da Marca"
        description="A base sobre a qual toda a comunicação da Fina Fragrância é construída."
      />
      <div className="flex flex-wrap gap-2">
        <Chip tone="brand">{brand.name}</Chip>
        <Chip>{brand.segment}</Chip>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Panel title="Propósito">
          <p className="text-sm leading-relaxed">{brand.purpose}</p>
        </Panel>
        <Panel title="Posicionamento 2026">
          <p className="text-sm leading-relaxed">{brand.positioning}</p>
          <p className="mt-4 text-sm">
            <span className="text-muted-foreground">DNA: </span>
            <span className="text-gradient-brand font-semibold">{brand.essence}</span>
          </p>
        </Panel>
        <Panel title="Arquétipos">
          <div className="flex flex-wrap gap-2">
            {brand.archetypes.map((a) => (
              <Chip key={a} tone="brand">
                {a}
              </Chip>
            ))}
          </div>
          <p className="mt-4 text-xs uppercase tracking-[0.14em] text-muted-foreground">Personalidade</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {brand.personality.map((p) => (
              <Chip key={p}>{p}</Chip>
            ))}
          </div>
        </Panel>
        <Panel title="Atributos & tom de voz">
          <div className="flex flex-wrap gap-2">
            {brand.attributes.map((a) => (
              <Chip key={a}>{a}</Chip>
            ))}
          </div>
          <p className="mt-4 text-xs uppercase tracking-[0.14em] text-muted-foreground">Tom de voz</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {brand.toneOfVoice.map((t) => (
              <li key={t}>· {t}</li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="Personas">
        <div className="grid gap-4 md:grid-cols-2">
          {brand.personas.map((p) => (
            <div key={p.name} className="rounded-2xl border border-border/60 p-4">
              <p className="text-sm font-medium">{p.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{p.desc}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Territórios de valor">
        <div className="flex flex-wrap gap-2">
          {brand.valueTerritories.map((t) => (
            <Chip key={t}>{t}</Chip>
          ))}
        </div>
        <p className="mt-4 text-lg font-semibold text-gradient-brand">{brand.valueConcept}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Conceito que conecta todas as personas em uma única narrativa de marca.
        </p>
      </Panel>
    </AppShell>
  );
}
