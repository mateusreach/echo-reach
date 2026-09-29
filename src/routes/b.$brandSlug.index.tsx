import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/b/$brandSlug/")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/b/$brandSlug/biblioteca", params, search: { tab: undefined } });
  },
});
