// Identidade Visual (Acabamento da Marca) — Master, Canais, Paleta, Presets
// de produção e Modelos de conteúdo. Cada canal herda por padrão as cores da
// Identidade Master via referência (brand_identity_channel_color_refs), sem
// duplicar dados; cores específicas de um canal usam o mesmo registro com
// channel_id preenchido. Presets = regra técnica de produção; Modelos = tipo
// de conteúdo — propositalmente duas tabelas para não confundir os conceitos.
import { supabase } from "@/integrations/supabase/client";
import type { StoredFile } from "@/lib/storage";

const db = supabase as any;

// ---------------------------------------------------------------------------
// Identidade Visual Master
// ---------------------------------------------------------------------------

export type BrandIdentityMaster = {
  brand_id: string;
  typography: string | null;
  graphic_elements: string | null;
  photo_direction: string | null;
  visual_direction: string | null;
  icon_style: string | null;
  general_rules: string | null;
  manual_attachments: StoredFile[];
  created_at: string;
  updated_at: string;
};

export async function getBrandIdentityMaster(brandId: string): Promise<BrandIdentityMaster | null> {
  const { data, error } = await db.from("brand_identity_master").select("*").eq("brand_id", brandId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveBrandIdentityMaster(brandId: string, patch: Partial<BrandIdentityMaster>) {
  const { data, error } = await db
    .from("brand_identity_master")
    .upsert({ brand_id: brandId, ...patch }, { onConflict: "brand_id" })
    .select()
    .single();
  if (error) throw error;
  return data as BrandIdentityMaster;
}

// ---------------------------------------------------------------------------
// Paleta de cores — Master (channel_id null) ou específica de um canal
// ---------------------------------------------------------------------------

export const COLOR_CATEGORIES = [
  { key: "primaria", label: "Primária" },
  { key: "secundaria", label: "Secundária" },
  { key: "apoio", label: "Apoio" },
  { key: "neutra", label: "Neutra" },
  { key: "destaque", label: "Destaque" },
] as const;

/** 'manual' = cadastrada à mão; 'logo'/'capa' = extraída automaticamente de
 * um ativo (ver src/lib/color-extraction.ts) — mostrado como origem na UI. */
export type ColorSource = "manual" | "logo" | "capa";

export type BrandIdentityColor = {
  id: string;
  brand_id: string;
  channel_id: string | null;
  name: string;
  hex: string | null;
  rgb: string | null;
  cmyk: string | null;
  pantone: string | null;
  category: string;
  note: string | null;
  source: ColorSource;
  order_index: number;
  created_at: string;
  updated_at: string;
};

/** HEX → "R, G, B" — calculado automaticamente sempre que o hex for válido. */
export function hexToRgbString(hex: string): string | null {
  const m = hex.trim().replace(/^#/, "").match(/^([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

export async function listMasterColors(brandId: string): Promise<BrandIdentityColor[]> {
  const { data, error } = await db.from("brand_identity_colors").select("*").eq("brand_id", brandId).is("channel_id", null).order("order_index");
  if (error) throw error;
  return (data ?? []) as BrandIdentityColor[];
}

export async function listChannelColors(channelId: string): Promise<BrandIdentityColor[]> {
  const { data, error } = await db.from("brand_identity_colors").select("*").eq("channel_id", channelId).order("order_index");
  if (error) throw error;
  return (data ?? []) as BrandIdentityColor[];
}

export async function createColor(input: { brand_id: string; channel_id?: string | null; name: string; hex?: string | null; cmyk?: string | null; pantone?: string | null; category?: string; note?: string | null; order_index?: number }) {
  const { data, error } = await db
    .from("brand_identity_colors")
    .insert({ ...input, rgb: input.hex ? hexToRgbString(input.hex) : null })
    .select()
    .single();
  if (error) throw error;
  return data as BrandIdentityColor;
}

export async function updateColor(id: string, patch: Partial<BrandIdentityColor>) {
  const nextPatch = { ...patch };
  if (patch.hex !== undefined) nextPatch.rgb = patch.hex ? hexToRgbString(patch.hex) : null;
  const { error } = await db.from("brand_identity_colors").update(nextPatch).eq("id", id);
  if (error) throw error;
}

export async function deleteColor(id: string) {
  const { error } = await db.from("brand_identity_colors").delete().eq("id", id);
  if (error) throw error;
}

/** Aplica uma paleta sugerida como a paleta ativa da marca (Master, sem
 * canal): substitui apenas as cores com origem 'logo'/'capa' já existentes
 * — nunca apaga cores cadastradas manualmente pela pessoa (decisão
 * manual preservada). */
export async function applySuggestedPalette(brandId: string, colors: { hex: string; source: "logo" | "capa" | "derivada" }[]) {
  const { error: delError } = await db
    .from("brand_identity_colors")
    .delete()
    .eq("brand_id", brandId)
    .is("channel_id", null)
    .in("source", ["logo", "capa"]);
  if (delError) throw delError;
  if (colors.length === 0) return;
  const rows = colors.map((c, i) => ({
    brand_id: brandId,
    channel_id: null,
    name: `Cor ${i + 1}`,
    hex: c.hex,
    rgb: hexToRgbString(c.hex),
    category: i === 0 ? "primaria" : i === 1 ? "secundaria" : "apoio",
    source: c.source === "derivada" ? "logo" : c.source,
    order_index: i,
  }));
  const { error } = await db.from("brand_identity_colors").insert(rows);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Sugestões de paleta (cache) — geradas sob demanda a partir de logo/capa
// ---------------------------------------------------------------------------

export async function saveSuggestedPalettes(brandId: string, palettes: unknown) {
  const { error } = await db.from("brands").update({ suggested_palettes: palettes }).eq("id", brandId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Canais — Instagram, Offline, Site, WhatsApp, Outros + personalizados
// ---------------------------------------------------------------------------

export const SUGGESTED_CHANNELS = [
  { key: "instagram", name: "Instagram" },
  { key: "offline", name: "Offline" },
  { key: "site", name: "Site" },
  { key: "whatsapp", name: "WhatsApp" },
  { key: "outros", name: "Outros" },
] as const;

export type BrandIdentityChannel = {
  id: string;
  brand_id: string;
  key: string;
  name: string;
  active: boolean;
  general_prompt: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
};

export async function listChannels(brandId: string): Promise<BrandIdentityChannel[]> {
  const { data, error } = await db.from("brand_identity_channels").select("*").eq("brand_id", brandId).order("order_index");
  if (error) throw error;
  return (data ?? []) as BrandIdentityChannel[];
}

function slugKey(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || `canal-${Date.now()}`;
}

export async function createChannel(brandId: string, name: string, key?: string) {
  const { data, error } = await db
    .from("brand_identity_channels")
    .insert({ brand_id: brandId, name: name.trim(), key: key ?? slugKey(name) })
    .select()
    .single();
  if (error) throw error;
  return data as BrandIdentityChannel;
}

export async function updateChannel(id: string, patch: Partial<BrandIdentityChannel>) {
  const { error } = await db.from("brand_identity_channels").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteChannel(id: string) {
  const { error } = await db.from("brand_identity_channels").delete().eq("id", id);
  if (error) throw error;
}

/** Cores da Master já vinculadas a este canal (por referência, sem cópia). */
export async function listChannelMasterColorRefs(channelId: string): Promise<string[]> {
  const { data, error } = await db.from("brand_identity_channel_color_refs").select("color_id").eq("channel_id", channelId);
  if (error) throw error;
  return ((data ?? []) as { color_id: string }[]).map((r) => r.color_id);
}

export async function setChannelMasterColorRefs(channelId: string, colorIds: string[]) {
  const { error: delError } = await db.from("brand_identity_channel_color_refs").delete().eq("channel_id", channelId);
  if (delError) throw delError;
  if (colorIds.length === 0) return;
  const { error } = await db.from("brand_identity_channel_color_refs").insert(colorIds.map((color_id) => ({ channel_id: channelId, color_id })));
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Presets de produção — regra técnica/visual (Stories, Estático, Carrossel…)
// ---------------------------------------------------------------------------

export const SUGGESTED_PRESETS = ["Stories", "Estático", "Carrossel"] as const;

export type BrandIdentityPreset = {
  id: string;
  channel_id: string;
  name: string;
  format: string | null;
  dimension: string | null;
  margins: string | null;
  safe_area: string | null;
  typography: string | null;
  hierarchy: string | null;
  text_sizes: string | null;
  logo_position: string | null;
  image_treatment: string | null;
  graphic_elements: string | null;
  composition_rules: string | null;
  notes: string | null;
  attachments: StoredFile[];
  active: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
};

export async function listPresets(channelId: string): Promise<BrandIdentityPreset[]> {
  const { data, error } = await db.from("brand_identity_presets").select("*").eq("channel_id", channelId).order("order_index");
  if (error) throw error;
  return (data ?? []) as BrandIdentityPreset[];
}

export async function createPreset(channelId: string, input: Partial<BrandIdentityPreset> & { name: string }) {
  const { data, error } = await db.from("brand_identity_presets").insert({ ...input, channel_id: channelId }).select().single();
  if (error) throw error;
  return data as BrandIdentityPreset;
}

export async function updatePreset(id: string, patch: Partial<BrandIdentityPreset>) {
  const { error } = await db.from("brand_identity_presets").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deletePreset(id: string) {
  const { error } = await db.from("brand_identity_presets").delete().eq("id", id);
  if (error) throw error;
}

export async function duplicatePreset(preset: BrandIdentityPreset) {
  const { id, created_at, updated_at, ...rest } = preset;
  return createPreset(preset.channel_id, { ...rest, name: `${preset.name} (cópia)` });
}

// ---------------------------------------------------------------------------
// Modelos de conteúdo — tipo específico de peça (livre, sem categoria fixa)
// ---------------------------------------------------------------------------

export const CONTENT_FORMATS = [
  { key: "stories", label: "Stories" },
  { key: "estatico", label: "Estático" },
  { key: "carrossel", label: "Carrossel" },
] as const;

export const SUGGESTED_MODEL_NAMES = ["Conteúdo", "Notícia", "Lifestyle", "Oferta", "Institucional", "Educativo", "Depoimento"] as const;

export type BrandIdentityModel = {
  id: string;
  channel_id: string;
  preset_id: string | null;
  name: string;
  format: string | null;
  category: string | null;
  objective: string | null;
  description: string | null;
  visual_direction: string | null;
  structure: string | null;
  naming_pattern: string | null;
  prompt: string | null;
  status: "ativo" | "inativo";
  carousel_cover_structure: string | null;
  carousel_pages_structure: string | null;
  carousel_page_count: string | null;
  carousel_hierarchy: string | null;
  carousel_title_treatment: string | null;
  carousel_text_treatment: string | null;
  carousel_cta: string | null;
  carousel_final_page: string | null;
  carousel_required_elements: string | null;
  carousel_forbidden_elements: string | null;
  attachments: StoredFile[];
  order_index: number;
  created_at: string;
  updated_at: string;
};

export async function listModels(channelId: string): Promise<BrandIdentityModel[]> {
  const { data, error } = await db.from("brand_identity_models").select("*").eq("channel_id", channelId).order("order_index");
  if (error) throw error;
  return (data ?? []) as BrandIdentityModel[];
}

export async function createModel(channelId: string, input: Partial<BrandIdentityModel> & { name: string }) {
  const { data, error } = await db.from("brand_identity_models").insert({ ...input, channel_id: channelId }).select().single();
  if (error) throw error;
  return data as BrandIdentityModel;
}

export async function updateModel(id: string, patch: Partial<BrandIdentityModel>) {
  const { error } = await db.from("brand_identity_models").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteModel(id: string) {
  const { error } = await db.from("brand_identity_models").delete().eq("id", id);
  if (error) throw error;
}

export async function duplicateModel(model: BrandIdentityModel) {
  const { id, created_at, updated_at, ...rest } = model;
  return createModel(model.channel_id, { ...rest, name: `${model.name} (cópia)` });
}

/** Exemplo de nome de arquivo a partir do padrão de nomenclatura definido
 * (ex.: "[CLIENTE][CANAL][FORMATO][TEMA][DATA]"). */
export function previewNamingPattern(pattern: string, vars: { cliente: string; canal: string; formato: string; tema?: string }): string {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return pattern
    .replace(/\[CLIENTE\]/gi, vars.cliente)
    .replace(/\[CANAL\]/gi, vars.canal)
    .replace(/\[FORMATO\]/gi, vars.formato)
    .replace(/\[TEMA\]/gi, vars.tema || "TEMA")
    .replace(/\[DATA\]/gi, today);
}
