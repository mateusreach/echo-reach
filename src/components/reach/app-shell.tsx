import { getStoredTheme, setTheme } from "@/lib/branding";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  Boxes,
  Compass,
  Home,
  Images,
  LayoutGrid,
  LineChart,
  Menu,
  MessageSquare,
  PanelRight,
  Radar,
  Search,
  Sparkles,
  Star,
  Target,
  Timer,
  Radio,
  History,
  FileStack,
  Moon,
  Sun,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { brand } from "@/lib/brand-data";
import { cn } from "@/lib/utils";
import { PillButton, ReachMark } from "./ui";

const nav = [
  { to: "/", label: "Brand Home", icon: Home },
  { to: "/estrutura", label: "Estrutura da Marca", icon: Boxes },
  { to: "/editorial", label: "Biblioteca Editorial", icon: BookOpen },
  { to: "/criativa", label: "Biblioteca Criativa", icon: Images },
  { to: "/referencias", label: "Referências", icon: FileStack },
  { to: "/radar", label: "Radar", icon: Radar },
  { to: "/mercado", label: "Mercado", icon: Compass },
  { to: "/canais", label: "Canais", icon: Radio },
  { to: "/resultados", label: "Resultados", icon: LineChart },
  { to: "/evolucao", label: "Evolução da Marca", icon: History },
  { to: "/especialistas-ia", label: "Especialistas IA", icon: Sparkles },
  { to: "/pesquisa", label: "Pesquisa Global", icon: Search },
] as const;

const favorites = [
  { to: "/estrutura", label: "Posicionamento" },
  { to: "/editorial", label: "Pilares narrativos" },
  { to: "/espaco-360", label: "Campanhas 2026" },
];

function useTheme() {
  // Claro por padrão (mesma linguagem do Reach Workspace); respeita a escolha salva.
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(getStoredTheme() === "dark");
  }, []);
  useEffect(() => {
    setTheme(dark ? "dark" : "light");
  }, [dark]);
  return { dark, toggle: () => setDark((d) => !d) };
}

