// Identidade visual da plataforma (logo da agência, cores e tema) e do cliente.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppSettings = {
  id: string;
  logo_url: string | null;
  logo_scale: number;
  logo_offset_x: number;
  logo_offset_y: number;
  primary_color: string | null;
  accent_color: string | null;
  default_theme: "light" | "dark" | "auto";
  agency_name: string | null;
  favicon_url?: string | null;
  invite_colaborador_subject?: string | null;
  invite_colaborador_body?: string | null;
  invite_cliente_subject?: string | null;
  invite_cliente_body?: string | null;
};

export const DEFAULT_INVITE_COLABORADOR_SUBJECT = "Você foi convidado para acessar o Reach Brand";
export const DEFAULT_INVITE_COLABORADOR_BODY =
  "Olá, {{nome}}!\n\nVocê foi convidado por {{agencia}} para fazer parte da equipe no Reach Brand, como {{cargo}}.\n\nAcesse seu ambiente para acompanhar projetos, clientes e planejamentos.\n\n[Acessar meu ambiente]({{link_convite}})\n\nAtenciosamente,\n{{agencia}}";
export const DEFAULT_INVITE_CLIENTE_SUBJECT = "Você foi convidado para acessar o Reach Brand";
export const DEFAULT_INVITE_CLIENTE_BODY =
  "Olá, {{nome}}!\n\nVocê foi convidado por {{agencia}} para acessar o ambiente de {{cliente}} no Reach Brand.\n\nAcesse seu ambiente para acompanhar projetos, conteúdos, planejamentos e informações compartilhadas pela sua equipe.\n\n[Acessar meu ambiente]({{link_convite}})\n\nAtenciosamente,\n{{agencia}}";

export const INVITE_TEMPLATE_VARIABLES: { key: string; label: string }[] = [
  { key: "nome", label: "Nome do convidado" },
  { key: "agencia", label: "Nome da agência" },
  { key: "email", label: "E-mail do convidado" },
  { key: "link_convite", label: "Link de acesso" },
  { key: "cliente", label: "Nome do cliente (só no convite de cliente)" },
  { key: "cargo", label: "Cargo / função" },
  { key: "ano", label: "Ano atual" },
];

/** Substitui {{variavel}} pelo valor correspondente — nunca executa nada do
 * conteúdo do template, é troca de texto simples e segura. */
export function renderInviteTemplate(template: string, vars: Record<string, string | null | undefined>): string {
  return template.replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (_, key: string) => vars[key] ?? "");
}

const CACHE_KEY = "reach.app-settings";
const THEME_KEY = "reach.theme";
const ACCENT_KEY = "reach.accent";

export type ThemeMode = "light" | "dark" | "auto";

/** Paletas oficiais Reach (mesmas do Reach Workspace). */
export type ReachAccent = "blue" | "pink" | "purple" | "orange";

export const REACH_THEMES: { key: ReachAccent; name: string; description: string; colors: string[] }[] = [
  { key: "blue", name: "Reach Blue", description: "Elegante e tecnológica", colors: ["#1b3a8b", "#2f6be0", "#6ba6ff", "#dcebff"] },
  { key: "pink", name: "Reach Pink", description: "Criativa e moderna", colors: ["#7a1e52", "#e5399b", "#ff8bc4", "#ffe1ef"] },
  { key: "purple", name: "Reach Purple", description: "Premium e sofisticada", colors: ["#3d1f7a", "#7a4ce0", "#b99cff", "#eae0ff"] },
  { key: "orange", name: "Reach Orange", description: "Quente, energia e criatividade", colors: ["#8b2a16", "#e85d3a", "#ffa07a", "#ffdac7"] },
];

export const DEFAULT_ACCENT: ReachAccent = "blue";

export function getStoredAccent(): ReachAccent {
  if (typeof window === "undefined") return DEFAULT_ACCENT;
  const v = window.localStorage.getItem(ACCENT_KEY);
  return v === "blue" || v === "pink" || v === "purple" || v === "orange" ? v : DEFAULT_ACCENT;
}

