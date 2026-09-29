// ---------------------------------------------------------------------------
// Echo · Sessão do shell
// Quem está conectado, com qual papel e quais ambientes pode abrir. Usado pela
// barra superior de todos os ambientes. Em modo demonstração (sem Supabase),
// devolve uma pessoa de exemplo.
// ---------------------------------------------------------------------------
import { useQuery } from "@tanstack/react-query";
import { isSlowmo, restoreSlowmo, setSlowmo } from "./slowmo";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getFullAccess, WORKSPACE_DENY_PERMISSION } from "@/lib/agency-data";
import { brandModules, myBrands } from "@/lib/reach-data";
import { isDemoMode } from "@/lib/home-data";
import { readAppearance, saveAppearance, type Appearance } from "./appearance";

export type EnvAvailability = Partial<Record<"brand" | "workspace" | "like" | "e360", { available: boolean; reason?: string }>>;

export type EchoSession = {
  mode: "live" | "demo";
  signedIn: boolean;
  name: string;
  role: "team" | "client";
  isAdmin: boolean;
  envs: EnvAvailability;
  permissions: string[];
  userId?: string;
  /** Aparência salva no perfil (quando a migração 20260929090000 estiver aplicada). */
  appearance?: { base: string; path: string; mix: string; angle: number; aura: number } | null;
};

const LIKE_ON = { available: true };

async function loadSession(): Promise<EchoSession> {
  if (isDemoMode()) {
    let role: "team" | "client" = "team";
    try { if (sessionStorage.getItem("echo.demo-role") === "client") role = "client"; } catch { /* ok */ }
    return role === "team"
      ? { mode: "demo", signedIn: true, name: "Helena Duarte", role, isAdmin: true, permissions: [], envs: { brand: { available: true }, workspace: { available: true }, like: LIKE_ON, e360: { available: true } } }
      : { mode: "demo", signedIn: true, name: "Carla Mendes", role, isAdmin: false, permissions: [], envs: { like: LIKE_ON, e360: { available: true }, brand: { available: true } } };
  }
  const { data } = await supabase.auth.getSession();
  if (!data.session) return { mode: "live", signedIn: false, name: "", role: "client", isAdmin: false, permissions: [], envs: {} };
  const access = await getFullAccess();
  const { data: profile } = await supabase.from("profiles").select("display_name, email").eq("id", access.userId!).maybeSingle();
  const name = profile?.display_name || profile?.email || data.session.user.email || "";
  // Colunas de aparência: ausentes até a migração ser aplicada — nesse caso, segue só o navegador.
  const ui = await (supabase as any).from("profiles").select("ui_base, ui_path, ui_mix, ui_angle, ui_aura").eq("id", access.userId!).maybeSingle();
  const appearance = ui.error || !ui.data ? null : { base: ui.data.ui_base, path: ui.data.ui_path, mix: ui.data.ui_mix, angle: ui.data.ui_angle, aura: ui.data.ui_aura };
  if (access.isAgency) {
    const blocked = access.permissions.includes(WORKSPACE_DENY_PERMISSION);
    return {
      mode: "live", signedIn: true, name, role: "team", isAdmin: access.isAdmin, permissions: access.permissions, userId: access.userId ?? undefined, appearance,
      envs: { brand: { available: true }, workspace: blocked ? { available: false, reason: "Acesso desativado" } : { available: true }, like: LIKE_ON, e360: { available: true } },
    };
  }
  const brands = await myBrands().catch(() => []);
  return {
    mode: "live", signedIn: true, name, role: "client", isAdmin: false, permissions: [], userId: access.userId ?? undefined, appearance,
    envs: {
      like: LIKE_ON,
      e360: brands.some((b) => brandModules(b).espaco360) ? { available: true } : { available: false, reason: "Não contratado" },
      brand: brands.some((b) => brandModules(b).biblioteca) ? { available: true } : { available: false, reason: "Não contratado" },
    },
  };
}

/** Sessão do shell; só consulta depois de montar no navegador (depende de storage). */
export function useEchoSession() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return useQuery({ queryKey: ["echo-session"], queryFn: loadSession, enabled: ready, staleTime: 60_000, retry: 1 });
}

/**
 * Sincroniza a aparência com o perfil: ao entrar em outro navegador, aplica o
 * que está salvo no perfil; ao mudar aqui, grava no perfil. Falhas (migração não
 * aplicada, política de escrita ausente) são ignoradas e o navegador segue valendo.
 */
export function AppearanceSync() {
  const { data } = useEchoSession();
  // Câmera lenta: ferramenta de revisão só para administradores.
  useEffect(() => {
    if (!data) return;
    if (data.isAdmin) restoreSlowmo();
    else if (isSlowmo()) setSlowmo(false);
  }, [data?.isAdmin]);
  useEffect(() => {
    if (!data || data.mode !== "live" || !data.userId) return;
    const key = "echo.appearance.user";
    let known: string | null = null;
    try { known = localStorage.getItem(key); } catch { /* ok */ }
    if (data.appearance && known !== data.userId) {
      const a = data.appearance;
      saveAppearance({ ...readAppearance(), base: a.base as Appearance["base"], path: a.path as Appearance["path"], mix: a.mix as Appearance["mix"], angle: a.angle, aura: a.aura });
    }
    try { localStorage.setItem(key, data.userId); } catch { /* ok */ }
    const push = (e: Event) => {
      const a = (e as CustomEvent<Appearance>).detail;
      (supabase as any).from("profiles").update({ ui_base: a.base, ui_path: a.path, ui_mix: a.mix, ui_angle: a.angle, ui_aura: a.aura }).eq("id", data.userId).then(() => undefined, () => undefined);
    };
    window.addEventListener("echo:appearance", push);
    return () => window.removeEventListener("echo:appearance", push);
  }, [data]);
  return null;
}

/**
 * Acesso da pessoa conectada: `can("modulo.acao")` responde igual às
 * permissões gravadas (admins da agência podem tudo). A RLS do banco continua
 * sendo a garantia; isto só decide o que a interface mostra.
 */
export function useAccess() {
  const q = useEchoSession();
  const s = q.data;
  const can = (key: string) => !!s && s.signedIn && (s.isAdmin || s.permissions.includes(key));
  return { ...q, session: s, can, isTeam: s?.role === "team", isClient: s?.role === "client" };
}

/** Acesso da pessoa a um cliente específico (vínculo em brand_members). */
export function useBrandAccess(brandId: string | null | undefined) {
  const { session } = useAccess();
  const q = useQuery({
    queryKey: ["echo-brand-access", brandId, session?.userId],
    enabled: !!brandId && !!session && session.mode === "live",
    queryFn: async () => {
      const { getBrandMembership } = await import("@/lib/reach-data");
      return getBrandMembership(brandId!);
    },
    staleTime: 60_000,
  });
  const canBrand = (key: string) => {
    if (!session) return false;
    if (session.mode === "demo" || session.role === "team") return session.isAdmin || session.mode === "demo" || session.permissions.includes(key);
    const m = q.data;
    return !!m && (m.isAdmin || m.permissions.includes(key));
  };
  return { ...q, canBrand };
}
