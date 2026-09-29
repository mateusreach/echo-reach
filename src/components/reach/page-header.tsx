import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { FramedImage } from "@/components/reach/framed-image";

/** Proporção real usada pela capa do cliente neste componente — é a fonte
 * de verdade também para a orientação de dimensão mostrada no editor de
 * enquadramento (ver FrameConfigButton na Identidade do cliente). */
export const COVER_ASPECT_RATIO = "4 / 1";
export const COVER_ASPECT_NUMBER = 4;

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  coverUrl,
  coverFrame,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Capa do cliente (brand.cover_url) — quando presente, vira o hero da página. */
  coverUrl?: string | null;
  /** Enquadramento salvo da capa (brand.cover_frame) — mesma configuração usada em todo o sistema. */
  coverFrame?: unknown;
}) {
  if (coverUrl) {
    return (
      <header className="mb-8 overflow-hidden rounded-3xl border border-border">
        <div className="relative w-full" style={{ aspectRatio: COVER_ASPECT_RATIO, maxHeight: 220 }}>
          <FramedImage src={coverUrl} frame={coverFrame} shape="rect" className="absolute inset-0 h-full w-full" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-4 p-5 sm:p-6">
            <div className="min-w-0">
              {eyebrow && <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-white/80">{eyebrow}</div>}
              <h1 className="truncate text-2xl font-semibold tracking-tight text-white drop-shadow-sm sm:text-3xl">{title}</h1>
              {description && <p className="mt-1.5 hidden max-w-2xl text-[13.5px] leading-relaxed text-white/85 sm:block">{description}</p>}
            </div>
            {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className={cn("mb-8 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-6")}>
      <div className="min-w-0">
        {eyebrow && <div className="mb-2 text-label">{eyebrow}</div>}
        <h1 className="text-display truncate">{title}</h1>
        {description && (
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
