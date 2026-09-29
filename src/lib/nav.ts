import {
  BookOpen,
  Lightbulb,
  FolderTree,
  FileText,
  Sparkles,
  Flag,
  Building2,
  Image as ImageIcon,
  KeyRound,
  History,
  Plug,
  SlidersHorizontal,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";

export type NavAccent = "coral" | "violet" | "blue" | "amber" | "mint" | "rose";
export type Icon = ComponentType<SVGProps<SVGSVGElement>>;

export type NavItem = {
  to: string;
  label: string;
  icon: Icon;
  accent: NavAccent;
  /** Renderiza um divisor delicado acima do item (sem título de seção). */
  divider?: boolean;
};

export type ModuleKey = "biblioteca" | "plano";

// ---------------------------------------------------------------------------
// NAVEGAÇÃO GLOBAL — apenas os grandes ambientes do Reach Brand.
// ---------------------------------------------------------------------------
const NAV_DEFS: (Omit<NavItem, "to"> & { suffix: string; module?: ModuleKey })[] = [
  { suffix: "/biblioteca", label: "Biblioteca", icon: BookOpen, accent: "blue", module: "biblioteca" },
];

export function getNavItems(basePath: string, modules?: Partial<Record<ModuleKey, boolean>>): NavItem[] {
  return NAV_DEFS.filter((n) => !n.module || !modules || modules[n.module] !== false).map((n) => ({
    ...n,
    to: n.suffix ? `${basePath}${n.suffix}` : basePath,
  }));
}

// ---------------------------------------------------------------------------
// NAVEGAÇÃO INTERNA DE CADA MÓDULO (menu lateral contextual)
// ---------------------------------------------------------------------------
export type ModuleSection = {
  key: string;
  label: string;
  /** sufixo de rota relativo ao basePath da marca */
  suffix: string;
  /** valor do search param `tab` (quando a seção vive dentro de uma rota) */
  tab?: string;
  icon: Icon;
  /** Rótulo do grupo hierárquico (ex.: "Planejamento", "Execução"). Renderiza um divisor quando muda em relação ao item anterior. */
  group?: string;
};

export type ModuleNav = {
  key: "plano" | "biblioteca" | "configuracoes";
  title: string;
  accent: NavAccent;
  /** rota-raiz do módulo (para casar com o pathname) */
  suffixes: string[];
  sections: ModuleSection[];
};

const MODULE_NAVS: ModuleNav[] = [
  {
    key: "plano",
    title: "Plano",
    accent: "violet",
    suffixes: ["/plano"],
    sections: [
      { key: "fundacao", label: "Fundação", suffix: "/plano", tab: "fundacao", icon: Building2 },
      { key: "objetivos", label: "Objetivos", suffix: "/plano", tab: "objetivos", icon: Flag },
      { key: "estrategia", label: "Estratégia", suffix: "/plano", tab: "estrategia", icon: Sparkles },
    ],
  },
  {
    key: "biblioteca",
    title: "Biblioteca",
    accent: "blue",
    suffixes: ["/biblioteca"],
    sections: [
      { key: "ideias", label: "Banco de Ideias", suffix: "/biblioteca", tab: "ideias", icon: Lightbulb },
      { key: "construir", label: "Ideias a construir", suffix: "/biblioteca", tab: "construir", icon: Sparkles },
      { key: "estrutura", label: "Pilares e categorias", suffix: "/biblioteca", tab: "estrutura", icon: FolderTree },
      { key: "conteudos", label: "Conteúdos", suffix: "/biblioteca", tab: "conteudos", icon: FileText },
      { key: "referencias", label: "Referências", suffix: "/biblioteca", tab: "referencias", icon: ImageIcon },
    ],
  },
  {
    key: "configuracoes",
    title: "Configurações",
    accent: "coral",
    suffixes: ["/configuracoes"],
    sections: [
      { key: "informacoes", label: "Informações do cliente", suffix: "/configuracoes", tab: "informacoes", icon: Building2 },
      { key: "identidade", label: "Identidade visual", suffix: "/configuracoes", tab: "identidade", icon: ImageIcon },
      { key: "acessos", label: "Usuários e acessos", suffix: "/configuracoes", tab: "acessos", icon: KeyRound },
      { key: "historico", label: "Histórico de acessos", suffix: "/configuracoes", tab: "historico", icon: History },
      { key: "integracoes", label: "Integrações", suffix: "/configuracoes", tab: "integracoes", icon: Plug },
      { key: "preferencias", label: "Preferências", suffix: "/configuracoes", tab: "preferencias", icon: SlidersHorizontal },
    ],
  },
];

/** Navegação interna de um módulo pela chave (usada no menu lateral fixo). */
export function moduleNavByKey(key: ModuleNav["key"]): ModuleNav | undefined {
  return MODULE_NAVS.find((m) => m.key === key);
}

/** Encontra a navegação interna do módulo correspondente ao pathname atual. */
export function getModuleNav(basePath: string, pathname: string): ModuleNav | null {
  const rest = pathname.startsWith(basePath) ? pathname.slice(basePath.length) : "";
  if (!rest || rest === "/") return null;
  return MODULE_NAVS.find((m) => m.suffixes.some((s) => rest === s || rest.startsWith(`${s}/`))) ?? null;
}

export function moduleSectionHref(basePath: string, section: ModuleSection) {
  return `${basePath}${section.suffix}`;
}

export const accentClass = (accent: NavAccent, kind: "bg" | "text" | "border" | "dot" = "bg") => {
  const map: Record<string, Record<NavAccent, string>> = {
    bg: { coral: "bg-reach-coral-soft", violet: "bg-reach-violet-soft", blue: "bg-reach-blue-soft", amber: "bg-reach-amber-soft", mint: "bg-reach-mint-soft", rose: "bg-reach-rose-soft" },
    text: { coral: "text-reach-coral", violet: "text-reach-violet", blue: "text-reach-blue", amber: "text-reach-amber", mint: "text-reach-mint", rose: "text-reach-rose" },
    border: { coral: "border-reach-coral/30", violet: "border-reach-violet/30", blue: "border-reach-blue/30", amber: "border-reach-amber/30", mint: "border-reach-mint/30", rose: "border-reach-rose/30" },
    dot: { coral: "bg-reach-coral", violet: "bg-reach-violet", blue: "bg-reach-blue", amber: "bg-reach-amber", mint: "bg-reach-mint", rose: "bg-reach-rose" },
  };
  return map[kind]?.[accent] ?? "";
};
