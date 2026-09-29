// ---------------------------------------------------------------------------
// BRAND — Configurações do cliente, identidade visual e personalização (página 10)
//
// Identidade mestre, paleta, canais, presets de formato (usados pelo Like para
// enquadrar prévias) e modelos de peça; espaço do cliente (capa, logo, avatar,
// cores); informações, acessos e histórico. Sem banco, roda em memória.
// ---------------------------------------------------------------------------
import { supabase } from "@/integrations/supabase/client";
import {
  addBrandMember, cancelBrandInvite, getBrandBySlug, listBrandAccessLogs, listBrandInvites, listClientProfiles, removeBrandMember, updateBrand, updateBrandMemberAccess,
  type BrandAccessLog, type BrandInvite,
} from "@/lib/reach-data";
import {
  applySuggestedPalette, createChannel, createColor, createModel, createPreset, deleteChannel, deleteColor, deleteModel, deletePreset, getBrandIdentityMaster, hexToRgbString,
  listChannelMasterColorRefs, listChannels, listMasterColors, listModels, listPresets, saveBrandIdentityMaster, saveSuggestedPalettes, setChannelMasterColorRefs, updateChannel, updateColor, updateModel, updatePreset,
  type BrandIdentityChannel, type BrandIdentityColor, type BrandIdentityMaster, type BrandIdentityModel, type BrandIdentityPreset,
} from "@/lib/identity-data";
import type { PaletteSuggestion } from "@/lib/color-extraction";
import { isDemoMode } from "@/lib/home-data";

