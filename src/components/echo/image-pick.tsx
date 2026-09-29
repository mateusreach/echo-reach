// Echo · Escolha de imagem: prévia, enviar/trocar/remover, até 2 MB.
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "./primitives";
import { Icon } from "./icon";
import { isDemoMode } from "@/lib/home-data";

export function ImagePick({ label, value, onChange, disabled, round, hint, folder = "marca-plataforma", wide }: { label: string; value: string | null; onChange: (v: string | null) => void; disabled?: boolean; round?: boolean; hint: string; folder?: string; wide?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const pick = async (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast.error("Escolha um arquivo de imagem."); return; }
    if (f.size > 2 * 1024 * 1024) { toast.error("A imagem precisa ter até 2 MB."); return; }
    setBusy(true);
    try {
      if (isDemoMode()) onChange(URL.createObjectURL(f));
      else { const { uploadFile } = await import("@/lib/storage"); onChange((await uploadFile(f, folder)).url); }
    } catch { toast.error("Não foi possível enviar a imagem."); } finally { setBusy(false); }
  };
  return (
    <div className="e-field">
      <span className="e-field-label">{label}</span>
      <div className="img-pick">
        <span className={`img-pick-prev${round ? " round" : ""}${wide ? " wide" : ""}`}>{value ? <img src={value} alt="" /> : <Icon name="image" />}</span>
        <div className="e-stack" style={{ gap: 6 }}>
          <div className="e-row" style={{ gap: 6 }}>
            <Button size="sm" variant="secondary" icon="upload" loading={busy} disabled={disabled} onClick={() => input.current?.click()}>{value ? "Trocar" : "Enviar"}</Button>
            {value && <Button size="sm" variant="ghost" disabled={disabled} onClick={() => onChange(null)}>Remover</Button>}
          </div>
          <span className="e-caption">{hint}</span>
        </div>
        <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
    </div>
  );
}

