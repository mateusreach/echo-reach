import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { goToLogin } from "@/lib/login-redirect";
import { useEffect, useState } from "react";
import { SpaceShell } from "@/components/reach/space-shell";
import { PageHeader } from "@/components/reach/page-header";
import { IdentidadeVisualSection } from "@/components/reach/identidade-visual-section";
import { BrandIdentityCard } from "./b.$brandSlug.configuracoes";
import { getAccess, modulePermissionKey } from "@/lib/agency-data";
import { brandModules, getBrandBySlug, getBrandMembership, type Brand } from "@/lib/reach-data";
import { supabase } from "@/integrations/supabase/client";
import { isViewingAsClient } from "@/lib/view-as";

export const Route = createFileRoute("/e360/$brandSlug/personalizacao")({ component: SpacePersonalization });

function SpacePersonalization() {
  const { brandSlug } = Route.useParams();
  const navigate = useNavigate();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  async function refresh() {
    const updated = await getBrandBySlug(brandSlug);
    if (updated) setBrand(updated);
  }
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { goToLogin(navigate as never); return; }
      const b = await getBrandBySlug(brandSlug);
      if (!b || !brandModules(b).espaco360) { if (active) setError("Espaço não disponível para este cliente."); return; }
      const access = await getAccess();
      const membership = access.isAgency ? null : await getBrandMembership(b.id);
      const canView = access.isAgency || membership?.isAdmin || membership?.permissions.includes(modulePermissionKey("espaco360", "visualizar"));
      if (!canView) { if (active) setError("Você não tem acesso a este espaço."); return; }
      if (active) {
        setBrand(b);
        setCanEdit(!isViewingAsClient() && (access.isAgency || !!membership?.isAdmin || !!membership?.permissions.includes(modulePermissionKey("espaco360", "editar"))));
      }
    })().catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Não foi possível carregar a personalização."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [brandSlug, navigate]);

  if (loading) return <p className="p-8 text-sm text-muted-foreground">Carregando personalização…</p>;
  if (!brand) return <p role="alert" className="p-8 text-sm text-destructive">{error || "Cliente não encontrado."}</p>;
  return <SpaceShell brandSlug={brandSlug} brandName={brand.name} primaryColor={brand.primary_color} accentColor={brand.accent_color}>
    <PageHeader eyebrow="Espaço 360 · Cliente" title="Personalização" description="Capa, logo, avatar, cores e aplicações do cliente." coverUrl={brand.cover_url} coverFrame={brand.cover_frame} />
    <div className="space-y-5">
      <BrandIdentityCard brand={brand} canEdit={canEdit} onSaved={() => { void refresh(); }} />
      <IdentidadeVisualSection brandId={brand.id} brandName={brand.name} canEdit={canEdit} />
    </div>
  </SpaceShell>;
}
