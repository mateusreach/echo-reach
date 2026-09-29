// ---------------------------------------------------------------------------
// Echo · Notificações (sino, preferências por pessoa, resumo e e-mail)
// No banco: tabelas notifications e notification_prefs, preenchidas pelos
// gatilhos da migração echo_like_notify_links. No demo: memória, com as mesmas
// regras (evento desligado não entra; 1 lembrete por pessoa por dia).
// ---------------------------------------------------------------------------
import { supabase } from "@/integrations/supabase/client";
import { isDemoMode } from "./home-data";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
const nowISO = () => new Date().toISOString();
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 10)}`;

export type NotifyKind =
  | "like.nova_rodada" | "like.nova_versao" | "like.lembrete" | "like.mencao" | "like.resposta"
  | "like.comentario" | "like.decisao" | "like.ajuste" | "like.rodada_vencida";
export type Notification = { id: string; userId: string; brandSlug: string | null; kind: NotifyKind | string; title: string; body: string | null; link: string | null; readAt: string | null; createdAt: string; dedupeKey?: string | null };
export type Prefs = { events: Partial<Record<NotifyKind, boolean>>; inApp: boolean; email: boolean; dailyDigest: boolean; quietStart: string | null; quietEnd: string | null };

export const EVENTS: { kind: NotifyKind; label: string; who: "cliente" | "equipe" }[] = [
  { kind: "like.nova_rodada", label: "Novos materiais para aprovar", who: "cliente" },
  { kind: "like.nova_versao", label: "Nova versão de um material", who: "cliente" },
  { kind: "like.lembrete", label: "Lembrete de prazo", who: "cliente" },
  { kind: "like.resposta", label: "Resposta ao meu comentário", who: "cliente" },
  { kind: "like.mencao", label: "Menção com @", who: "cliente" },
  { kind: "like.comentario", label: "Comentário do cliente", who: "equipe" },
  { kind: "like.decisao", label: "Material aprovado ou reprovado", who: "equipe" },
  { kind: "like.ajuste", label: "Pedido de ajuste", who: "equipe" },
  { kind: "like.rodada_vencida", label: "Rodada vencida", who: "equipe" },
];
export const DEFAULT_PREFS: Prefs = { events: {}, inApp: true, email: true, dailyDigest: false, quietStart: "22:00", quietEnd: "08:00" };

// ----- Demo --------------------------------------------------------------------------------
const demo = { list: [] as Notification[], prefs: new Map<string, Prefs>(), listeners: new Set<() => void>() };
const emit = () => demo.listeners.forEach((f) => f());
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

export function inQuiet(p: Prefs, at = new Date()): boolean {
  if (!p.quietStart || !p.quietEnd) return false;
  const hm = `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
  return p.quietStart <= p.quietEnd ? hm >= p.quietStart && hm <= p.quietEnd : hm >= p.quietStart || hm <= p.quietEnd;
}

/**
 * Registra notificações (demo). Mesmas regras do banco: quem está com o evento
 * desligado não recebe; dedupeKey evita repetir (ex.: um lembrete por dia).
 */
export function demoNotify(userIds: string[], n: { brandSlug: string | null; kind: NotifyKind; title: string; body?: string | null; link?: string | null; dedupeKey?: string | null }, exceptUser?: string): number {
  let count = 0;
  for (const u of new Set(userIds)) {
    if (!u || u === exceptUser) continue;
    const p = demo.prefs.get(u) ?? DEFAULT_PREFS;
    if (p.events[n.kind] === false || (!p.inApp && !p.email)) continue;
    if (n.dedupeKey && demo.list.some((x) => x.userId === u && x.dedupeKey === n.dedupeKey)) continue;
    demo.list.unshift({ id: uid("nt"), userId: u, brandSlug: n.brandSlug, kind: n.kind, title: n.title, body: n.body ?? null, link: n.link ?? null, readAt: null, createdAt: nowISO(), dedupeKey: n.dedupeKey ?? null });
    count++;
  }
  if (count) emit();
  return count;
}
export const demoPrefsOf = (userId: string) => demo.prefs.get(userId) ?? DEFAULT_PREFS;

// ----- API ---------------------------------------------------------------------------------
export async function listNotifications(userId: string, limit = 30): Promise<Notification[]> {
  if (isDemoMode()) return clone(demo.list.filter((n) => n.userId === userId).slice(0, limit));
  const { data } = await db.from("notifications").select("*, brands(slug)").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
  return ((data ?? []) as any[]).map((n) => ({ id: n.id, userId: n.user_id, brandSlug: n.brands?.slug ?? null, kind: n.kind, title: n.title, body: n.body, link: n.link, readAt: n.read_at, createdAt: n.created_at }));
}

export async function markRead(ids: string[]) {
  if (isDemoMode()) { for (const n of demo.list) if (ids.includes(n.id)) n.readAt = n.readAt ?? nowISO(); emit(); return; }
  if (ids.length) await db.from("notifications").update({ read_at: nowISO() }).in("id", ids).is("read_at", null);
}

export async function getPrefs(userId: string): Promise<Prefs> {
  if (isDemoMode()) return clone(demoPrefsOf(userId));
  const { data } = await db.from("notification_prefs").select("*").eq("user_id", userId).maybeSingle();
  if (!data) return { ...DEFAULT_PREFS };
  return { events: data.events ?? {}, inApp: data.in_app, email: data.email, dailyDigest: data.daily_digest, quietStart: data.quiet_start?.slice(0, 5) ?? null, quietEnd: data.quiet_end?.slice(0, 5) ?? null };
}

export async function savePrefs(userId: string, p: Prefs) {
  if (isDemoMode()) { demo.prefs.set(userId, clone(p)); return; }
  const { error } = await db.from("notification_prefs").upsert({ user_id: userId, events: p.events, in_app: p.inApp, email: p.email, daily_digest: p.dailyDigest, quiet_start: p.quietStart, quiet_end: p.quietEnd, updated_at: nowISO() });
  if (error) throw error;
}

/** Tempo real: chama onChange quando chega notificação nova. */
export function subscribeNotifications(userId: string, onChange: () => void) {
  if (isDemoMode()) { demo.listeners.add(onChange); return () => { demo.listeners.delete(onChange); }; }
  const ch = supabase.channel(`notif-${userId}`).on("postgres_changes" as never, { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => onChange()).subscribe();
  return () => { supabase.removeChannel(ch); };
}

/** Mensagem pronta para a equipe mandar pelo WhatsApp (sem integração de API). */
export function whatsappMessage(o: { brandName: string; firstName?: string | null; pending: number; dueLabel?: string | null; url: string }) {
  const hi = o.firstName ? `Oi, ${o.firstName}!` : "Oi!";
  const what = o.pending === 1 ? "Tem 1 material esperando sua aprovação" : `Tem ${o.pending} materiais esperando sua aprovação`;
  return `${hi} ${what} no Like da Reach${o.dueLabel ? ` (prazo ${o.dueLabel})` : ""}.\n\nÉ só abrir, comentar no próprio material e aprovar:\n${o.url}`;
}
