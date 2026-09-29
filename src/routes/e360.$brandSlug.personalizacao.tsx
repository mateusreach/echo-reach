import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { SpaceShell } from "@/components/reach/space-shell";
import { EmptyState, Skeleton } from "@/components/echo/primitives";
import { IdentityEditor, SpaceCustomizer } from "@/components/echo/identity";
import { useAccess } from "@/components/echo/session";
import { getBrandMembership } from "@/lib/reach-data";
import { isViewingAsClient } from "@/lib/view-as";
import { isDemoMode } from "@/lib/home-data";
import { loadBrandInfo } from "@/lib/brand-settings-data";

export const Route = createFileRoute("/e360/$brandSlug/personalizacao")({
  head: () => ({ meta: [{ title: "Personalização · Espaço 360 · Echo" }] }),
  component: SpacePersonalization,
});

/**
 * Personalização do espaço: o administrador do cliente troca capa, logo e cores.
 * A identidade visual (mestre, paleta, canais) fica em leitura para o cliente.
 */
function SpacePersonalization() {
  const { brandSlug } = Route.useParams();
  const qc = useQueryClient();
  const { isTeam } = useAccess();
  const [ready, setReady] = useState(false);
  const [viewAs, setViewAs] = useState(false);
  useEffect(() => { setReady(true); setViewAs(isViewingAsClient()); }, []);
  const info = useQuery({ queryKey: ["brand-info", brandSlug], queryFn: () => loadBrandInfo(brandSlug), enabled: ready });
  const member = useQuery({
    queryKey: ["brand-membership", info.data?.id],
    enabled: !!info.data && !isDemoMode() && !isTeam,
    queryFn: () => getBrandMembership(info.data!.id),
  });
  const b = info.data;
  const team = !!isTeam && !viewAs;
  const clientAdmin = isDemoMode() ? viewAs : !!member.data?.isAdmin;
  const refresh = () => qc.invalidateQueries({ queryKey: ["brand-info", brandSlug] });

  if (!ready || info.isLoading) return <SpaceShell brandSlug={brandSlug} brandName=""><Skeleton h={420} r={24} /></SpaceShell>;
  if (!b) return <SpaceShell brandSlug={brandSlug} brandName=""><div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState kind="search" title="Espaço não encontrado" actions={<Link to="/e360" className="e-btn secondary">Voltar ao 360</Link>} /></div></SpaceShell>;

  return (
    <SpaceShell brandSlug={brandSlug} brandName={b.name} primaryColor={b.primary_color} accentColor={b.accent_color}>
      <div className="stack-lg">
        <SpaceCustomizer info={b} canEdit={team || clientAdmin} onSaved={refresh} />
        {!team && !clientAdmin && <p className="e-caption" style={{ margin: 0 }}>Só administradores do cliente mudam a aparência do espaço.</p>}
        <IdentityEditor info={b} canEdit={team} onBrandChanged={refresh} />
      </div>
    </SpaceShell>
  );
}
