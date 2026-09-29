import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Eye } from "lucide-react";
import { ReachBackground } from "./background";
import { BrandSidebar } from "./sidebar";
import { BrandTopbar } from "./topbar";
import { CommandPalette } from "./command-palette";
import { ModuleNavPanel } from "./module-nav";
import { cn } from "@/lib/utils";
import { getModuleNav } from "@/lib/nav";
import { isViewingAsClient, stopViewAsClient, viewingAsClientBrandName } from "@/lib/view-as";
import { applyBrandColors, applyTheme, getStoredTheme } from "@/lib/branding";
import { brandModules, getBrandBySlug, getBrandMembership, logBrandAccess, type Brand, type BrandModules } from "@/lib/reach-data";
import { getAccess, modulePermissionKey } from "@/lib/agency-data";

export function BrandShell({
  children,
  basePath,
  displayName = "Você",
  primaryColor,
  accentColor,
}: {
  children: ReactNode;
  basePath: string;
  displayName?: string;
  primaryColor?: string | null;
  accentColor?: string | null;
}) {
  const [expanded, setExpanded] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [modules, setModules] = useState<BrandModules | null>(null);
  const [isAgencyUser, setIsAgencyUser] = useState(false);
  const [gate, setGate] = useState<"loading" | "allowed" | "blocked">("loading");
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const viewingAsClient = isViewingAsClient();
  const clientBrandName = viewingAsClientBrandName();
  const slug = basePath.split("/").filter(Boolean)[1] ?? "";
  // A Biblioteca já expõe suas seções no menu lateral global.
  const currentNav = getModuleNav(basePath, pathname);
  const moduleNav = currentNav && (currentNav.key === "plano" || currentNav.key === "biblioteca") ? null : currentNav;
  // Chave de permissão do módulo atual — configuracoes usa "administrar",
  // os demais módulos do cliente usam "visualizar" como piso de acesso.
  const moduleKey = currentNav?.key;
  const requiredPermission = moduleKey ? modulePermissionKey(moduleKey, moduleKey === "configuracoes" ? "administrar" : "visualizar") : null;

  useEffect(() => {
    applyTheme(getStoredTheme());
  }, []);

  useEffect(() => {
    applyBrandColors(primaryColor, accentColor);
    return () => applyBrandColors(null, null);
  }, [primaryColor, accentColor]);

  useEffect(() => {
    let alive = true;
    if (!slug) return;
    getBrandBySlug(slug)
      .then(async (b) => {
        if (!alive) return;
        if (!b) {
          // RLS não devolveu nenhuma marca com esse slug para este usuário —
          // ou não existe, ou ele não tem vínculo algum com ela.
          setGate("blocked");
          return;
        }
        setBrand(b);
        setModules(brandModules(b));
        logBrandAccess(b.id, "acesso", b.name).catch(() => undefined);

        const access = await getAccess();
        if (!alive) return;
        if (access.isAgency) {
          setIsAgencyUser(true);
          if (pathname === basePath || pathname === `${basePath}/`) {
            navigate({ to: "/b/$brandSlug/biblioteca", params: { brandSlug: slug }, search: { tab: undefined } });
            return;
          }
          setGate("allowed");
          return;
        }
        setIsAgencyUser(false);
        const membership = await getBrandMembership(b.id);
        if (!alive) return;
        if (!membership) {
          setGate("blocked");
          return;
        }
        const visible = (key: "plano" | "biblioteca" | "espaco360") =>
          membership.isAdmin || membership.permissions.includes(modulePermissionKey(key, "visualizar"));
        setModules({ ...brandModules(b), plano: brandModules(b).plano && visible("plano"), biblioteca: brandModules(b).biblioteca && visible("biblioteca"), espaco360: false, workspace: false });
        if (pathname === basePath || pathname === `${basePath}/`) {
          if (brandModules(b).biblioteca && visible("biblioteca")) {
            navigate({ to: "/b/$brandSlug/biblioteca", params: { brandSlug: slug }, search: { tab: undefined } });
            return;
          }
          if (brandModules(b).espaco360 && visible("espaco360")) {
            navigate({ to: "/e360/$brandSlug", params: { brandSlug: slug }, search: { tab: undefined, filtro: undefined } });
            return;
          }
          setGate("blocked");
          return;
        }
        if (membership.isAdmin || !requiredPermission || membership.permissions.includes(requiredPermission)) {
          setGate("allowed");
        } else {
          setGate("blocked");
        }
      })
      .catch(() => {
        if (alive) setGate("blocked");
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, requiredPermission]);

  function exitViewAsClient() {
    stopViewAsClient();
    navigate({ to: "/agencia" });
  }

  return (
    <div className="relative min-h-screen">
      <ReachBackground />
      <BrandSidebar
        basePath={basePath}
        displayName={displayName}
        expanded={expanded}
        modules={modules}
        isAgencyUser={isAgencyUser}
        brandName={brand?.name ?? null}
        brandLogoUrl={brand?.logo_url ?? null}
        brandLogoFrame={(brand as any)?.logo_frame ?? null}
        onToggleExpanded={() => setExpanded((v) => !v)}
        onOpenPalette={() => setPaletteOpen(true)}
      />
      {isAgencyUser && <CommandPalette basePath={basePath} open={paletteOpen} onClose={() => setPaletteOpen(false)} />}

      <main
        className={cn(
          "relative z-10 min-h-screen px-8 py-6 transition-[padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          expanded ? "pl-[248px]" : "pl-[88px]",
        )}
      >
        {viewingAsClient && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-reach-amber/30 bg-reach-amber/[0.08] px-4 py-2.5">
            <span className="inline-flex items-center gap-2 text-[12.5px] font-medium text-reach-amber">
              <Eye className="h-3.5 w-3.5" /> Visualizando como: {clientBrandName ?? "Cliente"}
            </span>
            <button onClick={exitViewAsClient} className="rounded-full bg-reach-amber/20 px-3 py-1 text-[11.5px] font-medium text-reach-amber transition-colors hover:bg-reach-amber/30">
              Voltar para Agência
            </button>
          </div>
        )}
        <BrandTopbar
          basePath={basePath}
          brandName={brand?.name ?? null}
          brandLogoUrl={brand?.logo_url ?? null}
          brandLogoFrame={(brand as any)?.logo_frame ?? null}
          modules={modules}
          isAgencyUser={isAgencyUser}
          onOpenPalette={() => setPaletteOpen(true)}
        />
        <div className="flex gap-6">
          {gate === "allowed" && moduleNav && <ModuleNavPanel basePath={basePath} nav={moduleNav} />}
          <div className="animate-fade-up min-w-0 flex-1 pb-16">
            {gate === "loading" && <div className="py-16 text-center text-sm text-muted-foreground">Carregando…</div>}
            {gate === "blocked" && (
              <div className="surface mx-auto mt-10 max-w-md space-y-2 rounded-2xl p-6 text-center">
                <h2 className="text-sm font-semibold">Acesso não autorizado</h2>
                <p className="text-sm text-muted-foreground">Você não tem permissão para acessar esta área.</p>
              </div>
            )}
            {gate === "allowed" && children}
          </div>
        </div>
      </main>
    </div>
  );
}
