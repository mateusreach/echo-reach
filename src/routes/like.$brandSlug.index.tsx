import { createFileRoute } from "@tanstack/react-router";
import { ClientBox } from "@/components/echo/like-box";

export const Route = createFileRoute("/like/$brandSlug/")({
  head: () => ({ meta: [{ title: "Aprovações · Like · Echo" }] }),
  component: () => { const { brandSlug } = Route.useParams(); return <ClientBox brandSlug={brandSlug} />; },
});
