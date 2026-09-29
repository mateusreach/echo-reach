import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { SpaceShell } from "@/components/reach/space-shell";
import { PLAN_TABS, PlanView, type PlanTab } from "@/components/echo/plan";
import { useAccess } from "@/components/echo/session";
import { isViewingAsClient } from "@/lib/view-as";
import { loadPlan } from "@/lib/plan-data";

export const Route = createFileRoute("/e360/$brandSlug/plano")({
  head: () => ({ meta: [{ title: "Plano · Espaço 360 · Echo" }] }),
  component: SpacePlan,
  validateSearch: (search: Record<string, unknown>) => ({
    tab: typeof search.tab === "string" ? search.tab : undefined,
    filtro: typeof search.filtro === "string" ? search.filtro : undefined,
  }),
});

/** O cliente acompanha o plano da marca e sugere alterações; a equipe edita no Brand. */
function SpacePlan() {
  const { brandSlug } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { isTeam } = useAccess();
  const [ready, setReady] = useState(false);
  const [viewAs, setViewAs] = useState(false);
  useEffect(() => { setReady(true); setViewAs(isViewingAsClient()); }, []);
  const plan = useQuery({ queryKey: ["plan", brandSlug], queryFn: () => loadPlan(brandSlug), enabled: ready });
  const legacy: Record<string, PlanTab> = { "Fundação": "fundacao", Objetivos: "objetivos", "Estratégia": "estrategia" };
  const raw = legacy[search.tab ?? ""] ?? search.tab;
  const tab: PlanTab = PLAN_TABS.includes(raw as PlanTab) ? (raw as PlanTab) : "fundacao";
  const b = plan.data?.brand;
  const team = !!isTeam && !viewAs;
  return (
    <SpaceShell demoData brandSlug={brandSlug} brandName={b?.name ?? ""} primaryColor={b?.primary} accentColor={b?.accent}>
      {ready && <PlanView slug={brandSlug} tab={tab} onTab={(t) => navigate({ to: "/e360/$brandSlug/plano", params: { brandSlug }, search: { tab: t, filtro: undefined }, replace: true })} canEdit={team} canSuggest={!team} spaceLinks />}
    </SpaceShell>
  );
}
