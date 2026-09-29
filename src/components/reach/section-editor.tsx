import { useEffect, useState } from "react";
import { Pencil, Plus, Save, X } from "lucide-react";
import { Panel, PillButton, Chip } from "@/components/reach/ui";
import {
  listCategorias,
  listChannels,
  listPilares,
  newFieldKey,
  updateSectionFields,
  updateSectionTitle,
  type BrandHomeSection,
  type SectionField,
} from "@/lib/reach-data";
import { cn } from "@/lib/utils";

const fieldInputClass = "mt-1 w-full rounded-2xl border border-border bg-background/50 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring";

/** Campo de valor do modelo, de acordo com o tipo definido em Modelos de Plano. */
function FieldInput({ field, brandId, onChange }: { field: SectionField; brandId?: string; onChange: (value: string) => void }) {
  const [refOptions, setRefOptions] = useState<string[] | null>(null);
  const isRef = field.type === "pilares" || field.type === "categorias" || field.type === "canais";

  useEffect(() => {
    if (!isRef || !brandId) return;
    let alive = true;
    (async () => {
      try {
        if (field.type === "pilares") {
          const rows = await listPilares(brandId);
          if (alive) setRefOptions(rows.map((r) => r.name));
        } else if (field.type === "categorias") {
          const rows = await listCategorias(brandId);
          if (alive) setRefOptions(rows.map((r) => r.name));
        } else if (field.type === "canais") {
          const rows = await listChannels(brandId);
          if (alive) setRefOptions(rows.map((r) => r.name));
        }
      } catch {
        if (alive) setRefOptions([]);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field.type, brandId]);

  switch (field.type) {
    case "numero":
      return <input type="number" value={field.value} onChange={(e) => onChange(e.target.value)} className={fieldInputClass} />;
    case "data":
      return <input type="date" value={field.value} onChange={(e) => onChange(e.target.value)} className={fieldInputClass} />;
    case "sim_nao":
      return (
        <select value={field.value} onChange={(e) => onChange(e.target.value)} className={fieldInputClass}>
          <option value="">Selecione…</option>
          <option value="sim">Sim</option>
          <option value="nao">Não</option>
        </select>
      );
    case "escala": {
      const opts = field.options?.length ? field.options : ["1", "2", "3", "4", "5"];
      return (
        <select value={field.value} onChange={(e) => onChange(e.target.value)} className={fieldInputClass}>
          <option value="">Selecione…</option>
          {opts.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    case "selecao":
      return (
        <select value={field.value} onChange={(e) => onChange(e.target.value)} className={fieldInputClass}>
          <option value="">Selecione…</option>
          {(field.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    case "selecao_multipla": {
      const selected = new Set(field.value ? field.value.split(",").map((v) => v.trim()) : []);
      return (
        <div className="mt-1 flex flex-wrap gap-2">
          {(field.options ?? []).map((o) => (
            <label key={o} className={cn("flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs", selected.has(o) && "border-primary bg-primary-soft")}>
              <input
                type="checkbox"
                checked={selected.has(o)}
                onChange={(e) => {
                  if (e.target.checked) selected.add(o);
                  else selected.delete(o);
                  onChange(Array.from(selected).join(", "));
                }}
              />
              {o}
            </label>
          ))}
          {(field.options ?? []).length === 0 && <span className="text-xs text-muted-foreground">Nenhuma opção configurada no modelo.</span>}
        </div>
      );
    }
    case "pilares":
    case "categorias":
    case "canais": {
      const opts = refOptions ?? field.options ?? [];
      return (
        <select value={field.value} onChange={(e) => onChange(e.target.value)} className={fieldInputClass}>
          <option value="">Selecione…</option>
          {opts.map((o) => <option key={o} value={o}>{o}</option>)}
          {opts.length === 0 && <option value="" disabled>Nenhum cadastrado ainda</option>}
        </select>
      );
    }
    case "texto_longo":
    case "lista":
    case "textarea":
      return <textarea value={field.value} onChange={(e) => onChange(e.target.value)} rows={3} className={cn(fieldInputClass, "resize-y")} />;
    default:
      return <input value={field.value} onChange={(e) => onChange(e.target.value)} className={cn(fieldInputClass, "rounded-full")} />;
  }
}

export function SectionEditor({
  section,
  brandId,
  canEdit,
  onSaved,
}: {
  section: BrandHomeSection;
  brandId?: string;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const fields = (section.fields as unknown as SectionField[]) ?? [];
  const [draft, setDraft] = useState<SectionField[]>(fields);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addingField, setAddingField] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [title, setTitle] = useState(section.title);
  const [editingTitle, setEditingTitle] = useState(false);
  const [renamingKey, setRenamingKey] = useState<string | null>(null);

  async function saveTitle() {
    const next = title.trim();
    setEditingTitle(false);
    if (!next || next === section.title) {
      setTitle(section.title);
      return;
    }
    await updateSectionTitle(section.id, next);
    onSaved();
  }

  function renameField(key: string, label: string) {
    setDraft((prev) => prev.map((f) => (f.key === key ? { ...f, label } : f)));
    setDirty(true);
  }

  function setValue(key: string, value: string) {
    setDraft((prev) => prev.map((f) => (f.key === key ? { ...f, value } : f)));
    setDirty(true);
  }

  async function save(next?: SectionField[]) {
    setSaving(true);
    try {
      await updateSectionFields(section.id, next ?? draft);
      setDirty(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function addField() {
    if (!newLabel.trim()) return;
    const field: SectionField = { key: newFieldKey(newLabel), label: newLabel.trim(), type: "texto_curto", value: "" };
    const next = [...draft, field];
    setDraft(next);
    setNewLabel("");
    setAddingField(false);
    await save(next);
  }

  return (
    <Panel
      action={
        canEdit ? (
          <div className="flex items-center gap-2">
            {dirty && (
              <PillButton size="sm" onClick={() => save()} disabled={saving}>
                <Save className="h-3.5 w-3.5" /> {saving ? "Salvando…" : "Salvar"}
              </PillButton>
            )}
            <PillButton size="sm" variant="secondary" onClick={() => setAddingField((v) => !v)}>
              <Plus className="h-3.5 w-3.5" /> Campo
            </PillButton>
          </div>
        ) : undefined
      }
    >
      <header className="mb-4 flex items-center gap-2">
        {editingTitle && canEdit ? (
          <>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveTitle();
                if (e.key === "Escape") {
                  setTitle(section.title);
                  setEditingTitle(false);
                }
              }}
              className="min-w-0 flex-1 rounded-full border border-border bg-background/50 px-4 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <PillButton size="sm" onClick={saveTitle}>Salvar título</PillButton>
            <PillButton size="sm" variant="ghost" onClick={() => { setTitle(section.title); setEditingTitle(false); }} aria-label="Cancelar">
              <X className="h-3.5 w-3.5" />
            </PillButton>
          </>
        ) : (
          <>
            <h2 className="truncate text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">{section.title}</h2>
            {canEdit && (
              <button
                onClick={() => setEditingTitle(true)}
                aria-label={`Editar título da seção ${section.title}`}
                title="Editar título da seção"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </>
        )}
      </header>
      <div className="space-y-4">
        {draft.map((f) => (
          <div key={f.key}>
            {renamingKey === f.key && canEdit ? (
              <div className="mb-1 flex items-center gap-2">
                <input
                  autoFocus
                  value={f.label}
                  onChange={(e) => renameField(f.key, e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && setRenamingKey(null)}
                  className="min-w-0 flex-1 rounded-full border border-border bg-background/50 px-3 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
                />
                <PillButton size="sm" onClick={() => { setRenamingKey(null); save(); }}>Salvar nome</PillButton>
              </div>
            ) : (
              <span className="flex items-center gap-1.5">
                <label className="text-xs text-muted-foreground">
                  {f.label}
                  {f.required && <span className="text-reach-rose"> *</span>}
                </label>
                {canEdit && (
                  <button
                    onClick={() => setRenamingKey(f.key)}
                    aria-label={`Editar nome do campo ${f.label}`}
                    title="Editar nome do campo"
                    className="text-muted-foreground/70 transition-colors hover:text-foreground"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                )}
              </span>
            )}
            {canEdit ? (
              <FieldInput field={f} brandId={brandId} onChange={(v) => setValue(f.key, v)} />
            ) : (
              <p className="mt-1 whitespace-pre-line text-sm">{f.value || "—"}</p>
            )}
          </div>
        ))}
        {draft.length === 0 && <p className="text-sm text-muted-foreground">Nenhum campo ainda.</p>}

        {addingField && canEdit && (
          <div className="flex items-center gap-2 rounded-2xl border border-dashed border-border p-3">
            <input
              autoFocus
              placeholder="Nome do novo campo"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addField()}
              className="min-w-0 flex-1 rounded-full border border-border bg-background/50 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <PillButton size="sm" onClick={addField}>
              Adicionar
            </PillButton>
          </div>
        )}
      </div>
      {!canEdit && <Chip>Somente leitura</Chip>}
    </Panel>
  );
}
