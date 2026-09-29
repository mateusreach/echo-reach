import { Link, useRouterState } from "@tanstack/react-router";
import { getNavItems, accentClass, moduleNavByKey } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { Search, PanelLeftClose, PanelLeftOpen, ArrowLeft } from "lucide-react";
import { ReachMark } from "./ui";
import { FramedImage } from "./framed-image";
import type { BrandModules } from "@/lib/reach-data";

export function BrandSidebar({
  basePath,
  displayName,
  onOpenPalette,
  expanded,
  onToggleExpanded,
  modules,
  isAgencyUser = true,
  brandName,
  brandLogoUrl,
  brandLogoFrame,
}: {
  basePath: string;
  displayName: string;
  onOpenPalette: () => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  modules?: BrandModules | null;
  isAgencyUser?: boolean;
  brandName?: string | null;
  brandLogoUrl?: string | null;
  brandLogoFrame?: unknown;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const currentTab = useRouterState({
    select: (s) => {
      const t = (s.location.search as Record<string, unknown>)?.tab;
      return typeof t === "string" ? t : undefined;
    },
  });
  const subNav = (to: string) =>
    to === `${basePath}/plano` ? moduleNavByKey("plano") : to === `${basePath}/biblioteca` ? moduleNavByKey("biblioteca") : undefined;
  const items = getNavItems(basePath, modules ?? undefined).filter((i) => isAgencyUser || (i.to !== basePath && !i.to.endsWith("/configuracoes")));
  const brandInitials = (brandName ?? "")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const initials = displayName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();





  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border bg-card py-4 backdrop-blur-xl transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        expanded ? "w-[232px] px-3" : "w-[72px] items-center",
      )}
    >
      <div className={cn("mb-2 flex items-center", expanded ? "w-full justify-between" : "flex-col gap-2")}>
        <Link to={basePath as any} aria-label="Branding Space" className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl">
          <ReachMark />
        </Link>
        {expanded && (
          <span className="min-w-0 flex-1 truncate pl-2.5 font-[var(--font-display)] text-[14.5px] font-semibold">
            Branding Space
          </span>
        )}
        <button
          onClick={onToggleExpanded}
          aria-label={expanded ? "Recolher menu" : "Expandir menu"}
          title={expanded ? "Recolher menu" : "Expandir menu"}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {expanded ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </button>
      </div>

      {isAgencyUser && <button
        onClick={onOpenPalette}
        aria-label="Buscar (Ctrl+K)"
        title="Buscar (Ctrl+K)"
        className={cn(
          "mb-2 flex items-center rounded-2xl border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          expanded ? "w-full gap-2.5 px-3 py-2.5" : "h-11 w-11 justify-center",
        )}
      >
        <Search className="h-[18px] w-[18px] shrink-0" />
        {expanded && <span className="text-[13px]">Buscar em tudo…</span>}
      </button>}

      {isAgencyUser && <Link
        to="/agencia"
        aria-label="Voltar para Clientes"
        title="Voltar para Clientes"
        className={cn(
          "mb-3 flex items-center rounded-2xl border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          expanded ? "w-full gap-2 px-3 py-2" : "h-11 w-11 justify-center",
        )}
      >
        <ArrowLeft className="h-4 w-4 shrink-0" />
        {expanded && <span className="truncate text-[12.5px]">Voltar para Clientes</span>}
      </Link>}

      <Link
        to={basePath as any}
        aria-label={brandName ?? "Cliente"}
        title={brandName ?? "Cliente"}
        className={cn(
          "mb-3 flex items-center rounded-2xl border border-border bg-card transition-colors hover:bg-muted",
          expanded ? "w-full gap-2.5 px-2.5 py-2" : "h-11 w-11 justify-center",
        )}
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-linear-to-br from-reach-coral/10 to-reach-violet/10 text-[11px] font-semibold">
          {brandLogoUrl ? (
            <FramedImage src={brandLogoUrl} frame={brandLogoFrame} shape="circle" className="h-full w-full" alt={brandName ? `Logo ${brandName}` : "Logo do cliente"} />
          ) : (
            brandInitials || "?"
          )}
        </span>
        {expanded && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-semibold">{brandName ?? "Cliente"}</span>
            <span className="block truncate text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">Cliente atual</span>
          </span>
        )}
      </Link>



      <nav className={cn("flex flex-1 flex-col gap-1 overflow-y-auto", !expanded && "items-center")}>
        {items.map((item) => {
          const active = item.to === basePath ? pathname === basePath : pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <div key={item.to} className={cn("flex flex-col", !expanded && "items-center")}>
              {item.divider && (
                <div className={cn("my-2 h-px bg-muted/60", expanded ? "mx-2" : "w-8")} aria-hidden />
              )}
              <Link
                to={item.to as any}
                aria-label={item.label}
                title={item.label}
                className={cn(
                  "group relative flex items-center rounded-2xl transition-all",
                  expanded ? "w-full gap-2.5 px-3 py-2.5" : "h-11 w-11 justify-center",
                )}
              >
                <span
                  className={cn(
                    "absolute inset-0 rounded-2xl transition-all",
                    active ? `${accentClass(item.accent, "bg")} border border-border` : "border border-transparent bg-transparent group-hover:bg-muted",
                  )}
                />
                <Icon
                  className={cn("relative h-[19px] w-[19px] shrink-0 transition-colors", active ? accentClass(item.accent, "text") : "text-muted-foreground group-hover:text-foreground")}
                  strokeWidth={active ? 2.2 : 1.8}
                />
                {expanded && (
                  <span className={cn("relative truncate text-[13px] font-medium transition-colors", active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")}>
                    {item.label}
                  </span>
                )}
                {active && !expanded && (
                  <span className={cn("absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full", accentClass(item.accent, "dot"))} />
                )}
              </Link>

              {expanded && subNav(item.to) && (
                <div className="ml-[22px] mt-0.5 flex flex-col gap-0.5 border-l border-border pl-2">
                  {subNav(item.to)!.sections.map((section) => {
                    const sectionActive =
                      (pathname === `${basePath}${section.suffix}` || pathname.startsWith(`${basePath}${section.suffix}/`)) &&
                      (!section.tab || (currentTab ?? subNav(item.to)!.sections[0]?.tab) === section.tab);
                    const SIcon = section.icon;
                    return (
                      <Link
                        key={section.key}
                        to={`${basePath}${section.suffix}` as any}
                        search={(section.tab ? { tab: section.tab } : {}) as any}
                        className={cn(
                          "group flex items-center gap-2 rounded-xl px-2 py-1.5 text-[12px] transition-colors",
                          sectionActive
                            ? `${accentClass(item.accent, "bg")} font-medium text-foreground`
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        <SIcon className={cn("h-[14px] w-[14px] shrink-0", sectionActive ? accentClass(item.accent, "text") : "text-muted-foreground group-hover:text-foreground")} strokeWidth={sectionActive ? 2.2 : 1.8} />
                        <span className="truncate">{section.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

      </nav>

      {isAgencyUser && <Link
        to={`${basePath}/configuracoes` as any}
        aria-label="Perfil"
        title={displayName}
        className={cn("mt-2 flex items-center", expanded ? "w-full gap-2.5 rounded-2xl px-2 py-2 hover:bg-muted" : "justify-center")}
      >
        <span className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-linear-to-br from-reach-coral/10 to-reach-violet/10 font-[var(--font-display)] text-[13px] font-semibold text-foreground">
          {initials || "?"}
        </span>
        {expanded && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium capitalize">{displayName}</span>
            <span className="block truncate text-[11.5px] text-muted-foreground">Equipe</span>
          </span>
        )}
      </Link>}
    </aside>
  );
}
