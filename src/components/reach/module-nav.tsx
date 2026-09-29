import { Link, useRouterState } from "@tanstack/react-router";
import { accentClass, type ModuleNav } from "@/lib/nav";
import { cn } from "@/lib/utils";

/**
 * Menu lateral contextual do módulo atual (Biblioteca, Plano, Espaço 360,
 * Configurações). Não substitui a navegação global — é o segundo nível da
 * hierarquia: GLOBAL → CLIENTE → MÓDULO → SEÇÃO DO MÓDULO.
 */
export function ModuleNavPanel({ basePath, nav }: { basePath: string; nav: ModuleNav }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.search as Record<string, unknown> });
  const currentTab = typeof search?.tab === "string" ? search.tab : undefined;
  const rest = pathname.startsWith(basePath) ? pathname.slice(basePath.length) : "";

  const tabbed = nav.sections.filter((s) => s.tab);
  const defaultTab = tabbed[0]?.tab;

  function isActive(suffix: string, tab?: string) {
    const onRoute = rest === suffix || rest.startsWith(`${suffix}/`);
    if (!onRoute) return false;
    if (!tab) return true;
    return (currentTab ?? defaultTab) === tab;
  }

  return (
    <aside className="hidden w-[212px] shrink-0 lg:block">
      <div className="sticky top-24 rounded-2xl border border-border bg-card p-2.5 backdrop-blur-xl">
        <p className={cn("px-2.5 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.14em]", accentClass(nav.accent, "text"))}>
          {nav.title}
        </p>
        <nav className="flex flex-col gap-0.5">
          {nav.sections.map((section, idx) => {
            const active = isActive(section.suffix, section.tab);
            const Icon = section.icon;
            const showGroup = section.group && section.group !== nav.sections[idx - 1]?.group;
            return (
              <div key={section.key}>
                {showGroup && (
                  <p className="px-2.5 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70 first:pt-1">
                    {section.group}
                  </p>
                )}
                <Link
                  to={`${basePath}${section.suffix}` as any}
                  search={(section.tab ? { tab: section.tab } : {}) as any}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-2xl px-2.5 py-2 text-[12.5px] transition-colors",
                    active
                      ? `${accentClass(nav.accent, "bg")} font-medium text-foreground`
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon
                    className={cn("h-[15px] w-[15px] shrink-0", active ? accentClass(nav.accent, "text") : "text-muted-foreground group-hover:text-foreground")}
                    strokeWidth={active ? 2.2 : 1.8}
                  />
                  <span className="truncate">{section.label}</span>
                </Link>
              </div>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
