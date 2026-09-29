import { Link } from "@tanstack/react-router";
import { ArrowLeft, BarChart3, BookOpen, CalendarDays, CalendarRange, Settings2, Workflow } from "lucide-react";
import type { ReactNode } from "react";
import { ReachBackground } from "./background";
import { ReachMark } from "./ui";
import { applyBrandColors, applyTheme, getStoredTheme } from "@/lib/branding";
import { useEffect } from "react";

const NAV_CHIP =
  "inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-border px-4 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:min-h-9 sm:px-3 sm:text-xs";
const NAV_CHIP_ACTIVE =
  "inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-primary/40 bg-primary/10 px-4 text-[13px] font-medium text-foreground sm:min-h-9 sm:px-3 sm:text-xs";

/** The plan and execution area has its own shell outside Brand. */
export function SpaceShell({
  children,
  brandSlug,
  brandName,
  primaryColor,
  accentColor,
}: {
  children: ReactNode;
  brandSlug: string;
  brandName: string;
  primaryColor?: string | null;
  accentColor?: string | null;
}) {
  useEffect(() => applyTheme(getStoredTheme()), []);
  useEffect(() => {
    applyBrandColors(primaryColor, accentColor);
    return () => applyBrandColors(null, null);
  }, [primaryColor, accentColor]);

  return (
    <div className="relative min-h-screen">
      <ReachBackground />
      <div className="relative z-10 mx-auto max-w-7xl px-4 pb-28 pt-0 sm:px-8 sm:pb-20 sm:pt-5">
        {/* Cabeçalho fixo e compacto: no celular vira uma linha de título + uma faixa de atalhos
            com rolagem horizontal (botões de 44 px), em vez de vários botões pequenos empilhados. */}
        <header className="sticky top-0 z-30 -mx-4 mb-4 border-b border-border/70 bg-background/85 backdrop-blur-xl sm:static sm:mx-0 sm:mb-6 sm:rounded-3xl sm:border sm:bg-transparent sm:backdrop-blur-none glass">
          <div className="flex min-w-0 items-center gap-2 px-4 pb-1 pt-2 sm:px-4 sm:pt-3">
            <Link to="/" className="flex h-11 shrink-0 items-center gap-2 text-sm font-semibold" aria-label="Home do Echo">
              <ReachMark className="h-8 w-8" />
              <span className="hidden min-[380px]:inline">Echo</span>
            </Link>
            <span className="h-6 w-px shrink-0 bg-border" aria-hidden />
            <Link to="/e360" className="hidden shrink-0 text-sm text-muted-foreground hover:text-foreground sm:inline">Espaço 360</Link>
            <span className="hidden shrink-0 text-sm text-muted-foreground sm:inline">/</span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{brandName}</span>
            <Link to="/e360" className="inline-flex h-11 shrink-0 items-center gap-1 rounded-full px-3 text-xs text-muted-foreground hover:text-foreground sm:hidden" aria-label="Todos os espaços">
              <ArrowLeft className="h-4 w-4" /> Espaços
            </Link>
          </div>
          <nav
            aria-label="Áreas do cliente"
            className="scrollbar-none flex items-center gap-1.5 overflow-x-auto px-4 pb-2 pt-1 sm:flex-wrap sm:overflow-visible sm:pb-3"
          >
            <Link to="/e360/$brandSlug" params={{ brandSlug }} search={{ tab: undefined, filtro: undefined }} activeOptions={{ exact: true }} className={NAV_CHIP} activeProps={{ className: NAV_CHIP_ACTIVE }}>Execução</Link>
            <Link to="/e360/$brandSlug/plano" params={{ brandSlug }} search={{ tab: undefined, filtro: undefined }} className={NAV_CHIP} activeProps={{ className: NAV_CHIP_ACTIVE }}><CalendarRange className="h-4 w-4" /> Plano</Link>
            <Link to="/e360/$brandSlug/agenda" params={{ brandSlug }} search={{ tab: undefined, filtro: undefined }} className={NAV_CHIP} activeProps={{ className: NAV_CHIP_ACTIVE }}><CalendarDays className="h-4 w-4" /> Agenda</Link>
            <Link to="/e360/$brandSlug/resultados" params={{ brandSlug }} search={{ tab: undefined, filtro: undefined }} className={NAV_CHIP} activeProps={{ className: NAV_CHIP_ACTIVE }}><BarChart3 className="h-4 w-4" /> Resultados</Link>
            <Link to="/e360/$brandSlug/personalizacao" params={{ brandSlug }} search={{ tab: undefined, filtro: undefined }} className={NAV_CHIP} activeProps={{ className: NAV_CHIP_ACTIVE }}><Settings2 className="h-4 w-4" /> Personalização</Link>
            <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden />
            <Link to="/b/$brandSlug/biblioteca" params={{ brandSlug }} search={{ tab: undefined }} className={NAV_CHIP}><BookOpen className="h-4 w-4" /> Branding Space</Link>
            <Link to="/workspace/cliente/$brandSlug" params={{ brandSlug }} className={NAV_CHIP}><Workflow className="h-4 w-4" /> Workspace</Link>
          </nav>
        </header>
        <Link to="/e360" className="mb-4 hidden items-center gap-1 text-xs text-muted-foreground hover:text-foreground sm:inline-flex"><ArrowLeft className="h-3.5 w-3.5" /> Todos os espaços</Link>
        {children}
      </div>
    </div>
  );
}
