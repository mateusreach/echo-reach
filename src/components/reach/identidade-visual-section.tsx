// Acabamento da Marca → Identidade Visual: Master (regra geral da marca) +
// Canais (adaptação por canal, herdando cores da Master por referência) +
// Presets (regra técnica de produção) + Modelos (tipo de conteúdo) +
// Referências (reaproveita ReferenciasPanel) + Prompts.
import { useEffect, useState } from "react";
import { ChevronDown, ChevronLeft, Copy, Plus, Trash2 } from "lucide-react";
import { GlassCard } from "@/components/reach/glass-card";
import { Btn, Field, TextArea, TextInput, SelectInput } from "@/components/ui-reach/primitives";
import { PillButton } from "@/components/reach/ui";
import { ReferenciasPanel } from "@/components/reach/referencias-panel";
import { AttachmentsField, AutoTextArea, FormModal, PromptField } from "@/components/reach/form-modal";
import { cn } from "@/lib/utils";
import type { StoredFile } from "@/lib/storage";
import {
  COLOR_CATEGORIES,
  CONTENT_FORMATS,
  SUGGESTED_CHANNELS,
  SUGGESTED_MODEL_NAMES,
  SUGGESTED_PRESETS,
  createChannel,
  createColor,
  createModel,
  createPreset,
  deleteChannel,
  deleteColor,
  deleteModel,
  deletePreset,
  duplicateModel,
  duplicatePreset,
  getBrandIdentityMaster,
  hexToRgbString,
  listChannelColors,
  listChannelMasterColorRefs,
  listChannels,
  listMasterColors,
  listModels,
  listPresets,
  previewNamingPattern,
  saveBrandIdentityMaster,
  setChannelMasterColorRefs,
  updateChannel,
  updateColor,
  updateModel,
  updatePreset,
  type BrandIdentityChannel,
  type BrandIdentityColor,
  type BrandIdentityMaster,
  type BrandIdentityModel,
  type BrandIdentityPreset,
} from "@/lib/identity-data";

