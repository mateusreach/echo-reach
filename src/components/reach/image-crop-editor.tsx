// Editor de enquadramento — configura COMO uma imagem já cadastrada
// (brand.logo_url ou brand.cover_url) deve ser aplicada em contextos
// circulares/retangulares. Não faz upload de um segundo arquivo: só produz
// uma configuração {focalX, focalY, zoom, rotation} que o FramedImage usa
// para renderizar exatamente o mesmo enquadramento em qualquer lugar do
// sistema — a prévia aqui usa o mesmo componente/CSS da renderização real,
// então o que a pessoa vê ao ajustar é o que vai aparecer em todo lugar.
//
// Sistema híbrido de enquadramento: clique define o ponto focal
// diretamente (mais confiável que só arrastar), arrastar continua
// funcionando para ajuste fino, roda do mouse e slider controlam zoom, e
// um grid de posições rápidas cobre os casos mais comuns sem precisar de
// nenhum gesto.
import { useRef, useState } from "react";
import { RotateCcw, ZoomIn } from "lucide-react";
import { PillButton } from "@/components/reach/ui";
import { Btn } from "@/components/ui-reach/primitives";
import { FormModal } from "@/components/reach/form-modal";
import { cn } from "@/lib/utils";
import { FramedImage, DEFAULT_FRAME, type ImageFrame } from "@/components/reach/framed-image";

export type CropShape = "circle" | "rect";

const QUICK_POSITIONS: { label: string; x: number; y: number }[] = [
  { label: "Superior esquerdo", x: 0, y: 0 },
  { label: "Centro superior", x: 50, y: 0 },
  { label: "Superior direito", x: 100, y: 0 },
  { label: "Esquerda", x: 0, y: 50 },
  { label: "Centro", x: 50, y: 50 },
  { label: "Direita", x: 100, y: 50 },
  { label: "Inferior esquerdo", x: 0, y: 100 },
  { label: "Centro inferior", x: 50, y: 100 },
  { label: "Inferior direito", x: 100, y: 100 },
];

