import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { EchoLayout, EchoSubnav } from "@/components/echo/layout";
import { ClientLogo, EmptyState, Skeleton } from "@/components/echo/primitives";
import { Icon } from "@/components/echo/icon";
import { applyBrandColors } from "@/lib/branding";
import { brandModules, getBrandBySlug, getBrandMembership, logBrandAccess, type Brand, type BrandModules } from "@/lib/reach-data";
import { getAccess, modulePermissionKey } from "@/lib/agency-data";
import { isDemoMode } from "@/lib/home-data";
import { setClientContext } from "@/lib/ecosystem";

/**
 * Moldura do Brand: barra do Echo, cliente em contexto e navegação do ambiente.
 * Controla o acesso: equipe entra em tudo; cliente só nos módulos contratados
 * e liberados nas permissões dele.
 */
export function BrandShell({
  children,
  basePath,
  primaryColor,
  accentColor,
  brandName,
  brandLogoUrl,
}: {
  children: ReactNode;
  basePath: string;
  displayName?: string;
  primaryColor?: string | null;
  accentColor?: string | null;
  brandName?: string | null;
  brandLogoUrl?: string | null;
}) {
  const [brand, setBrand] = useState<Brand | null>(null);
  const [modules, setModules] = useState<BrandModules | null>(null);
  const [isAgencyUser, setIsAgencyUser] = useState(false);
  const [gate, setGate] = useState<"loading" | "allowed" | "blocked">("loading");
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const slug = basePath.split("/").filter(Boolean)[1] ?? "";
  const moduleKey = pathname.includes("/configuracoes") ? "configuracoes" : pathname.includes("/plano") ? "plano" : "biblioteca";
  const requiredPermission = modulePermissionKey(moduleKey, moduleKey === "configuracoes" ? "administrar" : "visualizar");

  useEffect(() => {
    applyBrandColors(primaryColor, accentColor);
    return () => applyBrandColors(null, null);
  }, [primaryColor, accentColor]);

  useEffect(() => {
    let alive = true;
    if (!slug) return;
    setClientContext(slug);
    if (isDemoMode()) {
      setIsAgencyUser(true);
      setModules({ biblioteca: true, plano: true, workspace: true, espaco360: true, like: true } as BrandModules);
      setGate("allowed");
      return;
    }
    getBrandBySlug(slug)
      .then(async (b) => {
        if (!alive) return;
        if (!b) { setGate("blocked"); return; }
        setBrand(b);
        setModules(brandModules(b));
        logBrandAccess(b.id, "acesso", b.name).catch(() => undefined);
        const access = await getAccess();
        if (!alive) return;
        if (access.isAgency) { setIsAgencyUser(true); setGate("allowed"); return; }
        const membership = await getBrandMembership(b.id);
        if (!alive) return;
        if (!membership) { setGate("blocked"); return; }
        const visible = (key: "plano" | "biblioteca") => membership.isAdmin || membership.permissions.includes(modulePermissionKey(key, "visualizar"));
        const m = brandModules(b);
        setModules({ ...m, plano: m.plano && visible("plano"), biblioteca: m.biblioteca && visible("biblioteca"), espaco360: false, workspace: false });
        if (!m.biblioteca && !m.plano && m.espaco360) { navigate({ to: "/e360/$brandSlug", params: { brandSlug: slug }, search: { tab: undefined, filtro: undefined } }); return; }
        setGate(membership.isAdmin || membership.permissions.includes(requiredPermission) ? "allowed" : "blocked");
      })
      .catch(() => { if (alive) setGate("blocked"); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, requiredPermission]);

  const name = brandName ?? brand?.name ?? "";
  const logo = brandLogoUrl ?? brand?.logo_url ?? null;
  const p = { brandSlug: slug };
  const items = [
    modules?.biblioteca !== false && { to: "/b/$brandSlug/biblioteca", params: p, search: { tab: undefined }, label: "Biblioteca", icon: "layers" as const },
    modules?.plano !== false && { to: "/b/$brandSlug/plano", params: p, search: {}, label: "Plano", icon: "target" as const },
    isAgencyUser && { to: "/b/$brandSlug/configuracoes", params: p, search: {}, label: "Configurações", icon: "sliders" as const },
  ].filter(Boolean) as never[];

  return (
    <EchoLayout
      env="brand"
      wide
      demoData
      eyebrow={isAgencyUser ? <Link to="/clientes" className="e-link" style={{ fontSize: "inherit", fontWeight: 500 }}><Icon name="chevLeft" size="sm" /> Clientes</Link> : "Brand"}
      title={name ? <span className="brand-title">{<ClientLogo name={name} logoUrl={logo} size="sm" />}{name}</span> as never : "Brand"}
      titleAside={isAgencyUser && slug ? <Link to={`/clientes/${slug}` as never} className="e-btn ghost sm"><Icon name="briefcase" size="sm" /> Hub do cliente</Link> : undefined}
      nav={<EchoSubnav label="Áreas do Brand" items={items} />}
    >
      {gate === "loading" && <div className="stack-lg" aria-busy="true"><Skeleton h={48} r={16} /><Skeleton h={320} r={24} /></div>}
      {gate === "blocked" && <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState icon="lock" title="Acesso não autorizado" text="Você não tem permissão para abrir esta área deste cliente. Fale com a equipe se precisar de acesso." /></div>}
      {gate === "allowed" && children}
    </EchoLayout>
  );
}
