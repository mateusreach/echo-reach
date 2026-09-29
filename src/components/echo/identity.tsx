// ---------------------------------------------------------------------------
// Echo · Identidade visual do cliente e personalização do espaço
// Usado em Brand › Configurações (equipe edita tudo) e em Espaço 360 ›
// Personalização (cliente admin muda capa, logo e cores; identidade só leitura).
// ---------------------------------------------------------------------------
import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge, Button, ClientLogo, EmptyState, Skeleton } from "./primitives";
import { Checkbox, Field, LineTabs, Menu, Select, Switch, TextArea } from "./controls";
import { Drawer, Modal } from "./overlays";
import { Icon } from "./icon";
import { ImagePick } from "./image-pick";
import { FramedImage } from "@/components/reach/framed-image";
import { FrameConfigButton } from "@/components/reach/image-crop-editor";
import { applyBrandColors } from "@/lib/branding";
import { generatePaletteSuggestions, type PaletteSuggestion } from "@/lib/color-extraction";
import { COLOR_CATEGORIES, CONTENT_FORMATS, previewNamingPattern, type BrandIdentityColor, type BrandIdentityModel, type BrandIdentityPreset } from "@/lib/identity-data";
import {
  applyPalette, cachePalettes, loadIdentity, parseDimension, removeChannel, removeColor, removeModel, removePreset, reorderChannels, saveBrandPatch, saveMaster, setChannelColors,
  upsertChannel, upsertColor, upsertModel, upsertPreset, type BrandInfo, type ChannelFull, type Identity,
} from "@/lib/brand-settings-data";

function Section({ title, desc, aside, children }: { title: string; desc?: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="settings-section e-glass">
      <header className="e-row between wrap" style={{ gap: 12, alignItems: "flex-start" }}>
        <div><h2 className="e-h3" style={{ margin: 0 }}>{title}</h2>{desc && <p className="e-small" style={{ margin: "4px 0 0" }}>{desc}</p>}</div>
        {aside}
      </header>
      {children}
    </section>
  );
}

// ----- Personalização do espaço ---------------------------------------------------

