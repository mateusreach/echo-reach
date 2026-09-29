import { createFileRoute, redirect } from "@tanstack/react-router";

// Tela estática do piloto, removida na página 25: o conteúdo agora vive em /.
export const Route = createFileRoute("/especialistas-ia")({
  beforeLoad: () => { throw redirect({ to: "/" }); },
});
