import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/b/$brandSlug/campanha/$campaignId")({
  beforeLoad: ({ params }) => { throw redirect({ to: "/e360/$brandSlug/campanha/$campaignId", params, search: { tab: undefined, filtro: undefined } }); },
});
