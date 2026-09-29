import { createFileRoute } from "@tanstack/react-router";
import { ModulePage } from "@/components/reach/module-page";

export const Route = createFileRoute("/especialistas-ia")({
  head: () => ({
    meta: [
      { title: "Especialistas IA — Reach Brand OS" },
      { name: "description", content: "Assistentes de IA especializados que usam todo o contexto estratégico da marca." },
      { property: "og:title", content: "Especialistas IA — Reach Brand OS" },
      { property: "og:description", content: "Painel de especialistas de IA com contexto completo da marca." },
    ],
  }),
  component: () => (
    <ModulePage
      eyebrow="Reach AI Panel"
      title="Especialistas IA"
      description="Assistentes especializados que respondem com o contexto completo da marca."
      cards={[
        { title: "Estrategista", desc: "Testa hipóteses de posicionamento contra a fundação da marca.", tag: "Ativo" },
        { title: "Editor-chefe", desc: "Gera e critica pautas dentro dos pilares editoriais.", tag: "Ativo" },
        { title: "Analista de mercado", desc: "Cruza Radar e Mercado para apontar oportunidades." },
        { title: "Guardião de tom de voz", desc: "Revisa textos contra o guia de tom aprovado." },
      ]}
    />
  ),
});
