// ---------------------------------------------------------------------------
// Echo · Prévia do material do Like, no formato do canal (preset)
// Usada no envio (prévia "como o cliente vai ver") e na tela de revisão.
// ---------------------------------------------------------------------------
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./icon";
import { parseDimension } from "@/lib/brand-settings-data";
import type { Asset, ItemKind, ScriptSection } from "@/lib/like-data";

export const ratioOf = (dimension: string | null | undefined, kind: ItemKind) => {
  const d = parseDimension(dimension);
  if (d) return d.w / d.h;
  return kind === "stories" || kind === "video" ? 9 / 16 : kind === "post" || kind === "carrossel" ? 4 / 5 : 1;
};
export const ratioLabel = (r: number) => {
  const known: [number, string][] = [[1, "1:1"], [4 / 5, "4:5"], [9 / 16, "9:16"], [16 / 9, "16:9"], [3 / 4, "3:4"], [1.91, "1,91:1"]];
  return (known.find(([v]) => Math.abs(v - r) < 0.02)?.[1]) ?? `${Math.round(r * 100) / 100}:1`;
};

/** Moldura do material: slides com navegação, vídeo com capa e sobreposições (ex.: marcadores de comentário). */
export function MaterialFrame({ assets, kind, dimension, watermark, slide, onSlide, overlay, onPointer, onTime, videoRef }: {
  assets: Asset[]; kind: ItemKind; dimension?: string | null; watermark?: boolean; slide?: number; onSlide?: (i: number) => void;
  overlay?: (slide: number) => ReactNode; onPointer?: (slide: number, x: number, y: number) => void; onTime?: (t: number) => void; videoRef?: React.RefObject<HTMLVideoElement | null>;
}) {
  const [inner, setInner] = useState(0);
  const i = Math.min(slide ?? inner, Math.max(0, assets.length - 1));
  const go = (n: number) => { const v = Math.max(0, Math.min(assets.length - 1, n)); onSlide ? onSlide(v) : setInner(v); };
  const a = assets[i];
  const ratio = ratioOf(dimension, kind);
  const local = useRef<HTMLVideoElement>(null);
  const vref = videoRef ?? local;
  useEffect(() => { const v = vref.current; if (!v || !onTime) return; const h = () => onTime(v.currentTime); v.addEventListener("timeupdate", h); return () => v.removeEventListener("timeupdate", h); }, [a?.url]);
  if (!a) return <div className="lk-frame empty" style={{ aspectRatio: ratio }}><Icon name="image" /><small>Sem arquivo ainda</small></div>;
  return (
    <div className="lk-frame-wrap">
      <div className="lk-frame" style={{ aspectRatio: ratio }}
        onClick={(e) => { if (!onPointer || a.type === "video") return; const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); onPointer(i, Math.round(((e.clientX - r.left) / r.width) * 1000) / 10, Math.round(((e.clientY - r.top) / r.height) * 1000) / 10); }}>
        {a.type === "video" ? <video ref={vref} src={a.url} poster={a.poster} controls playsInline /> : a.type === "pdf" ? <iframe title={a.name ?? "PDF"} src={a.url} /> : <img src={a.url} alt={a.name ?? `Slide ${i + 1}`} draggable={false} />}
        {watermark && <span className="lk-watermark" aria-hidden="true">Prévia · não aprovado</span>}
        {overlay?.(i)}
        {assets.length > 1 && <>
          <button type="button" className="lk-nav prev" aria-label="Slide anterior" disabled={i === 0} onClick={(e) => { e.stopPropagation(); go(i - 1); }}><Icon name="chevLeft" size="sm" /></button>
          <button type="button" className="lk-nav next" aria-label="Próximo slide" disabled={i === assets.length - 1} onClick={(e) => { e.stopPropagation(); go(i + 1); }}><Icon name="chevRight" size="sm" /></button>
        </>}
      </div>
      {assets.length > 1 && <div className="lk-dots" role="tablist" aria-label="Slides">{assets.map((_, n) => <button key={n} type="button" role="tab" aria-selected={n === i} aria-label={`Slide ${n + 1}`} onClick={() => go(n)} />)}</div>}
    </div>
  );
}

export function ScriptView({ script }: { script: ScriptSection[] }) {
  if (!script.length) return null;
  return (
    <ol className="lk-script">
      {script.map((s, i) => (
        <li key={i}>
          <div className="e-row between"><b>{s.nome}</b>{s.tempo && <span className="e-caption tnum">{s.tempo}</span>}</div>
          <p>{s.texto}</p>
          {s.off && <p className="lk-off"><Icon name="message" size="sm" /> Off: {s.off}</p>}
          {s.cta && <p className="lk-cta">CTA: {s.cta}</p>}
        </li>
      ))}
    </ol>
  );
}

/** Prévia completa como o cliente vai ver (sem registrar visualização). */
export function ClientPreview({ brandName, title, kind, dimension, assets, caption, hashtags, cta, script, textBody, watermark }: { brandName: string; title: string; kind: ItemKind; dimension?: string | null; assets: Asset[]; caption?: string | null; hashtags?: string | null; cta?: string | null; script?: ScriptSection[]; textBody?: string | null; watermark?: boolean }) {
  return (
    <div className="lk-client">
      <div className="lk-post-head"><span className="lk-avatar">{brandName[0]}</span><b>{brandName}</b><span className="e-caption">· {title}</span></div>
      {kind === "roteiro" || kind === "texto" ? null : <MaterialFrame assets={assets} kind={kind} dimension={dimension} watermark={watermark} />}
      {caption && <p className="lk-caption"><b>{brandName}</b> {caption}{hashtags ? <span className="lk-tags"> {hashtags}</span> : null}</p>}
      {cta && <span className="lk-cta-pill">{cta}</span>}
      {script && script.length > 0 && <ScriptView script={script} />}
      {textBody && <div className="lk-textbody">{textBody}</div>}
    </div>
  );
}
