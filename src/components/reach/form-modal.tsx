// Componente-base para modais/drawers de cadastro e edição do Reach Brand.
// Único lugar que define overlay, moldura, cabeçalho e rodapé — qualquer
// correção visual feita aqui se propaga para todo o sistema. Ver `overlay-scrim`
// e `surface` em src/styles.css para os tokens usados.
import { FileText, Trash2, UploadCloud } from "lucide-react";
import { X } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Field } from "@/components/ui-reach/primitives";
import { uploadFiles, isImageUrl, type StoredFile } from "@/lib/storage";

const SIZES = {
  sm: "sm:max-w-md",
  md: "sm:max-w-xl",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-3xl",
} as const;

export function FormModal({
  title,
  description,
  onClose,
  children,
  footer,
  size = "md",
  closeOnBackdrop = true,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  /** Ações do rodapé (ex.: Cancelar + Salvar) — fica fixo, fora da área com rolagem. */
  footer?: ReactNode;
  size?: keyof typeof SIZES;
  closeOnBackdrop?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overlay-scrim p-0 sm:items-center sm:p-6"
      onClick={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          "animate-fade-up flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-3xl border border-border/80 bg-card shadow-modal sm:rounded-3xl",
          SIZES[size],
        )}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold tracking-tight">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">{children}</div>

        {footer && <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3.5">{footer}</footer>}
      </div>
    </div>
  );
}

/** Textarea que cresce com o conteúdo em vez de aparecer como um vão vazio
 * gigante — usada em regras, observações e descrições curtas/médias. */
export function AutoTextArea({
  label,
  hint,
  value,
  onChange,
  placeholder,
  minRows = 2,
  disabled,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minRows?: number;
  disabled?: boolean;
}) {
  return (
    <Field label={label} hint={hint}>
      <textarea
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        rows={minRows}
        onChange={(e) => {
          onChange(e.target.value);
          e.target.style.height = "auto";
          e.target.style.height = `${e.target.scrollHeight}px`;
        }}
        className="input-reach resize-none overflow-hidden leading-relaxed"
        style={{ minHeight: `${minRows * 1.6 + 1.2}rem` }}
      />
    </Field>
  );
}

/** Textarea para prompts de IA — tipografia monoespaçada legível, mais
 * altura, contador e botão de copiar. Deixa claro que aquele campo é uma
 * instrução para geração de conteúdo, não um campo de texto comum. */
export function PromptField({
  label = "Prompt",
  hint,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label?: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Field label={label} hint={hint}>
      <div className="overflow-hidden rounded-2xl border border-border bg-surface-sunken">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
          <span className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Prompt de IA</span>
          <div className="flex items-center gap-2">
            <span className="text-[10.5px] text-muted-foreground">{value.length} caracteres</span>
            {value && (
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(value).catch(() => undefined);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="text-[10.5px] font-medium text-primary hover:underline"
              >
                {copied ? "Copiado!" : "Copiar"}
              </button>
            )}
          </div>
        </div>
        <textarea
          value={value}
          placeholder={placeholder ?? "Escreva a instrução que a IA deve seguir para gerar este conteúdo…"}
          disabled={disabled}
          rows={5}
          onChange={(e) => onChange(e.target.value)}
          className="w-full resize-y bg-transparent px-3 py-2.5 font-mono text-[12.5px] leading-relaxed outline-none"
          style={{ minHeight: "8rem" }}
        />
      </div>
    </Field>
  );
}

/** Área de upload discreta (dropzone) com miniaturas — substitui o botão
 * isolado "[ ↑ Anexar ]" por algo que já mostra o que foi anexado. */
export function AttachmentsField({
  label = "Anexos",
  hint,
  files,
  folder,
  onChange,
  disabled,
}: {
  label?: string;
  hint?: string;
  files: StoredFile[];
  folder: string;
  onChange: (files: StoredFile[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function handleFiles(list: FileList | File[] | null) {
    if (!list || (list as FileList).length === 0) return;
    setBusy(true);
    try {
      const uploaded = await uploadFiles(list, folder);
      onChange([...files, ...uploaded]);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <Field label={label} hint={hint}>
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!disabled) handleFiles(e.dataTransfer.files);
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border border-dashed px-4 py-5 text-center transition-colors",
          dragOver ? "border-primary bg-primary-muted" : "border-border hover:bg-muted/50",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <UploadCloud className="h-5 w-5 text-muted-foreground" />
        <p className="text-xs font-medium">{busy ? "Enviando…" : "Arraste arquivos aqui ou clique para adicionar"}</p>
        <input ref={inputRef} type="file" hidden multiple onChange={(e) => handleFiles(e.target.files)} />
      </div>

      {files.length > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {files.map((f) => (
            <div key={f.url} className="group relative flex items-center gap-2 rounded-xl border border-border bg-card p-2">
              {isImageUrl(f.url) ? (
                <img src={f.url} alt={f.name} className="h-9 w-9 shrink-0 rounded-lg object-cover" loading="lazy" />
              ) : (
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted"><FileText className="h-4 w-4 text-muted-foreground" /></span>
              )}
              <a href={f.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-[11.5px] hover:underline">{f.name}</a>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onChange(files.filter((x) => x.url !== f.url))}
                  aria-label={`Remover ${f.name}`}
                  className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Field>
  );
}
