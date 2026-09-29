import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { BrandShell } from "@/components/reach/brand-shell";
import { PLAN_TABS, PlanView, type PlanTab } from "@/components/echo/plan";
import { useAccess } from "@/components/echo/session";
import { isViewingAsClient } from "@/lib/view-as";
import { loadPlan } from "@/lib/plan-data";

export const Route = createFileRoute("/b/$brandSlug/plano")({
  head: () => ({ meta: [{ title: "Plano · Brand · Echo" }] }),
  component: BrandPlan,
  validateSearch: (search: Record<string, unknown>) => ({ tab: typeof search.tab === "string" ? search.tab : undefined }),
});

/** Plano estratégico no Brand: a equipe edita; o cliente acompanha pelo Espaço 360. */
function BrandPlan() {
  const { brandSlug } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { isTeam } = useAccess();
  const [ready, setReady] = useState(false);
  const [viewAs, setViewAs] = useState(false);
  useEffect(() => { setReady(true); setViewAs(isViewingAsClient()); }, []);
  const plan = useQuery({ queryKey: ["plan", brandSlug], queryFn: () => loadPlan(brandSlug), enabled: ready });
  const tab: PlanTab = PLAN_TABS.includes(search.tab as PlanTab) ? (search.tab as PlanTab) : "fundacao";
  const b = plan.data?.brand;
  const team = !!isTeam && !viewAs;
  return (
    <BrandShell basePath={`/b/${brandSlug}`} brandName={b?.name} brandLogoUrl={b?.logoUrl} primaryColor={b?.primary} accentColor={b?.accent}>
      {ready && <PlanView slug={brandSlug} tab={tab} onTab={(t) => navigate({ to: "/b/$brandSlug/plano", params: { brandSlug }, search: { tab: t }, replace: true })} canEdit={team} canSuggest={!team} spaceLinks />}
    </BrandShell>
  );
}
