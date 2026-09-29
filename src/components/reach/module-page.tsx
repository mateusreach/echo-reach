import type { ReactNode } from "react";
import { AppShell } from "@/components/reach/app-shell";
import { Chip, PageHeader, Panel } from "@/components/reach/ui";
import { brand } from "@/lib/brand-data";

export function ModulePage({
  eyebrow,
  title,
  description,
  cards,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  cards: { title: string; desc: string; tag?: string }[];
  children?: ReactNode;
}) {
  return (
    <AppShell>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <div className="flex flex-wrap gap-2">
        <Chip tone="brand">{brand.name}</Chip>
        <Chip>{brand.segment}</Chip>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {cards.map((c) => (
          <Panel key={c.title}>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <h3 className="min-w-0 text-base font-medium">{c.title}</h3>
              {c.tag && <Chip>{c.tag}</Chip>}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{c.desc}</p>
          </Panel>
        ))}
      </div>
      {children}
      <Panel title="Próximos passos">
        <p className="text-sm text-muted-foreground">
          Módulo alimentado pelo Plano Publicitário 360 | 2026 da Reach. O detalhamento profundo entra nas próximas
          iterações do Reach Brand OS.
        </p>
      </Panel>
    </AppShell>
  );
}
