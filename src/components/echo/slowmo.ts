// ---------------------------------------------------------------------------
// Echo · Câmera lenta 4× (ferramenta de revisão, só para admins, só na sessão)
// Desacelera transições CSS, keyframes e animações feitas com element.animate().
// ---------------------------------------------------------------------------
const KEY = "echo.slowmo";
const RATE = 0.25;
let installed = false;

function slow(target: EventTarget | null) {
  if (!(target instanceof Element) || !document.documentElement.hasAttribute("data-slowmo")) return;
  for (const a of target.getAnimations()) if (a.playbackRate !== RATE) a.playbackRate = RATE;
}

function install() {
  if (installed || typeof document === "undefined") return;
  installed = true;
  document.addEventListener("transitionrun", (e) => slow(e.target), true);
  document.addEventListener("animationstart", (e) => slow(e.target), true);
  const original = Element.prototype.animate;
  Element.prototype.animate = function (this: Element, ...args: Parameters<Element["animate"]>) {
    const anim = original.apply(this, args);
    if (document.documentElement.hasAttribute("data-slowmo")) anim.playbackRate = RATE;
    return anim;
  };
}

export function isSlowmo() {
  try { return typeof window !== "undefined" && sessionStorage.getItem(KEY) === "1"; } catch { return false; }
}

export function setSlowmo(on: boolean) {
  if (typeof document === "undefined") return;
  install();
  document.documentElement.toggleAttribute("data-slowmo", on);
  try { if (on) sessionStorage.setItem(KEY, "1"); else sessionStorage.removeItem(KEY); } catch { /* ok */ }
  for (const a of document.getAnimations()) a.playbackRate = on ? RATE : 1;
}

/** Reaplica a escolha ao recarregar a página (a sessão guarda o estado). */
export function restoreSlowmo() {
  if (isSlowmo()) setSlowmo(true);
}