export function AppShell({
  children,
  context,
  basePath = "",
  brandName,
  brandSegment,
}: {
  children: ReactNode;
  context?: { title: string; items: { label: string; value: string }[] };
  basePath?: string;
  brandName?: string;
  brandSegment?: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const { dark, toggle } = useTheme();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const activeBrandName = brandName ?? brand.name;
  const activeBrandSegment = brandSegment ?? brand.segment;
  const withBase = (to: string) => (to === "/" ? basePath || "/" : `${basePath}${to}`);

  const ctx = context ?? {
    title: "Contexto",
    items: [
      { label: "Relacionamentos", value: "12 itens vinculados" },
      { label: "Arquivos", value: "8 documentos" },
      { label: "Comentários", value: "3 abertos" },
      { label: "Histórico", value: "Atualizado hoje" },
    ],
  };

  return (
    <div className="min-h-screen">
      <header className="glass sticky top-0 z-40 flex h-16 items-center gap-3 px-3 sm:px-5">
        <PillButton variant="icon" size="icon" aria-label="Alternar menu" onClick={() => setCollapsed((c) => !c)}>
          <Menu className="h-4 w-4" />
        </PillButton>
        <Link to={withBase("/") as any} className="flex min-w-0 items-center gap-2.5">
          <ReachMark />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold leading-tight">Reach Echo</span>
            <span className="block truncate text-[11px] text-muted-foreground">Brand</span>
          </span>
        </Link>
        <div className="mx-auto hidden w-full max-w-md items-center gap-2 rounded-full border border-border/60 bg-background/40 px-4 py-2 text-sm text-muted-foreground md:flex">
          <Search className="h-4 w-4" />
          <span>Buscar em {activeBrandName}…</span>
        </div>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <PillButton variant="icon" size="icon" aria-label="Alternar tema" onClick={toggle}>
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </PillButton>
          <PillButton
            variant="icon"
            size="icon"
            aria-label="Painel contextual"
            onClick={() => setPanelOpen((p) => !p)}
          >
            <PanelRight className="h-4 w-4" />
          </PillButton>
          <span className="hidden h-9 items-center rounded-full gradient-brand px-3 text-xs font-semibold text-primary-foreground sm:inline-flex">
            RB
          </span>
        </div>
      </header>

      <div className="flex">
        <aside
          className={cn(
            "glass sticky top-16 hidden h-[calc(100vh-4rem)] shrink-0 flex-col gap-1 overflow-y-auto p-3 transition-all md:flex",
            collapsed ? "w-[72px]" : "w-64",
          )}
        >
          {nav.map((item) => {
            const active = pathname === withBase(item.to);
            return (
              <Link
                key={item.to}
                to={withBase(item.to) as any}
                className={cn(
                  "flex items-center gap-3 rounded-full px-3 py-2 text-sm transition-colors",
                  active
                    ? "gradient-brand text-primary-foreground shadow-glow"
                    : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}

          <div className="my-3 h-px bg-border" />

          <Link
            to={withBase("/espaco-360") as any}
            className={cn(
              "flex items-center gap-3 rounded-full border border-brand/40 px-3 py-2 text-sm transition-colors",
              pathname === withBase("/espaco-360")
                ? "gradient-brand text-primary-foreground shadow-glow"
                : "text-foreground hover:bg-accent/40",
            )}
          >
            <Target className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">Espaço 360</span>}
          </Link>

          {!collapsed && (
            <div className="mt-5">
              <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Favoritos
              </p>
              <div className="mt-2 flex flex-col">
                {favorites.map((f) => (
                  <Link
                    key={f.label}
                    to={withBase(f.to) as any}
                    className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <Star className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{f.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {!collapsed && (
            <div className="mt-auto pt-6">
              <a
                href="https://lovable.dev"
                className="block rounded-2xl border border-border/60 p-3 text-[11px] leading-relaxed text-muted-foreground transition-colors hover:text-foreground"
              >
                <span className="text-gradient-brand font-semibold">Reach Echo</span>
                <br />
                Brand · Workspace
              </a>
            </div>
          )}
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-10">
          <div className="mx-auto max-w-5xl space-y-8">{children}</div>
          <footer className="mx-auto mt-16 max-w-5xl border-t border-border/60 pt-6 text-xs text-muted-foreground">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <p className="min-w-0 truncate">
                Reach Echo · Brand · {activeBrandName}{activeBrandSegment ? ` · ${activeBrandSegment}` : ""}
              </p>
              <span className="shrink-0 rounded-full border border-border/60 px-3 py-1">
                Reach Echo · Brand · Workspace
              </span>
            </div>
          </footer>
        </main>

        {panelOpen && (
          <aside className="glass sticky top-16 hidden h-[calc(100vh-4rem)] w-72 shrink-0 flex-col gap-4 overflow-y-auto p-5 xl:flex">
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {ctx.title}
            </h2>
            <div className="space-y-3">
              {ctx.items.map((i) => (
                <div key={i.label} className="rounded-2xl border border-border/60 p-3">
                  <p className="text-xs text-muted-foreground">{i.label}</p>
                  <p className="mt-0.5 text-sm">{i.value}</p>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-border/60 p-3">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-brand" /> Especialistas IA
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Pergunte algo usando todo o contexto de {brand.name}.
              </p>
              <PillButton variant="secondary" size="sm" className="mt-3 w-full">
                <MessageSquare className="h-3.5 w-3.5" /> Abrir painel
              </PillButton>
            </div>
            <div className="mt-auto flex items-center gap-2 text-xs text-muted-foreground">
              <Timer className="h-3.5 w-3.5" /> Última decisão registrada há 2 dias
            </div>
          </aside>
        )}
      </div>

      <nav className="glass fixed inset-x-0 bottom-0 z-40 flex items-center justify-around px-2 py-2 md:hidden">
        {[nav[0], nav[1], nav[2], { to: "/espaco-360", label: "360", icon: Target }, nav[11]].map((item) => (
          <Link
            key={item.to}
            to={withBase(item.to) as any}
            className={cn(
              "grid h-10 w-10 place-items-center rounded-full",
              pathname === withBase(item.to) ? "gradient-brand text-primary-foreground" : "text-muted-foreground",
            )}
            aria-label={item.label}
          >
            <item.icon className="h-4 w-4" />
          </Link>
        ))}
      </nav>
      <div className="h-14 md:hidden" />
      <LayoutGrid className="hidden" />
    </div>
  );
}