export function applyAccent(accent: ReachAccent) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-reach-theme", accent);
}

export function setAccent(accent: ReachAccent) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCENT_KEY, accent);
  applyAccent(accent);
}

export function useAccent() {
  const [accent, setLocal] = useState<ReachAccent>(DEFAULT_ACCENT);
  useEffect(() => {
    const initial = getStoredAccent();
    setLocal(initial);
    applyAccent(initial);
  }, []);
  return { accent, change: (a: ReachAccent) => { setAccent(a); setLocal(a); } };
}

let cached: AppSettings | null = null;
const listeners = new Set<(s: AppSettings | null) => void>();

export function cachedSettings(): AppSettings | null {
  if (cached) return cached;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (raw) cached = JSON.parse(raw) as AppSettings;
  } catch {
    /* ignore */
  }
  return cached;
}

function publish(s: AppSettings | null) {
  cached = s;
  if (typeof window !== "undefined" && s) {
    try {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(s));
    } catch {
      /* ignore */
    }
  }
  listeners.forEach((l) => l(s));
}

/** Cada organização (agência) tem sua própria identidade visual, guardada em
 * app_settings com id = organization_id. "default" é usado apenas como
 * identidade da plataforma para quem ainda não autenticou (tela de login) —
 * uma vez logado, a identidade sempre resolve para a própria organização. */
async function appSettingsRowId(): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return "default";
  const { myOrganizationId } = await import("@/lib/agency-data");
  const orgId = await myOrganizationId();
  return orgId ?? "default";
}

export async function fetchAppSettings(): Promise<AppSettings | null> {
  const id = await appSettingsRowId();
  const { data, error } = await supabase.from("app_settings" as any).select("*").eq("id", id).maybeSingle();
  if (error) return cachedSettings();
  const s = (data as unknown as AppSettings) ?? null;
  publish(s);
  return s;
}

export async function saveAppSettings(patch: Partial<AppSettings>) {
  const id = await appSettingsRowId();
  const { myOrganizationId } = await import("@/lib/agency-data");
  const organization_id = id === "default" ? null : await myOrganizationId();
  const { data, error } = await supabase
    .from("app_settings" as any)
    .upsert({ id, organization_id, ...patch })
    .select()
    .single();
  if (error) throw error;
  publish(data as unknown as AppSettings);
  return data as unknown as AppSettings;
}

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(() => cachedSettings());

  useEffect(() => {
    listeners.add(setSettings);
    fetchAppSettings();
    return () => {
      listeners.delete(setSettings);
    };
  }, []);

  return settings;
}

// --------------------------------------------------------------------------
// Tema claro / escuro / automático
// --------------------------------------------------------------------------

export function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const v = window.localStorage.getItem(THEME_KEY);
  return v === "light" || v === "dark" || v === "auto" ? v : (cachedSettings()?.default_theme ?? "light");
}

export function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  applyAccent(getStoredAccent());
  const dark = mode === "dark" || (mode === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function setTheme(mode: ThemeMode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THEME_KEY, mode);
  applyTheme(mode);
}

/** Aplica as cores personalizadas (plataforma e/ou cliente) como tokens CSS. */
export function applyBrandColors(primary?: string | null, accent?: string | null) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  // A identidade do cliente é conteúdo dentro do sistema: expomos como tokens
  // próprios (--client-*), sem sobrescrever os tokens de interface do Reach.
  if (primary) root.style.setProperty("--client-primary", primary);
  else root.style.removeProperty("--client-primary");
  if (accent) root.style.setProperty("--client-accent", accent);
  else root.style.removeProperty("--client-accent");
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>("light");

  useEffect(() => {
    const initial = getStoredTheme();
    setMode(initial);
    applyTheme(initial);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => getStoredTheme() === "auto" && applyTheme("auto");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return {
    mode,
    change: (m: ThemeMode) => {
      setTheme(m);
      setMode(m);
    },
  };
}
