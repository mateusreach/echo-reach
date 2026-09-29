import { createFileRoute } from "@tanstack/react-router";
import { ModulePage } from "@/components/reach/module-page";

export const Route = createFileRoute("/resultados")({
  head: () => ({
    meta: [
      { title: "Resultados — Fina Fragrância | Reach Brand OS" },
      {
        name: "description",
        content: "Indicadores internos da Fina Fragrância conectados às campanhas do Plano 360 | 2026.",
      },
      { property: "og:title", content: "Resultados — Fina Fragrância" },
      { property: "og:description", content: "Indicadores de marca, campanhas e desempenho por canal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <ModulePage
      eyebrow="Desempenho"
      title="Resultados"
      description="Leitura interna dos resultados das campanhas de 2026."
      cards={[
        {
          title: "Campanha 12 anos",
          desc: "Aumento de fluxo na loja física e alta procura pelos kits de aniversário.",
          tag: "Abr/26",
        },
        {
          title: "Kits para vender no Dia das Mães",
          desc: "Kits prontos convertem melhor que itens avulsos entre as empreendedoras.",
          tag: "Mai/26",
        },
        {
          title: "Conteúdo educativo",
          desc: "“Ideia para Criar” e “Produtos que Vendem Muito” lideram o engajamento no Instagram.",
        },
        {
          title: "Casa Aconchegante",
          desc: "Crescimento de aromatizadores e velas; base de WhatsApp mais engajada.",
          tag: "Jun/26",
        },
      ]}
    />
  ),
});
