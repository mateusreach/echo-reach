import { createFileRoute } from "@tanstack/react-router";
import { ClientBox } from "@/components/echo/like-box";

export const Route = createFileRoute("/like/$brandSlug/rodada/$roundId")({
  head: () => ({ meta: [{ title: "Rodada · Like · Echo" }] }),
  component: () => { const { brandSlug, roundId } = Route.useParams(); return <ClientBox brandSlug={brandSlug} roundId={roundId} />; },
});
