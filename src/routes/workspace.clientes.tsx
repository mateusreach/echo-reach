import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Clientes é uma experiência única do Reach Echo. O item de menu do Workspace
 * continua existindo como atalho, mas abre o mesmo Client Hub — nunca uma
 * segunda listagem nem um segundo cadastro.
 */
export const Route = createFileRoute("/workspace/clientes")({
  beforeLoad: () => {
    throw redirect({ to: "/clientes" });
  },
});
