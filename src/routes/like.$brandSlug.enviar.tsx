import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { EchoLayout } from "@/components/echo/layout";
import { Alert, Checkbox, Field, Menu, Segmented, Select, TextArea } from "@/components/echo/controls";
import { Badge, Button, EmptyState, Skeleton } from "@/components/echo/primitives";
import { HoldButton, Modal } from "@/components/echo/overlays";
import { Icon, type IconName } from "@/components/echo/icon";
import { ClientPreview, ratioLabel, ratioOf } from "@/components/echo/like-preview";
import { loadBrandInfo, loadIdentity, parseDimension, type ChannelFull } from "@/lib/brand-settings-data";
import { listOpsFronts, listOpsTasks, type OpsTask } from "@/lib/ops-data";
import { loadLibrary } from "@/lib/library-data";
import { loadClientOps } from "@/lib/client-ops-data";
import {
  KIND_LABEL, addBusinessDays, addVersion, cancelItem, createItem, createRound, getItem, getSettings, inspectFile, listApprovers, listRounds, resolveComment, sendItems, uploadAsset,
  type Asset, type ItemKind, type ScriptSection,
} from "@/lib/like-data";

export const Route = createFileRoute("/like/$brandSlug/enviar")({
  head: () => ({ meta: [{ title: "Enviar para aprovação · Like · Echo" }] }),
  component: SendPage,
  validateSearch: (s: Record<string, unknown>): { tarefa?: string; conteudo?: string; entrega?: string; item?: string } => ({
    ...(typeof s.tarefa === "string" ? { tarefa: s.tarefa } : {}), ...(typeof s.conteudo === "string" ? { conteudo: s.conteudo } : {}),
    ...(typeof s.entrega === "string" ? { entrega: s.entrega } : {}), ...(typeof s.item === "string" ? { item: s.item } : {}),
  }),
});

type FileState = Asset & { key: string; state: "ok" | "up" | "erro"; error?: string; file?: File };
type Draft = {
  key: string; title: string; kind: ItemKind; channelId: string | null; presetId: string | null; frontId: string | null; taskId: string | null; conteudoId: string | null; workOrderId: string | null;
  publishAt: string; assets: FileState[]; caption: string; hashtags: string; cta: string; script: ScriptSection[]; textBody: string; checks: string[];
};
const KINDS: { value: ItemKind; label: string; icon: IconName }[] = [
  { value: "post", label: "Post", icon: "image" }, { value: "carrossel", label: "Carrossel", icon: "carousel" }, { value: "video", label: "Vídeo", icon: "play" },
  { value: "stories", label: "Stories", icon: "stories" }, { value: "roteiro", label: "Roteiro", icon: "fileText" }, { value: "texto", label: "Texto", icon: "file" }, { value: "peca", label: "Peça", icon: "layers" },
];
const LIMIT: Record<string, number> = { Instagram: 2200, TikTok: 2200, LinkedIn: 3000, X: 280, Facebook: 63206, Site: 10000 };
const MATERIAL_KIND: Record<string, ItemKind> = { carrossel: "carrossel", post: "post", video: "video", stories: "stories", roteiro: "roteiro", texto: "texto", peca: "peca" };
const MODEL_FORMAT: Partial<Record<ItemKind, string>> = { carrossel: "carrossel", post: "estatico", peca: "estatico", stories: "stories", video: "stories" };
const uid = () => Math.random().toString(36).slice(2, 10);
const ddmm = (d?: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "—");
const localInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

