import { createFileRoute, redirect } from "@tanstack/react-router";

// Tela estática do piloto, removida na página 25: o conteúdo agora vive em /clientes.
export const Route = createFileRoute("/criativa")({
  beforeLoad: () => { throw redirect({ to: "/clientes" }); },
});
