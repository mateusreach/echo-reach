import { createFileRoute } from "@tanstack/react-router";
import { ModulePage } from "@/components/reach/module-page";

export const Route = createFileRoute("/criativa")({
  head: () => ({
    meta: [
      { title: "Biblioteca Criativa — Fina Fragrância | Reach Brand OS" },
      {
        name: "description",
        content: "Direção de arte, formatos e materiais criativos da Fina Fragrância para o Plano 360 | 2026.",
      },
      { property: "og:title", content: "Biblioteca Criativa — Fina Fragrância" },
      { property: "og:description", content: "Direção de arte, materiais criativos e ativos visuais da marca." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <ModulePage
      eyebrow="Ativos"
      title="Biblioteca Criativa"
      description="Direção de arte, templates e materiais aprovados para as campanhas de 2026."
      cards={[
        {
          title: "Direção de arte",
          desc: "Sensorial e acolhedora: luz quente, texturas de vidro e cera, matéria-prima em primeiro plano.",
          tag: "2026",
        },
        {
          title: "Templates de conteúdo",
          desc: "Layouts dedicados aos quadros fixos: Receita da Semana, Essência da Semana e Dica Fina.",
        },
        {
          title: "Kits e embalagens",
          desc: "Sistema visual para kits de aniversário, Dia das Mães, Namorados e caixa personalizada de troca.",
          tag: "Em produção",
        },
        {
          title: "Bastidores da #FF",
          desc: "Registro da loja, do fracionamento e da equipe — base do território de autoridade técnica.",
        },
      ]}
    />
  ),
});
