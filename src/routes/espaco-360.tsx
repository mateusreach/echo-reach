import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/espaco-360")({
  beforeLoad: () => { throw redirect({ to: "/e360" }); },
});