export function IdentidadeVisualSection({ brandId, brandName, canEdit }: { brandId: string; brandName: string; canEdit: boolean }) {
  const [channels, setChannels] = useState<BrandIdentityChannel[]>([]);
  const [selected, setSelected] = useState<BrandIdentityChannel | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshChannels() {
    setChannels(await listChannels(brandId));
  }

  useEffect(() => {
    refreshChannels()
      .catch(() => undefined)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

  useEffect(() => {
    if (selected) {
      const fresh = channels.find((c) => c.id === selected.id);
      if (fresh) setSelected(fresh);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels]);

  return (
    <GlassCard level={2} className="space-y-6 p-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Identidade Visual</h2>
        <p className="text-sm text-muted-foreground">Regra geral da marca e adaptação por canal — paleta, presets de produção, modelos de conteúdo e prompts.</p>
      </div>

      <MasterCard brandId={brandId} canEdit={canEdit} />

      {selected ? (
        <ChannelDetail
          brandId={brandId}
          brandName={brandName}
          channel={selected}
          canEdit={canEdit}
          onBack={() => setSelected(null)}
          onChanged={refreshChannels}
        />
      ) : (
        <ChannelsGrid
          brandId={brandId}
          channels={channels}
          loading={loading}
          canEdit={canEdit}
          onOpen={setSelected}
          onChanged={refreshChannels}
        />
      )}
    </GlassCard>
  );
}

// ---------------------------------------------------------------------------
// Identidade Visual Master
// ---------------------------------------------------------------------------

function MasterCard({ brandId, canEdit }: { brandId: string; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [master, setMaster] = useState<BrandIdentityMaster | null>(null);
  const [colors, setColors] = useState<BrandIdentityColor[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function refresh() {
    const [m, c] = await Promise.all([getBrandIdentityMaster(brandId), listMasterColors(brandId)]);
    setMaster(m);
    setColors(c);
    setLoaded(true);
  }

  useEffect(() => {
    if (open && !loaded) refresh().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const draft = master ?? {
    brand_id: brandId,
    typography: "",
    graphic_elements: "",
    photo_direction: "",
    visual_direction: "",
    icon_style: "",
    general_rules: "",
    manual_attachments: [] as StoredFile[],
  };

  async function save(patch: Partial<BrandIdentityMaster>) {
    setSaving(true);
    try {
      const next = await saveBrandIdentityMaster(brandId, { ...draft, ...patch });
      setMaster(next);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left">
        <div>
          <p className="text-sm font-semibold">Identidade Master</p>
          <p className="text-xs text-muted-foreground">Regra geral da marca — independente de canal.</p>
        </div>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-5 border-t border-border p-4">
          {!loaded ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (
            <>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Paleta principal</p>
                <ColorPaletteEditor brandId={brandId} channelId={null} colors={colors} canEdit={canEdit} onChanged={refresh} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Tipografia">
                  <TextArea rows={2} defaultValue={draft.typography ?? ""} disabled={!canEdit} onBlur={(e) => save({ typography: e.target.value })} />
                </Field>
                <Field label="Elementos gráficos">
                  <TextArea rows={2} defaultValue={draft.graphic_elements ?? ""} disabled={!canEdit} onBlur={(e) => save({ graphic_elements: e.target.value })} />
                </Field>
                <Field label="Direção fotográfica">
                  <TextArea rows={2} defaultValue={draft.photo_direction ?? ""} disabled={!canEdit} onBlur={(e) => save({ photo_direction: e.target.value })} />
                </Field>
                <Field label="Direção visual">
                  <TextArea rows={2} defaultValue={draft.visual_direction ?? ""} disabled={!canEdit} onBlur={(e) => save({ visual_direction: e.target.value })} />
                </Field>
                <Field label="Estilo de ícones">
                  <TextArea rows={2} defaultValue={draft.icon_style ?? ""} disabled={!canEdit} onBlur={(e) => save({ icon_style: e.target.value })} />
                </Field>
                <Field label="Regras gerais de aplicação">
                  <TextArea rows={2} defaultValue={draft.general_rules ?? ""} disabled={!canEdit} onBlur={(e) => save({ general_rules: e.target.value })} />
                </Field>
              </div>

              <AttachmentsField
                label="Anexos / manual da marca"
                files={draft.manual_attachments ?? []}
                folder="identidade-visual/manual"
                disabled={!canEdit}
                onChange={(files) => save({ manual_attachments: files })}
              />
              {saving && <p className="text-[11px] text-muted-foreground">Salvando…</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Paleta de cores — reutilizada pela Master e por cada canal
// ---------------------------------------------------------------------------

export function ColorPaletteEditor({
  brandId,
  channelId,
  colors,
  canEdit,
  onChanged,
}: {
  brandId: string;
  channelId: string | null;
  colors: BrandIdentityColor[];
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);

  async function add(name: string) {
    await createColor({ brand_id: brandId, channel_id: channelId, name, category: "primaria" });
    setAdding(false);
    onChanged();
  }

  return (
    <div className="space-y-2">
      {colors.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma cor cadastrada ainda.</p>}
      <div className="space-y-1.5">
        {colors.map((c) => (
          <ColorRow key={c.id} color={c} canEdit={canEdit} onChanged={onChanged} />
        ))}
      </div>
      {canEdit &&
        (adding ? (
          <NewColorInline onCancel={() => setAdding(false)} onCreate={add} />
        ) : (
          <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
            <Plus className="h-3.5 w-3.5" /> Adicionar cor
          </button>
        ))}
    </div>
  );
}

function NewColorInline({ onCreate, onCancel }: { onCreate: (name: string) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  return (
    <div className="flex items-center gap-2">
      <TextInput autoFocus placeholder="Nome da cor" value={name} onChange={(e) => setName(e.target.value)} className="max-w-[220px]" />
      <Btn size="sm" onClick={() => name.trim() && onCreate(name.trim())}>Adicionar</Btn>
      <Btn size="sm" variant="ghost" onClick={onCancel}>Cancelar</Btn>
    </div>
  );
}

function ColorRow({ color, canEdit, onChanged }: { color: BrandIdentityColor; canEdit: boolean; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(color);

  useEffect(() => setDraft(color), [color]);

  async function save() {
    await updateColor(color.id, {
      name: draft.name,
      hex: draft.hex,
      cmyk: draft.cmyk,
      pantone: draft.pantone,
      category: draft.category,
      note: draft.note,
    });
    setEditing(false);
    onChanged();
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border px-3 py-2">
        <span
          className="h-7 w-7 shrink-0 rounded-full border border-border"
          style={{ backgroundColor: color.hex ?? "#e5e5e5" }}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-medium">
            {color.name}
            {color.source !== "manual" && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 align-middle text-[9.5px] font-normal text-muted-foreground">
                Extraída da {color.source === "logo" ? "logo" : "capa"}
              </span>
            )}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {color.hex ?? "—"} {color.rgb && `· RGB ${color.rgb}`} · {COLOR_CATEGORIES.find((c) => c.key === color.category)?.label ?? color.category}
          </p>
        </div>
        {canEdit && (
          <div className="flex shrink-0 items-center gap-1">
            <button onClick={() => setEditing(true)} className="rounded-full border border-border px-2.5 py-1 text-[10.5px]">Editar</button>
            <button onClick={async () => { await deleteColor(color.id); onChanged(); }} aria-label="Remover cor" className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    );
  }

  const rgbPreview = draft.hex ? hexToRgbString(draft.hex) : null;

  return (
    <div className="space-y-2 rounded-xl border border-border p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <TextInput placeholder="Nome" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
        <SelectInput value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}>
          {COLOR_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </SelectInput>
        <div className="flex items-center gap-2">
          <input type="color" value={draft.hex && /^#/.test(draft.hex) ? draft.hex : "#ff6b4a"} onChange={(e) => setDraft((d) => ({ ...d, hex: e.target.value }))} className="h-10 w-12 shrink-0 rounded-lg border border-border bg-background/50" />
          <TextInput placeholder="#HEX" value={draft.hex ?? ""} onChange={(e) => setDraft((d) => ({ ...d, hex: e.target.value }))} />
        </div>
        <TextInput placeholder="RGB (automático)" value={rgbPreview ?? draft.rgb ?? ""} disabled />
        <TextInput placeholder="CMYK (opcional)" value={draft.cmyk ?? ""} onChange={(e) => setDraft((d) => ({ ...d, cmyk: e.target.value }))} />
        <TextInput placeholder="Pantone (opcional)" value={draft.pantone ?? ""} onChange={(e) => setDraft((d) => ({ ...d, pantone: e.target.value }))} />
      </div>
      <TextArea rows={2} placeholder="Observação de uso" value={draft.note ?? ""} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} />
      <div className="flex items-center gap-2">
        <Btn size="sm" variant="primary" onClick={save}>Salvar</Btn>
        <Btn size="sm" variant="ghost" onClick={() => { setDraft(color); setEditing(false); }}>Cancelar</Btn>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grid de canais
// ---------------------------------------------------------------------------

function ChannelsGrid({
  brandId,
  channels,
  loading,
  canEdit,
  onOpen,
  onChanged,
}: {
  brandId: string;
  channels: BrandIdentityChannel[];
  loading: boolean;
  canEdit: boolean;
  onOpen: (c: BrandIdentityChannel) => void;
  onChanged: () => void;
}) {
  const [customName, setCustomName] = useState("");
  const missingSuggested = SUGGESTED_CHANNELS.filter((s) => !channels.some((c) => c.key === s.key));

  async function add(name: string, key?: string) {
    await createChannel(brandId, name, key);
    setCustomName("");
    onChanged();
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Canais</p>
      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando canais…</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {channels.map((c) => (
            <button key={c.id} onClick={() => onOpen(c)} className={cn("surface flex flex-col items-start gap-1 rounded-2xl p-4 text-left transition-transform hover:-translate-y-0.5", !c.active && "opacity-50")}>
              <p className="text-sm font-medium">{c.name}</p>
              <p className="text-[11px] text-muted-foreground">{c.active ? "Ativo" : "Inativo"}</p>
            </button>
          ))}
          {channels.length === 0 && <p className="text-sm text-muted-foreground">Nenhum canal configurado ainda.</p>}
        </div>
      )}

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {missingSuggested.map((s) => (
            <button key={s.key} onClick={() => add(s.name, s.key)} className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
              <Plus className="h-3.5 w-3.5" /> {s.name}
            </button>
          ))}
          <div className="flex items-center gap-1.5">
            <TextInput placeholder="Nome do canal personalizado" value={customName} onChange={(e) => setCustomName(e.target.value)} className="h-8 max-w-[220px] text-xs" />
            <Btn size="sm" onClick={() => customName.trim() && add(customName.trim())}>
              <Plus className="h-3.5 w-3.5" /> Adicionar canal
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detalhe de um canal — Paleta / Referências / Presets / Modelos / Prompt
// ---------------------------------------------------------------------------

const CHANNEL_TABS = ["Paleta", "Referências", "Presets", "Modelos", "Prompt"] as const;

function ChannelDetail({
  brandId,
  brandName,
  channel,
  canEdit,
  onBack,
  onChanged,
}: {
  brandId: string;
  brandName: string;
  channel: BrandIdentityChannel;
  canEdit: boolean;
  onBack: () => void;
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<(typeof CHANNEL_TABS)[number]>("Paleta");
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(channel.name);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="grid h-8 w-8 place-items-center rounded-full border border-border text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-4 w-4" />
          </button>
          {editingName ? (
            <div className="flex items-center gap-1.5">
              <TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} className="h-8 max-w-[200px] text-sm" />
              <Btn size="sm" onClick={async () => { await updateChannel(channel.id, { name }); setEditingName(false); onChanged(); }}>Salvar</Btn>
            </div>
          ) : (
            <h3 className="text-base font-semibold tracking-tight" onDoubleClick={() => canEdit && setEditingName(true)}>{channel.name}</h3>
          )}
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input type="checkbox" checked={channel.active} onChange={async (e) => { await updateChannel(channel.id, { active: e.target.checked }); onChanged(); }} className="h-4 w-4 accent-[var(--primary)]" />
              Ativo
            </label>
            <button
              onClick={async () => {
                if (!confirm(`Remover o canal "${channel.name}"? Isso apaga também presets e modelos dele.`)) return;
                await deleteChannel(channel.id);
                onBack();
                onChanged();
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remover canal
            </button>
          </div>
        )}
      </div>

      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {CHANNEL_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-[12.5px] font-medium transition-colors",
              tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Paleta" && <ChannelPaletteTab brandId={brandId} channel={channel} canEdit={canEdit} />}
      {tab === "Referências" && <ReferenciasPanel brandId={brandId} channelId={channel.id} canEdit={canEdit} />}
      {tab === "Presets" && <ChannelPresetsTab channel={channel} canEdit={canEdit} />}
      {tab === "Modelos" && <ChannelModelsTab brandId={brandId} brandName={brandName} channel={channel} canEdit={canEdit} />}
      {tab === "Prompt" && <ChannelPromptTab channel={channel} canEdit={canEdit} onChanged={onChanged} />}
    </div>
  );
}

function ChannelPaletteTab({ brandId, channel, canEdit }: { brandId: string; channel: BrandIdentityChannel; canEdit: boolean }) {
  const [masterColors, setMasterColors] = useState<BrandIdentityColor[]>([]);
  const [selectedRefs, setSelectedRefs] = useState<string[]>([]);
  const [ownColors, setOwnColors] = useState<BrandIdentityColor[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const [master, refs, own] = await Promise.all([listMasterColors(brandId), listChannelMasterColorRefs(channel.id), listChannelColors(channel.id)]);
    setMasterColors(master);
    setSelectedRefs(refs);
    setOwnColors(own);
    setLoading(false);
  }

  useEffect(() => {
    refresh().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel.id]);

  async function toggleRef(colorId: string, checked: boolean) {
    const next = checked ? [...selectedRefs, colorId] : selectedRefs.filter((id) => id !== colorId);
    setSelectedRefs(next);
    await setChannelMasterColorRefs(channel.id, next);
  }

  if (loading) return <p className="text-sm text-muted-foreground">Carregando paleta…</p>;

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Cores da Identidade Master usadas neste canal</p>
        {masterColors.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma cor cadastrada na Identidade Master ainda.</p>}
        <div className="space-y-1.5">
          {masterColors.map((c) => (
            <label key={c.id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2">
              <input type="checkbox" checked={selectedRefs.includes(c.id)} disabled={!canEdit} onChange={(e) => toggleRef(c.id, e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
              <span className="h-6 w-6 shrink-0 rounded-full border border-border" style={{ backgroundColor: c.hex ?? "#e5e5e5" }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-medium">{c.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{c.hex ?? "—"} {c.rgb && `· RGB ${c.rgb}`} · {COLOR_CATEGORIES.find((k) => k.key === c.category)?.label}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Cores específicas deste canal (opcional)</p>
        <ColorPaletteEditor brandId={brandId} channelId={channel.id} colors={ownColors} canEdit={canEdit} onChanged={refresh} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Presets de produção
// ---------------------------------------------------------------------------

function ChannelPresetsTab({ channel, canEdit }: { channel: BrandIdentityChannel; canEdit: boolean }) {
  const [presets, setPresets] = useState<BrandIdentityPreset[]>([]);
  const [editing, setEditing] = useState<Partial<BrandIdentityPreset> | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setPresets(await listPresets(channel.id));
    setLoading(false);
  }

  useEffect(() => {
    refresh().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel.id]);

  const missingSuggested = SUGGESTED_PRESETS.filter((s) => !presets.some((p) => p.name === s));

  return (
    <div className="space-y-3">
      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando presets…</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {presets.map((p) => (
            <div key={p.id} className={cn("surface space-y-1 rounded-2xl p-4", !p.active && "opacity-50")}>
              <p className="text-sm font-medium">{p.name}</p>
              {p.dimension && <p className="text-[11px] text-muted-foreground">{p.dimension}</p>}
              {canEdit && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button onClick={() => setEditing(p)} className="rounded-full border border-border px-2.5 py-1 text-[10.5px]">Editar</button>
                  <button onClick={async () => { await duplicatePreset(p); refresh(); }} className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted"><Copy className="h-3.5 w-3.5" /></button>
                  <button onClick={async () => { await deletePreset(p.id); refresh(); }} className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              )}
            </div>
          ))}
          {presets.length === 0 && <p className="text-sm text-muted-foreground">Nenhum preset cadastrado ainda.</p>}
        </div>
      )}
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          {missingSuggested.map((s) => (
            <button key={s} onClick={() => setEditing({ name: s, format: s.toLowerCase().replace("é", "e").replace("á", "a"), attachments: [], active: true })} className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
              <Plus className="h-3.5 w-3.5" /> {s}
            </button>
          ))}
          <button onClick={() => setEditing({ name: "", attachments: [], active: true })} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs text-primary-foreground">
            <Plus className="h-3.5 w-3.5" /> Novo preset
          </button>
        </div>
      )}
      {editing && (
        <PresetDrawer channelId={channel.id} value={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />
      )}
    </div>
  );
}

function PresetDrawer({ channelId, value, onClose, onSaved }: { channelId: string; value: Partial<BrandIdentityPreset>; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Partial<BrandIdentityPreset>>(value);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<BrandIdentityPreset>) => setForm((v) => ({ ...v, ...patch }));

  async function save() {
    if (!form.name?.trim()) return;
    setSaving(true);
    try {
      if (form.id) await updatePreset(form.id, form);
      else await createPreset(channelId, form as any);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormModal
      title={form.id ? "Editar preset" : "Novo preset"}
      description="Regra técnica de produção — dimensão, margens e composição desta peça."
      onClose={onClose}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
          <PillButton onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar preset"}</PillButton>
        </>
      }
    >
      <Field label="Nome"><TextInput value={form.name ?? ""} onChange={(e) => set({ name: e.target.value })} placeholder="Ex.: Carrossel" /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Dimensão"><TextInput value={form.dimension ?? ""} onChange={(e) => set({ dimension: e.target.value })} placeholder="1080x1350" /></Field>
        <Field label="Margens"><TextInput value={form.margins ?? ""} onChange={(e) => set({ margins: e.target.value })} /></Field>
        <Field label="Área segura"><TextInput value={form.safe_area ?? ""} onChange={(e) => set({ safe_area: e.target.value })} /></Field>
        <Field label="Posicionamento de logo"><TextInput value={form.logo_position ?? ""} onChange={(e) => set({ logo_position: e.target.value })} /></Field>
        <Field label="Tipografia"><TextInput value={form.typography ?? ""} onChange={(e) => set({ typography: e.target.value })} /></Field>
        <Field label="Tamanho de textos"><TextInput value={form.text_sizes ?? ""} onChange={(e) => set({ text_sizes: e.target.value })} /></Field>
      </div>
      <AutoTextArea label="Hierarquia" placeholder="Como o olhar deve percorrer a peça…" value={form.hierarchy ?? ""} onChange={(v) => set({ hierarchy: v })} />
      <AutoTextArea label="Tratamento de imagens" placeholder="Recorte, filtro, sobreposição…" value={form.image_treatment ?? ""} onChange={(v) => set({ image_treatment: v })} />
      <AutoTextArea label="Elementos gráficos" value={form.graphic_elements ?? ""} onChange={(v) => set({ graphic_elements: v })} />
      <AutoTextArea label="Regras de composição" value={form.composition_rules ?? ""} onChange={(v) => set({ composition_rules: v })} />
      <AutoTextArea label="Observações" value={form.notes ?? ""} onChange={(v) => set({ notes: v })} />
      <AttachmentsField label="Anexos / referências" files={form.attachments ?? []} folder="identidade-visual/presets" onChange={(files) => set({ attachments: files })} />
      <label className="flex items-center gap-2 text-[12.5px]">
        <input type="checkbox" checked={form.active !== false} onChange={(e) => set({ active: e.target.checked })} className="h-4 w-4 accent-[var(--primary)]" /> Ativo
      </label>
    </FormModal>
  );
}

// ---------------------------------------------------------------------------
// Modelos de conteúdo
// ---------------------------------------------------------------------------

function ChannelModelsTab({ brandId, brandName, channel, canEdit }: { brandId: string; brandName: string; channel: BrandIdentityChannel; canEdit: boolean }) {
  const [models, setModels] = useState<BrandIdentityModel[]>([]);
  const [editing, setEditing] = useState<Partial<BrandIdentityModel> | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setModels(await listModels(channel.id));
    setLoading(false);
  }

  useEffect(() => {
    refresh().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel.id]);

  return (
    <div className="space-y-3">
      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando modelos…</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {models.map((m) => (
            <div key={m.id} className={cn("surface space-y-1 rounded-2xl p-4", m.status === "inativo" && "opacity-50")}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{m.name}</p>
                <span className={cn("rounded-full px-2 py-0.5 text-[10px]", m.status === "ativo" ? "bg-success/12 text-success" : "bg-muted text-muted-foreground")}>{m.status}</span>
              </div>
              {m.format && <p className="text-[11px] text-muted-foreground">{CONTENT_FORMATS.find((f) => f.key === m.format)?.label ?? m.format}</p>}
              {canEdit && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button onClick={() => setEditing(m)} className="rounded-full border border-border px-2.5 py-1 text-[10.5px]">Editar</button>
                  <button onClick={async () => { await duplicateModel(m); refresh(); }} className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted"><Copy className="h-3.5 w-3.5" /></button>
                  <button onClick={async () => { await deleteModel(m.id); refresh(); }} className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              )}
            </div>
          ))}
          {models.length === 0 && <p className="text-sm text-muted-foreground">Nenhum modelo cadastrado ainda. Um cliente pode ter só 1 — ou quantos precisar.</p>}
        </div>
      )}
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          {SUGGESTED_MODEL_NAMES.filter((s) => !models.some((m) => m.name === s)).map((s) => (
            <button key={s} onClick={() => setEditing({ name: s, status: "ativo", attachments: [] })} className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
              <Plus className="h-3.5 w-3.5" /> {s}
            </button>
          ))}
          <button onClick={() => setEditing({ name: "", status: "ativo", attachments: [] })} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs text-primary-foreground">
            <Plus className="h-3.5 w-3.5" /> Novo modelo
          </button>
        </div>
      )}
      {editing && (
        <ModelDrawer brandId={brandId} brandName={brandName} channel={channel} value={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />
      )}
    </div>
  );
}

function ModelDrawer({
  brandId,
  brandName,
  channel,
  value,
  onClose,
  onSaved,
}: {
  brandId: string;
  brandName: string;
  channel: BrandIdentityChannel;
  value: Partial<BrandIdentityModel>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<BrandIdentityModel>>(value);
  const [presets, setPresets] = useState<BrandIdentityPreset[]>([]);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<BrandIdentityModel>) => setForm((v) => ({ ...v, ...patch }));
  const isCarrossel = form.format === "carrossel";

  useEffect(() => {
    listPresets(channel.id).then(setPresets).catch(() => undefined);
  }, [channel.id]);

  async function save() {
    if (!form.name?.trim()) return;
    setSaving(true);
    try {
      if (form.id) await updateModel(form.id, form);
      else await createModel(channel.id, form as any);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  const namingPreview = form.naming_pattern
    ? previewNamingPattern(form.naming_pattern, { cliente: brandName, canal: channel.name, formato: form.format ?? "FORMATO" })
    : null;

  return (
    <FormModal
      title={form.id ? "Editar modelo" : "Novo modelo"}
      description="Defina as características visuais e editoriais deste tipo de conteúdo."
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
          <PillButton onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar modelo"}</PillButton>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome"><TextInput value={form.name ?? ""} onChange={(e) => set({ name: e.target.value })} placeholder="Ex.: Notícia" /></Field>
        <Field label="Formato">
          <SelectInput value={form.format ?? ""} onChange={(e) => set({ format: e.target.value })}>
            <option value="">Selecione…</option>
            {CONTENT_FORMATS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </SelectInput>
        </Field>
        <Field label="Categoria"><TextInput value={form.category ?? ""} onChange={(e) => set({ category: e.target.value })} /></Field>
        <Field label="Objetivo"><TextInput value={form.objective ?? ""} onChange={(e) => set({ objective: e.target.value })} /></Field>
        <Field label="Status">
          <SelectInput value={form.status ?? "ativo"} onChange={(e) => set({ status: e.target.value as any })}>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </SelectInput>
        </Field>
        <Field label="Preset de produção associado">
          <SelectInput value={form.preset_id ?? ""} onChange={(e) => set({ preset_id: e.target.value || null })}>
            <option value="">Nenhum</option>
            {presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </SelectInput>
        </Field>
      </div>

      <AutoTextArea label="Descrição" placeholder="Do que trata este tipo de conteúdo…" value={form.description ?? ""} onChange={(v) => set({ description: v })} />
      <AutoTextArea label="Direção visual" value={form.visual_direction ?? ""} onChange={(v) => set({ visual_direction: v })} />
      <AutoTextArea label="Estrutura da peça" value={form.structure ?? ""} onChange={(v) => set({ structure: v })} />

      <Field label="Nomenclatura" hint="Ex.: [CLIENTE][CANAL][FORMATO][TEMA][DATA]">
        <TextInput value={form.naming_pattern ?? ""} onChange={(e) => set({ naming_pattern: e.target.value })} placeholder="[CLIENTE][CANAL][FORMATO][TEMA][DATA]" />
      </Field>
      {namingPreview && <p className="text-[11px] text-muted-foreground">Exemplo: <code className="rounded bg-muted px-1.5 py-0.5">{namingPreview}</code></p>}

      {isCarrossel && (
        <div className="space-y-3 rounded-2xl border border-border p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Configuração de carrossel</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <AutoTextArea label="Estrutura da capa" value={form.carousel_cover_structure ?? ""} onChange={(v) => set({ carousel_cover_structure: v })} />
            <AutoTextArea label="Estrutura das páginas internas" value={form.carousel_pages_structure ?? ""} onChange={(v) => set({ carousel_pages_structure: v })} />
            <Field label="Quantidade sugerida de páginas"><TextInput value={form.carousel_page_count ?? ""} onChange={(e) => set({ carousel_page_count: e.target.value })} /></Field>
            <Field label="Hierarquia de informação"><TextInput value={form.carousel_hierarchy ?? ""} onChange={(e) => set({ carousel_hierarchy: e.target.value })} /></Field>
            <Field label="Tratamento de títulos"><TextInput value={form.carousel_title_treatment ?? ""} onChange={(e) => set({ carousel_title_treatment: e.target.value })} /></Field>
            <Field label="Tratamento de textos"><TextInput value={form.carousel_text_treatment ?? ""} onChange={(e) => set({ carousel_text_treatment: e.target.value })} /></Field>
            <Field label="CTA"><TextInput value={form.carousel_cta ?? ""} onChange={(e) => set({ carousel_cta: e.target.value })} /></Field>
            <Field label="Página final"><TextInput value={form.carousel_final_page ?? ""} onChange={(e) => set({ carousel_final_page: e.target.value })} /></Field>
            <AutoTextArea label="Elementos obrigatórios" value={form.carousel_required_elements ?? ""} onChange={(v) => set({ carousel_required_elements: v })} />
            <AutoTextArea label="Elementos proibidos" value={form.carousel_forbidden_elements ?? ""} onChange={(v) => set({ carousel_forbidden_elements: v })} />
          </div>
        </div>
      )}

      <PromptField label="Prompt específico do modelo" value={form.prompt ?? ""} onChange={(v) => set({ prompt: v })} />

      <AttachmentsField label="Anexos / referências" files={form.attachments ?? []} folder="identidade-visual/modelos" onChange={(files) => set({ attachments: files })} />
    </FormModal>
  );
}

// ---------------------------------------------------------------------------
// Prompt de direção de conteúdo do canal
// ---------------------------------------------------------------------------

function ChannelPromptTab({ channel, canEdit, onChanged }: { channel: BrandIdentityChannel; canEdit: boolean; onChanged: () => void }) {
  const [value, setValue] = useState(channel.general_prompt ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => setValue(channel.general_prompt ?? ""), [channel.id, channel.general_prompt]);

  async function save() {
    setSaving(true);
    try {
      await updateChannel(channel.id, { general_prompt: value });
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Prompt-base de direção de conteúdo para este canal — combina com o prompt específico de cada modelo na hora de gerar conteúdo.</p>
      <TextArea rows={6} value={value} disabled={!canEdit} onChange={(e) => setValue(e.target.value)} />
      {canEdit && <PillButton onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar prompt"}</PillButton>}
    </div>
  );
}
