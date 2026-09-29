import { createFileRoute, redirect } from "@tanstack/react-router";

// Tela estática do piloto, removida na página 25: o conteúdo agora vive em /e360.
export const Route = createFileRoute("/resultados")({
  beforeLoad: () => { throw redirect({ to: "/e360" }); },
});