export function SpaceCustomizer({ info, canEdit, onSaved }: { info: BrandInfo; canEdit: boolean; onSaved: () => void }) {
  const [d, setD] = useState({ logo_url: info.logo_url, logo_frame: info.logo_frame, cover_url: info.cover_url, cover_frame: info.cover_frame, primary_color: info.primary_color ?? "", accent_color: info.accent_color ?? "" });
  const [saving, setSaving] = useState(false);
  useEffect(() => setD({ logo_url: info.logo_url, logo_frame: info.logo_frame, cover_url: info.cover_url, cover_frame: info.cover_frame, primary_color: info.primary_color ?? "", accent_color: info.accent_color ?? "" }), [info]);
  const base = JSON.stringify({ logo_url: info.logo_url, logo_frame: info.logo_frame, cover_url: info.cover_url, cover_frame: info.cover_frame, primary_color: info.primary_color ?? "", accent_color: info.accent_color ?? "" });
  const dirty = JSON.stringify(d) !== base;
  const p1 = d.primary_color || "#6B4FE8";
  const p2 = d.accent_color || "#9C80F5";
  const save = async () => {
    setSaving(true);
    try { await saveBrandPatch(info.slug, info.id, { ...d, primary_color: d.primary_color || null, accent_color: d.accent_color || null }); applyBrandColors(d.primary_color || null, d.accent_color || null); toast.success("Espaço atualizado"); onSaved(); }
    catch { toast.error("Não foi possível salvar."); } finally { setSaving(false); }
  };
  return (
    <Section title="Espaço do cliente" desc="Capa, logo e cores que aparecem no cabeçalho do cliente no Espaço 360 e no Like. O caminho de cor de cada pessoa continua valendo no resto do Echo.">
      <div className="space-preview" style={{ ["--p1" as string]: p1, ["--p2" as string]: p2 }}>
        <div className="space-cover">{d.cover_url ? <FramedImage src={d.cover_url} frame={d.cover_frame} shape="rect" className="space-cover-img" /> : <span className="space-cover-fallback" />}</div>
        <div className="space-id">
          <span className="space-avatar">{d.logo_url ? <FramedImage src={d.logo_url} frame={d.logo_frame} shape="circle" className="space-avatar-img" alt="" /> : <ClientLogo name={info.name} size="lg" gradient={`linear-gradient(135deg, ${p1}, ${p2})`} />}</span>
          <div><b>{info.name}</b><span className="e-caption">Prévia do cabeçalho</span></div>
          <span style={{ flex: 1 }} />
          <span className="space-chip">Aguardando você · 2</span>
        </div>
      </div>
      <div className="grid-2" style={{ gap: 16 }}>
        <div className="e-stack" style={{ gap: 8 }}>
          <ImagePick label="Logo" value={d.logo_url} disabled={!canEdit} folder={`marcas/${info.slug}`} hint="Proporção original preservada; o avatar é um enquadramento da própria logo." onChange={(v) => setD({ ...d, logo_url: v, logo_frame: null })} />
          {canEdit && d.logo_url && <div><FrameConfigButton src={d.logo_url} shape="circle" aspect={1} frame={d.logo_frame} label="Ajustar avatar" recommendedLabel="Como a logo aparece em avatares circulares." onSave={(f) => setD({ ...d, logo_frame: f })} /></div>}
        </div>
        <div className="e-stack" style={{ gap: 8 }}>
          <ImagePick label="Capa" wide value={d.cover_url} disabled={!canEdit} folder={`marcas/${info.slug}`} hint="1600 × 400 px (4:1)." onChange={(v) => setD({ ...d, cover_url: v, cover_frame: null })} />
          {canEdit && d.cover_url && <div><FrameConfigButton src={d.cover_url} shape="rect" aspect={4} frame={d.cover_frame} label="Ajustar enquadramento" recommendedLabel="1600 × 400 px · 4:1" onSave={(f) => setD({ ...d, cover_frame: f })} /></div>}
        </div>
      </div>
      <div className="color-pair">
        <ColorInput label="Cor principal" value={d.primary_color} disabled={!canEdit} onChange={(v) => setD({ ...d, primary_color: v })} />
        <ColorInput label="Cor de destaque" value={d.accent_color} disabled={!canEdit} onChange={(v) => setD({ ...d, accent_color: v })} />
      </div>
      {canEdit && <div className="e-row" style={{ gap: 8, justifyContent: "flex-end" }}>
        <Button variant="ghost" disabled={!dirty} onClick={() => setD(JSON.parse(base))}>Desfazer</Button>
        <Button icon="check" loading={saving} disabled={!dirty} onClick={save}>Salvar espaço</Button>
      </div>}
    </Section>
  );
}

