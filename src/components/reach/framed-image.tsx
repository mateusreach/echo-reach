// Renderização única do enquadramento de logo/capa do cliente. Qualquer
// lugar do sistema que precise mostrar a logo aplicada (avatar circular) ou
// a capa deve usar este componente — nunca um <img> com object-position
// próprio. Um único arquivo original (brand.logo_url / brand.cover_url) +
// uma configuração de enquadramento (brand.logo_frame / brand.cover_frame),
// nunca uma segunda imagem processada.
import { cn } from "@/lib/utils";

export type ImageFrame = {
  /** Posição do foco da imagem, em % (0-100) — equivalente a object-position. */
  focalX: number;
  focalY: number;
  /** Zoom aplicado sobre o "cover" — 1 = ajuste mínimo que cobre o container. */
  zoom: number;
  /** Rotação leve, em graus. */
  rotation: number;
};

export const DEFAULT_FRAME: ImageFrame = { focalX: 50, focalY: 50, zoom: 1, rotation: 0 };

export function parseFrame(raw: unknown): ImageFrame {
  if (!raw || typeof raw !== "object") return DEFAULT_FRAME;
  const f = raw as Partial<ImageFrame>;
  return {
    focalX: typeof f.focalX === "number" ? f.focalX : DEFAULT_FRAME.focalX,
    focalY: typeof f.focalY === "number" ? f.focalY : DEFAULT_FRAME.focalY,
    zoom: typeof f.zoom === "number" && f.zoom > 0 ? f.zoom : DEFAULT_FRAME.zoom,
    rotation: typeof f.rotation === "number" ? f.rotation : DEFAULT_FRAME.rotation,
  };
}

/** Mostra `src` recortado com o mesmo enquadramento em qualquer tamanho de
 * container — a mesma matemática (object-position + transform) é usada no
 * editor (ImageCropEditor) e aqui, então o que a pessoa configura é
 * exatamente o que aparece em todo o sistema, do menor ícone ao hero. */
export function FramedImage({
  src,
  frame,
  shape = "rect",
  className,
  alt = "",
}: {
  src: string | null | undefined;
  frame?: unknown;
  shape?: "circle" | "rect";
  className?: string;
  alt?: string;
}) {
  if (!src) return null;
  const f = parseFrame(frame);
  return (
    <div className={cn("relative overflow-hidden", shape === "circle" ? "rounded-full" : "", className)}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="h-full w-full"
        style={{
          objectFit: "cover",
          objectPosition: `${f.focalX}% ${f.focalY}%`,
          transform: `scale(${f.zoom}) rotate(${f.rotation}deg)`,
          transformOrigin: "center center",
        }}
        onError={(e) => {
          (e.currentTarget.parentElement as HTMLElement).style.display = "none";
        }}
      />
    </div>
  );
}