export function ImageCropEditor({
  src,
  shape,
  aspect = 1,
  initialFrame,
  title = "Ajustar enquadramento",
  recommendedLabel,
  onCancel,
  onSave,
}: {
  src: string;
  shape: CropShape;
  /** largura / altura da área de aplicação (ex.: 1 para avatar, 4 para capa 4:1). */
  aspect?: number;
  initialFrame?: unknown;
  title?: string;
  recommendedLabel?: string;
  onCancel: () => void;
  onSave: (frame: ImageFrame) => void;
}) {
  const initial: ImageFrame = { ...DEFAULT_FRAME, ...(initialFrame as Partial<ImageFrame> | undefined) };
  const [frame, setFrame] = useState<ImageFrame>(initial);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; fx: number; fy: number; moved: boolean } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const viewportW = 300;
  const viewportH = Math.round(viewportW / aspect);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, fx: frame.focalX, fy: frame.focalY, moved: false };
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging || !dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragStart.current.moved = true;
    // Arrastar para a direita revela mais a região esquerda da imagem —
    // diminui object-position X (sensação de "puxar" a foto com o dedo).
    const nextX = clamp(dragStart.current.fx - (dx / viewportW) * 100, 0, 100);
    const nextY = clamp(dragStart.current.fy - (dy / viewportH) * 100, 0, 100);
    setFrame((f) => ({ ...f, focalX: nextX, focalY: nextY }));
  }
  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    // Clique sem arrastar: define o ponto focal diretamente onde a pessoa
    // tocou — mais previsível do que só arrastar.
    if (dragStart.current && !dragStart.current.moved && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const cx = clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 100);
      const cy = clamp(((e.clientY - rect.top) / rect.height) * 100, 0, 100);
      setFrame((f) => ({ ...f, focalX: cx, focalY: cy }));
    }
    setDragging(false);
    dragStart.current = null;
  }
  function onWheel(e: React.WheelEvent<HTMLDivElement>) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    setFrame((f) => ({ ...f, zoom: clamp(Number((f.zoom + delta).toFixed(2)), 1, 3) }));
  }

  return (
    <FormModal
      title={title}
      description={recommendedLabel}
      onClose={onCancel}
      size="lg"
      footer={
        <>
          <Btn variant="ghost" onClick={() => setFrame(DEFAULT_FRAME)}>
            <RotateCcw className="h-3.5 w-3.5" /> Redefinir
          </Btn>
          <Btn variant="ghost" onClick={onCancel}>Cancelar</Btn>
          <PillButton onClick={() => onSave(frame)}>Salvar</PillButton>
        </>
      }
    >
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-center">
        <div className="flex flex-col items-center gap-2">
          <div
            ref={containerRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={() => { setDragging(false); dragStart.current = null; }}
            onWheel={onWheel}
            className="cursor-grab touch-none border border-border active:cursor-grabbing"
            style={{ width: viewportW, height: viewportH, borderRadius: shape === "circle" ? "9999px" : "1rem" }}
          >
            <FramedImage src={src} frame={frame} shape={shape} className="h-full w-full" />
          </div>
          <p className="max-w-[300px] text-center text-[11px] text-muted-foreground">
            Clique para focar num ponto · arraste para ajustar · role o mouse para zoom
          </p>
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">Prévia</p>
          <FramedImage src={src} frame={frame} shape={shape} className={cn("border border-border", shape === "circle" ? "h-20 w-20" : "h-16 w-24 rounded-lg")} />
        </div>
      </div>

      <div className="mx-auto mt-4 max-w-sm space-y-4">
        <div>
          <p className="mb-1.5 text-[11px] text-muted-foreground">Posicionamento rápido</p>
          <div className="grid grid-cols-3 gap-1.5">
            {QUICK_POSITIONS.map((p) => (
              <button
                key={p.label}
                type="button"
                title={p.label}
                onClick={() => setFrame((f) => ({ ...f, focalX: p.x, focalY: p.y }))}
                className={cn(
                  "grid h-8 place-items-center rounded-lg border text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  frame.focalX === p.x && frame.focalY === p.y ? "border-primary text-primary" : "border-border",
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
          <ZoomIn className="h-4 w-4 text-muted-foreground" />
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setFrame((f) => ({ ...f, zoom: clamp(f.zoom - 0.1, 1, 3) }))} className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-border text-xs">−</button>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={frame.zoom}
              onChange={(e) => setFrame((f) => ({ ...f, zoom: Number(e.target.value) }))}
              className="w-full accent-[var(--primary)]"
            />
            <button type="button" onClick={() => setFrame((f) => ({ ...f, zoom: clamp(f.zoom + 0.1, 1, 3) }))} className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-border text-xs">+</button>
          </div>
          <RotateCcw className="h-4 w-4 text-muted-foreground" />
          <input
            type="range"
            min={-15}
            max={15}
            step={0.5}
            value={frame.rotation}
            onChange={(e) => setFrame((f) => ({ ...f, rotation: Number(e.target.value) }))}
            className="w-full accent-[var(--primary)]"
          />
        </div>
      </div>
    </FormModal>
  );
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

/** Botão "Ajustar aplicação"/"Ajustar enquadramento" — abre o editor sobre
 * a imagem JÁ cadastrada (nunca dispara um novo upload). */
export function FrameConfigButton({
  src,
  shape,
  aspect = 1,
  frame,
  label = "Ajustar enquadramento",
  recommendedLabel,
  onSave,
}: {
  src: string | null | undefined;
  shape: CropShape;
  aspect?: number;
  frame?: unknown;
  label?: string;
  recommendedLabel?: string;
  onSave: (frame: ImageFrame) => void;
}) {
  const [open, setOpen] = useState(false);
  if (!src) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-[12.5px] text-foreground transition-colors hover:bg-muted"
      >
        {label}
      </button>
      {open && (
        <ImageCropEditor
          src={src}
          shape={shape}
          aspect={aspect}
          initialFrame={frame}
          title={label}
          recommendedLabel={recommendedLabel}
          onCancel={() => setOpen(false)}
          onSave={(f) => {
            onSave(f);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
