import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, Crop, ImagePlus, Loader2, Upload, X } from "lucide-react";
import { uploadFile, uploadFiles, type StoredFile } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { ImageCropEditor } from "@/components/reach/image-crop-editor";
import type { ImageFrame } from "@/components/reach/framed-image";

export function AvatarField({ value, onChange, canEdit = true }: {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  canEdit?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => {
    if (source?.startsWith("blob:")) URL.revokeObjectURL(source);
  }, [source]);

  async function applyCrop(frame: ImageFrame) {
    if (!source) return;
    setBusy(true);
    setError(null);
    try {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.src = source;
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Não foi possível abrir a foto para recorte."));
      });
      const size = 512;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Este navegador não permite recortar a foto.");
      const cover = Math.max(size / image.naturalWidth, size / image.naturalHeight);
      const width = image.naturalWidth * cover;
      const height = image.naturalHeight * cover;
      context.translate(size / 2, size / 2);
      context.rotate((frame.rotation * Math.PI) / 180);
      context.scale(frame.zoom, frame.zoom);
      context.drawImage(
        image,
        (size - width) * frame.focalX / 100 - size / 2,
        (size - height) * frame.focalY / 100 - size / 2,
        width,
        height,
      );
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Falha ao gerar o avatar.")), "image/webp", 0.9),
      );
      const file = new File([blob], `avatar-${Date.now()}.webp`, { type: "image/webp" });
      const uploaded = await uploadFile(file, "pessoas");
      onChange(uploaded.url);
      setSource(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar a foto.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="flex flex-wrap items-center gap-4">
    <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-muted">
      {value ? <img src={value} alt="Foto de perfil" className="h-full w-full object-cover" /> : <Camera className="h-6 w-6 text-muted-foreground" />}
    </div>
    {canEdit && <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy} onClick={() => input.current?.click()} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-xs hover:bg-muted disabled:opacity-60">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} {value ? "Trocar foto" : "Adicionar foto"}
      </button>
      {value && <button type="button" disabled={busy} onClick={() => setSource(value)} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-xs hover:bg-muted disabled:opacity-60"><Crop className="h-4 w-4" /> Reenquadrar</button>}
      {value && <button type="button" disabled={busy} onClick={() => onChange(null)} title="Remover foto" aria-label="Remover foto" className="grid h-9 w-9 place-items-center rounded-md border border-border text-muted-foreground hover:text-destructive disabled:opacity-60"><X className="h-4 w-4" /></button>}
      <input ref={input} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) { setError(null); setSource(URL.createObjectURL(file)); }
        event.target.value = "";
      }} />
    </div>}
    {error && <p role="alert" className="w-full text-xs text-destructive">{error}</p>}
    {source && createPortal(<ImageCropEditor src={source} shape="circle" title="Ajustar foto de perfil" onCancel={() => { if (!busy) setSource(null); }} onSave={(frame) => { if (!busy) void applyCrop(frame); }} />, document.body)}
  </div>;
}

/** Botão de upload real (múltiplos arquivos) — devolve nome + URL persistível. */
export function UploadButton({
  folder,
  multiple = true,
  accept,
  label = "Enviar arquivos",
  onUploaded,
  className,
}: {
  folder: string;
  multiple?: boolean;
  accept?: string;
  label?: string;
  onUploaded: (files: StoredFile[]) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      onUploaded(await uploadFiles(files, folder));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no upload.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <span className={cn("inline-flex flex-col gap-1", className)}>
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-[12.5px] text-foreground transition-colors hover:bg-muted disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        {busy ? "Enviando…" : label}
      </button>
      {error && <span className="text-[11px] text-reach-rose">{error}</span>}
      <input ref={inputRef} type="file" hidden multiple={multiple} accept={accept} onChange={(e) => handle(e.target.files)} />
    </span>
  );
}

/** Campo de imagem única com upload + preview (logo, capa, anexos). O
 * arquivo é sempre a fonte oficial — proporção original preservada aqui,
 * sem nenhum recorte automático. Para configurar como uma imagem é
 * APLICADA (avatar circular, enquadramento de capa), ver FrameConfigButton
 * — são responsabilidades separadas de propósito. */
export function ImageField({
  value,
  folder,
  onChange,
  canEdit = true,
  hint,
  previewClassName,
}: {
  value: string | null | undefined;
  folder: string;
  onChange: (url: string | null) => void;
  canEdit?: boolean;
  hint?: string;
  previewClassName?: string;
}) {
  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative inline-block">
          <img src={value} alt="" loading="lazy" className={cn("max-h-40 rounded-xl border border-border object-contain", previewClassName)} />
          {canEdit && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full border border-border bg-background text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      ) : (
        <div className="grid h-24 w-full max-w-[220px] place-items-center rounded-xl border border-dashed border-border text-muted-foreground">
          <ImagePlus className="h-5 w-5" />
        </div>
      )}
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <UploadButton
            folder={folder}
            multiple={false}
            accept="image/*"
            label={value ? "Trocar imagem" : "Enviar imagem"}
            onUploaded={(files) => files[0] && onChange(files[0].url)}
          />
          {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
        </div>
      )}
    </div>
  );
}
