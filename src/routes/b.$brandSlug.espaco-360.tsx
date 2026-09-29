import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/b/$brandSlug/espaco-360")({
  beforeLoad: ({ params, location }) => {
    throw redirect({ to: "/e360/$brandSlug", params, search: location.search as any });
  },
});
