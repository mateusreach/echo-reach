// ---------------------------------------------------------------------------
// Echo · Camadas: Modal, Drawer e HoldButton
// Prendem o foco, fecham com Esc e devolvem o foco ao gatilho. A saída anima
// mais rápido que a entrada (classes .e-layer.closing em motion.css).
// ---------------------------------------------------------------------------
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "./icon";

function useLayer(open: boolean, onClose: () => void, exitMs: number) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) { back.current = document.activeElement as HTMLElement; setMounted(true); setClosing(false); return; }
    if (!mounted) return;
    setClosing(true);
    const t = window.setTimeout(() => { setMounted(false); setClosing(false); back.current?.focus(); }, exitMs);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => {
    if (!mounted || closing) return;
    const t = window.setTimeout(() => (panel.current?.querySelector<HTMLElement>("[autofocus], input, textarea, select, button:not([data-x])") ?? panel.current)?.focus(), 30);
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
      if (e.key !== "Tab" || !panel.current) return;
      const f = [...panel.current.querySelectorAll<HTMLElement>("button, input, textarea, select, a[href], [tabindex]:not([tabindex='-1'])")].filter((x) => !(x as HTMLButtonElement).disabled && x.offsetParent);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    };
    document.addEventListener("keydown", key);
    return () => { window.clearTimeout(t); document.removeEventListener("keydown", key); };
  }, [mounted, closing, onClose]);
  return { mounted, closing, panel };
}

export function Modal({ open, onClose, title, sub, icon, tone, children, footer }: { open: boolean; onClose: () => void; title: string; sub?: string; icon?: IconName; tone?: "danger" | "soft"; children?: ReactNode; footer?: ReactNode }) {
  const id = useId();
  const { mounted, closing, panel } = useLayer(open, onClose, 150);
  if (!mounted || typeof document === "undefined") return null;
  return createPortal(
    <div className={`e-layer${closing ? " closing" : ""}`}>
      <div className="e-scrim" onClick={onClose} />
      <div ref={panel} className="e-modal" role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}>
        <div className="e-modal-head">
          {icon && <span className={`e-ico-tile ${tone ?? ""}`}><Icon name={icon} size="md" /></span>}
          <div>
            <h3 className="e-h3" id={id} style={{ margin: 0 }}>{title}</h3>
            {sub && <div className="e-small" style={{ marginTop: 4 }}>{sub}</div>}
          </div>
          <button type="button" data-x className="e-btn ghost icon x" aria-label="Fechar" onClick={onClose}><Icon name="x" /></button>
        </div>
        {children}
        {footer && <div className="e-modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({ open, onClose, title, eyebrow, children, footer }: { open: boolean; onClose: () => void; title: string; eyebrow?: string; children?: ReactNode; footer?: ReactNode }) {
  const id = useId();
  const { mounted, closing, panel } = useLayer(open, onClose, 260);
  const drag = useRef({ on: false, x0: 0, t0: 0, dx: 0 });
  if (!mounted || typeof document === "undefined") return null;
  return createPortal(
    <div className={`e-layer e-drawer-layer${closing ? " closing" : ""}`}>
      <div className="e-scrim" onClick={onClose} />
      <aside ref={panel} className="e-drawer" role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}>
        <div
          className="e-drawer-head"
          onPointerDown={(e) => { if ((e.target as HTMLElement).closest("button")) return; drag.current = { on: true, x0: e.clientX, t0: Date.now(), dx: 0 }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); panel.current?.classList.add("dragging"); }}
          onPointerMove={(e) => { const d = drag.current; if (!d.on || !panel.current) return; d.dx = e.clientX - d.x0; panel.current.style.transform = `translateX(${d.dx < 0 ? -Math.sqrt(-d.dx) * 2 : d.dx}px)`; }}
          onPointerUp={() => { const d = drag.current; if (!d.on || !panel.current) return; d.on = false; panel.current.classList.remove("dragging"); panel.current.style.transform = ""; const v = Math.abs(d.dx) / Math.max(1, Date.now() - d.t0); if (d.dx > 120 || (d.dx > 16 && v > 0.11)) onClose(); }}
        >
          <div className="e-grow">
            {eyebrow && <div className="e-label">{eyebrow}</div>}
            <h3 className="e-h3" id={id} style={{ margin: "4px 0 0" }}>{title}</h3>
          </div>
          <button type="button" data-x className="e-btn ghost icon" aria-label="Fechar" onClick={onClose}><Icon name="x" /></button>
        </div>
        <div className="e-drawer-body">{children}</div>
        {footer && <div className="e-drawer-foot">{footer}</div>}
      </aside>
    </div>,
    document.body,
  );
}

/** Ação destrutiva: preenche enquanto a pessoa segura; soltar antes cancela. */
export function HoldButton({ label, icon = "trash", ms = 1400, onConfirm, size }: { label: string; icon?: IconName; ms?: number; onConfirm: () => void; size?: "sm" | "lg" }) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const start = () => { setHolding(true); timer.current = window.setTimeout(() => { setHolding(false); onConfirm(); }, ms); };
  const stop = () => { window.clearTimeout(timer.current); setHolding(false); };
  return (
    <button
      type="button"
      className={`e-btn danger e-hold ${size ?? ""}${holding ? " holding" : ""}`}
      style={{ ["--hold" as string]: `${ms}ms` }}
      onPointerDown={(e) => { if (e.button === 0) start(); }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !e.repeat) { e.preventDefault(); start(); } }}
      onKeyUp={(e) => { if (e.key === "Enter" || e.key === " ") stop(); }}
      aria-label={`${label} (segure para confirmar)`}
    >
      <span className="fill" aria-hidden="true" />
      <Icon name={icon} />
      <span>{label}</span>
    </button>
  );
}
