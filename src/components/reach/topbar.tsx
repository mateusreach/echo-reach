import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { getModuleNav } from "@/lib/nav";
import { Bell, Search, ChevronRight, ArrowLeft } from "lucide-react";
import { FramedImage } from "./framed-image";
import type { BrandModules } from "@/lib/reach-data";

function useBreadcrumb(basePath: string, brandName?: string | null, isAgencyUser = true) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.search as Record<string, unknown> });
  const crumbs: Array<{ label: string; to?: string }> = [
    ...(isAgencyUser ? [{ label: "Perfil da Agência", to: "/agencia" }] : []),
    { label: brandName ?? "Cliente", to: basePath },
  ];
  const nav = getModuleNav(basePath, pathname);
  if (!nav) return crumbs;
  crumbs.push({ label: nav.title, to: `${basePath}${nav.sections[0]?.suffix ?? ""}` });
  const rest = pathname.slice(basePath.length);
  const tab = typeof search?.tab === "string" ? search.tab : undefined;
  const section =
    nav.sections.find((s) => s.suffix === rest && (s.tab ? s.tab === tab : true)) ??
    nav.sections.find((s) => s.suffix === rest);
  if (section && section.label !== nav.title) crumbs.push({ label: section.label });
  return crumbs;
}

const NOTIFICATIONS = [
  { id: "1", title: "Campanha aguardando aprovação", body: "Verifique o Planejamento", time: "recente", tone: "text-reach-amber" },
];

export function BrandTopbar({
  basePath,
  onOpenPalette,
  brandName,
  brandLogoUrl,
  brandLogoFrame,
  isAgencyUser = true,
}: {
  basePath: string;
  onOpenPalette: () => void;
  brandName?: string | null;
  brandLogoUrl?: string | null;
  brandLogoFrame?: unknown;
  modules?: BrandModules | null;
  isAgencyUser?: boolean;
}) {
  const crumbs = useBreadcrumb(basePath, brandName, isAgencyUser);
  const [open, setOpen] = useState(false);

  return (
    <div className="sticky top-0 z-30 -mx-8 mb-8 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border bg-background/60 px-8 py-3 backdrop-blur-xl">
      <div className="flex min-w-0 items-center gap-4">
        {isAgencyUser && <Link
          to="/agencia"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[12px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Clientes
        </Link>}
        <span className="hidden shrink-0 items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-3 sm:inline-flex">
          <span className="grid h-6 w-6 place-items-center overflow-hidden rounded-full border border-border bg-linear-to-br from-reach-coral/10 to-reach-violet/10 text-[10px] font-semibold">
            {brandLogoUrl ? (
              <FramedImage src={brandLogoUrl} frame={brandLogoFrame} shape="circle" className="h-full w-full" alt={brandName ? `Logo ${brandName}` : "Logo do cliente"} />
            ) : (
              (brandName ?? "C").slice(0, 1).toUpperCase()
            )}
          </span>
          <span className="max-w-[160px] truncate text-[12px] font-medium">{brandName ?? "Cliente"}</span>
        </span>
        <nav aria-label="Navegação estrutural" className="hidden min-w-0 items-center gap-1 text-[12.5px] lg:flex">
          {crumbs.map((crumb, i) => (
            <span key={`${crumb.label}-${i}`} className="flex min-w-0 items-center gap-1">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />}
              {crumb.to && i < crumbs.length - 1 ? (
                <Link to={crumb.to as any} className="truncate capitalize text-muted-foreground transition-colors hover:text-foreground">
                  {crumb.label}
                </Link>
              ) : (
                <span className="truncate font-medium capitalize">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>


        {isAgencyUser && <button
          onClick={onOpenPalette}
          className="group flex w-full max-w-xs items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-2 text-left transition-colors hover:bg-muted md:ml-auto"
        >
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate text-[13px] text-muted-foreground">Buscar em tudo…</span>
        </button>}
      </div>

      <div className="relative flex items-center gap-2">
        <button
          aria-label="Notificações"
          onClick={() => setOpen((v) => !v)}
          className="relative grid h-9 w-9 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-reach-coral px-1 text-[10px] font-semibold text-primary-foreground">
            {NOTIFICATIONS.length}
          </span>
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-2xl border border-border bg-card/95 shadow-soft backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <span className="text-[12.5px] font-semibold">Notificações</span>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {NOTIFICATIONS.map((item) => (
                  <div key={item.id} className="block w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted">
                    <div className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-reach-coral" />
                      <div className="min-w-0 flex-1">
                        <div className={`truncate text-[12.5px] font-medium ${item.tone}`}>{item.title}</div>
                        <div className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{item.body}</div>
                        <div className="mt-1 text-[10.5px] text-muted-foreground/70">{item.time}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
