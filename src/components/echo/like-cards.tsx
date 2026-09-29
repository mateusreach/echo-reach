// ---------------------------------------------------------------------------
// Echo · Like: cartão de material e calendário editorial
// Calendário inspirado no protótipo (reach-like.html): capa, formato, título e
// status por dia; aqui com arte real, várias peças por dia, arrastar para
// reagendar e "+" no dia (equipe).
// ---------------------------------------------------------------------------
import { useState, type DragEvent } from "react";
import { Badge, type Tone } from "./primitives";
import { Icon, type IconName } from "./icon";
import { MaterialFrame } from "./like-preview";
import { KIND_LABEL, PENDING, STATUS_LABEL, coverCss, type ItemFull, type ItemStatus } from "@/lib/like-data";

export const LIKE_STATUS_TONE: Record<ItemStatus, Tone> = { rascunho: "draft", aguardando: "review", em_revisao: "review", aprovado: "approved", ajustes: "adjust", nova_versao: "doing", reprovado: "late", agendado: "approved", publicado: "done", cancelado: "blocked" };
export const KIND_ICON: Record<string, IconName> = { post: "image", carrossel: "carousel", video: "play", stories: "stories", roteiro: "fileText", texto: "file", peca: "layers", outro: "file" };
const fmtDue = (iso: string | null) => {
  if (!iso) return null;
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400e3);
  return { label: days < 0 ? `venceu há ${-days}d` : days === 0 ? "vence hoje" : days === 1 ? "vence amanhã" : `vence em ${days} dias`, tone: days < 0 ? "late" : days <= 1 ? "soon" : "ok" };
};

/** Cartão de material (caixa do cliente e painel da equipe). Prévia funcional: setas do carrossel, vídeo. */
export function MaterialCard({ item, onOpen, showDue = true, approvals }: { item: ItemFull; onOpen: () => void; showDue?: boolean; approvals?: { done: string[]; waiting: string[] } }) {
  const v = item.current;
  const text = ["roteiro", "texto"].includes(item.kind);
  const due = showDue && PENDING.includes(item.status) ? fmtDue(item.dueAt) : null;
  const openComments = item.comments.filter((c) => !c.resolvedAt && !c.internal).length;
  return (
    <article className="mat-card e-glass">
      <div className="mat-preview" onClick={(e) => { if ((e.target as HTMLElement).closest("button, video, iframe, a")) return; onOpen(); }}>
        {text ? (
          <div className="mat-textcover" style={{ background: coverCss(item.coverTone) }}>
            <Icon name={KIND_ICON[item.kind]} />
            <p>{v?.script?.[0]?.texto ?? v?.textBody?.slice(0, 140) ?? item.title}</p>
          </div>
        ) : <MaterialFrame assets={v?.assets ?? []} kind={item.kind} dimension={item.presetDimension} />}
      </div>
      <button type="button" className="mat-body" onClick={onOpen}>
        <span className="mat-top"><span className="fmt"><Icon name={KIND_ICON[item.kind]} size="sm" />{KIND_LABEL[item.kind]}</span>{(v?.number ?? 1) > 1 && <span className="mat-version">v{v!.number}</span>}{item.channelName && <span className="e-caption">{item.channelName}</span>}</span>
        <b>{item.title}</b>
        {item.status === "nova_versao" && v?.changesNote && <span className="mat-new"><Icon name="sparkle" size="sm" /> Nova versão · {v.changesNote}</span>}
        <span className="mat-foot">
          <Badge tone={LIKE_STATUS_TONE[item.status]} dot>{STATUS_LABEL[item.status]}</Badge>
          {due && <span className={`mat-due ${due.tone}`}>{due.label}</span>}
          <span style={{ flex: 1 }} />
          {openComments > 0 && <span className="e-caption tnum"><Icon name="message" size="sm" /> {openComments}</span>}
          {item.publishAt && <span className="e-caption tnum"><Icon name="calendar" size="sm" /> {new Date(item.publishAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>}
        </span>
        {approvals && (approvals.done.length > 0 || approvals.waiting.length > 0) && <span className="mat-approvals">{approvals.done.map((n) => <span key={n} className="ok"><Icon name="check" size="sm" /> {n}</span>)}{approvals.waiting.map((n) => <span key={n}><Icon name="clock" size="sm" /> {n}</span>)}</span>}
      </button>
    </article>
  );
}

const WEEK = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Calendário editorial: cada peça no dia de publicação, com a capa real. */
export function EditorialCalendar({ items, year, month, onOpen, onMove, onAdd, canMove }: { items: ItemFull[]; year: number; month: number; onOpen: (id: string) => void; onMove?: (id: string, dateISO: string) => void; onAdd?: (dateISO: string) => void; canMove?: (i: ItemFull) => boolean }) {
  const [over, setOver] = useState<string | null>(null);
  const first = new Date(year, month, 1);
  const off = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((off + days) / 7) * 7 }, (_, i) => new Date(year, month, i - off + 1));
  const today = toISO(new Date());
  const byDay = new Map<string, ItemFull[]>();
  for (const it of items) if (it.publishAt) { const k = toISO(new Date(it.publishAt)); byDay.set(k, [...(byDay.get(k) ?? []), it]); }
  byDay.forEach((l) => l.sort((a, b) => (a.publishAt ?? "").localeCompare(b.publishAt ?? "")));
  return (
    <div className="ed-cal e-glass">
      {WEEK.map((w) => <span key={w} className="cal-wd">{w}</span>)}
      {cells.map((d) => {
        const iso = toISO(d);
        const list = byDay.get(iso) ?? [];
        const out = d.getMonth() !== month;
        return (
          <div key={iso} className={`ed-day${out ? " out" : ""}${iso === today ? " today" : ""}${iso < today ? " past" : ""}${over === iso ? " over" : ""}`}
            onDragOver={(e: DragEvent) => { if (onMove && e.dataTransfer.types.includes("text/x-like")) { e.preventDefault(); setOver(iso); } }}
            onDragLeave={() => setOver((o) => (o === iso ? null : o))}
            onDrop={(e: DragEvent) => { const id = e.dataTransfer.getData("text/x-like"); setOver(null); if (id && onMove) { e.preventDefault(); onMove(id, iso); } }}>
            <span className="cal-n tnum">{d.getDate()}</span>
            {onAdd && !out && iso >= today && <button type="button" className="ed-add" aria-label={`Novo material em ${d.getDate()}`} onClick={() => onAdd(iso)}><Icon name="plus" size="sm" /></button>}
            <div className="ed-items">
              {list.map((it) => {
                const art = it.current?.assets.find((a) => a.type === "image")?.url ?? it.current?.assets.find((a) => a.poster)?.poster;
                const movable = !!onMove && (canMove ? canMove(it) : true);
                return (
                  <button key={it.id} type="button" className={`ed-card st-${it.status}`} draggable={movable} onDragStart={(e) => { e.dataTransfer.setData("text/x-like", it.id); e.dataTransfer.effectAllowed = "move"; }} onClick={() => onOpen(it.id)} title={`${it.title} · ${STATUS_LABEL[it.status]}`}>
                    <span className="ed-thumb" style={art ? undefined : { background: coverCss(it.coverTone) }}>{art ? <img src={art} alt="" draggable={false} /> : <Icon name={KIND_ICON[it.kind]} size="sm" />}<em>{KIND_LABEL[it.kind]}</em></span>
                    <span className="ed-title">{it.title}</span>
                    <i className="ed-dot" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