const db = supabase as any;
const now = () => new Date().toISOString();
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`;
const clone = <T,>(x: T): T => structuredClone(x);

export type BrandInfo = {
  id: string; slug: string; name: string; segment: string; description: string; contact_name: string; contact_email: string; notes: string;
  logo_url: string | null; logo_frame: unknown; cover_url: string | null; cover_frame: unknown; primary_color: string | null; accent_color: string | null;
  suggested_palettes: PaletteSuggestion[] | null;
};
export type ChannelFull = BrandIdentityChannel & { presets: BrandIdentityPreset[]; models: BrandIdentityModel[]; colorRefs: string[] };
export type Identity = { master: Partial<BrandIdentityMaster>; colors: BrandIdentityColor[]; channels: ChannelFull[] };
export type Member = { user_id: string; name: string | null; email: string | null; member_role: string; is_admin: boolean; permissions: string[]; created_at: string | null; last_access: string | null };
export type Access = { members: Member[]; invites: BrandInvite[]; logs: BrandAccessLog[]; linkable: { id: string; name: string }[] };

/** "1080×1350", "1080 x 1350", "1080X1350" → { w, h }. */
export function parseDimension(dim: string | null | undefined): { w: number; h: number } | null {
  const m = String(dim ?? "").match(/(\d{2,5})\s*[x×X*]\s*(\d{2,5})/);
  return m ? { w: Number(m[1]), h: Number(m[2]) } : null;
}

// ----- exemplo em memória -----------------------------------------------------

type DemoBrand = { info: BrandInfo; identity: Identity; access: Access };
const demoStore = new Map<string, DemoBrand>();
function demo(slug: string): DemoBrand {
  if (demoStore.has(slug)) return demoStore.get(slug)!;
  const t = now();
  const b = `b-${slug}`;
  const name = slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ").replace("Fina Fragrancia", "Fina Fragrância");
  const col = (id: string, n: string, hex: string, category: string, source: "manual" | "logo" | "capa", i: number, extra: Partial<BrandIdentityColor> = {}): BrandIdentityColor => ({ id, brand_id: b, channel_id: null, name: n, hex, rgb: hexToRgbString(hex), cmyk: null, pantone: null, category, note: null, source, order_index: i, created_at: t, updated_at: t, ...extra });
  const preset = (id: string, channel_id: string, n: string, format: string, dimension: string, safe: string, i: number): BrandIdentityPreset => ({ id, channel_id, name: n, format, dimension, margins: "64 px nas laterais", safe_area: safe, typography: "Títulos em serifada, 64–72 pt; texto em sans 28–32 pt", hierarchy: "Título › apoio › assinatura", text_sizes: null, logo_position: "Canto inferior direito, 72 px", image_treatment: "Luz natural, contraste suave, tons quentes", graphic_elements: "Linha fina dourada", composition_rules: "Produto sempre no terço inferior", notes: null, attachments: [], active: true, order_index: i, created_at: t, updated_at: t });
  const model = (id: string, channel_id: string, preset_id: string, n: string, format: string, i: number, extra: Partial<BrandIdentityModel> = {}): BrandIdentityModel => ({
    id, channel_id, preset_id, name: n, format, category: null, objective: null, description: null, visual_direction: null, structure: null, naming_pattern: "[CLIENTE]_[CANAL]_[FORMATO]_[TEMA]_[DATA]", prompt: null, status: "ativo",
    carousel_cover_structure: null, carousel_pages_structure: null, carousel_page_count: null, carousel_hierarchy: null, carousel_title_treatment: null, carousel_text_treatment: null, carousel_cta: null, carousel_final_page: null, carousel_required_elements: null, carousel_forbidden_elements: null,
    attachments: [], order_index: i, created_at: t, updated_at: t, ...extra,
  });
  const ch = (id: string, key: string, n: string, active: boolean, i: number, presets: BrandIdentityPreset[], models: BrandIdentityModel[], colorRefs: string[], prompt: string | null = null): ChannelFull => ({ id, brand_id: b, key, name: n, active, general_prompt: prompt, order_index: i, created_at: t, updated_at: t, presets, models, colorRefs });
  const data: DemoBrand = {
    info: { id: b, slug, name, segment: "Perfumaria artesanal", description: "Perfumes autorais feitos à mão em pequenos lotes, com matérias-primas naturais.", contact_name: "Carla Mendes", contact_email: `carla@${slug}.com.br`, notes: "Prefere aprovar às terças e quintas.", logo_url: null, logo_frame: null, cover_url: null, cover_frame: null, primary_color: "#8C4A6B", accent_color: "#D9A15B", suggested_palettes: null },
    identity: {
      master: { visual_direction: "Elegante, sensorial e artesanal. Muito respiro, poucos elementos, matéria-prima em destaque.", typography: "Títulos: Cormorant Garamond. Texto: Inter.", photo_direction: "Luz natural lateral, fundos em pedra e linho, mãos em cena.", icon_style: "Traço fino, cantos arredondados.", graphic_elements: "Linha dourada fina e selo do ateliê.", general_rules: "Nunca usar fundo branco puro. Logo sempre com área de respiro de 1× a altura do símbolo.", manual_attachments: [] },
      colors: [col("co1", "Ameixa", "#8C4A6B", "primaria", "logo", 0), col("co2", "Âmbar", "#D9A15B", "destaque", "logo", 1), col("co3", "Linho", "#F2EBE1", "neutra", "capa", 2), col("co4", "Grafite", "#2E2A2B", "neutra", "manual", 3, { pantone: "Black 7 C", cmyk: "0, 10, 5, 85" }), col("co5", "Sálvia", "#9CAF95", "apoio", "manual", 4)],
      channels: [
        ch("ch1", "instagram", "Instagram", true, 0, [preset("pr1", "ch1", "Feed", "estatico", "1080×1350", "Margem de 120 px no topo e na base", 0), preset("pr2", "ch1", "Stories", "stories", "1080×1920", "250 px livres no topo e na base (interface)", 1), preset("pr3", "ch1", "Carrossel", "carrossel", "1080×1350", "Margem de 120 px no topo e na base", 2)],
          [model("mo1", "ch1", "pr3", "Educativo", "carrossel", 0, { objective: "Ensinar algo útil sobre perfumes", carousel_cover_structure: "Pergunta curta + imagem do frasco", carousel_page_count: "5 a 7", carousel_cta: "Salve para consultar depois", carousel_final_page: "Assinatura do ateliê + @", carousel_required_elements: "Logo na última página\nNúmero da página\nFonte mínima de 28 pt", carousel_forbidden_elements: "Fundo branco puro\nMais de 30 palavras por página" }), model("mo2", "ch1", "pr1", "Lançamento", "estatico", 1, { objective: "Apresentar um novo perfume", carousel_required_elements: "Nome da fragrância\nNotas principais\nPreço ou “em breve”" })],
          ["co1", "co2", "co3"], "Tom sensorial e acolhedor; frases curtas; sempre convidar a sentir."),
        ch("ch2", "tiktok", "TikTok", true, 1, [preset("pr4", "ch2", "Vídeo vertical", "stories", "1080×1920", "Evitar 300 px à direita (botões)", 0)], [], ["co1", "co4"]),
        ch("ch3", "site", "Site", false, 2, [], [], []),
      ],
    },
    access: {
      members: [
        { user_id: "u-carla", name: "Carla Mendes", email: `carla@${slug}.com.br`, member_role: "client", is_admin: true, permissions: ["espaco360.visualizar", "like.visualizar", "like.comentar", "like.aprovar", "biblioteca.visualizar", "biblioteca.criar"], created_at: "2026-03-02T10:00:00Z", last_access: new Date(Date.now() - 86400e3).toISOString() },
        { user_id: "u-paulo", name: "Paulo Nunes", email: `paulo@${slug}.com.br`, member_role: "client", is_admin: false, permissions: ["espaco360.visualizar", "like.visualizar", "like.comentar"], created_at: "2026-05-18T10:00:00Z", last_access: new Date(Date.now() - 6 * 86400e3).toISOString() },
      ],
      invites: [{ id: "bi1", brand_id: b, email: `marketing@${slug}.com.br`, name: "Equipe de marketing", member_role: "viewer", status: "pendente", invited_by: null, accepted_at: null, created_at: new Date(Date.now() - 3 * 86400e3).toISOString(), updated_at: t, permissions: ["espaco360.visualizar"] }],
      logs: Array.from({ length: 8 }, (_, i) => ({ id: `lg${i}`, brand_id: b, user_id: i % 3 ? "u-carla" : "u-paulo", user_email: i % 3 ? `carla@${slug}.com.br` : `paulo@${slug}.com.br`, event: i % 4 ? "acesso" : "aprovação", context: i % 4 ? "Espaço 360" : "Like · Carrossel Notas de outono", status: "ok", created_at: new Date(Date.now() - i * 1.3 * 86400e3).toISOString() })),
      linkable: [{ id: "u-luiza", name: "Luiza Prado (cliente)" }],
    },
  };
  demoStore.set(slug, data);
  return data;
}

// ----- leitura ----------------------------------------------------------------

export async function loadBrandInfo(slug: string): Promise<BrandInfo | null> {
  if (isDemoMode()) return clone(demo(slug).info);
  const b = (await getBrandBySlug(slug)) as any;
  if (!b) return null;
  return {
    id: b.id, slug: b.slug, name: b.name, segment: b.segment ?? "", description: b.description ?? "", contact_name: b.contact_name ?? "", contact_email: b.contact_email ?? "", notes: b.notes ?? "",
    logo_url: b.logo_url ?? null, logo_frame: b.logo_frame ?? null, cover_url: b.cover_url ?? null, cover_frame: b.cover_frame ?? null, primary_color: b.primary_color ?? null, accent_color: b.accent_color ?? null,
    suggested_palettes: b.suggested_palettes ?? null,
  };
}

export async function loadIdentity(slug: string, brandId: string): Promise<Identity> {
  if (isDemoMode()) return clone(demo(slug).identity);
  const [master, colors, channels] = await Promise.all([getBrandIdentityMaster(brandId), listMasterColors(brandId), listChannels(brandId)]);
  const full = await Promise.all(channels.map(async (c) => {
    const [presets, models, colorRefs] = await Promise.all([listPresets(c.id), listModels(c.id), listChannelMasterColorRefs(c.id)]);
    return { ...c, presets, models, colorRefs };
  }));
  return { master: master ?? {}, colors, channels: full };
}

export async function loadAccess(slug: string, brandId: string, agency: boolean): Promise<Access> {
  if (isDemoMode()) return clone(demo(slug).access);
  const [{ data }, invites, logs, profiles] = await Promise.all([
    db.from("brand_members").select("user_id, member_role, is_admin, permissions, created_at, profiles!brand_members_user_id_profiles_fkey(display_name, email)").eq("brand_id", brandId),
    listBrandInvites(brandId).catch(() => [] as BrandInvite[]),
    listBrandAccessLogs(brandId).catch(() => [] as BrandAccessLog[]),
    agency ? listClientProfiles().catch(() => []) : Promise.resolve([]),
  ]);
  const last = new Map<string, string>();
  for (const l of logs) if (l.user_id && !last.has(l.user_id)) last.set(l.user_id, l.created_at);
  const members: Member[] = ((data ?? []) as any[]).map((m) => ({ user_id: m.user_id, member_role: m.member_role, is_admin: !!m.is_admin, permissions: m.permissions ?? [], created_at: m.created_at ?? null, name: m.profiles?.display_name ?? null, email: m.profiles?.email ?? null, last_access: last.get(m.user_id) ?? null }));
  return { members, invites: invites.filter((i) => i.status === "pendente"), logs, linkable: (profiles as any[]).filter((p) => !members.some((m) => m.user_id === p.id)).map((p) => ({ id: p.id, name: p.display_name ?? p.email ?? p.id })) };
}

/** Presets ativos de todos os canais — o Like usa para enquadrar prévias. */
export async function listFramePresets(slug: string, brandId: string) {
  const { channels } = await loadIdentity(slug, brandId);
  return channels.filter((c) => c.active).flatMap((c) => c.presets.filter((p) => p.active).map((p) => ({ id: p.id, channel: c.name, name: p.name, dimension: parseDimension(p.dimension), safeArea: p.safe_area })));
}

// ----- escrita: espaço e informações ------------------------------------------

export async function saveBrandPatch(slug: string, brandId: string, patch: Partial<BrandInfo>) {
  if (isDemoMode()) { const d = demo(slug); d.info = { ...d.info, ...clone(patch) }; return; }
  const { id: _i, slug: _s, suggested_palettes: _p, ...row } = patch as any;
  const clean = Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v === "" ? null : v]));
  await updateBrand(brandId, clean as never);
}

export async function cachePalettes(slug: string, brandId: string, palettes: PaletteSuggestion[]) {
  if (isDemoMode()) { demo(slug).info.suggested_palettes = clone(palettes); return; }
  await saveSuggestedPalettes(brandId, palettes);
}

// ----- escrita: identidade ------------------------------------------------------

export async function saveMaster(slug: string, brandId: string, patch: Partial<BrandIdentityMaster>) {
  if (isDemoMode()) { const d = demo(slug); d.identity.master = { ...d.identity.master, ...clone(patch) }; return; }
  await saveBrandIdentityMaster(brandId, patch);
}

export async function upsertColor(slug: string, brandId: string, id: string | null, patch: Partial<BrandIdentityColor> & { name: string }) {
  if (isDemoMode()) {
    const d = demo(slug);
    const rgb = patch.hex ? hexToRgbString(patch.hex) : null;
    if (id) d.identity.colors = d.identity.colors.map((c) => (c.id === id ? { ...c, ...patch, rgb: patch.hex !== undefined ? rgb : c.rgb } : c));
    else d.identity.colors.push({ id: uid("co"), brand_id: brandId, channel_id: null, hex: null, rgb, cmyk: null, pantone: null, category: "apoio", note: null, source: "manual", order_index: d.identity.colors.length, created_at: now(), updated_at: now(), ...patch });
    return;
  }
  if (id) await updateColor(id, patch);
  else await createColor({ brand_id: brandId, name: patch.name, hex: patch.hex ?? null, category: patch.category ?? "apoio", cmyk: patch.cmyk ?? null, pantone: patch.pantone ?? null });
}

export async function removeColor(slug: string, id: string) {
  if (isDemoMode()) { const d = demo(slug); d.identity.colors = d.identity.colors.filter((c) => c.id !== id); d.identity.channels.forEach((c) => (c.colorRefs = c.colorRefs.filter((r) => r !== id))); return; }
  await deleteColor(id);
}

/** Aplica a paleta sugerida: troca só as cores extraídas; as manuais ficam. */
export async function applyPalette(slug: string, brandId: string, colors: { hex: string; source: "logo" | "capa" | "derivada" }[]) {
  if (isDemoMode()) {
    const d = demo(slug);
    const manual = d.identity.colors.filter((c) => c.source === "manual");
    const fresh = colors.map((c, i) => ({ id: uid("co"), brand_id: brandId, channel_id: null, name: `Cor ${i + 1}`, hex: c.hex, rgb: hexToRgbString(c.hex), cmyk: null, pantone: null, category: i === 0 ? "primaria" : i === 1 ? "secundaria" : "apoio", note: null, source: (c.source === "derivada" ? "logo" : c.source) as "logo" | "capa", order_index: i, created_at: now(), updated_at: now() }));
    d.identity.colors = [...fresh, ...manual.map((c, i) => ({ ...c, order_index: fresh.length + i }))];
    return;
  }
  await applySuggestedPalette(brandId, colors);
}

export async function upsertChannel(slug: string, brandId: string, id: string | null, patch: Partial<BrandIdentityChannel> & { name?: string }) {
  if (isDemoMode()) {
    const d = demo(slug);
    if (id) d.identity.channels = d.identity.channels.map((c) => (c.id === id ? { ...c, ...patch } : c));
    else d.identity.channels.push({ id: uid("ch"), brand_id: brandId, key: (patch.name ?? "canal").toLowerCase(), name: patch.name ?? "Canal", active: true, general_prompt: null, order_index: d.identity.channels.length, created_at: now(), updated_at: now(), presets: [], models: [], colorRefs: [] });
    return;
  }
  if (id) await updateChannel(id, patch);
  else await createChannel(brandId, patch.name ?? "Canal");
}

export async function removeChannel(slug: string, id: string) {
  if (isDemoMode()) { const d = demo(slug); d.identity.channels = d.identity.channels.filter((c) => c.id !== id); return; }
  await deleteChannel(id);
}

export async function reorderChannels(slug: string, ids: string[]) {
  if (isDemoMode()) { const d = demo(slug); d.identity.channels.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)); d.identity.channels.forEach((c, i) => (c.order_index = i)); return; }
  for (const [i, id] of ids.entries()) await updateChannel(id, { order_index: i });
}

export async function setChannelColors(slug: string, channelId: string, colorIds: string[]) {
  if (isDemoMode()) { const c = demo(slug).identity.channels.find((x) => x.id === channelId); if (c) c.colorRefs = [...colorIds]; return; }
  await setChannelMasterColorRefs(channelId, colorIds);
}

export async function upsertPreset(slug: string, channelId: string, id: string | null, patch: Partial<BrandIdentityPreset> & { name: string }) {
  if (isDemoMode()) {
    const c = demo(slug).identity.channels.find((x) => x.id === channelId)!;
    if (id) c.presets = c.presets.map((p) => (p.id === id ? { ...p, ...patch } : p));
    else c.presets.push({ id: uid("pr"), channel_id: channelId, format: null, dimension: null, margins: null, safe_area: null, typography: null, hierarchy: null, text_sizes: null, logo_position: null, image_treatment: null, graphic_elements: null, composition_rules: null, notes: null, attachments: [], active: true, order_index: c.presets.length, created_at: now(), updated_at: now(), ...patch });
    return;
  }
  const { id: _i, created_at: _c, updated_at: _u, ...rest } = patch as any;
  if (id) await updatePreset(id, rest);
  else await createPreset(channelId, rest);
}

export async function removePreset(slug: string, channelId: string, id: string) {
  if (isDemoMode()) { const c = demo(slug).identity.channels.find((x) => x.id === channelId)!; c.presets = c.presets.filter((p) => p.id !== id); return; }
  await deletePreset(id);
}

export async function upsertModel(slug: string, channelId: string, id: string | null, patch: Partial<BrandIdentityModel> & { name: string }) {
  if (isDemoMode()) {
    const c = demo(slug).identity.channels.find((x) => x.id === channelId)!;
    if (id) c.models = c.models.map((m) => (m.id === id ? { ...m, ...patch } : m));
    else c.models.push({ id: uid("mo"), channel_id: channelId, preset_id: null, format: null, category: null, objective: null, description: null, visual_direction: null, structure: null, naming_pattern: null, prompt: null, status: "ativo", carousel_cover_structure: null, carousel_pages_structure: null, carousel_page_count: null, carousel_hierarchy: null, carousel_title_treatment: null, carousel_text_treatment: null, carousel_cta: null, carousel_final_page: null, carousel_required_elements: null, carousel_forbidden_elements: null, attachments: [], order_index: c.models.length, created_at: now(), updated_at: now(), ...patch });
    return;
  }
  const { id: _i, created_at: _c, updated_at: _u, ...rest } = patch as any;
  if (id) await updateModel(id, rest);
  else await createModel(channelId, rest);
}

export async function removeModel(slug: string, channelId: string, id: string) {
  if (isDemoMode()) { const c = demo(slug).identity.channels.find((x) => x.id === channelId)!; c.models = c.models.filter((m) => m.id !== id); return; }
  await deleteModel(id);
}

// ----- escrita: acessos -----------------------------------------------------------

export async function inviteClientUser(slug: string, brandId: string, input: { name: string; email: string; role: "client" | "viewer" | "agency"; permissions: string[]; isAdmin: boolean }) {
  if (isDemoMode()) {
    const d = demo(slug);
    if (d.access.members.some((m) => m.email === input.email.toLowerCase())) throw new Error("Essa pessoa já tem acesso a este cliente.");
    d.access.invites.unshift({ id: uid("bi"), brand_id: brandId, email: input.email.toLowerCase(), name: input.name || null, member_role: input.role, status: "pendente", invited_by: null, accepted_at: null, created_at: now(), updated_at: now(), permissions: input.permissions, is_admin: input.isAdmin });
    return { sent: true, linked: false as boolean, warning: undefined as string | undefined };
  }
  const { inviteBrandUser } = await import("@/lib/invites.functions");
  const r = await inviteBrandUser({ data: { brandId, email: input.email.trim(), name: input.name.trim() || undefined, role: input.role, permissions: input.permissions, redirectTo: `${window.location.origin}/auth` } });
  return { sent: !!r.sent, linked: "linked" in r ? !!r.linked : false, warning: "warning" in r ? (r.warning as string | undefined) : undefined };
}

export async function linkExisting(slug: string, brandId: string, userId: string) {
  if (isDemoMode()) { const d = demo(slug); const p = d.access.linkable.find((x) => x.id === userId); d.access.linkable = d.access.linkable.filter((x) => x.id !== userId); d.access.members.push({ user_id: userId, name: p?.name ?? "Pessoa", email: null, member_role: "client", is_admin: false, permissions: ["espaco360.visualizar"], created_at: now(), last_access: null }); return; }
  await addBrandMember(brandId, userId, "client");
}

export async function setMemberAccess(slug: string, brandId: string, userId: string, patch: { permissions: string[]; is_admin: boolean }) {
  if (isDemoMode()) { const d = demo(slug); d.access.members = d.access.members.map((m) => (m.user_id === userId ? { ...m, ...patch } : m)); return; }
  await updateBrandMemberAccess(brandId, userId, patch);
}

export async function removeMember(slug: string, brandId: string, userId: string) {
  if (isDemoMode()) { const d = demo(slug); d.access.members = d.access.members.filter((m) => m.user_id !== userId); return; }
  await removeBrandMember(brandId, userId);
}

export async function cancelInvite(slug: string, id: string) {
  if (isDemoMode()) { const d = demo(slug); d.access.invites = d.access.invites.filter((i) => i.id !== id); return; }
  await cancelBrandInvite(id);
}
