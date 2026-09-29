import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/b/$brandSlug/resultados")({
  beforeLoad: ({ params }) => { throw redirect({ to: "/e360/$brandSlug/resultados", params, search: { tab: undefined, filtro: undefined } }); },
});