function SendPage() {
  const { brandSlug } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const brand = useQuery({ queryKey: ["brand-info", brandSlug], queryFn: () => loadBrandInfo(brandSlug), enabled: ready });
  const b = brand.data;
  const identity = useQuery({ queryKey: ["identity", brandSlug], queryFn: () => loadIdentity(brandSlug, b!.id), enabled: !!b });
  const tasks = useQuery({ queryKey: ["ops-tasks"], queryFn: listOpsTasks, enabled: ready });
  const fronts = useQuery({ queryKey: ["ops-fronts"], queryFn: listOpsFronts, enabled: ready });
  const library = useQuery({ queryKey: ["library", brandSlug], queryFn: () => loadLibrary(brandSlug), enabled: ready });
  const ops = useQuery({ queryKey: ["client-ops", brandSlug], queryFn: () => loadClientOps(brandSlug), enabled: ready });
  const settings = useQuery({ queryKey: ["like-settings", b?.id], queryFn: () => getSettings(b!.id), enabled: !!b });
  const approvers = useQuery({ queryKey: ["like-approvers", b?.id], queryFn: () => listApprovers(b!.id), enabled: !!b });
  const rounds = useQuery({ queryKey: ["like-rounds", brandSlug], queryFn: () => listRounds(brandSlug), enabled: ready });
  const existing = useQuery({ queryKey: ["like-item", search.item], queryFn: () => getItem(search.item!), enabled: ready && !!search.item });

  const channels = identity.data?.channels.filter((c) => c.active) ?? [];
  const brandTasks = (tasks.data ?? []).filter((t) => t.brand.slug === brandSlug);
  const brandFronts = (fronts.data ?? []).filter((f) => f.brand.slug === brandSlug);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);

  const presetFor = (ch: ChannelFull | undefined, kind: ItemKind) => ch?.presets.find((p) => p.active && (kind === "carrossel" ? p.format === "carrossel" : kind === "stories" || kind === "video" ? p.format === "stories" : p.format === "estatico")) ?? ch?.presets[0] ?? null;
  const defaultPublish = () => { const d = addBusinessDays(new Date(), 4); d.setHours(11, 0, 0, 0); return localInput(d); };
  const blank = (over: Partial<Draft> = {}): Draft => {
    const kind = over.kind ?? "post";
    const ch = channels.find((c) => c.id === over.channelId) ?? channels[0];
    return { key: uid(), title: "", kind, channelId: ch?.id ?? null, presetId: presetFor(ch, kind)?.id ?? null, frontId: brandFronts.find((f) => f.front.name === "Feed")?.front.id ?? brandFronts[0]?.front.id ?? null, taskId: null, conteudoId: null, workOrderId: null, publishAt: defaultPublish(), assets: [], caption: "", hashtags: "", cta: "", script: [], textBody: "", checks: [], ...over };
  };
  const fromTask = (t: OpsTask): Draft => {
    const kind = MATERIAL_KIND[t.likeMaterial ?? ""] ?? "post";
    return blank({ title: t.title, kind, taskId: t.id, frontId: t.frontId, workOrderId: t.workOrderId, assets: (t.attachments ?? []).map((a) => ({ key: uid(), url: a.url, type: "image" as const, name: a.name, state: "ok" as const })) });
  };
  const fromConteudo = (id: string): Draft | null => {
    const c = library.data?.conteudos.find((x) => x.id === id);
    if (!c) return null;
    const kind: ItemKind = c.formato === "Reels" || c.formato === "TikTok" ? "video" : c.formato === "Carrossel" ? "carrossel" : c.formato === "Stories" ? "stories" : "post";
    const ch = channels.find((x) => x.name === c.canal) ?? channels[0];
    const script: ScriptSection[] = (c.roteiro ?? "").split(/^## /m).filter((x) => x.trim()).map((sec) => { const [h, ...r] = sec.split("\n"); return { nome: h.trim(), texto: r.join("\n").trim() }; });
    return blank({ title: c.title, kind, conteudoId: c.id, channelId: ch?.id ?? null, presetId: presetFor(ch, kind)?.id ?? null, caption: c.legenda ?? "", cta: c.cta ?? "", script, publishAt: c.publish_date ? `${c.publish_date}T11:00` : defaultPublish() });
  };

  // Semear pela origem da URL (tarefa, conteúdo, entrega inteira) quando os dados chegarem.
  const dataReady = !!b && identity.isSuccess && tasks.isSuccess && fronts.isSuccess && library.isSuccess && ops.isSuccess && (!search.item || existing.isSuccess);
  useEffect(() => {
    if (!dataReady || seeded) return;
    setSeeded(true);
    let list: Draft[] = [];
    if (search.item && existing.data) {
      const it = existing.data; const v = it.current;
      list = [blank({ title: it.title, kind: it.kind, channelId: it.channelId, presetId: it.presetId, frontId: it.frontId, taskId: it.taskId, conteudoId: it.conteudoId, publishAt: it.publishAt ? localInput(new Date(it.publishAt)) : defaultPublish(), assets: (v?.assets ?? []).map((a) => ({ ...a, key: uid(), state: "ok" as const })), caption: v?.caption ?? "", hashtags: v?.hashtags ?? "", cta: v?.cta ?? "", script: v?.script ?? [], textBody: v?.textBody ?? "" })];
    } else if (search.tarefa) { const t = brandTasks.find((x) => x.id === search.tarefa); if (t) list = [fromTask(t)]; }
    else if (search.conteudo) { const d = fromConteudo(search.conteudo); if (d) list = [d]; }
    else if (search.entrega) { const o = ops.data?.orders.find((x) => x.id === search.entrega); list = (o?.tasks ?? []).filter((t) => t.likeMaterial && t.status !== "Concluído").map(fromTask); }
    if (!list.length) list = [blank()];
    setDrafts(list); setActive(list[0].key);
  }, [dataReady]);

  // Rodada
  const openRounds = (rounds.data ?? []).filter((r) => r.status === "aberta");
  const [roundMode, setRoundMode] = useState<"nova" | string>("nova");
  const firstFront = brandFronts.find((f) => f.front.id === drafts[0]?.frontId);
  const suggested = firstFront ? `${firstFront.front.name} · ${ddmm(firstFront.period.start)} a ${ddmm(firstFront.period.end)}` : `Materiais · ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
  const [round, setRound] = useState({ title: "", due: "", message: "Oi! Seguem os materiais para você aprovar. Qualquer ajuste, é só marcar no próprio material." });
  useEffect(() => { if (settings.data && !round.due) setRound((r) => ({ ...r, due: localInput(addBusinessDays(new Date(), settings.data!.decisionDays)) })); }, [settings.data]);
  const [rule, setRule] = useState<"qualquer" | "todos" | "sequencial" | null>(null);
  const [preview, setPreview] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<"draft" | "send" | null>(null);
  const [done, setDone] = useState(false);
  const [changesNote, setChangesNote] = useState("");
  const [resolved, setResolved] = useState<string[]>([]);
  const [cancelMotive, setCancelMotive] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const d = drafts.find((x) => x.key === active) ?? drafts[0];
  const set = (p: Partial<Draft>) => setDrafts((l) => l.map((x) => (x.key === d.key ? { ...x, ...p } : x)));
  const ch = channels.find((c) => c.id === d?.channelId);
  const preset = ch?.presets.find((p) => p.id === d?.presetId) ?? null;
  const checklistOf = (x: Draft) => {
    const c = channels.find((y) => y.id === x.channelId);
    const fmt = MODEL_FORMAT[x.kind];
    const model = !fmt ? [] : [...new Set((c?.models ?? []).filter((m) => m.status !== "inativo" && m.format === fmt).flatMap((m) => (m.carousel_required_elements ?? "").split("\n").map((s) => s.trim()).filter(Boolean)))];
    const task = (brandTasks.find((t) => t.id === x.taskId)?.reviewChecklist ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
    return [...model.map((i) => ({ item: i, from: "modelo de peça" })), ...task.map((i) => ({ item: i, from: "tarefa" }))];
  };
  const missing = (x: Draft) => {
    const m: string[] = [];
    if (!x.title.trim()) m.push("dar um título");
    if (!["roteiro", "texto"].includes(x.kind) && !x.assets.some((a) => a.state === "ok")) m.push("anexar o arquivo");
    if (x.kind === "roteiro" && !x.script.length) m.push("escrever o roteiro");
    if (x.kind === "texto" && !x.textBody.trim()) m.push("escrever o texto");
    if (x.assets.some((a) => a.state !== "ok")) m.push("resolver os arquivos com erro ou enviando");
    const cl = checklistOf(x).filter((i) => !x.checks.includes(i.item));
    if (cl.length) m.push(`marcar ${cl.length} ${cl.length === 1 ? "item" : "itens"} do checklist`);
    const lim = LIMIT[channels.find((c) => c.id === x.channelId)?.name ?? "Instagram"] ?? 2200;
    if (x.caption.length > lim) m.push("encurtar a legenda");
    return m;
  };
  const newVersion = !!search.item;
  const unresolved = (existing.data?.comments ?? []).filter((c) => !c.resolvedAt && !c.internal && c.authorKind !== "agency");
  const blocking = drafts.flatMap((x) => missing(x).map((m) => `${x.title || "Material sem título"}: ${m}`)).concat(newVersion && !changesNote.trim() ? ["Explique o que mudou nesta versão"] : []);

  // Arquivos
  const addFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    const placeholders: FileState[] = list.map((f) => ({ key: uid(), url: "", type: f.type.startsWith("video/") ? "video" : f.type === "application/pdf" ? "pdf" : "image", name: f.name, state: "up", file: f }));
    const target = d.key;
    setDrafts((l) => l.map((x) => (x.key === target ? { ...x, assets: [...x.assets, ...placeholders], kind: x.kind === "post" && x.assets.length + placeholders.length > 1 ? "carrossel" : x.kind } : x)));
    for (const ph of placeholders) await uploadOne(target, ph);
  };
  const uploadOne = async (target: string, ph: FileState) => {
    const upd = (p: Partial<FileState>) => setDrafts((l) => l.map((x) => (x.key === target ? { ...x, assets: x.assets.map((a) => (a.key === ph.key ? { ...a, ...p } : a)) } : x)));
    upd({ state: "up", error: undefined });
    try { const meta = await inspectFile(ph.file!); const a = await uploadAsset(b!.id, ph.file!, meta); upd({ ...a, state: "ok" }); }
    catch (e) { upd({ state: "erro", error: e instanceof Error ? e.message : "Falha no envio" }); }
  };
  const moveAsset = (from: number, to: number) => set({ assets: (() => { const a = [...d.assets]; const [x] = a.splice(from, 1); a.splice(to, 0, x); return a; })() });

  // Aviso de proporção (não bloqueia).
  const ratioWarn = useMemo(() => {
    const p = parseDimension(preset?.dimension);
    if (!p || !d) return null;
    const want = p.w / p.h;
    const off = d.assets.find((a) => a.state === "ok" && a.width && a.height && Math.abs(a.width / a.height - want) > 0.03);
    return off ? `O arquivo “${off.name ?? "anexo"}” é ${ratioLabel(off.width! / off.height!)}; o formato ${preset?.name ?? ""} é ${ratioLabel(want)}. O cliente verá cortes ou bordas.` : null;
  }, [d?.assets, preset?.id]);

  // Efeito na cobertura.
  const front = brandFronts.find((f) => f.front.id === d?.frontId);
  const pubDay = d?.publishAt?.slice(0, 10);
  const coverage = front && pubDay ? (!front.front.approved_until || pubDay > front.front.approved_until ? `Se aprovado, ${front.front.name} fica coberto até ${ddmm(pubDay)} (hoje até ${ddmm(front.front.approved_until)}).` : `${front.front.name} já está coberto até ${ddmm(front.front.approved_until)}; esta data não muda a cobertura.`) : null;

  const commit = async (send: boolean) => {
    if (!b) return;
    if (send && blocking.length) { toast.error("Ainda falta concluir alguns itens antes de enviar."); return; }
    setBusy(send ? "send" : "draft");
    try {
      if (newVersion && existing.data) {
        await addVersion(existing.data.id, { assets: d.assets.map(({ key: _k, state: _s, file: _f, error: _e, ...a }) => a), caption: d.caption || null, hashtags: d.hashtags || null, cta: d.cta || null, script: d.script, textBody: d.textBody || null, changesNote: changesNote.trim() });
        for (const c of resolved) await resolveComment(c);
        if (send) await sendItems([existing.data.id]);
        toast.success(send ? `Versão ${(existing.data.versions.at(-1)?.number ?? 1) + 1} enviada` : "Nova versão salva como rascunho", { description: send ? `${b.name} vai ver o que mudou.` : undefined });
      } else {
        let roundId = roundMode !== "nova" ? roundMode : null;
        if (!roundId) {
          const r = await createRound({ brandId: b.id, brandSlug, brandName: b.name, title: round.title.trim() || suggested, frontId: drafts[0]?.frontId ?? null, periodStart: firstFront?.period.start ?? null, periodEnd: firstFront?.period.end ?? null, dueAt: round.due ? new Date(round.due).toISOString() : null, message: round.message.trim() || null });
          roundId = r.id;
        }
        const ids: string[] = [];
        for (const x of drafts) {
          const c = channels.find((y) => y.id === x.channelId);
          const p = c?.presets.find((y) => y.id === x.presetId);
          const f = brandFronts.find((y) => y.front.id === x.frontId);
          const it = await createItem({ brandId: b.id, brandSlug, brandName: b.name, title: x.title.trim(), kind: x.kind, roundId, channelId: x.channelId, channelName: c?.name ?? null, presetId: x.presetId, presetDimension: p?.dimension ?? null, frontId: x.frontId, frontName: f?.front.name ?? null, taskId: x.taskId, conteudoId: x.conteudoId, workOrderId: x.workOrderId, publishAt: x.publishAt ? new Date(x.publishAt).toISOString() : null, dueAt: round.due ? new Date(round.due).toISOString() : null },
            { assets: x.assets.map(({ key: _k, state: _s, file: _f, error: _e, ...a }) => a), caption: x.caption || null, hashtags: x.hashtags || null, cta: x.cta || null, script: x.script, textBody: x.textBody || null });
          ids.push(it.id);
        }
        if (send) await sendItems(ids, roundId);
        toast.success(send ? `${ids.length} ${ids.length === 1 ? "material enviado" : "materiais enviados"} para ${b.name}` : `${ids.length} ${ids.length === 1 ? "rascunho salvo" : "rascunhos salvos"}`, { description: send ? "Os aprovadores foram avisados." : "O cliente não vê rascunhos internos." });
      }
      qc.invalidateQueries();
      setDone(true);
      window.setTimeout(() => navigate({ to: "/like" as never }), 900);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível enviar."); } finally { setBusy(null); }
  };

  if (!ready || brand.isLoading || !seeded || !d) return <EchoLayout env="like" wide demoData eyebrow="Like" title="Enviar para aprovação"><div className="stack-lg"><Skeleton h={60} r={18} /><Skeleton h={520} r={24} /></div></EchoLayout>;
  if (!b) return <EchoLayout env="like" eyebrow="Like" title="Enviar para aprovação"><div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState kind="search" title="Cliente não encontrado" /></div></EchoLayout>;

  const lim = LIMIT[ch?.name ?? "Instagram"] ?? 2200;
  const cl = checklistOf(d);
  const ruleNow = rule ?? settings.data?.rule ?? "qualquer";

  return (
    <EchoLayout env="like" wide demoData eyebrow={<Link to={"/like" as never} className="e-link" style={{ fontSize: "inherit", fontWeight: 500 }}><Icon name="chevLeft" size="sm" /> Like</Link>} title={newVersion ? `Nova versão · ${existing.data?.title ?? ""}` : `Enviar para aprovação · ${b.name}`}>
      <div className={`send-layout${done ? " is-done" : ""}`}>
        <aside className="send-list">
          {drafts.map((x) => {
            const m = missing(x);
            return (
              <button key={x.key} type="button" className={`send-item e-glass${x.key === d.key ? " on" : ""}`} onClick={() => setActive(x.key)}>
                <span className="send-thumb">{x.assets.find((a) => a.state === "ok" && a.type === "image") ? <img src={x.assets.find((a) => a.state === "ok" && a.type === "image")!.url} alt="" /> : <Icon name={KINDS.find((k) => k.value === x.kind)?.icon ?? "image"} />}</span>
                <span className="e-grow" style={{ minWidth: 0 }}><b className="e-ellipsis" style={{ display: "block" }}>{x.title || "Sem título"}</b><span className="e-caption">{KIND_LABEL[x.kind]} · {m.length ? `${m.length} pendência${m.length > 1 ? "s" : ""}` : "pronto"}</span></span>
                {m.length ? <Icon name="alert" size="sm" /> : <Icon name="checkCircle" size="sm" />}
              </button>
            );
          })}
          {!newVersion && (
            <Menu trigger={({ toggle }) => <Button variant="secondary" icon="plus" onClick={toggle}>Adicionar material</Button>} items={[
              { title: "Começar de" },
              { label: "Arquivo avulso", icon: "upload", onSelect: () => { const n = blank(); setDrafts((l) => [...l, n]); setActive(n.key); } },
              ...brandTasks.filter((t) => t.likeMaterial && !drafts.some((x) => x.taskId === t.id) && t.status !== "Concluído").slice(0, 8).map((t) => ({ label: `Tarefa: ${t.title}`, icon: "checks" as const, onSelect: () => { const n = fromTask(t); setDrafts((l) => [...l, n]); setActive(n.key); } })),
              ...(library.data?.conteudos ?? []).filter((c) => !drafts.some((x) => x.conteudoId === c.id)).slice(0, 6).map((c) => ({ label: `Conteúdo: ${c.title}`, icon: "feed" as const, onSelect: () => { const n = fromConteudo(c.id); if (n) { setDrafts((l) => [...l, n]); setActive(n.key); } } })),
              ...(ops.data?.orders ?? []).filter((o) => o.tasks.some((t) => t.likeMaterial && t.status !== "Concluído")).slice(0, 4).map((o) => ({ label: `Entrega inteira: ${o.title}`, icon: "kanban" as const, onSelect: () => { const add = o.tasks.filter((t) => t.likeMaterial && t.status !== "Concluído" && !drafts.some((x) => x.taskId === t.id)).map(fromTask); setDrafts((l) => [...l.filter((x) => x.title || x.assets.length), ...add]); if (add[0]) setActive(add[0].key); toast(`${add.length} ${add.length === 1 ? "material" : "materiais"} da entrega`, { description: "Só as etapas marcadas “vai para o Like”." }); } })),
            ]} />
          )}
        </aside>

        <section className="send-editor e-glass">
          <div className="e-row between wrap" style={{ gap: 8 }}>
            <Segmented value={d.kind} onChange={(k) => { const p = presetFor(ch, k); set({ kind: k, presetId: p?.id ?? d.presetId }); }} label="Tipo" items={KINDS.map((k) => ({ value: k.value, label: k.label }))} />
            {!newVersion && drafts.length > 1 && <Button size="sm" variant="ghost" icon="trash" onClick={() => { const rest = drafts.filter((x) => x.key !== d.key); setDrafts(rest); setActive(rest[0]?.key ?? null); }}>Remover</Button>}
          </div>
          <Field label="Título" value={d.title} placeholder="Ex.: Carrossel “Notas de outono”" onChange={(e) => set({ title: e.target.value })} />
          <div className="grid-2" style={{ gap: 12 }}>
            <Select label="Canal" value={d.channelId ?? ""} placeholder="Escolha" onChange={(v) => { const c = channels.find((x) => x.id === v); set({ channelId: v, presetId: presetFor(c, d.kind)?.id ?? null }); }} options={channels.map((c) => ({ value: c.id, label: c.name }))} />
            <Select label="Formato (preset)" value={d.presetId ?? ""} placeholder="Escolha" onChange={(v) => set({ presetId: v })} options={(ch?.presets ?? []).map((p) => ({ value: p.id, label: `${p.name}${p.dimension ? ` · ${p.dimension}` : ""}` }))} />
          </div>

          {!["roteiro", "texto"].includes(d.kind) && (
            <UploadArea assets={d.assets} kind={d.kind} ratio={ratioOf(preset?.dimension, d.kind)} onFiles={addFiles} onRetry={(a) => uploadOne(d.key, a)} onRemove={(k) => set({ assets: d.assets.filter((a) => a.key !== k) })} onMove={moveAsset} onPoster={(k, url) => set({ assets: d.assets.map((a) => (a.key === k ? { ...a, poster: url } : a)) })} />
          )}
          {ratioWarn && <Alert kind="warn" title="Proporção diferente do formato">{ratioWarn}</Alert>}

          {!["roteiro", "texto"].includes(d.kind) && <>
            <div className="e-field">
              <TextArea label="Legenda" rows={5} value={d.caption} onChange={(e) => set({ caption: e.target.value })} />
              <div className={`caption-count tnum${d.caption.length > lim ? " over" : d.caption.length > lim * 0.9 ? " near" : ""}`}><div className="e-bar sm"><i style={{ ["--v" as string]: `${Math.min(100, (d.caption.length / lim) * 100)}%` }} /></div>{d.caption.length.toLocaleString("pt-BR")} / {lim.toLocaleString("pt-BR")} no {ch?.name ?? "canal"}</div>
            </div>
            <div className="grid-2" style={{ gap: 12 }}>
              <Field label="Hashtags" optional value={d.hashtags} onChange={(e) => set({ hashtags: e.target.value })} />
              <Field label="CTA" optional value={d.cta} onChange={(e) => set({ cta: e.target.value })} />
            </div>
          </>}
          {(d.kind === "video" || d.kind === "roteiro") && <ScriptEditor value={d.script} onChange={(script) => set({ script })} />}
          {(d.kind === "texto" || d.kind === "peca") && <TextArea label={d.kind === "texto" ? "Texto" : "Texto da peça"} optional={d.kind === "peca"} rows={8} value={d.textBody} onChange={(e) => set({ textBody: e.target.value })} />}
          {d.conteudoId && <button type="button" className="e-link" onClick={() => { const c = fromConteudo(d.conteudoId!); if (c) { set({ caption: c.caption, cta: c.cta, script: c.script }); toast.success("Texto trazido do conteúdo"); } }}><Icon name="refresh" size="sm" /> Trazer do conteúdo</button>}

          <div className="grid-2" style={{ gap: 12 }}>
            <Field label="Publicação planejada" type="datetime-local" value={d.publishAt} onChange={(e) => set({ publishAt: e.target.value })} />
            <Select label="Frente" value={d.frontId ?? ""} placeholder="Nenhuma" onChange={(v) => set({ frontId: v || null })} options={[{ value: "", label: "Nenhuma" }, ...brandFronts.map((f) => ({ value: f.front.id, label: f.front.name }))]} />
          </div>
          {coverage && <p className="send-coverage"><Icon name="flag" size="sm" /> {coverage}</p>}

          <div className="e-stack" style={{ gap: 6 }}>
            <span className="e-label">Checklist antes de enviar</span>
            {cl.length ? cl.map((i) => <Checkbox key={i.item} checked={d.checks.includes(i.item)} onChange={(v) => set({ checks: v ? [...d.checks, i.item] : d.checks.filter((x) => x !== i.item) })} label={<span>{i.item} <span className="e-caption">· {i.from}</span></span>} />) : <span className="e-caption">Sem itens obrigatórios para este formato.</span>}
          </div>
        </section>

        <aside className="send-side">
          {newVersion ? (
            <section className="settings-section e-glass">
              <h3 className="e-h3" style={{ margin: 0 }}>Nova versão</h3>
              <TextArea label="O que mudou" rows={3} value={changesNote} placeholder="Ex.: troquei a foto da capa e encurtei a legenda" help="Aparece para o cliente junto da nova versão." onChange={(e) => setChangesNote(e.target.value)} />
              <span className="e-label">Pedidos do cliente</span>
              {unresolved.length ? unresolved.map((c) => <Checkbox key={c.id} checked={resolved.includes(c.id)} onChange={(v) => setResolved(v ? [...resolved, c.id] : resolved.filter((x) => x !== c.id))} label={<span>{c.body} <span className="e-caption">· {c.authorName}</span></span>} />) : <span className="e-caption">Nenhum comentário em aberto.</span>}
              <p className="e-caption" style={{ margin: 0 }}>Os marcados ficam como atendidos. A versão anterior continua guardada, sem mudanças.</p>
              <div className="send-cancel">
                <Field label="Motivo para cancelar" optional value={cancelMotive} onChange={(e) => setCancelMotive(e.target.value)} />
                <HoldButton label={cancelling ? "Cancelando…" : "Segure para cancelar o material"} size="sm" onConfirm={async () => { if (!cancelMotive.trim()) { toast.error("Diga o motivo do cancelamento."); return; } setCancelling(true); await cancelItem(existing.data!.id); toast.success("Material cancelado", { description: "O cliente foi avisado." }); navigate({ to: "/like" as never }); }} />
              </div>
            </section>
          ) : (
            <section className="settings-section e-glass">
              <h3 className="e-h3" style={{ margin: 0 }}>Rodada</h3>
              <Select label="Adicionar a" value={roundMode} onChange={setRoundMode} options={[{ value: "nova", label: "Nova rodada" }, ...openRounds.map((r) => ({ value: r.id, label: r.title }))]} />
              {roundMode === "nova" && <>
                <Field label="Título" value={round.title} placeholder={suggested} onChange={(e) => setRound({ ...round, title: e.target.value })} />
                <Field label="Prazo de decisão" type="datetime-local" value={round.due} help={`Padrão: ${settings.data?.decisionDays ?? 2} dias úteis.`} onChange={(e) => setRound({ ...round, due: e.target.value })} />
                <TextArea label="Mensagem ao cliente" optional rows={3} value={round.message} onChange={(e) => setRound({ ...round, message: e.target.value })} />
              </>}
              <span className="e-label">Aprovadores</span>
              <div className="e-stack" style={{ gap: 4 }}>{(approvers.data ?? []).map((a) => <div key={a.userId} className="ops-row" style={{ cursor: "default" }}><span className="e-grow">{a.name}</span><Badge tone="glass">{a.role === "aprovador" ? "Aprova" : a.role === "revisor" ? "Só comenta" : "Acompanha"}</Badge></div>)}</div>
              <Select label="Regra desta rodada" value={ruleNow} onChange={(v) => setRule(v as typeof ruleNow)} options={[{ value: "qualquer", label: "Qualquer aprovador decide" }, { value: "todos", label: "Todos precisam aprovar" }, { value: "sequencial", label: "Um de cada vez, na ordem" }]} />
            </section>
          )}
          <section className="settings-section e-glass send-actions">
            {blocking.length > 0 && <div className="send-missing"><b>Para enviar, falta:</b><ul>{blocking.slice(0, 6).map((m) => <li key={m}>{m}</li>)}</ul></div>}
            <Button variant="secondary" icon="eye" onClick={() => setPreview(d)}>Ver como o cliente</Button>
            <Button variant="ghost" loading={busy === "draft"} disabled={!!busy} onClick={() => commit(false)}>Salvar rascunho interno</Button>
            <Button icon={done ? "check" : "send"} loading={busy === "send"} disabled={!!busy || blocking.length > 0} onClick={() => commit(true)}>{done ? "Enviado" : newVersion ? "Enviar nova versão" : `Enviar ${drafts.length > 1 ? `${drafts.length} materiais` : "para aprovação"}`}</Button>
          </section>
        </aside>
      </div>

      <Modal open={!!preview} onClose={() => setPreview(null)} icon="eye" title="Como o cliente vai ver" sub="Prévia: não registra visualização.">
        {preview && <ClientPreview brandName={b.name} title={preview.title || "Material"} kind={preview.kind} dimension={channels.find((c) => c.id === preview.channelId)?.presets.find((p) => p.id === preview.presetId)?.dimension} assets={preview.assets.filter((a) => a.state === "ok")} caption={preview.caption} hashtags={preview.hashtags} cta={preview.cta} script={preview.script} textBody={preview.textBody} watermark={settings.data?.watermark} />}
      </Modal>
    </EchoLayout>
  );
}

function UploadArea({ assets, kind, ratio, onFiles, onRetry, onRemove, onMove, onPoster }: { assets: FileState[]; kind: ItemKind; ratio: number; onFiles: (f: FileList) => void; onRetry: (a: FileState) => void; onRemove: (k: string) => void; onMove: (from: number, to: number) => void; onPoster: (k: string, url: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const cover = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [coverFor, setCoverFor] = useState<string | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const prev = useRef(new Map<string, DOMRect>());
  useLayoutEffect(() => {
    const els = grid.current?.querySelectorAll<HTMLElement>("[data-k]");
    const next = new Map<string, DOMRect>();
    els?.forEach((el) => {
      const r = el.getBoundingClientRect(); next.set(el.dataset.k!, r);
      const p = prev.current.get(el.dataset.k!);
      if (p && (Math.abs(p.left - r.left) > 2 || Math.abs(p.top - r.top) > 2)) el.animate([{ transform: `translate(${p.left - r.left}px, ${p.top - r.top}px)` }, { transform: "none" }], { duration: 280, easing: "cubic-bezier(.23,1,.32,1)" });
      else if (!p) el.animate([{ opacity: 0, transform: "scale(.94)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: "cubic-bezier(.23,1,.32,1)", delay: 30 * [...(els ?? [])].indexOf(el) });
    });
    prev.current = next;
  });
  return (
    <div className="e-field">
      <span className="e-field-label">Arquivos {kind === "carrossel" && assets.length > 1 ? `· ${assets.length} slides (arraste para ordenar)` : ""}</span>
      <div className={`upload-area${over ? " over" : ""}`} onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setOver(true); } }} onDragLeave={() => setOver(false)} onDrop={(e) => { if (!e.dataTransfer.files.length) return; e.preventDefault(); setOver(false); onFiles(e.dataTransfer.files); }}>
        <div className="upload-grid" ref={grid}>
          {assets.map((a, i) => (
            <div key={a.key} data-k={a.key} className={`upload-tile ${a.state}`} style={{ aspectRatio: ratio }} draggable={a.state === "ok"} onDragStart={(e) => e.dataTransfer.setData("text/x-slide", String(i))} onDragOver={(e) => { if (e.dataTransfer.types.includes("text/x-slide")) e.preventDefault(); }} onDrop={(e) => { const from = Number(e.dataTransfer.getData("text/x-slide")); if (!Number.isNaN(from) && e.dataTransfer.types.includes("text/x-slide")) { e.preventDefault(); e.stopPropagation(); onMove(from, i); } }}>
              {a.state === "ok" ? (a.type === "video" ? (a.poster ? <img src={a.poster} alt="" /> : <Icon name="play" />) : a.type === "pdf" ? <Icon name="fileText" /> : <img src={a.url} alt="" />) : a.state === "up" ? <span className="upload-spin"><Icon name="loader" /><small>Enviando…</small></span> : <span className="upload-err"><Icon name="alert" /><small>{a.error}</small><button type="button" className="e-link" onClick={() => onRetry(a)}>Tentar de novo</button></span>}
              <span className="upload-n tnum">{i + 1}</span>
              <button type="button" className="upload-x" aria-label={`Remover ${a.name ?? "arquivo"}`} onClick={() => onRemove(a.key)}><Icon name="x" size="sm" /></button>
              {a.state === "ok" && a.width && <span className="upload-dim tnum">{a.width}×{a.height}{a.duration ? ` · ${a.duration}s` : ""}</span>}
              {a.state === "ok" && a.type === "video" && <button type="button" className="upload-cover" onClick={() => { setCoverFor(a.key); cover.current?.click(); }}>Trocar capa</button>}
            </div>
          ))}
          <button type="button" className="upload-add" style={{ aspectRatio: ratio }} onClick={() => input.current?.click()}><Icon name="upload" /><b>Adicionar arquivos</b><small>Imagens, vídeo ou PDF · arraste aqui</small></button>
        </div>
        <input ref={input} type="file" multiple accept="image/*,video/*,application/pdf" hidden onChange={(e) => { if (e.target.files?.length) onFiles(e.target.files); e.target.value = ""; }} />
        <input ref={cover} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f && coverFor) onPoster(coverFor, URL.createObjectURL(f)); e.target.value = ""; }} />
      </div>
    </div>
  );
}

function ScriptEditor({ value, onChange }: { value: ScriptSection[]; onChange: (s: ScriptSection[]) => void }) {
  const patch = (i: number, p: Partial<ScriptSection>) => onChange(value.map((s, j) => (j === i ? { ...s, ...p } : s)));
  return (
    <div className="e-stack" style={{ gap: 8 }}>
      <span className="e-label">Roteiro</span>
      {value.map((s, i) => (
        <div key={i} className="script-edit">
          <div className="e-row" style={{ gap: 6 }}>
            <input className="e-input sm e-grow" value={s.nome} placeholder="Seção (ex.: Abertura)" aria-label="Nome da seção" onChange={(e) => patch(i, { nome: e.target.value })} />
            <input className="e-input sm" style={{ width: 110 }} value={s.tempo ?? ""} placeholder="0–3s" aria-label="Tempo" onChange={(e) => patch(i, { tempo: e.target.value })} />
            <Button size="sm" variant="ghost" icon="x" aria-label="Remover seção" onClick={() => onChange(value.filter((_, j) => j !== i))} />
          </div>
          <textarea className="e-input" rows={2} value={s.texto} placeholder="O que aparece" aria-label="Texto da seção" onChange={(e) => patch(i, { texto: e.target.value })} />
          <div className="grid-2" style={{ gap: 6 }}>
            <input className="e-input sm" value={s.off ?? ""} placeholder="Off (narração)" aria-label="Off" onChange={(e) => patch(i, { off: e.target.value })} />
            <input className="e-input sm" value={s.cta ?? ""} placeholder="CTA" aria-label="CTA da seção" onChange={(e) => patch(i, { cta: e.target.value })} />
          </div>
        </div>
      ))}
      <button type="button" className="tpl-add" onClick={() => onChange([...value, { nome: "", texto: "" }])}><Icon name="plus" size="sm" /> Seção</button>
    </div>
  );
}

