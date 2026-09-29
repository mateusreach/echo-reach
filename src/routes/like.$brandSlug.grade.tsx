import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { EchoLayout } from "@/components/echo/layout";
import { Alert, Chip } from "@/components/echo/controls";
import { Modal } from "@/components/echo/overlays";
import { Badge, Button, EmptyState, Skeleton } from "@/components/echo/primitives";
import { Icon } from "@/components/echo/icon";
import { KIND_ICON, LIKE_STATUS_TONE, LikeBrandNav } from "@/components/echo/like-cards";
import { useAccess } from "@/components/echo/session";
import { isViewingAsClient } from "@/lib/view-as";
import { loadBrandInfo } from "@/lib/brand-settings-data";
import { KIND_LABEL, STATUS_LABEL, coverCss, listItems, movePublish, type ItemFull } from "@/lib/like-data";

export const Route = createFileRoute("/like/$brandSlug/grade")({
  head: () => ({ meta: [{ title: "Grade · Like · Echo" }] }),
  component: FeedGrid,
});

type Channel = "feed" | "stories" | "tiktok";
const CHANNELS: { value: Channel; label: string; icon: string }[] = [{ value: "feed", label: "Feed", icon: "grid" }, { value: "stories", label: "Stories", icon: "stories" }, { value: "tiktok", label: "TikTok", icon: "tiktok" }];
const channelOf = (i: ItemFull): Channel => (i.kind === "stories" ? "stories" : i.channelName === "TikTok" ? "tiktok" : "feed");
const ddmm = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