function ColorInput({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const valid = /^#[0-9a-fA-F]{6}$/.test(value);
  return (
    <div className="e-field">
      <span className="e-field-label">{label}</span>
      <div className="color-input">
        <label className="swatch" style={{ background: valid ? value : "transparent" }}>
          <input type="color" value={valid ? value : "#6b4fe8"} disabled={disabled} aria-label={label} onChange={(e) => onChange(e.target.value.toUpperCase())} />
        </label>
        <input className="e-input sm tnum" value={value} disabled={disabled} placeholder="#000000" maxLength={7} aria-label={`${label} em hexadecimal`} onChange={(e) => onChange(e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`)} />
        {value && !disabled && <Button size="sm" variant="ghost" icon="x" aria-label={`Limpar ${label}`} onClick={() => onChange("")} />}
      </div>
    </div>
  );
}

// ----- Identidade visual ------------------------------------------------------------

export function IdentityEditor({ info, canEdit, onBrandChanged }: { info: BrandInfo; canEdit: boolean; onBrandChanged: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["identity", info.slug], queryFn: () => loadIdentity(info.slug, info.id) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["identity", info.slug] });
  const [channel, setChannel] = useState<string | null>(null);
  if (q.isLoading) return <div className="stack-lg"><Skeleton h={220} r={24} /><Skeleton h={260} r={24} /></div>;
  if (!q.data) return <EmptyState kind="error" title="Não foi possível carregar a identidade" actions={<Button variant="secondary" icon="refresh" onClick={() => q.refetch()}>Tentar novamente</Button>} />;
  const id = q.data;
  return (
    <div className="stack-lg">
      {!canEdit && <p className="e-caption" style={{ margin: 0 }}><Icon name="lock" size="sm" /> A identidade mestre é definida pela equipe. Você pode consultar tudo aqui.</p>}
      <MasterSection info={info} identity={id} canEdit={canEdit} onChanged={refresh} />
      <PaletteSection info={info} identity={id} canEdit={canEdit} onChanged={refresh} onBrandChanged={onBrandChanged} />
      <ChannelsSection info={info} identity={id} canEdit={canEdit} onChanged={refresh} onOpen={setChannel} />
      <ChannelDrawer info={info} identity={id} channel={id.channels.find((c) => c.id === channel) ?? null} canEdit={canEdit} onClose={() => setChannel(null)} onChanged={refresh} />
    </div>
  );
}

const MASTER_FIELDS: { key: "visual_direction" | "typography" | "photo_direction" | "icon_style" | "graphic_elements" | "general_rules"; label: string; ph: string }[] = [
  { key: "visual_direction", label: "Direção visual", ph: "Personalidade, atmosfera, o que a marca transmite" },
  { key: "typography", label: "Tipografia", ph: "Famílias, pesos e usos" },
  { key: "photo_direction", label: "Fotografia", ph: "Luz, cenário, enquadramento, pessoas" },
  { key: "icon_style", label: "Ícones", ph: "Traço, preenchimento, cantos" },
  { key: "graphic_elements", label: "Elementos gráficos", ph: "Texturas, grafismos, selos" },
  { key: "general_rules", label: "Regras gerais", ph: "O que nunca fazer, respiro do logo, contraste" },
];

function MasterSection({ info, identity, canEdit, onChanged }: { info: BrandInfo; identity: Identity; canEdit: boolean; onChanged: () => void }) {
  const init = Object.fromEntries(MASTER_FIELDS.map((f) => [f.key, (identity.master[f.key] as string | null) ?? ""])) as Record<string, string>;
  const [d, setD] = useState(init);
  const [saving, setSaving] = useState(false);
  useEffect(() => setD(init), [JSON.stringify(init)]);
  const dirty = JSON.stringify(d) !== JSON.stringify(init);
  return (
    <Section title="Identidade mestre" desc="Vale para todos os canais. Orienta a produção e a avaliação interna no Like.">
      <div className="grid-2" style={{ gap: 12 }}>
        {MASTER_FIELDS.map((f) => <TextArea key={f.key} label={f.label} rows={3} value={d[f.key]} placeholder={f.ph} disabled={!canEdit} onChange={(e) => setD({ ...d, [f.key]: e.target.value })} />)}
      </div>
      {(identity.master.manual_attachments ?? []).length > 0 && <div className="e-row wrap" style={{ gap: 6 }}>{identity.master.manual_attachments!.map((a) => <a key={a.url} className="e-chip" href={a.url} target="_blank" rel="noreferrer"><Icon name="paperclip" size="sm" /> {a.name}</a>)}</div>}
      {canEdit && dirty && <div className="e-row" style={{ gap: 8, justifyContent: "flex-end" }}>
        <Button variant="ghost" onClick={() => setD(init)}>Desfazer</Button>
        <Button icon="check" loading={saving} onClick={async () => { setSaving(true); try { await saveMaster(info.slug, info.id, Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v.trim() || null]))); toast.success("Identidade mestre salva"); onChanged(); } catch { toast.error("Não foi possível salvar."); } finally { setSaving(false); } }}>Salvar</Button>
      </div>}
    </Section>
  );
}

function PaletteSection({ info, identity, canEdit, onChanged, onBrandChanged }: { info: BrandInfo; identity: Identity; canEdit: boolean; onChanged: () => void; onBrandChanged: () => void }) {
  const [sugs, setSugs] = useState<PaletteSuggestion[] | null>(info.suggested_palettes);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<(Partial<BrandIdentityColor> & { name: string }) | null>(null);
  const hasAssets = !!(info.logo_url || info.cover_url);
  const extract = async () => {
    if (!hasAssets) { toast.error("Envie o logo ou a capa primeiro."); return; }
    setBusy(true);
    try {
      const s = await generatePaletteSuggestions({ logoUrl: info.logo_url, coverUrl: info.cover_url });
      setSugs(s);
      if (s.length) await cachePalettes(info.slug, info.id, s); else toast("Não encontramos cores marcantes nas imagens.");
    } catch { toast.error("Não foi possível ler as imagens."); } finally { setBusy(false); }
  };
  const markBrand = async (key: "primary_color" | "accent_color", hex: string | null) => { if (!hex) return; await saveBrandPatch(info.slug, info.id, { [key]: hex }); toast.success(key === "primary_color" ? "Definida como cor principal" : "Definida como cor de destaque"); onBrandChanged(); };
  return (
    <Section title="Paleta" desc="Cores oficiais do cliente. Extraídas do logo e da capa ou cadastradas à mão."
      aside={canEdit ? <div className="e-row" style={{ gap: 6 }}><Button variant="secondary" icon="wand" loading={busy} disabled={!hasAssets} title={hasAssets ? undefined : "Envie o logo ou a capa"} onClick={extract}>Extrair do logo e da capa</Button><Button icon="plus" onClick={() => setEdit({ name: "", hex: "#", category: "apoio" })}>Cor</Button></div> : undefined}>
      {sugs && sugs.length > 0 && canEdit && (
        <div className="sug-grid">
          {sugs.map((s) => (
            <div key={s.name} className="sug-card">
              <div className="sug-swatches">{s.colors.map((c) => <i key={c.hex} style={{ background: c.hex }} title={`${c.hex} · ${c.source}`} />)}</div>
              <div className="e-row between" style={{ gap: 8 }}>
                <span style={{ minWidth: 0 }}><b className="e-ellipsis" style={{ display: "block", fontSize: 13 }}>{s.name}</b><span className="e-caption">{s.description}</span></span>
                <Button size="sm" variant="secondary" onClick={async () => { await applyPalette(info.slug, info.id, s.colors); toast.success("Paleta aplicada", { description: "As cores manuais foram mantidas." }); onChanged(); }}>Aplicar</Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {identity.colors.length === 0 ? <EmptyState compact icon="palette" title="Nenhuma cor cadastrada" text={hasAssets ? "Extraia do logo e da capa ou cadastre à mão." : "Envie o logo e a capa em “Espaço do cliente” para sugerir cores reais da marca."} /> : (
        <div className="color-grid">
          {identity.colors.map((c) => {
            const isP = c.hex && c.hex.toLowerCase() === (info.primary_color ?? "").toLowerCase();
            const isA = c.hex && c.hex.toLowerCase() === (info.accent_color ?? "").toLowerCase();
            return (
              <div key={c.id} className="color-card">
                <span className="color-chip" style={{ background: c.hex ?? "transparent" }}>{(isP || isA) && <em>{isP ? "Principal" : "Destaque"}</em>}</span>
                <div className="color-meta">
                  <div className="e-row between" style={{ gap: 6 }}>
                    <b className="e-ellipsis">{c.name}</b>
                    {canEdit && <Menu align="right" trigger={({ toggle }) => <Button size="sm" variant="ghost" icon="more" aria-label={`Ações de ${c.name}`} onClick={toggle} />} items={[
                      { label: "Editar", icon: "edit", onSelect: () => setEdit({ ...c }) },
                      { label: "Usar como cor principal", icon: "star", onSelect: () => markBrand("primary_color", c.hex) },
                      { label: "Usar como destaque", icon: "sparkle", onSelect: () => markBrand("accent_color", c.hex) },
                      "-",
                      { label: "Excluir", icon: "trash", danger: true, onSelect: async () => { await removeColor(info.slug, c.id); toast.success("Cor excluída"); onChanged(); } },
                    ]} />}
                  </div>
                  <span className="e-caption tnum e-mono">{c.hex}</span>
                  <span className="e-caption tnum">RGB {c.rgb ?? "—"}{c.cmyk ? ` · CMYK ${c.cmyk}` : ""}{c.pantone ? ` · ${c.pantone}` : ""}</span>
                  <span className="e-row" style={{ gap: 4 }}><Badge tone="glass">{COLOR_CATEGORIES.find((x) => x.key === c.category)?.label ?? c.category}</Badge><span className="e-caption">{c.source === "manual" ? "manual" : `do ${c.source}`}</span></span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} icon="palette" title={edit?.id ? "Editar cor" : "Nova cor"}
        footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancelar</Button><Button disabled={!edit?.name.trim() || !/^#[0-9a-fA-F]{6}$/.test(edit?.hex ?? "")} onClick={async () => { if (!edit) return; await upsertColor(info.slug, info.id, edit.id ?? null, { name: edit.name.trim(), hex: edit.hex!.toUpperCase(), category: edit.category, cmyk: edit.cmyk || null, pantone: edit.pantone || null }); toast.success("Cor salva"); setEdit(null); onChanged(); }}>Salvar</Button></>}>
        {edit && <div className="e-stack" style={{ gap: 12 }}>
          <Field label="Nome" autoFocus value={edit.name} placeholder="Ex.: Ameixa" onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
          <ColorInput label="Cor" value={edit.hex ?? ""} onChange={(v) => setEdit({ ...edit, hex: v })} />
          <div className="grid-2" style={{ gap: 12 }}>
            <Select label="Categoria" value={edit.category ?? "apoio"} onChange={(v) => setEdit({ ...edit, category: v })} options={COLOR_CATEGORIES.map((c) => ({ value: c.key, label: c.label }))} />
            <Field label="Pantone" optional value={edit.pantone ?? ""} onChange={(e) => setEdit({ ...edit, pantone: e.target.value })} />
          </div>
          <Field label="CMYK" optional value={edit.cmyk ?? ""} placeholder="0, 45, 20, 45" onChange={(e) => setEdit({ ...edit, cmyk: e.target.value })} />
        </div>}
      </Modal>
    </Section>
  );
}

function ChannelsSection({ info, identity, canEdit, onChanged, onOpen }: { info: BrandInfo; identity: Identity; canEdit: boolean; onChanged: () => void; onOpen: (id: string) => void }) {
  const [adding, setAdding] = useState("");
  const move = async (i: number, to: number) => { const ids = identity.channels.map((c) => c.id); const [x] = ids.splice(i, 1); ids.splice(to, 0, x); await reorderChannels(info.slug, ids); onChanged(); };
  return (
    <Section title="Canais" desc="Cada canal herda a identidade mestre e define cores, formatos e modelos de peça. O Like usa os formatos para enquadrar as prévias.">
      <div className="e-stack" style={{ gap: 6 }}>
        {identity.channels.map((c, i) => (
          <div key={c.id} className={`channel-row${c.active ? "" : " off"}`}>
            <span className="tnum sector-n">{i + 1}</span>
            <button type="button" className="channel-open" onClick={() => onOpen(c.id)}>
              <b>{c.name}</b>
              <span className="e-caption">{c.presets.length} {c.presets.length === 1 ? "formato" : "formatos"} · {c.models.length} {c.models.length === 1 ? "modelo" : "modelos"} · {c.colorRefs.length} cores</span>
            </button>
            <span className="channel-sw">{c.colorRefs.slice(0, 5).map((r) => <i key={r} style={{ background: identity.colors.find((x) => x.id === r)?.hex ?? "transparent" }} />)}</span>
            <Switch checked={c.active} disabled={!canEdit} onChange={async (v) => { await upsertChannel(info.slug, info.id, c.id, { active: v }); onChanged(); }} label={<span className="e-sr">{c.name} ativo</span>} />
            {canEdit && <Menu align="right" trigger={({ toggle }) => <Button size="sm" variant="ghost" icon="more" aria-label={`Ações de ${c.name}`} onClick={toggle} />} items={[
              { label: "Abrir", icon: "chevRight", onSelect: () => onOpen(c.id) },
              { label: "Subir", icon: "chevUp", disabled: i === 0, onSelect: () => move(i, i - 1) },
              { label: "Descer", icon: "chevDown", disabled: i === identity.channels.length - 1, onSelect: () => move(i, i + 1) },
              "-",
              { label: "Excluir canal", icon: "trash", danger: true, onSelect: async () => { await removeChannel(info.slug, c.id); toast.success("Canal excluído"); onChanged(); } },
            ]} />}
          </div>
        ))}
        {identity.channels.length === 0 && <EmptyState compact icon="grid" title="Nenhum canal" text="Adicione Instagram, TikTok, LinkedIn ou outro canal." />}
        {canEdit && <form className="e-row" style={{ gap: 6, marginTop: 4 }} onSubmit={async (e) => { e.preventDefault(); if (!adding.trim()) return; await upsertChannel(info.slug, info.id, null, { name: adding.trim() }); setAdding(""); onChanged(); }}>
          <input className="e-input sm e-grow" value={adding} placeholder="Novo canal (ex.: LinkedIn)" aria-label="Nome do novo canal" onChange={(e) => setAdding(e.target.value)} />
          <Button size="sm" variant="secondary" icon="plus" type="submit" disabled={!adding.trim()}>Adicionar</Button>
        </form>}
      </div>
    </Section>
  );
}

type ChTab = "cores" | "formatos" | "modelos" | "prompt";

function PresetFrame({ dimension, safe }: { dimension: string | null; safe?: string | null }) {
  const d = parseDimension(dimension);
  if (!d) return <span className="preset-frame empty"><Icon name="image" size="sm" /></span>;
  return <span className="preset-frame" style={{ aspectRatio: `${d.w} / ${d.h}` }} title={safe ?? undefined}><i /><em className="tnum">{d.w}×{d.h}</em></span>;
}

function ChannelDrawer({ info, identity, channel, canEdit, onClose, onChanged }: { info: BrandInfo; identity: Identity; channel: ChannelFull | null; canEdit: boolean; onClose: () => void; onChanged: () => void }) {
  const [tab, setTab] = useState<ChTab>("formatos");
  const [refs, setRefs] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [preset, setPreset] = useState<(Partial<BrandIdentityPreset> & { name: string }) | null>(null);
  const [model, setModel] = useState<(Partial<BrandIdentityModel> & { name: string }) | null>(null);
  const [last, setLast] = useState<ChannelFull | null>(null);
  if (channel && channel !== last) setLast(channel);
  useEffect(() => { if (channel) { setRefs(channel.colorRefs); setPrompt(channel.general_prompt ?? ""); } }, [channel?.id, channel?.colorRefs.join(), channel?.general_prompt]);
  const c = channel ?? last;
  if (!c) return <Drawer open={false} onClose={onClose} title="" />;
  const ro = !canEdit;
  return (
    <>
      <Drawer open={!!channel} onClose={onClose} eyebrow="Canal" title={c.name}>
        <LineTabs<ChTab> value={tab} onChange={setTab} items={[{ value: "formatos", label: `Formatos · ${c.presets.length}` }, { value: "modelos", label: `Modelos · ${c.models.length}` }, { value: "cores", label: "Cores" }, { value: "prompt", label: "Prompt" }]} />
        {tab === "cores" && <div className="e-stack" style={{ gap: 8 }}>
          <p className="e-small" style={{ margin: 0 }}>Cores da paleta mestre usadas neste canal (vínculo, sem cópia).</p>
          {identity.colors.map((col) => <Checkbox key={col.id} checked={refs.includes(col.id)} disabled={ro} onChange={(v) => setRefs(v ? [...refs, col.id] : refs.filter((r) => r !== col.id))} label={<span className="e-row" style={{ gap: 8 }}><i className="dot-sw" style={{ background: col.hex ?? "transparent" }} />{col.name} <span className="e-caption e-mono">{col.hex}</span></span>} />)}
          {canEdit && <div><Button icon="check" disabled={refs.join() === c.colorRefs.join()} onClick={async () => { await setChannelColors(info.slug, c.id, refs); toast.success("Cores do canal salvas"); onChanged(); }}>Salvar cores</Button></div>}
        </div>}
        {tab === "formatos" && <div className="e-stack" style={{ gap: 8 }}>
          {c.presets.map((p) => (
            <div key={p.id} className="preset-row">
              <PresetFrame dimension={p.dimension} safe={p.safe_area} />
              <span className="e-grow" style={{ minWidth: 0 }}><b>{p.name}</b><span className="e-caption" style={{ display: "block" }}>{p.dimension ?? "Sem dimensão"}{p.safe_area ? ` · ${p.safe_area}` : ""}</span></span>
              {canEdit && <Menu align="right" trigger={({ toggle }) => <Button size="sm" variant="ghost" icon="more" aria-label={`Ações de ${p.name}`} onClick={toggle} />} items={[
                { label: "Editar", icon: "edit", onSelect: () => setPreset({ ...p }) },
                { label: "Duplicar", icon: "copy", onSelect: async () => { const { id: _i, created_at: _c, updated_at: _u, ...rest } = p; await upsertPreset(info.slug, c.id, null, { ...rest, name: `${p.name} (cópia)` }); toast.success("Formato duplicado"); onChanged(); } },
                "-",
                { label: "Excluir", icon: "trash", danger: true, onSelect: async () => { await removePreset(info.slug, c.id, p.id); onChanged(); } },
              ]} />}
            </div>
          ))}
          {c.presets.length === 0 && <EmptyState compact icon="image" title="Nenhum formato" text="Ex.: Feed 1080×1350, Stories 1080×1920." />}
          {canEdit && <button type="button" className="tpl-add" onClick={() => setPreset({ name: "", dimension: "1080×1350" })}><Icon name="plus" size="sm" /> Formato</button>}
        </div>}
        {tab === "modelos" && <div className="e-stack" style={{ gap: 8 }}>
          {c.models.map((m) => {
            const req = (m.carousel_required_elements ?? "").split("\n").filter(Boolean);
            return (
              <button key={m.id} type="button" className="model-row" onClick={() => setModel({ ...m })}>
                <span className="e-grow" style={{ minWidth: 0 }}><b>{m.name}</b><span className="e-caption" style={{ display: "block" }}>{CONTENT_FORMATS.find((f) => f.key === m.format)?.label ?? "Formato livre"}{m.objective ? ` · ${m.objective}` : ""}</span></span>
                {req.length > 0 && <Badge tone="glass" icon="checks">{req.length} obrigatórios</Badge>}
                {m.status === "inativo" && <Badge tone="glass">Inativo</Badge>}
                <Icon name="chevRight" size="sm" />
              </button>
            );
          })}
          {c.models.length === 0 && <EmptyState compact icon="layers" title="Nenhum modelo de peça" text="Modelos definem estrutura, CTA e elementos obrigatórios." />}
          {canEdit && <button type="button" className="tpl-add" onClick={() => setModel({ name: "", status: "ativo", naming_pattern: "[CLIENTE]_[CANAL]_[FORMATO]_[TEMA]_[DATA]" })}><Icon name="plus" size="sm" /> Modelo</button>}
        </div>}
        {tab === "prompt" && <div className="e-stack" style={{ gap: 8 }}>
          <TextArea label="Prompt geral do canal" rows={8} value={prompt} disabled={ro} help="Tom, linguagem e regras para textos e roteiros deste canal." onChange={(e) => setPrompt(e.target.value)} />
          {canEdit && <div><Button icon="check" disabled={prompt === (c.general_prompt ?? "")} onClick={async () => { await upsertChannel(info.slug, info.id, c.id, { general_prompt: prompt || null }); toast.success("Prompt salvo"); onChanged(); }}>Salvar prompt</Button></div>}
        </div>}
      </Drawer>

      <Modal open={!!preset} onClose={() => setPreset(null)} icon="image" title={preset?.id ? "Editar formato" : "Novo formato"}
        footer={<><Button variant="secondary" onClick={() => setPreset(null)}>{ro ? "Fechar" : "Cancelar"}</Button>{canEdit && <Button disabled={!preset?.name.trim()} onClick={async () => { if (!preset) return; await upsertPreset(info.slug, c.id, preset.id ?? null, { ...preset, name: preset.name.trim() }); toast.success("Formato salvo"); setPreset(null); onChanged(); }}>Salvar</Button>}</>}>
        {preset && <div className="e-stack" style={{ gap: 10 }}>
          <div className="preset-edit">
            <PresetFrame dimension={preset.dimension ?? null} />
            <div className="e-stack e-grow" style={{ gap: 10 }}>
              <Field label="Nome" autoFocus value={preset.name} disabled={ro} placeholder="Feed" onChange={(e) => setPreset({ ...preset, name: e.target.value })} />
              <Field label="Dimensão (px)" value={preset.dimension ?? ""} disabled={ro} placeholder="1080×1350" error={preset.dimension && !parseDimension(preset.dimension) ? "Use largura×altura, ex.: 1080×1350" : undefined} onChange={(e) => setPreset({ ...preset, dimension: e.target.value })} />
            </div>
          </div>
          <Select label="Formato" value={preset.format ?? ""} disabled={ro} placeholder="Escolha" onChange={(v) => setPreset({ ...preset, format: v })} options={CONTENT_FORMATS.map((f) => ({ value: f.key, label: f.label }))} />
          <Field label="Área segura" optional value={preset.safe_area ?? ""} disabled={ro} onChange={(e) => setPreset({ ...preset, safe_area: e.target.value })} />
          <Field label="Margens" optional value={preset.margins ?? ""} disabled={ro} onChange={(e) => setPreset({ ...preset, margins: e.target.value })} />
          <Field label="Posição do logo" optional value={preset.logo_position ?? ""} disabled={ro} onChange={(e) => setPreset({ ...preset, logo_position: e.target.value })} />
          <TextArea label="Tipografia e hierarquia" optional rows={2} value={preset.typography ?? ""} disabled={ro} onChange={(e) => setPreset({ ...preset, typography: e.target.value })} />
          <TextArea label="Tratamento de imagem" optional rows={2} value={preset.image_treatment ?? ""} disabled={ro} onChange={(e) => setPreset({ ...preset, image_treatment: e.target.value })} />
        </div>}
      </Modal>

      <Modal open={!!model} onClose={() => setModel(null)} icon="layers" title={model?.id ? "Modelo de peça" : "Novo modelo de peça"}
        footer={<>{canEdit && model?.id && <Button variant="ghost" icon="trash" onClick={async () => { await removeModel(info.slug, c.id, model.id!); setModel(null); onChanged(); }}>Excluir</Button>}<span style={{ flex: 1 }} /><Button variant="secondary" onClick={() => setModel(null)}>{ro ? "Fechar" : "Cancelar"}</Button>{canEdit && <Button disabled={!model?.name.trim()} onClick={async () => { if (!model) return; await upsertModel(info.slug, c.id, model.id ?? null, { ...model, name: model.name.trim() }); toast.success("Modelo salvo"); setModel(null); onChanged(); }}>Salvar</Button>}</>}>
        {model && <div className="e-stack" style={{ gap: 10 }}>
          <div className="grid-2" style={{ gap: 10 }}>
            <Field label="Nome" autoFocus value={model.name} disabled={ro} placeholder="Educativo" onChange={(e) => setModel({ ...model, name: e.target.value })} />
            <Select label="Formato" value={model.format ?? ""} disabled={ro} placeholder="Escolha" onChange={(v) => setModel({ ...model, format: v })} options={CONTENT_FORMATS.map((f) => ({ value: f.key, label: f.label }))} />
            <Select label="Formato de produção" value={model.preset_id ?? ""} disabled={ro} placeholder="Nenhum" onChange={(v) => setModel({ ...model, preset_id: v || null })} options={[{ value: "", label: "Nenhum" }, ...c.presets.map((p) => ({ value: p.id, label: `${p.name}${p.dimension ? ` · ${p.dimension}` : ""}` }))]} />
            <Field label="Objetivo" optional value={model.objective ?? ""} disabled={ro} onChange={(e) => setModel({ ...model, objective: e.target.value })} />
          </div>
          {model.format === "carrossel" && <div className="grid-2" style={{ gap: 10 }}>
            <Field label="Capa" optional value={model.carousel_cover_structure ?? ""} disabled={ro} onChange={(e) => setModel({ ...model, carousel_cover_structure: e.target.value })} />
            <Field label="Páginas" optional value={model.carousel_page_count ?? ""} disabled={ro} placeholder="5 a 7" onChange={(e) => setModel({ ...model, carousel_page_count: e.target.value })} />
            <Field label="Página final" optional value={model.carousel_final_page ?? ""} disabled={ro} onChange={(e) => setModel({ ...model, carousel_final_page: e.target.value })} />
          </div>}
          <Field label="CTA" optional value={model.carousel_cta ?? ""} disabled={ro} onChange={(e) => setModel({ ...model, carousel_cta: e.target.value })} />
          <div className="grid-2" style={{ gap: 10 }}>
            <TextArea label="Elementos obrigatórios" optional rows={4} help="Um por linha. Viram checklist da avaliação interna no Like." value={model.carousel_required_elements ?? ""} disabled={ro} onChange={(e) => setModel({ ...model, carousel_required_elements: e.target.value })} />
            <TextArea label="Elementos proibidos" optional rows={4} help="Um por linha." value={model.carousel_forbidden_elements ?? ""} disabled={ro} onChange={(e) => setModel({ ...model, carousel_forbidden_elements: e.target.value })} />
          </div>
          <Field label="Padrão de nome do arquivo" optional value={model.naming_pattern ?? ""} disabled={ro} help={model.naming_pattern ? `Prévia: ${previewNamingPattern(model.naming_pattern, { cliente: info.name.replace(/\s+/g, ""), canal: c.name, formato: model.format ?? "peca", tema: "Outono" })}` : "Use [CLIENTE], [CANAL], [FORMATO], [TEMA] e [DATA]."} onChange={(e) => setModel({ ...model, naming_pattern: e.target.value })} />
          <TextArea label="Prompt" optional rows={3} value={model.prompt ?? ""} disabled={ro} onChange={(e) => setModel({ ...model, prompt: e.target.value })} />
          <Switch checked={model.status !== "inativo"} disabled={ro} onChange={(v) => setModel({ ...model, status: v ? "ativo" : "inativo" })} label="Modelo ativo" />
        </div>}
      </Modal>
    </>
  );
}
