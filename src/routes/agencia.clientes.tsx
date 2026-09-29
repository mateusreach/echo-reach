import { createFileRoute, redirect } from "@tanstack/react-router";

// Tela antiga do piloto (consultava o banco direto e não tinha modo demonstração).
// A carteira de clientes é /clientes (página 06).
export const Route = createFileRoute("/agencia/clientes")({
  beforeLoad: () => { throw redirect({ to: "/clientes" }); },
});
