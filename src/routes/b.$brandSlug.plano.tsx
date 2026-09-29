import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/b/$brandSlug/plano")({
  beforeLoad: ({ params, location }) => {
    throw redirect({ to: "/e360/$brandSlug/plano", params, search: location.search as any });
  },
});
