import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/reach/app-shell";
import { Chip, Meter, PageHeader, Panel } from "@/components/reach/ui";
import { maturity, maturityStages, timeline } from "@/lib/brand-data";

export const Route = createFileRoute("/evolucao")({
  head: () => ({
    meta: [
      { title: "Evolução da Marca — Fina Fragrância | Reach Brand OS" },
      {
        name: "description",
        content: "Grau de maturidade da Fina Fragrância: Nível 3 — Marca Especialista Local, forças e lacunas.",
      },
      { property: "og:title", content: "Evolução da Marca — Fina Fragrância" },
      { property: "og:description", content: "Estágios de maturidade, pontos fortes, lacunas e histórico da marca." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Evolucao,
});

function Evolucao() {
  const progress = Math.round((maturity.level / maturityStages.length) * 100);
  return (
    <AppShell>
      <PageHeader
        eyebrow="Maturidade"
        title="Evolução da Marca"
        description="Onde a Fina Fragrância está hoje e qual o próximo estágio de maturidade."
      />
      <div className="flex flex-wrap gap-2">
        <Chip tone="brand">{maturity.title}</Chip>
        <Chip>{maturity.stage}</Chip>
      </div>

      <Panel title="Grau de maturidade">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <Meter value={progress} />
          <span className="shrink-0 text-sm text-muted-foreground">
            Nível {maturity.level} de {maturityStages.length}
          </span>
        </div>
        <ol className="mt-6 space-y-3">
          {maturityStages.map((s) => {
            const current = s.level === maturity.level - 1;
            return (
              <li
                key={s.name}
                className={
                  current
                    ? "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-brand/40 p-4"
                    : "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border/60 p-4"
                }
              >
                <div className="min-w-0">
                  <p className={current ? "text-sm font-semibold text-gradient-brand" : "text-sm font-medium"}>
                    {s.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{s.note}</p>
                </div>
                {current ? <Chip tone="brand">Atual</Chip> : <Chip>{s.level}</Chip>}
              </li>
            );
          })}
        </ol>
      </Panel>

      <div className="grid gap-5 md:grid-cols-2">
        <Panel title="Pontos fortes">
          <ul className="space-y-2 text-sm text-muted-foreground">
            {maturity.strengths.map((s) => (
              <li key={s}>· {s}</li>
            ))}
          </ul>
        </Panel>
        <Panel title="Lacunas a resolver">
          <ul className="space-y-2 text-sm text-muted-foreground">
            {maturity.gaps.map((g) => (
              <li key={g}>· {g}</li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="Histórico">
        <ol className="relative space-y-6 border-l border-border pl-5">
          {timeline.map((t) => (
            <li key={t.title}>
              <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full gradient-brand" />
              <p className="text-xs text-muted-foreground">{t.date}</p>
              <p className="text-sm font-medium">{t.title}</p>
              <p className="text-sm text-muted-foreground">{t.desc}</p>
            </li>
          ))}
        </ol>
      </Panel>
    </AppShell>
  );
}
