// ---------------------------------------------------------------------------
// Echo · Like: tela de revisão do material (página 21)
// Ver o material como vai para o canal, comentar no ponto certo e decidir.
// Visualizador à esquerda; painel com comentários, detalhes e histórico à
// direita; barra de decisão sempre visível (no celular, fixa no rodapé).
// ---------------------------------------------------------------------------
import { Link, useNavigate } from "@tanstack/react-router";
import { LoadFailed } from "@/components/echo/blocks";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { EchoLayout } from "./layout";
import { Alert, Chip, LineTabs, Menu, Segmented, Switch, TextArea, Field } from "./controls";
import { Modal } from "./overlays";
import { Avatar, Badge, Button, EmptyState, Skeleton } from "./primitives";
import { Icon } from "./icon";
import { prefersReducedMotion } from "./motion";
import { MaterialFrame, ScriptView, ratioOf } from "./like-preview";
import { KIND_ICON, LIKE_STATUS_TONE } from "./like-cards";
import { useAccess } from "./session";
import { isViewingAsClient } from "@/lib/view-as";
import { isDemoMode } from "@/lib/home-data";
import { loadBrandInfo } from "@/lib/brand-settings-data";
import {
  KIND_LABEL, PENDING, STATUS_LABEL, UNDO_MS, addComment, decide, demoActor, editComment, getItem, getSettings, itemTimeline,
  listApprovers, listItems, markPublished, markViewed, resolveComment, schedule, subscribeLike, undoDecision,
  type Activity, type Actor, type Anchor, type Comment, type ItemFull, type Version,
} from "@/lib/like-data";

