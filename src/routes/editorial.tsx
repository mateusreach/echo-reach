import { createFileRoute, redirect } from "@tanstack/react-router";

// Tela estática do piloto, removida na página 25: o conteúdo agora vive em /agencia/clientes.
export const Route = createFileRoute("/editorial")({
  beforeLoad: () => { throw redirect({ to: "/agencia/clientes" }); },
});
