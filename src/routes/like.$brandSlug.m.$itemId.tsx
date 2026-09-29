import { createFileRoute } from "@tanstack/react-router";
import { MaterialReview } from "@/components/echo/like-review";

export const Route = createFileRoute("/like/$brandSlug/m/$itemId")({
  head: () => ({ meta: [{ title: "Revisão · Like · Echo" }] }),
  validateSearch: (s: Record<string, unknown>): { v?: number; sequencia?: number } => ({
    ...(s.v !== undefined && !Number.isNaN(Number(s.v)) ? { v: Number(s.v) } : {}),
    ...(s.sequencia !== undefined ? { sequencia: 1 } : {}),
  }),
  component: Review,
});

function Review() {
  const { brandSlug, itemId } = Route.useParams();
  const { v, sequencia } = Route.useSearch();
  return <MaterialReview key={itemId} brandSlug={brandSlug} itemId={itemId} v={v} sequence={!!sequencia} />;
}
