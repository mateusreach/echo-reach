// ---------------------------------------------------------------------------
// Echo · Aparência por pessoa
// Base (clara, escura, automática) + caminho de cor (Céu, Blush, Íris, Solar)
// + mistura, ângulo e intensidade da aura. Aplicada no <html> antes da primeira
// pintura (APPEARANCE_BOOT) e sincronizada com os temas do piloto, para que as
// telas antigas acompanhem a escolha.
// ---------------------------------------------------------------------------
import { useEffect, useState } from "react";

export type Base = "light" | "dark" | "system";
export type PathKey = "ceu" | "blush" | "iris" | "solar";
export type MixKey = "auto" | "azul" | "rosa" | "lilas" | "laranja" | "perola";
export type Appearance = { base: Base; path: PathKey; mix: MixKey; angle: number; aura: number };

export const PATHS: Record<PathKey, { name: string; p1: string; p2: string; mix: string; img: string; reach: "blue" | "pink" | "purple" | "orange" }> = {
  ceu: { name: "Céu", p1: "#2E7BE4", p2: "#58B0F2", mix: "#9C84F3", img: "/echo/r-ceu.jpg", reach: "blue" },
  blush: { name: "Blush", p1: "#DC3F88", p2: "#F07BB0", mix: "#B98CF2", img: "/echo/r-blush.jpg", reach: "pink" },
  iris: { name: "Íris", p1: "#6B4FE8", p2: "#9C80F5", mix: "#6FA9F5", img: "/echo/r-iris.jpg", reach: "purple" },
  solar: { name: "Solar", p1: "#D8520C", p2: "#F2892C", mix: "#E86AA0", img: "/echo/r-solar.jpg", reach: "orange" },
};
export const MIXES: { key: MixKey; name: string; color: string | null }[] = [
  { key: "auto", name: "Mistura da casa", color: null },
  { key: "azul", name: "Azul", color: "#5AA6F2" },
  { key: "rosa", name: "Rosa", color: "#EF7FB4" },
  { key: "lilas", name: "Lilás", color: "#A58BF5" },
  { key: "laranja", name: "Laranja", color: "#F59A4A" },
  { key: "perola", name: "Pérola", color: "#EADFD2" },
];

const KEY = "echo.appearance";
const DEFAULT: Appearance = { base: "system", path: "iris", mix: "auto", angle: 135, aura: 90 };
const FROM_REACH: Record<string, PathKey> = { blue: "ceu", pink: "blush", purple: "iris", orange: "solar" };

export function readAppearance(): Appearance {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT, ...JSON.parse(raw) };
    // Primeira vez no Echo: herda o tema e o acento escolhidos no piloto.
    const t = localStorage.getItem("reach.theme");
    const a = localStorage.getItem("reach.accent");
    return { ...DEFAULT, base: t === "dark" || t === "light" ? t : "system", path: (a && FROM_REACH[a]) || DEFAULT.path };
  } catch {
    return DEFAULT;
  }
}

export function resolvedBase(a: Appearance): "light" | "dark" {
  if (a.base !== "system") return a.base;
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyAppearance(a: Appearance) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const base = resolvedBase(a);
  root.dataset.base = base;
  root.dataset.path = a.path;
  root.classList.toggle("dark", base === "dark");
  root.setAttribute("data-reach-theme", PATHS[a.path].reach);
  const mix = MIXES.find((m) => m.key === a.mix)?.color ?? PATHS[a.path].mix;
  root.style.setProperty("--mix", mix);
  root.style.setProperty("--g-angle", `${a.angle}deg`);
  root.style.setProperty("--aura", String(a.aura / 100));
}

export function saveAppearance(a: Appearance) {
  try {
    localStorage.setItem(KEY, JSON.stringify(a));
    localStorage.setItem("reach.theme", a.base === "system" ? "auto" : a.base);
    localStorage.setItem("reach.accent", PATHS[a.path].reach);
  } catch {
    /* navegação privada: vale só nesta sessão */
  }
  applyAppearance(a);
  window.dispatchEvent(new CustomEvent("echo:appearance", { detail: a }));
}

export function useAppearance(): [Appearance, (patch: Partial<Appearance>) => void] {
  const [a, setA] = useState<Appearance>(DEFAULT);
  useEffect(() => {
    setA(readAppearance());
    const on = (e: Event) => setA((e as CustomEvent<Appearance>).detail);
    window.addEventListener("echo:appearance", on);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const sys = () => { const cur = readAppearance(); if (cur.base === "system") applyAppearance(cur); };
    mq.addEventListener("change", sys);
    return () => { window.removeEventListener("echo:appearance", on); mq.removeEventListener("change", sys); };
  }, []);
  return [a, (patch) => { const next = { ...readAppearance(), ...patch }; setA(next); saveAppearance(next); }];
}

/** Script embutido no <head>: aplica a aparência antes da primeira pintura (sem piscar). */
export const APPEARANCE_BOOT = `(function(){try{var d={base:"system",path:"iris",mix:"auto",angle:135,aura:90},r=localStorage.getItem("${KEY}"),a=r?Object.assign(d,JSON.parse(r)):d;if(!r){var t=localStorage.getItem("reach.theme"),ac=localStorage.getItem("reach.accent"),m={blue:"ceu",pink:"blush",purple:"iris",orange:"solar"};if(t==="dark"||t==="light")a.base=t;if(ac&&m[ac])a.path=m[ac];}var b=a.base==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):a.base,h=document.documentElement,R={ceu:"blue",blush:"pink",iris:"purple",solar:"orange"},M={ceu:"#9C84F3",blush:"#B98CF2",iris:"#6FA9F5",solar:"#E86AA0"},X={azul:"#5AA6F2",rosa:"#EF7FB4",lilas:"#A58BF5",laranja:"#F59A4A",perola:"#EADFD2"};h.dataset.base=b;h.dataset.path=a.path;if(b==="dark")h.classList.add("dark");h.setAttribute("data-reach-theme",R[a.path]);h.style.setProperty("--mix",X[a.mix]||M[a.path]);h.style.setProperty("--g-angle",a.angle+"deg");h.style.setProperty("--aura",a.aura/100);}catch(e){}})();`;