const ADJUST_PHRASES = ["Ajustar texto", "Ajustar informação", "Ajustar CTA", "Trocar imagem", "Ajustar cores", "Rever formato", "Mudar a data"];
const fmtTime = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
const fmtDateTime = (iso: string) => { const d = new Date(iso); return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às ${d.getHours()}h${d.getMinutes() ? String(d.getMinutes()).padStart(2, "0") : ""}`; };
const rel = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};
const anchorLabel = (a: Anchor) => (a.type === "point" ? `slide ${a.slide + 1}` : a.type === "time" ? fmtTime(a.t) : `“${a.quote.slice(0, 40)}${a.quote.length > 40 ? "…" : ""}”`);

/** Diferença de texto por palavras (LCS): marca o que saiu e o que entrou. */
export function wordDiff(a: string, b: string): { t: string; k: "same" | "del" | "add" }[] {
  const A = a.split(/(\s+)/), B = b.split(/(\s+)/);
  const n = A.length, m = B.length;
  const L = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out: { t: string; k: "same" | "del" | "add" }[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { out.push({ t: A[i], k: "same" }); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) out.push({ t: A[i++], k: "del" });
    else out.push({ t: B[j++], k: "add" });
  }
  while (i < n) out.push({ t: A[i++], k: "del" });
  while (j < m) out.push({ t: B[j++], k: "add" });
  return out;
}

function Diff({ a, b }: { a: string; b: string }) {
  return <p className="rv-diff">{wordDiff(a, b).map((p, i) => (p.k === "same" ? p.t : <span key={i} className={p.k}>{p.t}</span>))}</p>;
}

/** Partículas nas cores do caminho, ao aprovar. */
function Burst({ show }: { show: number }) {
  if (!show || prefersReducedMotion()) return null;
  const colors = ["var(--env-brand)", "var(--env-workspace)", "var(--env-like)", "var(--env-360)"];
  return (
    <span className="rv-burst" key={show} aria-hidden="true">
      {Array.from({ length: 22 }, (_, i) => {
        const ang = (i / 22) * Math.PI * 2;
        const dist = 60 + (i % 5) * 18;
        return <i key={i} style={{ ["--dx" as string]: `${Math.cos(ang) * dist}px`, ["--dy" as string]: `${Math.sin(ang) * dist - 30}px`, background: colors[i % 4], animationDelay: `${(i % 4) * 20}ms` }} />;
      })}
    </span>
  );
}

type Filter = "abertos" | "resolvidos" | "versao" | "todos";
type SideTab = "comentarios" | "detalhes" | "historico";

export function MaterialReview({ brandSlug, itemId, v, sequence }: { brandSlug: string; itemId: string; v?: number; sequence?: boolean }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { session } = useAccess();
  const [ready, setReady] = useState(false);
  const [viewAs, setViewAs] = useState(false);
  useEffect(() => { setReady(true); setViewAs(isViewingAsClient()); }, []);

  const itemQ = useQuery({ queryKey: ["like-item", itemId, viewAs], queryFn: () => getItem(itemId), enabled: ready });
  const brand = useQuery({ queryKey: ["brand-info", brandSlug], queryFn: () => loadBrandInfo(brandSlug), enabled: ready });
  const approvers = useQuery({ queryKey: ["like-approvers", itemQ.data?.brandId], queryFn: () => listApprovers(itemQ.data!.brandId), enabled: !!itemQ.data });
  const settings = useQuery({ queryKey: ["like-settings", itemQ.data?.brandId], queryFn: () => getSettings(itemQ.data!.brandId), enabled: !!itemQ.data });
  const timeline = useQuery({ queryKey: ["like-timeline", itemId, viewAs], queryFn: () => itemTimeline(itemId), enabled: ready });
  const siblings = useQuery({ queryKey: ["like-items", brandSlug, viewAs], queryFn: () => listItems({ brandSlug }), enabled: ready });

  const refresh = () => {
    for (const k of [["like-item", itemId], ["like-timeline", itemId], ["like-items"], ["like-rounds"]]) qc.invalidateQueries({ queryKey: k });
  };
  useEffect(() => subscribeLike((_t, row) => { if (!row.item_id || row.item_id === itemId || row.id === itemId) refresh(); }), [itemId]);

  // Estado do visualizador
  const [mode, setMode] = useState<"canal" | "original">("canal");
  const [slide, setSlide] = useState(0);
  const [zoom, setZoom] = useState<{ on: boolean; x: number; y: number }>({ on: false, x: 50, y: 50 });
  const [compare, setCompare] = useState<{ on: boolean; style: "lado" | "deslizar"; pos: number }>({ on: false, style: "deslizar", pos: 50 });
  const [curTime, setCurTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [selection, setSelection] = useState<Extract<Anchor, { type: "text" }> | null>(null);
  // Comentários
  const [pending, setPending] = useState<Anchor | null>(null);
  const [draft, setDraft] = useState("");
  const [internal, setInternal] = useState(false);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const [filter, setFilter] = useState<Filter>("abertos");
  const [hover, setHover] = useState<string | null>(null);
  const [side, setSide] = useState<SideTab>("comentarios");
  const composer = useRef<HTMLTextAreaElement>(null);
  const seenIds = useRef<Set<string>>(new Set());
  // Decisão
  const [modal, setModal] = useState<null | "ajustes" | "reprovar" | "outro" | "data" | "publicado">(null);
  const [phrases, setPhrases] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [modalErr, setModalErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [burst, setBurst] = useState(0);
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t); }, []);

  const it = itemQ.data;
  const versions = it?.versions ?? [];
  const current = it?.current ?? null;
  const viewing: Version | null = (v ? versions.find((x) => x.number === v) : null) ?? current;
  const isCurrent = !!viewing && viewing.id === current?.id;
  const prevVersion = viewing ? versions.filter((x) => x.number < viewing.number).at(-1) ?? null : null;

  const me: Actor = isDemoMode() ? demoActor() : { id: session?.userId ?? "", name: session?.name ?? "", kind: session?.role === "team" && !viewAs ? "agency" : "client", isAdmin: session?.isAdmin };
  const isTeam = me.kind === "agency";
  const myApprover = (approvers.data ?? []).find((a) => a.userId === me.id);
  const aprovadores = (approvers.data ?? []).filter((a) => a.role === "aprovador");
  const rule = settings.data?.rule ?? "qualquer";

  // Marca como visto (cliente) ao abrir a versão.
  useEffect(() => { if (it && viewing && !isTeam) markViewed(it.id, viewing.id).then(() => qc.invalidateQueries({ queryKey: ["like-timeline", itemId] })); }, [it?.id, viewing?.id, isTeam]);
  useEffect(() => { setSlide(0); setZoom({ on: false, x: 50, y: 50 }); setPending(null); }, [viewing?.id]);

  // Sequência: pendentes da marca, na ordem do prazo.
  const queue = useMemo(() => (siblings.data ?? []).filter((x) => PENDING.includes(x.status)).sort((a, b) => (a.dueAt ?? "9").localeCompare(b.dueAt ?? "9") || a.orderIndex - b.orderIndex), [siblings.data]);
  const all = (siblings.data ?? []).filter((x) => x.status !== "cancelado" && (isTeam || x.status !== "rascunho"));
  const list = sequence ? queue : all;
  const pos = list.findIndex((x) => x.id === itemId);
  const go = (id: string) => navigate({ to: `/like/${brandSlug}/m/${id}${sequence ? "?sequencia=1" : ""}` as never });
  const nextPending = queue.find((x) => x.id !== itemId);

  if (!ready || itemQ.isLoading) return <EchoLayout env="like" wide demoData><div className="rv-layout"><Skeleton h={560} r={24} /><Skeleton h={560} r={24} /></div></EchoLayout>;
  if (itemQ.isError) return <EchoLayout env="like" wide><LoadFailed what="o material" onRetry={() => itemQ.refetch()} /></EchoLayout>;
  if (!it || !viewing || (it.brandSlug !== brandSlug)) return <EchoLayout env="like" wide demoData><div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState kind="search" title="Material não encontrado" text="Ele pode ter sido cancelado ou você não tem acesso." actions={<Link to={`/like/${brandSlug}` as never} className="e-btn secondary">Voltar para a caixa</Link>} /></div></EchoLayout>;

  const brandName = brand.data?.name ?? it.brandName;
  const assets = viewing.assets;
  const a = assets[Math.min(slide, Math.max(0, assets.length - 1))];
  const isVideo = a?.type === "video";
  const isText = ["roteiro", "texto"].includes(it.kind);

  // Decisões da versão atual (desconsidera as desfeitas)
  const live = it.decisions.filter((d) => d.decision !== "undone" && !it.decisions.some((u) => u.undoes === d.id));
  const onCurrent = live.filter((d) => d.versionId === current?.id);
  const approvedBy = new Set(onCurrent.filter((d) => d.decision === "approved").map((d) => d.decidedBy));
  const myLast = [...live].reverse().find((d) => d.decidedBy === me.id && d.versionId === current?.id);
  const undoLeft = myLast ? UNDO_MS - (Date.now() - new Date(myLast.createdAt).getTime()) : 0;
  const isPending = PENDING.includes(it.status);
  const seqTurn = rule === "sequencial" ? aprovadores.find((x) => !approvedBy.has(x.userId)) : undefined;
  const myTurnBlocked = rule === "sequencial" && !!seqTurn && seqTurn.userId !== me.id;
  const alreadyApproved = approvedBy.has(me.id);
  const canDecide = !isTeam && myApprover?.role === "aprovador" && isPending && isCurrent && !alreadyApproved && !myTurnBlocked;
  const canComment = isTeam || myApprover?.role === "aprovador" || myApprover?.role === "revisor" || isDemoMode();
  const progress = rule !== "qualquer" && aprovadores.length > 1 ? { done: approvedBy.size, total: aprovadores.length } : null;

  // Comentários
  const comments = it.comments.filter((c) => !c.deletedAt);
  const anchored = comments.filter((c) => c.anchor && !c.parentId && c.versionId === viewing.id).sort((x, y) => x.createdAt.localeCompare(y.createdAt));
  const pinNo = new Map(anchored.map((c, i) => [c.id, i + 1]));
  const roots = comments.filter((c) => !c.parentId).filter((c) =>
    filter === "abertos" ? !c.resolvedAt && c.versionId === viewing.id :
    filter === "resolvidos" ? !!c.resolvedAt :
    filter === "versao" ? c.versionId === viewing.id : true,
  ).sort((x, y) => x.createdAt.localeCompare(y.createdAt));
  const repliesOf = (id: string) => comments.filter((c) => c.parentId === id).sort((x, y) => x.createdAt.localeCompare(y.createdAt));
  const vNumOf = (id: string | null) => versions.find((x) => x.id === id)?.number ?? null;
  const openCount = comments.filter((c) => !c.parentId && !c.resolvedAt && c.versionId === viewing.id).length;
  const mentionables = [...(approvers.data ?? []).map((x) => x.name), "Marina Lopes", "Helena Duarte"];
  const mentionQuery = /(^|\s)@([\wÀ-ú]*)$/.exec(draft)?.[2];

  const startComment = (anchor: Anchor | null) => { setPending(anchor); setReplyTo(null); setSide("comentarios"); setTimeout(() => composer.current?.focus(), 30); };
  const sendComment = async () => {
    if (!draft.trim()) return;
    try {
      await addComment(it.id, { body: draft, anchor: replyTo ? null : pending, internal: isTeam && internal, parentId: replyTo?.id ?? null, versionId: viewing.id });
      setDraft(""); setPending(null); setReplyTo(null); setSelection(null);
      refresh();
    } catch (e) { toast.error((e as Error).message); }
  };
  const saveEdit = async () => { if (!editing) return; try { await editComment(editing.id, editing.body); setEditing(null); refresh(); } catch (e) { toast.error((e as Error).message); } };
  const toggleResolve = async (c: Comment) => { await resolveComment(c.id, !c.resolvedAt); refresh(); };
  const jumpTo = (c: Comment) => {
    if (!c.anchor) return;
    if (c.anchor.type === "point") setSlide(c.anchor.slide);
    if (c.anchor.type === "time" && videoRef.current) { videoRef.current.currentTime = c.anchor.t; videoRef.current.pause(); }
    setHover(c.id);
  };

  // Decisão
  const afterDecision = (status: string, decisionId: string | null) => {
    refresh();
    if (status === "aprovado" || status === "agendado") {
      setBurst((n) => n + 1);
      toast.success(it.publishAt ? `Material aprovado · agendado para ${fmtDateTime(it.publishAt)}` : "Material aprovado", {
        description: isTeam ? "Registrado como aprovação por outro canal." : "A equipe já foi avisada.",
        action: decisionId ? { label: "Desfazer", onClick: () => undo(decisionId) } : undefined, duration: 8000,
      });
    } else if (status === "em_revisao") toast.success(`Sua aprovação foi registrada (${approvedBy.size + 1} de ${aprovadores.length})`);
    else if (status === "ajustes") toast.success("Pedido de ajuste enviado para a equipe", { action: decisionId ? { label: "Desfazer", onClick: () => undo(decisionId) } : undefined, duration: 8000 });
    else if (status === "reprovado") toast("Material reprovado", { description: "A equipe vai repensar a peça.", action: decisionId ? { label: "Desfazer", onClick: () => undo(decisionId) } : undefined, duration: 8000 });
    if (sequence && nextPending) setTimeout(() => go(nextPending.id), 1400);
  };
  const doDecide = async (kind: "approved" | "changes_requested" | "rejected", opts: { note?: string; phrases?: string[] } = {}) => {
    if (!current) return;
    setBusy(true); setModalErr(null);
    try {
      const r = await decide(it.id, current.id, kind, opts);
      setModal(null); setPhrases([]); setNote("");
      afterDecision(r.status, r.decisionId);
    } catch (e) { setModalErr((e as Error).message); if (!modal) toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  const undo = async (id: string) => { try { await undoDecision(id); toast.success("Decisão desfeita"); refresh(); } catch (e) { toast.error((e as Error).message); } };
  const myOpen = comments.filter((c) => !c.parentId && !c.resolvedAt && !c.internal && c.versionId === current?.id && c.authorKind !== "agency");
  const requestAdjust = () => {
    if (settings.data?.requireCommentOnAdjust && !note.trim() && !phrases.length && !myOpen.length) { setModalErr("Diga o que ajustar: escolha uma frase, escreva uma observação ou comente no material."); return; }
    doDecide("changes_requested", { note, phrases });
  };

  // Ações da equipe
  const teamOutside = async () => {
    if (!current) return;
    setBusy(true); setModalErr(null);
    try { const r = await decide(it.id, current.id, "approved", { via: "outro_canal", justification: note }); setModal(null); setNote(""); afterDecision(r.status, r.decisionId); }
    catch (e) { setModalErr((e as Error).message); } finally { setBusy(false); }
  };

  // Texto selecionado (legenda, roteiro, texto) -> comentar este trecho
  const onTextUp = (field: "caption" | "script" | "text_body", full: string) => () => {
    const s = window.getSelection()?.toString().trim();
    if (!s || s.length < 2) { setSelection(null); return; }
    const start = Math.max(0, full.indexOf(s));
    setSelection({ type: "text", field, start, end: start + s.length, quote: s });
  };

  const overlay = (i: number) => (
    <>
      {anchored.filter((c) => c.anchor?.type === "point" && c.anchor.slide === i).map((c) => {
        const an = c.anchor as Extract<Anchor, { type: "point" }>;
        return (
          <button key={c.id} type="button" className={`rv-pin${hover === c.id ? " on" : ""}${c.resolvedAt ? " done" : ""}`} style={{ left: `${an.x}%`, top: `${an.y}%` }}
            aria-label={`Comentário ${pinNo.get(c.id)} de ${c.authorName.split(" ")[0]}: ${c.body}`}
            onMouseEnter={() => setHover(c.id)} onMouseLeave={() => setHover(null)} onClick={(e) => { e.stopPropagation(); setSide("comentarios"); setHover(c.id); document.getElementById(`c-${c.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }}>
            {pinNo.get(c.id)}
          </button>
        );
      })}
      {pending?.type === "point" && pending.slide === i && <span className="rv-pin new" style={{ left: `${pending.x}%`, top: `${pending.y}%` }} aria-hidden="true">+</span>}
    </>
  );

  const frame = (ver: Version, interactive = true) => (
    <MaterialFrame
      assets={ver.assets} kind={it.kind} dimension={it.presetDimension} slide={slide} onSlide={setSlide}
      watermark={!isTeam && !!settings.data?.watermark && isPending}
      overlay={interactive ? overlay : undefined}
      onPointer={interactive && canComment && !zoom.on && isCurrent ? (s, x, y) => startComment({ type: "point", slide: s, x, y }) : undefined}
      onTime={interactive ? setCurTime : undefined} videoRef={interactive ? videoRef : undefined}
    />
  );

  const viewer = () => {
    if (isText) {
      return (
        <div className="rv-text e-glass">
          {viewing.script.length > 0 && <div onMouseUp={onTextUp("script", viewing.script.map((x) => x.texto).join("\n"))}><ScriptView script={viewing.script} /></div>}
          {viewing.textBody && <div className="lk-textbody" onMouseUp={onTextUp("text_body", viewing.textBody)}>{viewing.textBody}</div>}
          {compare.on && prevVersion && viewing.textBody && prevVersion.textBody && <div className="rv-compare-text"><span className="e-label">Mudanças desde a v{prevVersion.number}</span><Diff a={prevVersion.textBody} b={viewing.textBody} /></div>}
        </div>
      );
    }
    if (compare.on && prevVersion) {
      const pa = prevVersion.assets[Math.min(slide, prevVersion.assets.length - 1)];
      const ratio = ratioOf(it.presetDimension, it.kind);
      if (compare.style === "lado" || pa?.type !== "image" || a?.type !== "image") {
        return (
          <div className="rv-side-by-side">
            <figure><figcaption>v{prevVersion.number}</figcaption>{frame(prevVersion, false)}</figure>
            <figure><figcaption>v{viewing.number}{isCurrent ? " · atual" : ""}</figcaption>{frame(viewing, false)}</figure>
          </div>
        );
      }
      return (
        <div className="rv-slider" style={{ aspectRatio: ratio }}>
          <img src={pa.url} alt={`Versão ${prevVersion.number}`} draggable={false} />
          <img src={a.url} alt={`Versão ${viewing.number}`} draggable={false} style={{ clipPath: `inset(0 0 0 ${compare.pos}%)` }} />
          <span className="rv-slider-line" style={{ left: `${compare.pos}%` }} aria-hidden="true"><i><Icon name="chevLeft" size="sm" /><Icon name="chevRight" size="sm" /></i></span>
          <span className="rv-slider-tag l">v{prevVersion.number}</span><span className="rv-slider-tag r">v{viewing.number}</span>
          <input type="range" min={0} max={100} value={compare.pos} aria-label="Comparar versões" onChange={(e) => setCompare((c) => ({ ...c, pos: +e.target.value }))} />
        </div>
      );
    }
    const inner = (
      <div className={`rv-zoom${zoom.on ? " on" : ""}`}
        onMouseMove={(e) => { if (!zoom.on) return; const r = e.currentTarget.getBoundingClientRect(); setZoom({ on: true, x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 }); }}
        onClick={() => zoom.on && setZoom((z) => ({ ...z, on: false }))}
        onTouchStart={(e) => { (e.currentTarget as HTMLElement).dataset.x = String(e.touches[0].clientX); }}
        onTouchEnd={(e) => { const x0 = Number((e.currentTarget as HTMLElement).dataset.x); const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) setSlide((s) => Math.max(0, Math.min(assets.length - 1, s + (dx < 0 ? 1 : -1)))); }}
        style={zoom.on ? { ["--zx" as string]: `${zoom.x}%`, ["--zy" as string]: `${zoom.y}%` } : undefined}>
        {frame(viewing)}
      </div>
    );
    if (mode === "original") return inner;
    return (
      <div className="rv-post">
        <div className="lk-post-head"><span className="lk-avatar">{brandName[0]}</span><b>{brandName.toLowerCase().replace(/\s+/g, "")}</b><span className="e-caption">· {it.channelName ?? KIND_LABEL[it.kind]}</span></div>
        {inner}
        {viewing.caption && (
          <p className="lk-caption" onMouseUp={onTextUp("caption", viewing.caption)}><b>{brandName.toLowerCase().replace(/\s+/g, "")}</b> {viewing.caption}{viewing.hashtags ? <span className="lk-tags"> {viewing.hashtags}</span> : null}</p>
        )}
      </div>
    );
  };

  const copy = (text: string, what: string) => { navigator.clipboard?.writeText(text).then(() => toast.success(`${what} copiada`)); };
  const statusBadge = <Badge tone={LIKE_STATUS_TONE[it.status]} dot>{STATUS_LABEL[it.status]}</Badge>;

  const decisionBar = (): ReactNode => {
    if (isTeam) {
      return (
        <div className="rv-bar e-glass">
          <span className="rv-bar-info">{statusBadge}<small>{isPending ? `Com o cliente${aprovadores.length ? ` · ${aprovadores.map((x) => x.name.split(" ")[0]).join(", ")}` : ""}` : it.publishAt && ["aprovado", "agendado"].includes(it.status) ? `Publicação em ${fmtDateTime(it.publishAt)}` : it.status === "publicado" ? "No ar" : "Aguardando nova versão"}</small></span>
          <div className="rv-bar-actions">
            {["ajustes", "reprovado", ...PENDING].includes(it.status) && <Link to={`/like/${brandSlug}/enviar?item=${it.id}` as never} className="e-btn primary"><Icon name="refresh" size="sm" /> Enviar nova versão</Link>}
            <Menu align="right" trigger={({ toggle }) => <Button variant="secondary" icon="more" iconOnly aria-label="Mais ações" onClick={toggle} />} items={[
              { title: "Equipe" },
              ...(isPending ? [{ label: "Lembrar aprovadores", icon: "bell", onSelect: () => toast.success(`Lembrete enviado para ${aprovadores.map((x) => x.name.split(" ")[0]).join(" e ") || "o cliente"}`) }] : []),
              { label: "Alterar data de publicação", icon: "calendar", onSelect: () => { setNote(it.publishAt ? it.publishAt.slice(0, 16) : ""); setModalErr(null); setModal("data"); } },
              ...(["aprovado", "agendado"].includes(it.status) ? [{ label: "Marcar como publicado", icon: "checkCircle", onSelect: () => { setNote(""); setModalErr(null); setModal("publicado"); } }] : []),
              ...(isPending && me.isAdmin ? [{ label: "Registrar aprovação por outro canal", icon: "checks", onSelect: () => { setNote(""); setModalErr(null); setModal("outro"); } }] : []),
              "-",
              { label: "Baixar arquivos", icon: "download", onSelect: () => viewing.assets.forEach((x) => window.open(x.url, "_blank")) },
            ]} />
          </div>
        </div>
      );
    }
    if (myLast && undoLeft > 0) {
      const label = myLast.decision === "approved" ? (it.status === "em_revisao" ? `Você aprovou · faltam ${aprovadores.length - approvedBy.size}` : "Você aprovou") : myLast.decision === "changes_requested" ? "Você pediu ajustes" : "Você reprovou";
      return (
        <div className="rv-bar e-glass decided">
          <Burst show={burst} />
          <span className="rv-bar-info"><Icon name={myLast.decision === "approved" ? "checkCircle" : "refresh"} /><span><b>{label}</b><small>Dá para desfazer por mais {Math.ceil(undoLeft / 60000)} min</small></span></span>
          <div className="rv-bar-actions">
            <Button variant="secondary" icon="history" onClick={() => undo(myLast.id)}>Desfazer</Button>
            {nextPending && <Button icon="arrowRight" onClick={() => go(nextPending.id)}>Próximo</Button>}
          </div>
        </div>
      );
    }
    if (!isCurrent) return <div className="rv-bar e-glass"><span className="rv-bar-info"><Icon name="history" /><small>Você está vendo a v{viewing.number}. A decisão vale para a versão atual.</small></span><Button variant="secondary" onClick={() => navigate({ to: `/like/${brandSlug}/m/${it.id}` as never })}>Ver a atual</Button></div>;
    if (!isPending) return <div className="rv-bar e-glass"><span className="rv-bar-info">{statusBadge}{it.publishAt && ["aprovado", "agendado"].includes(it.status) && <small>Publicação em {fmtDateTime(it.publishAt)}</small>}</span>{nextPending && <Button icon="arrowRight" onClick={() => go(nextPending.id)}>Próximo para decidir</Button>}</div>;
    if (!canDecide) {
      const who = myTurnBlocked && seqTurn ? `Aguardando ${seqTurn.name} aprovar primeiro` : alreadyApproved ? `Você já aprovou · aguardando ${aprovadores.filter((x) => !approvedBy.has(x.userId)).map((x) => x.name.split(" ")[0]).join(", ")}` : `Aprovação de ${aprovadores.map((x) => x.name).join(", ") || "—"}`;
      return <div className="rv-bar e-glass"><span className="rv-bar-info"><Icon name="lock" /><small>{who}. Você pode comentar.</small></span><Button variant="secondary" icon="message" onClick={() => startComment(null)}>Comentar</Button></div>;
    }
    return (
      <div className="rv-bar e-glass">
        <Burst show={burst} />
        {progress && <span className="rv-bar-info"><small>Sua aprovação ({progress.done + 1} de {progress.total})</small></span>}
        <div className="rv-bar-actions grow">
          <Menu align="left" trigger={({ toggle }) => <Button variant="ghost" icon="more" iconOnly aria-label="Outras decisões" onClick={toggle} />} items={[{ label: "Reprovar material", icon: "xCircle", danger: true, onSelect: () => { setNote(""); setModalErr(null); setModal("reprovar"); } }]} />
          <Button variant="secondary" icon="refresh" onClick={() => { setModalErr(null); setModal("ajustes"); }}>Solicitar ajustes</Button>
          <Button icon="check" loading={busy} onClick={() => doDecide("approved")}>Aprovar</Button>
        </div>
      </div>
    );
  };

  const commentItem = (c: Comment, reply = false) => {
    const vn = vNumOf(c.versionId);
    const old = vn !== null && vn !== viewing.number;
    const fresh = !seenIds.current.has(c.id);
    seenIds.current.add(c.id);
    return (
      <li key={c.id} id={`c-${c.id}`} className={`rv-c${reply ? " reply" : ""}${c.internal ? " internal" : ""}${c.resolvedAt ? " resolved" : ""}${old ? " old" : ""}${hover === c.id ? " on" : ""}${fresh ? " fresh" : ""}`}
        onMouseEnter={() => setHover(c.id)} onMouseLeave={() => setHover(null)}>
        <div className="rv-c-head">
          <Avatar name={c.authorName} size="xs" />
          <b>{c.authorName.split(" ")[0]}</b>
          {c.authorKind === "agency" && <span className="e-caption">Reach</span>}
          {c.internal && <Badge tone="glass" icon="lock">Nota interna</Badge>}
          {old && <span className="rv-vtag">v{vn}</span>}
          <span className="e-caption" style={{ marginLeft: "auto" }}>{rel(c.createdAt)}{c.editedAt ? " · editado" : ""}</span>
        </div>
        {c.anchor && <button type="button" className="rv-anchor" onClick={() => jumpTo(c)}>{pinNo.get(c.id) && <i>{pinNo.get(c.id)}</i>}<Icon name={c.anchor.type === "time" ? "play" : c.anchor.type === "text" ? "fileText" : "pin"} size="sm" /> {anchorLabel(c.anchor)}</button>}
        {editing?.id === c.id ? (
          <div className="stack" style={{ gap: 6 }}>
            <TextArea value={editing.body} onChange={(e) => setEditing({ id: c.id, body: e.target.value })} rows={2} aria-label="Editar comentário" />
            <div className="e-row" style={{ gap: 6 }}><Button size="sm" onClick={saveEdit}>Salvar</Button><Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button></div>
          </div>
        ) : <p className="rv-c-body">{c.body.split(/(@[\wÀ-ú]+(?:\s[A-ZÀ-Ú][\wÀ-ú]+)?)/).map((p, i) => (p.startsWith("@") ? <b key={i} className="rv-mention">{p}</b> : p))}</p>}
        <div className="rv-c-actions">
          {!reply && canComment && <button type="button" onClick={() => { setReplyTo(c); setPending(null); composer.current?.focus(); }}><Icon name="reply" size="sm" /> Responder</button>}
          {c.authorId === me.id && !editing && <button type="button" onClick={() => setEditing({ id: c.id, body: c.body })}><Icon name="edit" size="sm" /> Editar</button>}
          {isTeam && !reply && <button type="button" onClick={() => toggleResolve(c)}><Icon name={c.resolvedAt ? "refresh" : "check"} size="sm" /> {c.resolvedAt ? "Reabrir" : "Resolver"}</button>}
        </div>
        {!reply && repliesOf(c.id).length > 0 && <ul className="rv-replies">{repliesOf(c.id).map((r) => commentItem(r, true))}</ul>}
      </li>
    );
  };

  const who = (userId: string) => {
    const d = [...onCurrent].reverse().find((x) => x.decidedBy === userId);
    const name = (approvers.data ?? []).find((x) => x.userId === userId)?.name ?? "";
    const seen = it.views.filter((x) => x.userName === name).sort((x, y) => y.at.localeCompare(x.at))[0];
    if (d?.decision === "approved") return { tone: "ok", label: `Aprovou ${rel(d.createdAt)}`, icon: "checkCircle" };
    if (d?.decision === "changes_requested") return { tone: "warn", label: `Pediu ajustes ${rel(d.createdAt)}`, icon: "refresh" };
    if (d?.decision === "rejected") return { tone: "danger", label: "Reprovou", icon: "xCircle" };
    if (seen) return { tone: "muted", label: `Visto em ${new Date(seen.at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`, icon: "eye" };
    return { tone: "muted", label: "Pendente", icon: "clock" };
  };
  const dueDays = it.dueAt ? Math.ceil((new Date(it.dueAt).getTime() - Date.now()) / 86400e3) : null;

  const details = (
    <div className="stack">
      {viewing.number > 1 && viewing.changesNote && <div className="rv-changed"><Icon name="sparkle" size="sm" /><span><b>O que mudou na v{viewing.number}</b>{viewing.changesNote}</span></div>}
      <dl className="rv-facts">
        <div><dt>Formato</dt><dd><Icon name={KIND_ICON[it.kind]} size="sm" /> {KIND_LABEL[it.kind]}{it.presetDimension ? ` · ${it.presetDimension}` : ""}</dd></div>
        {it.channelName && <div><dt>Canal</dt><dd>{it.channelName}</dd></div>}
        {it.publishAt && <div><dt>Publicação</dt><dd>{fmtDateTime(it.publishAt)}</dd></div>}
        {it.frontName && <div><dt>Frente</dt><dd>{it.frontName}</dd></div>}
        <div><dt>Versão</dt><dd>v{viewing.number}{isCurrent ? " (atual)" : ""}</dd></div>
        {it.sentAt && <div><dt>Enviado</dt><dd>{new Date(it.sentAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} pela Reach</dd></div>}
        {it.dueAt && isPending && <div><dt>Decidir até</dt><dd className={dueDays !== null && dueDays <= 1 ? "urgent" : ""}>{new Date(it.dueAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}{dueDays !== null ? ` · ${dueDays < 0 ? "venceu" : dueDays === 0 ? "hoje" : dueDays === 1 ? "amanhã" : `em ${dueDays} dias`}` : ""}</dd></div>}
        {it.publishedLink && <div><dt>Publicado</dt><dd><a href={it.publishedLink} target="_blank" rel="noreferrer" className="e-link">Abrir post</a></dd></div>}
      </dl>
      <div>
        <span className="e-label">Aprovadores{rule !== "qualquer" ? ` · ${rule === "todos" ? "todos precisam aprovar" : "em sequência"}` : ""}</span>
        <ul className="rv-approvers">
          {(approvers.data ?? []).filter((x) => x.role !== "observador").map((x) => { const s = who(x.userId); return (
            <li key={x.userId}><Avatar name={x.name} size="sm" /><span><b>{x.name}</b><small className={`t-${s.tone}`}><Icon name={s.icon} size="sm" /> {x.role === "revisor" ? "Revisor · " : ""}{s.label}</small></span></li>
          ); })}
        </ul>
      </div>
      {(viewing.caption || viewing.hashtags || viewing.cta) && (
        <div className="rv-copy">
          {viewing.caption && <div><div className="e-row between"><span className="e-label">Legenda</span><button type="button" className="e-link" onClick={() => copy(viewing.caption!, "Legenda")}><Icon name="copy" size="sm" /> Copiar</button></div>
            {compare.on && prevVersion?.caption && prevVersion.caption !== viewing.caption ? <Diff a={prevVersion.caption} b={viewing.caption} /> : <p onMouseUp={onTextUp("caption", viewing.caption)}>{viewing.caption}</p>}</div>}
          {viewing.hashtags && <div><div className="e-row between"><span className="e-label">Hashtags</span><button type="button" className="e-link" onClick={() => copy(viewing.hashtags!, "Hashtags")}><Icon name="copy" size="sm" /> Copiar</button></div><p className="lk-tags">{viewing.hashtags}</p></div>}
          {viewing.cta && <div><span className="e-label">CTA</span><p>{viewing.cta}</p></div>}
        </div>
      )}
    </div>
  );

  const EVENT: Record<string, [string, string]> = { criado: ["Criado", "plus"], enviado: ["Enviado ao cliente", "send"], visto: ["Visto", "eye"], comentado: ["Comentou", "message"], decidido: ["Decidiu", "checkCircle"], desfeito: ["Desfez a decisão", "history"], nova_versao: ["Nova versão", "refresh"], agendado: ["Agendado", "calendar"], publicado: ["Publicado", "megaphone"], cancelado: ["Cancelado", "ban"] };
  const DEC: Record<string, string> = { approved: "Aprovou", changes_requested: "Pediu ajustes", rejected: "Reprovou" };
  const history = (timeline.data ?? []).filter((x: Activity) => isTeam || !x.payload.internal);

  return (
    <EchoLayout env="like" wide demoData>
      <div className="rv-page">
        <header className="rv-head">
          <Link to={`/like/${brandSlug}` as never} className="e-btn ghost sm" aria-label="Voltar para a caixa"><Icon name="chevLeft" size="sm" /> Caixa</Link>
          <div className="rv-title">
            <span className="e-caption"><Icon name={KIND_ICON[it.kind]} size="sm" /> {KIND_LABEL[it.kind]}{it.channelName ? ` · ${it.channelName}` : ""}</span>
            <h1 className="e-h3">{it.title}</h1>
          </div>
          {statusBadge}
          {pos >= 0 && list.length > 1 && (
            <nav className="rv-seq" aria-label="Navegar entre materiais">
              <Button variant="ghost" size="sm" icon="chevLeft" iconOnly aria-label="Anterior" disabled={pos <= 0} onClick={() => go(list[pos - 1].id)} />
              <span className="tnum">{pos + 1} de {list.length}{sequence ? " para decidir" : ""}</span>
              <Button variant="ghost" size="sm" icon="chevRight" iconOnly aria-label="Próximo" disabled={pos >= list.length - 1} onClick={() => go(list[pos + 1].id)} />
            </nav>
          )}
        </header>

        <div className="rv-layout">
          <section className="rv-viewer">
            <div className="rv-tools">
              {!isText && <Segmented value={mode} onChange={(m) => { setMode(m); setZoom({ on: false, x: 50, y: 50 }); }} label="Visualização" items={[{ value: "canal", label: "Como vai aparecer", icon: "eye" }, { value: "original", label: "Arquivo original", icon: "image" }]} />}
              {versions.length > 1 && (
                <div className="rv-versions" role="group" aria-label="Versões">
                  {versions.map((x) => <Chip key={x.id} pressed={x.id === viewing.id} onClick={() => navigate({ to: `/like/${brandSlug}/m/${it.id}${x.id === current?.id ? "" : `?v=${x.number}`}` as never })}>v{x.number}{x.id === current?.id ? " · atual" : ""}</Chip>)}
                </div>
              )}
              <span style={{ flex: 1 }} />
              {prevVersion && <Chip pressed={compare.on} icon="layers" onClick={() => setCompare((c) => ({ ...c, on: !c.on }))}>Comparar com v{prevVersion.number}</Chip>}
              {compare.on && prevVersion && !isText && <Segmented value={compare.style} onChange={(s) => setCompare((c) => ({ ...c, style: s }))} label="Modo de comparação" items={[{ value: "deslizar", label: "Deslizar" }, { value: "lado", label: "Lado a lado" }]} />}
              {!isText && a?.type === "image" && !compare.on && <Button variant="ghost" size="sm" icon={zoom.on ? "minus" : "search"} onClick={() => setZoom((z) => ({ ...z, on: !z.on }))}>{zoom.on ? "Sair do zoom" : "Ampliar"}</Button>}
            </div>

            {!isCurrent && <Alert kind="info" title={`Você está vendo a v${viewing.number}`}>A versão atual é a v{current?.number}. Comentários e decisões valem para a atual.</Alert>}
            {viewing.number > 1 && viewing.changesNote && isCurrent && <div className="rv-changed mobile-only"><Icon name="sparkle" size="sm" /><span><b>O que mudou na v{viewing.number}</b>{viewing.changesNote}</span></div>}

            <div className="rv-stage">
              {viewer()}
              {assets.length > 1 && !isText && <span className="rv-count tnum">{slide + 1}/{assets.length}</span>}
            </div>

            {assets.length > 1 && !isText && !compare.on && (
              <div className="rv-thumbs" role="tablist" aria-label="Slides">
                {assets.map((x, i) => (
                  <button key={i} type="button" role="tab" aria-selected={i === slide} aria-label={`Slide ${i + 1}`} onClick={() => setSlide(i)}>
                    {x.type === "image" ? <img src={x.url} alt="" /> : <Icon name={x.type === "video" ? "play" : "file"} size="sm" />}
                    {anchored.some((c) => c.anchor?.type === "point" && c.anchor.slide === i && !c.resolvedAt) && <i aria-hidden="true" />}
                  </button>
                ))}
              </div>
            )}

            {isVideo && (
              <div className="rv-timeline">
                <div className="rv-track" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); const d = videoRef.current?.duration || a?.duration || 0; if (videoRef.current && d) videoRef.current.currentTime = ((e.clientX - r.left) / r.width) * d; }}>
                  <span className="rv-track-fill" style={{ width: `${(curTime / (videoRef.current?.duration || a?.duration || 1)) * 100}%` }} />
                  {anchored.filter((c) => c.anchor?.type === "time").map((c) => { const t = (c.anchor as { t: number }).t; const d = videoRef.current?.duration || a?.duration || 1; return (
                    <button key={c.id} type="button" className={`rv-mark${hover === c.id ? " on" : ""}`} style={{ left: `${Math.min(100, (t / d) * 100)}%` }} aria-label={`Comentário em ${fmtTime(t)}: ${c.body}`} onClick={(e) => { e.stopPropagation(); jumpTo(c); }}>{pinNo.get(c.id)}</button>
                  ); })}
                </div>
                {canComment && isCurrent && <Button variant="secondary" size="sm" icon="message" onClick={() => { videoRef.current?.pause(); startComment({ type: "time", t: Math.round(curTime * 10) / 10 }); }}>Comentar em {fmtTime(curTime)}</Button>}
              </div>
            )}

            {selection && canComment && isCurrent && (
              <div className="rv-selection e-glass">
                <span>“{selection.quote.slice(0, 60)}{selection.quote.length > 60 ? "…" : ""}”</span>
                <Button size="sm" icon="message" onClick={() => startComment(selection)}>Comentar este trecho</Button>
                <Button size="sm" variant="ghost" icon="x" iconOnly aria-label="Cancelar" onClick={() => setSelection(null)} />
              </div>
            )}
            {!isText && canComment && isCurrent && !zoom.on && !compare.on && a?.type === "image" && <p className="e-caption rv-hint"><Icon name="pin" size="sm" /> Toque na imagem para comentar num ponto exato.</p>}
          </section>

          <aside className="rv-panel e-glass">
            <div className="rv-panel-tabs">
              <LineTabs value={side} onChange={setSide} items={[{ value: "comentarios", label: "Comentários", count: openCount }, { value: "detalhes", label: "Detalhes" }, { value: "historico", label: "Histórico" }]} />
            </div>
            <div className="rv-panel-body">
              {side === "comentarios" && (
                <div className="stack">
                  <div className="e-row wrap" style={{ gap: 6 }}>
                    {([["abertos", "Abertos"], ["resolvidos", "Resolvidos"], ["versao", "Desta versão"], ["todos", "Todos"]] as [Filter, string][]).map(([k, l]) => <Chip key={k} pressed={filter === k} onClick={() => setFilter(k)}>{l}</Chip>)}
                  </div>
                  {roots.length === 0 ? <EmptyState compact kind="ok" title={filter === "abertos" ? "Nenhum comentário em aberto" : "Nada por aqui"} text={canComment && isCurrent ? "Toque no material para comentar num ponto exato." : undefined} /> : <ul className="rv-comments">{roots.map((c) => commentItem(c))}</ul>}
                </div>
              )}
              {side === "detalhes" && details}
              {side === "historico" && (
                <ol className="rv-history">
                  {history.length === 0 && <li className="e-caption">Sem registros ainda.</li>}
                  {[...history].reverse().map((h) => { const [label, icon] = EVENT[h.event] ?? [h.event, "circle"]; const dec = h.payload.decision as string | undefined; return (
                    <li key={h.id}><span className="rv-h-ic"><Icon name={icon} size="sm" /></span><span><b>{h.actorName ?? "Sistema"}</b> {dec ? DEC[dec]?.toLowerCase() ?? label.toLowerCase() : label.toLowerCase()}{h.payload.internal ? " (nota interna)" : ""}<small>{rel(h.createdAt)}</small></span></li>
                  ); })}
                </ol>
              )}
            </div>
            {side === "comentarios" && canComment && isCurrent && (
              <div className="rv-composer">
                {(pending || replyTo) && (
                  <div className="rv-composer-ctx">
                    {replyTo ? <><Icon name="reply" size="sm" /> Respondendo a {replyTo.authorName.split(" ")[0]}</> : pending && <><Icon name={pending.type === "time" ? "play" : pending.type === "text" ? "fileText" : "pin"} size="sm" /> Comentário em {anchorLabel(pending)}</>}
                    <button type="button" aria-label="Remover marcação" onClick={() => { setPending(null); setReplyTo(null); }}><Icon name="x" size="sm" /></button>
                  </div>
                )}
                <div className={`rv-composer-box${internal ? " internal" : ""}`}>
                  <textarea ref={composer} rows={2} value={draft} placeholder={internal ? "Nota interna (o cliente não vê)" : "Escreva um comentário… use @ para mencionar"} aria-label="Comentário"
                    onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendComment(); }} />
                  {mentionQuery !== undefined && (
                    <div className="rv-mentions" role="listbox">
                      {mentionables.filter((n, i, arr) => arr.indexOf(n) === i && n.toLowerCase().startsWith(mentionQuery.toLowerCase())).slice(0, 5).map((n) => (
                        <button key={n} type="button" role="option" aria-selected="false" onClick={() => { setDraft((d) => d.replace(/@[\wÀ-ú]*$/, `@${n} `)); composer.current?.focus(); }}><Avatar name={n} size="xs" /> {n}</button>
                      ))}
                    </div>
                  )}
                  <div className="rv-composer-foot">
                    {isTeam ? <Switch label="Nota interna" checked={internal} onChange={setInternal} /> : <span className="e-caption">⌘ Enter para enviar</span>}
                    <Button size="sm" icon="send" disabled={!draft.trim()} onClick={sendComment}>Enviar</Button>
                  </div>
                </div>
              </div>
            )}
            <div className="rv-bar-slot">{decisionBar()}</div>
          </aside>
        </div>
      </div>

      <Modal open={modal === "ajustes"} onClose={() => setModal(null)} title="Solicitar ajustes" sub="A equipe recebe o resumo abaixo e envia uma nova versão." icon="refresh"
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>Cancelar</Button><Button loading={busy} onClick={requestAdjust}>Enviar pedido</Button></>}>
        <div className="stack">
          <div className="e-row wrap" style={{ gap: 6 }}>{ADJUST_PHRASES.map((p) => <Chip key={p} pressed={phrases.includes(p)} onClick={() => { setModalErr(null); setPhrases((x) => (x.includes(p) ? x.filter((y) => y !== p) : [...x, p])); }}>{p}</Chip>)}</div>
          <TextArea label="Observação" optional={!settings.data?.requireCommentOnAdjust} value={note} onChange={(e) => { setModalErr(null); setNote(e.target.value); }} rows={3} placeholder="O que precisa mudar?" />
          <div className="rv-summary">
            <span className="e-label">O que vai para a equipe</span>
            {phrases.length === 0 && !note.trim() && myOpen.length === 0 ? <p className="e-caption">Nada ainda. {settings.data?.requireCommentOnAdjust ? "Escolha uma frase, escreva uma observação ou comente no material." : ""}</p> : (
              <ul>
                {phrases.map((p) => <li key={p}>{p}</li>)}
                {note.trim() && <li>{note.trim()}</li>}
                {myOpen.map((c) => <li key={c.id}>{c.anchor ? `[${anchorLabel(c.anchor)}] ` : ""}{c.body}</li>)}
              </ul>
            )}
          </div>
          {modalErr && <Alert kind="warn" title="Falta dizer o que ajustar">{modalErr}</Alert>}
        </div>
      </Modal>

      <Modal open={modal === "reprovar"} onClose={() => setModal(null)} title="Reprovar material" sub="Use quando a peça não serve e precisa ser repensada. Para pequenas mudanças, prefira “Solicitar ajustes”." icon="xCircle" tone="danger"
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>Cancelar</Button><Button variant="danger" loading={busy} disabled={note.trim().length < 5} onClick={() => doDecide("rejected", { note })}>Reprovar</Button></>}>
        <div className="stack">
          <TextArea label="Motivo" value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Por que o material não serve?" help="Obrigatório. A equipe usa isso para refazer." />
          {modalErr && <Alert kind="danger" title="Não foi possível reprovar">{modalErr}</Alert>}
        </div>
      </Modal>

      <Modal open={modal === "outro"} onClose={() => setModal(null)} title="Registrar aprovação por outro canal" sub="Só para quando o cliente aprovou fora do Like (WhatsApp, e-mail, reunião). Fica registrado no histórico." icon="checks"
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>Cancelar</Button><Button loading={busy} disabled={note.trim().length < 10} onClick={teamOutside}>Registrar aprovação</Button></>}>
        <div className="stack">
          <TextArea label="Como o cliente aprovou" value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Ex.: Carla aprovou por WhatsApp em 29/09 às 15h." help="Mínimo de 10 caracteres." />
          {modalErr && <Alert kind="danger" title="Não foi possível registrar">{modalErr}</Alert>}
        </div>
      </Modal>

      <Modal open={modal === "data"} onClose={() => setModal(null)} title="Alterar data de publicação" icon="calendar"
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>Cancelar</Button><Button disabled={!note} onClick={async () => { await schedule(it.id, new Date(note).toISOString()); setModal(null); refresh(); toast.success(`Publicação em ${fmtDateTime(new Date(note).toISOString())}`); }}>Salvar</Button></>}>
        <Field label="Data e hora" type="datetime-local" value={note} onChange={(e) => setNote(e.target.value)} />
      </Modal>

      <Modal open={modal === "publicado"} onClose={() => setModal(null)} title="Marcar como publicado" icon="megaphone"
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>Cancelar</Button><Button disabled={!/^https?:\/\//.test(note)} onClick={async () => { try { await markPublished(it.id, note); setModal(null); refresh(); toast.success("Material publicado"); } catch (e) { setModalErr((e as Error).message); } }}>Marcar publicado</Button></>}>
        <div className="stack">
          <Field label="Link do post" type="url" value={note} onChange={(e) => setNote(e.target.value)} placeholder="https://instagram.com/p/…" />
          {modalErr && <Alert kind="danger" title="Não foi possível">{modalErr}</Alert>}
        </div>
      </Modal>
    </EchoLayout>
  );
}