function FeedGrid() {
  const { brandSlug } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isTeam } = useAccess();
  const [ready, setReady] = useState(false);
  const [viewAs, setViewAs] = useState(false);
  useEffect(() => { setReady(true); setViewAs(isViewingAsClient()); }, []);
  const team = ready && !!isTeam && !viewAs;
  const brand = useQuery({ queryKey: ["brand-info", brandSlug], queryFn: () => loadBrandInfo(brandSlug), enabled: ready });
  const items = useQuery({ queryKey: ["like-items", brandSlug, viewAs], queryFn: () => listItems({ brandSlug }), enabled: ready });
  const [channel, setChannel] = useState<Channel>("feed");
  const [period, setPeriod] = useState<"proximos" | "tudo">("proximos");
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [swap, setSwap] = useState<{ a: ItemFull; b: ItemFull } | null>(null);
  const [busy, setBusy] = useState(false);

  const nav = <LikeBrandNav slug={brandSlug} team={team} />;
  if (!ready || items.isLoading || brand.isLoading) return <EchoLayout env="like" wide demoData nav={nav}><Skeleton h={520} r={24} /></EchoLayout>;
  const b = brand.data;
  const since = new Date(Date.now() - 30 * 86400e3).toISOString();
  const all = (items.data ?? []).filter((i) => i.status !== "cancelado" && i.status !== "reprovado" && (team || i.status !== "rascunho"));
  const inChannel = all.filter((i) => channelOf(i) === channel);
  const dated = inChannel.filter((i) => i.publishAt && (period === "tudo" || i.publishAt >= since)).sort((x, y) => y.publishAt!.localeCompare(x.publishAt!));
  const undated = inChannel.filter((i) => !i.publishAt);
  const counts = { publicados: inChannel.filter((i) => i.status === "publicado").length, aprovados: inChannel.filter((i) => ["aprovado", "agendado"].includes(i.status)).length, pendentes: inChannel.filter((i) => !["publicado", "aprovado", "agendado"].includes(i.status)).length };
  const movable = (i: ItemFull) => team && i.status !== "publicado";
  const handle = (b?.name ?? brandSlug).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "");

  const confirmSwap = async () => {
    if (!swap) return;
    setBusy(true);
    try {
      const [ra, rb] = await Promise.all([movePublish(swap.a.id, swap.b.publishAt!), movePublish(swap.b.id, swap.a.publishAt!)]);
      for (const k of [["like-items"], ["like-item"], ["ops-fronts"], ["like-rounds"]]) qc.invalidateQueries({ queryKey: k });
      toast.success("Datas trocadas", { description: ra.notifyClient || rb.notifyClient ? `${b?.name ?? "O cliente"} vai ser avisado da nova data.` : "A cobertura foi recalculada." });
      setSwap(null);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <EchoLayout env="like" wide demoData nav={nav} eyebrow="Like" title="Como o feed vai ficar">
      <div className="stack-lg">
        <div className="e-row between wrap" style={{ gap: 10 }}>
          <div className="e-row wrap" style={{ gap: 6 }}>{CHANNELS.map((c) => <Chip key={c.value} icon={c.icon} pressed={channel === c.value} onClick={() => setChannel(c.value)} count={all.filter((i) => channelOf(i) === c.value).length}>{c.label}</Chip>)}</div>
          <div className="e-row wrap" style={{ gap: 6 }}>
            <Chip pressed={period === "proximos"} onClick={() => setPeriod("proximos")}>Últimos 30 dias e próximos</Chip>
            <Chip pressed={period === "tudo"} onClick={() => setPeriod("tudo")}>Tudo</Chip>
          </div>
        </div>
        {team && <Alert kind="info" title="Arraste para trocar a ordem">Soltar um material sobre outro troca as datas dos dois. Se algum já estava aprovado, o cliente é avisado.</Alert>}

        <section className="fg-phone e-glass">
          <header className="fg-profile">
            <span className="fg-avatar">{(b?.name ?? "?")[0]}</span>
            <div><b>{handle}</b><span className="e-caption">{CHANNELS.find((c) => c.value === channel)?.label}</span></div>
            <dl><div><dt>{counts.publicados}</dt><dd>publicados</dd></div><div><dt>{counts.aprovados}</dt><dd>aprovados</dd></div><div><dt>{counts.pendentes}</dt><dd>pendentes</dd></div></dl>
          </header>
          {dated.length === 0 ? <EmptyState compact kind="empty" title="Nada com data neste canal" text={team ? "Envie materiais com data de publicação para montar a grade." : "Assim que a Reach enviar materiais, eles aparecem aqui."} /> : (
            <div className={`fg-grid${channel !== "feed" ? " tall" : ""}`}>
              {dated.map((i) => {
                const art = i.current?.assets.find((a) => a.type === "image")?.url ?? i.current?.assets.find((a) => a.poster)?.poster;
                return (
                  <button key={i.id} type="button" className={`fg-tile${over === i.id ? " over" : ""}${drag === i.id ? " dragging" : ""} st-${i.status}`}
                    draggable={movable(i)}
                    onDragStart={(e: DragEvent) => { setDrag(i.id); e.dataTransfer.setData("text/x-like", i.id); e.dataTransfer.effectAllowed = "move"; }}
                    onDragEnd={() => { setDrag(null); setOver(null); }}
                    onDragOver={(e: DragEvent) => { if (drag && drag !== i.id && movable(i)) { e.preventDefault(); setOver(i.id); } }}
                    onDragLeave={() => setOver((o) => (o === i.id ? null : o))}
                    onDrop={(e: DragEvent) => { e.preventDefault(); const a = dated.find((x) => x.id === drag); setOver(null); setDrag(null); if (a && a.id !== i.id) setSwap({ a, b: i }); }}
                    onClick={() => navigate({ to: `/like/${brandSlug}/m/${i.id}` as never })}
                    aria-label={`${i.title}, ${STATUS_LABEL[i.status]}, ${ddmm(i.publishAt!)}`}>
                    {art ? <img src={art} alt="" draggable={false} /> : <span className="fg-text" style={{ background: coverCss(i.coverTone) }}><Icon name={KIND_ICON[i.kind]} /><small>{i.title}</small></span>}
                    {i.current && i.current.assets.length > 1 && <span className="fg-multi" aria-hidden="true"><Icon name="carousel" size="sm" /></span>}
                    {i.kind === "video" && <span className="fg-multi" aria-hidden="true"><Icon name="play" size="sm" /></span>}
                    {i.status !== "publicado" && <span className="fg-badge"><Badge tone={LIKE_STATUS_TONE[i.status]} dot>{STATUS_LABEL[i.status]}</Badge></span>}
                    <span className="fg-date tnum">{ddmm(i.publishAt!)} · {hhmm(i.publishAt!)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {dated.some((i) => i.status === "publicado" && i.publishedLink) && (
          <section className="settings-section e-glass">
            <h2 className="e-h3" style={{ margin: 0 }}>Já no ar</h2>
            {dated.filter((i) => i.status === "publicado" && i.publishedLink).map((i) => <a key={i.id} className="ops-row" href={i.publishedLink!} target="_blank" rel="noreferrer"><Icon name="external" size="sm" /><span className="e-grow">{i.title}</span><span className="e-caption tnum">{ddmm(i.publishAt!)}</span></a>)}
          </section>
        )}
        {undated.length > 0 && (
          <section className="settings-section e-glass">
            <h2 className="e-h3" style={{ margin: 0 }}>Sem data de publicação</h2>
            {undated.map((i) => <Link key={i.id} className="ops-row" to={`/like/${brandSlug}/m/${i.id}` as never}><Icon name={KIND_ICON[i.kind]} size="sm" /><span className="e-grow">{i.title}</span><Badge tone={LIKE_STATUS_TONE[i.status]} dot>{STATUS_LABEL[i.status]}</Badge></Link>)}
          </section>
        )}
      </div>

      <Modal open={!!swap} onClose={() => setSwap(null)} title="Trocar as datas?" icon="calendar"
        footer={<><Button variant="ghost" onClick={() => setSwap(null)}>Cancelar</Button><Button loading={busy} onClick={confirmSwap}>Trocar datas</Button></>}>
        {swap && (
          <div className="stack">
            <ul className="fg-swap">
              <li><b>{swap.a.title}</b><span>{ddmm(swap.a.publishAt!)} → <b>{ddmm(swap.b.publishAt!)} às {hhmm(swap.b.publishAt!)}</b></span></li>
              <li><b>{swap.b.title}</b><span>{ddmm(swap.b.publishAt!)} → <b>{ddmm(swap.a.publishAt!)} às {hhmm(swap.a.publishAt!)}</b></span></li>
            </ul>
            {[swap.a, swap.b].some((x) => ["aprovado", "agendado"].includes(x.status)) && <Alert kind="warn" title="Material já aprovado">O cliente aprovou com outra data. Ele vai ser avisado da mudança, e a agenda e a cobertura da frente são atualizadas.</Alert>}
            <p className="e-caption" style={{ margin: 0 }}>{KIND_LABEL[swap.a.kind]} e {KIND_LABEL[swap.b.kind].toLowerCase()} mantêm o estado de aprovação.</p>
          </div>
        )}
      </Modal>
    </EchoLayout>
  );
}
