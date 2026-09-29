import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/b/$brandSlug/agenda")({
  beforeLoad: ({ params }) => { throw redirect({ to: "/e360/$brandSlug/agenda", params, search: { tab: undefined, filtro: undefined } }); },
});
