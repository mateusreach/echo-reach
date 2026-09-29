import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/reach/app-shell";
import { Chip, PageHeader, Panel } from "@/components/reach/ui";

const index = [
  { title: "Posicionamento da marca", module: "Estrutura da Marca" },
  { title: "Pilar: Ciência Descomplicada", module: "Biblioteca Editorial" },
  { title: "Direção de arte v2", module: "Biblioteca Criativa" },
  { title: "Tendência: Skinimalism", module: "Radar" },
  { title: "Concorrente B", module: "Mercado" },
  { title: "Piloto de TikTok educativo", module: "Espaço 360" },
  { title: "Reposicionamento aprovado", module: "Evolução da Marca" },
];

export const Route = createFileRoute("/pesquisa")({
  head: () => ({
    meta: [
      { title: "Pesquisa Global — Reach Brand OS" },
      { name: "description", content: "Busque em toda a inteligência estratégica da marca em um só lugar." },
      { property: "og:title", content: "Pesquisa Global — Reach Brand OS" },
      { property: "og:description", content: "Busca unificada em todos os módulos do Brand Home." },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const [q, setQ] = useState("");
  const results = index.filter((i) => (i.title + i.module).toLowerCase().includes(q.toLowerCase()));

  return (
    <AppShell>
      <PageHeader eyebrow="Busca" title="Pesquisa Global" description="Tudo o que a marca já decidiu, em um campo só." />
      <Panel>
        <div className="flex items-center gap-3 rounded-full border border-border px-4 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar posicionamento, pilares, tendências…"
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>
        <ul className="mt-5 divide-y divide-border">
          {results.map((r) => (
            <li key={r.title} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3">
              <span className="truncate text-sm">{r.title}</span>
              <Chip>{r.module}</Chip>
            </li>
          ))}
          {results.length === 0 && <li className="py-6 text-sm text-muted-foreground">Nenhum resultado.</li>}
        </ul>
      </Panel>
    </AppShell>
  );
}
