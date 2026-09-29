// ---------------------------------------------------------------------------
// REACH OS — camada de ecossistema
//
// Registro central dos módulos (ambientes especializados) do Reach. Acrescentar
// um módulo novo no futuro (Financeiro, CRM…) é só adicionar uma entrada aqui:
// Home, switcher global e o controle por cliente leem desta lista.
// ---------------------------------------------------------------------------
import { Activity, BookOpen, Rocket, type LucideIcon } from "lucide-react";

export type ModuleId = "brand" | "e360" | "workspace";

export type EcosystemModule = {
  id: ModuleId;
  name: string;
  tagline: string;
  description: string;
  icon: LucideIcon;
  /** rota-raiz do módulo dentro desta aplicação */
  path: string;
  /** prefixos de rota que pertencem a este módulo */
  prefixes: string[];
  /** cor do tema Reach usada para identificar o módulo */
  accent: string;
  /**
   * Variável de ambiente com o domínio próprio do módulo, quando ele passar a
   * rodar em subdomínio separado. Enquanto estiver vazia, navegamos por rota
   * interna — nada de domínio fixo no código.
   */
  originEnvKey: string;
};

export const MODULES: EcosystemModule[] = [
  {
    id: "brand",
    name: "Branding Space",
    tagline: "Biblioteca de conteúdo",
    description: "Ideias, conteúdos e referências de cada cliente.",
    icon: BookOpen,
    path: "/agencia/clientes",
    prefixes: ["/agencia", "/b/"],
    accent: "var(--brand)",
    originEnvKey: "VITE_REACH_BRAND_ORIGIN",
  },
  {
    id: "e360",
    name: "Espaço 360",
    tagline: "Plano e acompanhamento",
    description: "Planos, estratégias, tarefas e acompanhamento dos clientes habilitados.",
    icon: Activity,
    path: "/e360",
    prefixes: ["/e360"],
    accent: "var(--brand)",
    originEnvKey: "VITE_REACH_E360_ORIGIN",
  },
  {
    id: "workspace",
    name: "Workspace",
    tagline: "Operação e entregas",
    description:
      "Demandas, produção, rotinas, prazos, avaliações e o controle de nenhum cliente ficar sem post.",
    icon: Rocket,
    path: "/workspace",
    prefixes: ["/workspace"],
    accent: "var(--brand-pink)",
    originEnvKey: "VITE_REACH_WORKSPACE_ORIGIN",
  },
];

export const moduleById = (id: ModuleId) => MODULES.find((m) => m.id === id)!;

/** Qual módulo corresponde ao caminho atual (undefined na Home e no login). */
export function moduleForPath(pathname: string): EcosystemModule | undefined {
  return MODULES.find((m) => m.prefixes.some((p) => pathname === p || pathname.startsWith(p)));
}

/**
 * Domínio configurado para o módulo. Vazio = mesma origem, navegação interna.
 * Isso mantém a arquitetura pronta para subdomínios sem travar nada agora.
 */
export function moduleOrigin(m: EcosystemModule): string | null {
  const env = import.meta.env as Record<string, string | undefined>;
  const value = env[m.originEnvKey];
  if (!value) return null;
  if (typeof window !== "undefined" && new URL(value).origin === window.location.origin) return null;
  return value.replace(/\/$/, "");
}

// ---------------------------------------------------------------------------
// MEMÓRIA DE CONTEXTO
//
// Ao trocar de módulo queremos continuar no mesmo cliente. Guardamos apenas o
// slug do cliente selecionado — usuário, organização e permissões continuam
// vindo da sessão única do ecossistema.
// ---------------------------------------------------------------------------
const CONTEXT_KEY = "reach_os_client_context";

export function setClientContext(slug: string | null) {
  if (typeof window === "undefined") return;
  if (slug) sessionStorage.setItem(CONTEXT_KEY, slug);
  else sessionStorage.removeItem(CONTEXT_KEY);
}

export function getClientContext(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(CONTEXT_KEY);
}

/** Destino ao entrar num módulo, preservando o cliente em contexto. */
export function moduleEntryPath(m: EcosystemModule, clientSlug?: string | null): string {
  const slug = clientSlug ?? getClientContext();
  if (!slug) return m.path;
  if (m.id === "brand") return `/b/${slug}/biblioteca`;
  if (m.id === "e360") return `/e360/${slug}`;
  return `/workspace/cliente/${slug}`;
}
