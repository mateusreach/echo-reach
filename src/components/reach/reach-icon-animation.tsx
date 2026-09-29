import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import reachIconStatic from "@/assets/reach-brand/icon.svg";
import loadingAnimationUrl from "@/assets/reach-brand/loading.json?url";

export type ReachIconAnimationContext =
  | "boot"
  | "page-loading"
  | "transition"
  | "processing"
  | "empty-state";

const CONTEXT_LABEL: Record<ReachIconAnimationContext, string> = {
  boot: "Carregando Reach Brand",
  "page-loading": "Carregando conteúdo",
  transition: "Carregando página",
  processing: "Processando",
  "empty-state": "Reach Brand",
};

/**
 * Ícone oficial Reach Brand como elemento vivo da experiência: mostra o
 * asset estático imediatamente e, quando `play` está ativo, troca para a
 * animação Lottie (carregada sob demanda, sem pesar o bundle inicial).
 */
export function ReachIconAnimation({
  size = 40,
  loop = true,
  play = true,
  context = "page-loading",
  label,
  className,
}: {
  /** Tamanho (px) do ícone, quadrado. Funciona bem entre 24px e 96px+. */
  size?: number;
  /** Repete a animação continuamente. */
  loop?: boolean;
  /** Quando false, renderiza só o ícone estático — não carrega o player. */
  play?: boolean;
  /** Contexto de uso (só define o aria-label padrão). */
  context?: ReachIconAnimationContext;
  label?: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [animReady, setAnimReady] = useState(false);

  useEffect(() => {
    if (!play) return;
    let cancelled = false;
    let anim: { destroy: () => void } | undefined;

    import("lottie-web/build/player/lottie_light").then(({ default: lottie }) => {
      if (cancelled || !containerRef.current) return;
      anim = lottie.loadAnimation({
        container: containerRef.current,
        renderer: "svg",
        loop,
        autoplay: true,
        path: loadingAnimationUrl,
      });
      setAnimReady(true);
    });

    return () => {
      cancelled = true;
      anim?.destroy();
      setAnimReady(false);
    };
  }, [play, loop]);

  return (
    <span
      className={cn("relative inline-grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? CONTEXT_LABEL[context]}
    >
      <img
        src={reachIconStatic}
        alt=""
        aria-hidden="true"
        className={cn(
          "h-full w-full object-contain transition-opacity duration-200",
          play && animReady ? "opacity-0" : "opacity-100",
        )}
      />
      {play && <div ref={containerRef} className="absolute inset-0" />}
    </span>
  );
}
