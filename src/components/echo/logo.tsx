// ---------------------------------------------------------------------------
// Echo · Marca viva
// Órbitas e estrela no degradê do caminho de cor (--p1 → --p2 → --mix), palavra
// em --ink. Hover: órbitas se abrem, ondas de eco, brilho e estrela girando
// (estilos em styles/echo/brand.css).
// ---------------------------------------------------------------------------
import { forwardRef, useId, useImperativeHandle, useRef } from "react";
import { RING_A, RING_B, SPARK, WORD } from "./logo-paths";

export type EchoLogoHandle = { play: () => void };

function Grad({ id }: { id: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="1" y2=".6">
      <stop offset="0" className="s1" />
      <stop offset=".55" className="s2" />
      <stop offset="1" className="s3" />
    </linearGradient>
  );
}

export const EchoLogo = forwardRef<EchoLogoHandle, { variant?: "color" | "mono" | "white"; size?: number; className?: string; label?: string }>(
  function EchoLogo({ variant = "color", size, className = "", label = "Echo" }, ref) {
    const raw = useId().replace(/[^a-zA-Z0-9]/g, "");
    const id = `eg${raw}`;
    const el = useRef<SVGSVGElement>(null);
    useImperativeHandle(ref, () => ({
      play() {
        const s = el.current;
        if (!s) return;
        s.classList.remove("is-playing");
        void s.getBoundingClientRect();
        s.classList.add("is-playing");
        window.setTimeout(() => s.classList.remove("is-playing"), 1500);
      },
    }));
    return (
      <svg
        ref={el}
        className={`e-echo v-${variant} ${className}`}
        viewBox="0 0 806.39 387.43"
        style={size ? { height: size } : undefined}
        role="img"
        aria-label={label}
      >
        <defs>
          <Grad id={`${id}g`} />
          <linearGradient id={`${id}sh`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset=".5" stopColor="#fff" stopOpacity=".95" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <clipPath id={`${id}c`}>
            <path d={RING_A} />
            <path d={RING_B} />
            <path d={SPARK} />
          </clipPath>
        </defs>
        <g className="echoes" aria-hidden="true">
          <path className="ring" d={RING_A} />
          <path className="ring" d={RING_B} />
        </g>
        <g className="orbit a"><path className="ring" d={RING_A} fill={`url(#${id}g)`} /></g>
        <g className="orbit b"><path className="ring" d={RING_B} fill={`url(#${id}g)`} /></g>
        <g className="sheen" clipPath={`url(#${id}c)`} aria-hidden="true">
          <rect className="band" x="-260" y="0" width="220" height="387.43" fill={`url(#${id}sh)`} />
        </g>
        <path className="word" d={WORD} />
        <path className="spark" d={SPARK} fill={`url(#${id}g)`} />
      </svg>
    );
  },
);

/** Carregador da marca: as duas órbitas oscilam em sentidos opostos e a estrela cintila. */
export function OrbitLoader({ size = 64, label = "Carregando" }: { size?: number; label?: string }) {
  const id = `ol${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <span className="e-orbit-loader" role="status" aria-label={label} style={{ ["--sz" as string]: `${size}px` }}>
      <svg viewBox="0 0 806.39 387.43" aria-hidden="true">
        <defs><Grad id={id} /></defs>
        <g className="la"><path d={RING_A} fill={`url(#${id})`} /></g>
        <g className="lb"><path d={RING_B} fill={`url(#${id})`} /></g>
        <path className="ls" d={SPARK} fill={`url(#${id})`} />
      </svg>
    </span>
  );
}
