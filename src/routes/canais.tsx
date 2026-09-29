import { createFileRoute } from "@tanstack/react-router";
import { ModulePage } from "@/components/reach/module-page";
import { channels } from "@/lib/brand-data";

export const Route = createFileRoute("/canais")({
  head: () => ({
    meta: [
      { title: "Canais — Fina Fragrância | Reach Brand OS" },
      { name: "description", content: "Instagram, WhatsApp e loja física: os canais da Fina Fragrância em Betim/MG." },
      { property: "og:title", content: "Canais — Fina Fragrância" },
      { property: "og:description", content: "Papel, status e prioridade de cada canal da marca." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <ModulePage
      eyebrow="Distribuição"
      title="Canais"
      description="Onde a narrativa da Fina Fragrância acontece e com qual papel."
      cards={channels.map((c) => ({ title: c.name, desc: c.note, tag: c.status }))}
    />
  ),
});
