// ---------------------------------------------------------------------------
// Echo · Movimento (Web Animations API)
// Só transform, opacity e filter. Saída mais rápida que entrada. Com
// prefers-reduced-motion, apenas opacidade.
// ---------------------------------------------------------------------------
import { useEffect, useRef, useState } from "react";

export const EASE = {
  out: "cubic-bezier(0.23, 1, 0.32, 1)",
  inOut: "cubic-bezier(0.77, 0, 0.175, 1)",
  drawer: "cubic-bezier(0.32, 0.72, 0, 1)",
  spring: "cubic-bezier(0.34, 1.36, 0.64, 1)",
};

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type EnterOpts = { y?: number; x?: number; scale?: number; blur?: number; dur?: number; delay?: number };

/** Entrada: nada surge do nada — parte de 94–100% de escala e alguns pixels de deslocamento. */
export function enter(el: Element | null, o: EnterOpts = {}) {
  if (!el || !(el as HTMLElement).animate) return;
  const { y = 8, x = 0, scale = 1, blur = 0, dur = 320, delay = 0 } = o;
  const reduced = prefersReducedMotion();
  const from: Keyframe = reduced ? { opacity: 0 } : { opacity: 0, transform: `translate(${x}px, ${y}px) scale(${scale})`, filter: blur ? `blur(${blur}px)` : "none" };
  const to: Keyframe = reduced ? { opacity: 1 } : { opacity: 1, transform: "none", filter: "none" };
  (el as HTMLElement).animate([from, to], { duration: dur, delay, easing: EASE.out, fill: "backwards" });
}

export function stagger(nodes: ArrayLike<Element>, o: EnterOpts = {}, step = 45) {
  Array.from(nodes).forEach((n, i) => enter(n, { ...o, delay: (o.delay ?? 0) + i * step }));
}

/** Número que conta até o valor quando aparece (uma vez). */
export function useCountUp(value: number, dur = 900) {
  const [shown, setShown] = useState(value);
  const first = useRef(true);
  useEffect(() => {
    if (prefersReducedMotion()) { setShown(value); return; }
    const from = first.current ? 0 : shown;
    first.current = false;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      setShown(Math.round(from + (value - from) * (1 - Math.pow(1 - p, 4))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, dur]);
  return shown;
}

/** Transição de página inteira com revelação circular a partir do ponto de clique. */
export function viewTransition(mutate: () => void, x: number, y: number) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void>; finished: Promise<void> } };
  if (!doc.startViewTransition || prefersReducedMotion()) { mutate(); return; }
  const root = document.documentElement;
  root.classList.add("e-vt");
  const t = doc.startViewTransition(mutate);
  t.ready.then(() => {
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] }, { duration: 560, easing: EASE.inOut, pseudoElement: "::view-transition-new(root)" });
  }).catch(() => {});
  t.finished.finally(() => root.classList.remove("e-vt"));
}
