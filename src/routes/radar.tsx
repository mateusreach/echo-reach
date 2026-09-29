import { createFileRoute } from "@tanstack/react-router";
import { ModulePage } from "@/components/reach/module-page";

export const Route = createFileRoute("/radar")({
  head: () => ({
    meta: [
      { title: "Radar — Fina Fragrância | Reach Brand OS" },
      {
        name: "description",
        content: "Sinais e tendências do mercado de essências e perfumaria artesanal monitorados para a marca.",
      },
      { property: "og:title", content: "Radar — Fina Fragrância" },
      { property: "og:description", content: "Sinais, tendências e movimentos do mercado de essências." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <ModulePage
      eyebrow="Sinais"
      title="Radar"
      description="Movimentos do mercado que podem afetar a estratégia da Fina Fragrância."
      cards={[
        {
          title: "Renda extra com artesanato",
          desc: "Busca crescente por produzir para vender — reforça o pilar Empreender com Aromas.",
          tag: "Alta",
        },
        {
          title: "Economia doméstica",
          desc: "Produção caseira de itens de limpeza segue em alta com o aperto no orçamento.",
          tag: "Alta",
        },
        {
          title: "Conteúdo educativo em vídeo curto",
          desc: "Receitas e passo a passo continuam sendo o formato de maior alcance no segmento.",
        },
        {
          title: "Cursos como produto",
          desc: "Concorrentes e formadores de mercado monetizam conhecimento antes do produto.",
          tag: "Atenção",
        },
      ]}
    />
  ),
});
