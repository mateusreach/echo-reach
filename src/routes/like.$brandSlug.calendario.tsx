import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EchoLayout } from "@/components/echo/layout";
import { Chip, Segmented, Select } from "@/components/echo/controls";
import { Badge, EmptyState, Skeleton } from "@/components/echo/primitives";
import { Icon } from "@/components/echo/icon";
import { EditorialCalendar, KIND_ICON, LIKE_STATUS_TONE, LikeBrandNav } from "@/components/echo/like-cards";
import { PeriodNavigator } from "@/components/echo/operations";
import { useAccess } from "@/components/echo/session";
import { isViewingAsClient } from "@/lib/view-as";
import { loadSpace } from "@/lib/space-data";
import { KIND_LABEL, STATUS_LABEL, coverCss, listItems, listRounds, movePublish, type ItemFull } from "@/lib/like-data";

export const Route = createFileRoute("/like/$brandSlug/calendario")({
  head: () => ({ meta: [{ title: "Calendário · Like · Echo" }] }),
  component: PublishCalendar,
});

const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const WEEK = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function PublishCalendar() {
  const { brandSlug } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isTeam } = useAccess();
  const [ready, setReady] = useState(false);
  const [viewAs, setViewAs] = useState(false);
  useEffect(() => { setReady(true); setViewAs(isViewingAsClient()); }, []);
  const team = !!isTeam && !viewAs;
  const items = useQuery({ queryKey: ["like-items", brandSlug, viewAs], queryFn: () => listItems({ brandSlug }), enabled: ready });
  const rounds = useQuery({ queryKey: ["like-rounds", brandSlug, viewAs], queryFn: () => listRounds(brandSlug), enabled: ready });
  const space = useQuery({ queryKey: ["space", brandSlug], queryFn: () => loadSpace(brandSlug), enabled: ready });
  const [view, setView] = useState<"mes" | "semana" | "lista">("mes");
  const [cursor, setCursor] = useState(() => new Date());
  const [channel, setChannel] = useState("");
  const [campaign, setCampaign] = useState("");

  const nav = <LikeBrandNav slug={brandSlug} team={team} />;
  if (!ready || items.isLoading) return <EchoLayout env="like" wide demoData nav={nav}><Skeleton h={560} r={24} /></EchoLayout>;

  const campaigns = space.data?.campaigns ?? [];
  const campaignName = (id: string) => campaigns.find((c) => c.id === id)?.title ?? "Campanha";
  const base = (items.data ?? []).filter((i) => i.status !== "cancelado" && (team || i.status !== "rascunho"));
  const channels = [...new Set(base.map((i) => i.channelName).filter(Boolean))] as string[];
  const shown = base.filter((i) => (!channel || i.channelName === channel) && (!campaign || i.campaignId === campaign));
  const open = (id: string) => navigate({ to: `/like/${brandSlug}/m/${id}` as never });
  // Lacunas: dias úteis dentro do período das rodadas (período contratado da frente) sem publicação.
  const gaps = new Set<string>();
  for (const r of rounds.data ?? []) {
    if (!r.periodStart || !r.periodEnd || r.status === "cancelada") continue;
    for (let d = new Date(`${r.periodStart}T12:00`); toISO(d) <= r.periodEnd; d.setDate(d.getDate() + 1)) if (d.getDay() !== 0 && d.getDay() !== 6) gaps.add(toISO(d));
  }
  const move = async (id: string, dateISO: string) => {
    const it = base.find((x) => x.id === id);
    if (!it) return;
    const time = it.publishAt ? new Date(it.publishAt) : null;
    const next = new Date(`${dateISO}T${time ? `${String(time.getHours()).padStart(2, "0")}:${String(time.getMinutes()).padStart(2, "0")}` : "11:00"}`);
    try {
      const r = await movePublish(id, next.toISOString());
      for (const k of [["like-items"], ["like-item"], ["ops-fronts"]]) qc.invalidateQueries({ queryKey: k });
      toast.success(`${it.title} foi para ${next.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`, { description: r.notifyClient ? "Já estava aprovado: o cliente vai ser avisado." : undefined });
    } catch (e) { toast.error((e as Error).message); }
  };
  const step = (n: number) => setCursor((c) => { const d = new Date(c); if (view === "semana") d.setDate(d.getDate() + 7 * n); else d.setMonth(d.getMonth() + n, 1); return d; });
  const monday = new Date(cursor); monday.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });
  const label = view === "semana" ? `${week[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} a ${week[6].toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}` : `${MONTHS[cursor.getMonth()]} de ${cursor.getFullYear()}`;
  const byDay = (iso: string) => shown.filter((i) => i.publishAt && toISO(new Date(i.publishAt)) === iso).sort((a, b) => a.publishAt!.localeCompare(b.publishAt!));
  const monthItems = shown.filter((i) => i.publishAt && new Date(i.publishAt).getMonth() === cursor.getMonth() && new Date(i.publishAt).getFullYear() === cursor.getFullYear()).sort((a, b) => a.publishAt!.localeCompare(b.publishAt!));
  const monthGaps = [...gaps].filter((g) => g.startsWith(toISO(cursor).slice(0, 7)) && !byDay(g).length && g >= toISO(new Date()));

  const card = (i: ItemFull) => {
    const art = i.current?.assets.find((a) => a.type === "image")?.url;
    return (
      <button key={i.id} type="button" className={`cw-card st-${i.status}`} onClick={() => open(i.id)} draggable={team && i.status !== "publicado"} onDragStart={(e) => { e.dataTransfer.setData("text/x-like", i.id); }}>
        <span className="cw-thumb" style={art ? undefined : { background: coverCss(i.coverTone) }}>{art ? <img src={art} alt="" draggable={false} /> : <Icon name={KIND_ICON[i.kind]} size="sm" />}</span>
        <span className="cw-body"><b>{i.title}</b><small>{new Date(i.publishAt!).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · {KIND_LABEL[i.kind]}{i.channelName ? ` · ${i.channelName}` : ""}</small><Badge tone={LIKE_STATUS_TONE[i.status]} dot>{STATUS_LABEL[i.status]}</Badge></span>
      </button>
    );
  };

  return (
    <EchoLayout env="like" wide demoData nav={nav} eyebrow="Like" title="Calendário de publicação">
      <div className="stack-lg">
        <div className="e-row between wrap" style={{ gap: 10 }}>
          <Segmented value={view} onChange={setView} label="Visualização" items={[{ value: "mes", label: "Mês", icon: "calendar" }, { value: "semana", label: "Semana", icon: "kanban" }, { value: "lista", label: "Lista", icon: "list" }]} />
          <div className="e-row wrap" style={{ gap: 6 }}>
            <Chip pressed={!channel} onClick={() => setChannel("")}>Todos os canais</Chip>
            {channels.map((c) => <Chip key={c} pressed={channel === c} onClick={() => setChannel(channel === c ? "" : c)}>{c}</Chip>)}
            {campaigns.length > 0 && <div style={{ minWidth: 200 }}><Select value={campaign} onChange={setCampaign} placeholder="Todas as campanhas" options={[{ value: "", label: "Todas as campanhas" }, ...campaigns.map((c) => ({ value: c.id, label: c.title }))]} /></div>}
          </div>
        </div>
        <PeriodNavigator label={label} unit={view === "semana" ? "semana" : "mês"} onPrevious={() => step(-1)} onNext={() => step(1)} onToday={() => setCursor(new Date())} current={view === "semana" ? week.some((d) => toISO(d) === toISO(new Date())) : cursor.getMonth() === new Date().getMonth() && cursor.getFullYear() === new Date().getFullYear()} />
        {monthGaps.length > 0 && view !== "lista" && (
          <p className="cal-gap-note"><i aria-hidden="true" /> {monthGaps.length} {monthGaps.length === 1 ? "dia útil" : "dias úteis"} do período contratado sem publicação prevista{team ? " · toque no + do dia para enviar um material" : ""}.</p>
        )}

        {view === "mes" && <EditorialCalendar items={shown} year={cursor.getFullYear()} month={cursor.getMonth()} onOpen={open} gaps={gaps}
          onMove={team ? move : undefined} canMove={(i) => i.status !== "publicado"}
          onAdd={team ? (iso) => navigate({ to: `/like/${brandSlug}/enviar?data=${iso}` as never }) : undefined} />}

        {view === "semana" && (
          <div className="cw-week">
            {week.map((d, n) => { const iso = toISO(d); const list = byDay(iso); return (
              <div key={iso} className={`cw-day${iso === toISO(new Date()) ? " today" : ""}${gaps.has(iso) && !list.length ? " gap" : ""}`}
                onDragOver={(e) => { if (team) e.preventDefault(); }} onDrop={(e) => { const id = e.dataTransfer.getData("text/x-like"); if (id) move(id, iso); }}>
                <header><span>{WEEK[n]}</span><b className="tnum">{d.getDate()}</b>{team && iso >= toISO(new Date()) && <button type="button" className="ed-add" style={{ opacity: 1 }} aria-label={`Novo material em ${d.getDate()}`} onClick={() => navigate({ to: `/like/${brandSlug}/enviar?data=${iso}` as never })}><Icon name="plus" size="sm" /></button>}</header>
                {list.map(card)}
                {!list.length && <span className="e-caption cw-empty">{gaps.has(iso) ? "Lacuna" : "—"}</span>}
              </div>
            ); })}
          </div>
        )}

        {view === "lista" && (monthItems.length === 0 ? <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState kind="empty" title="Nada previsto neste mês" /></div> : (
          <div className="cw-list">
            {[...new Set(monthItems.map((i) => toISO(new Date(i.publishAt!))))].map((iso) => (
              <section key={iso} className="settings-section e-glass">
                <h2 className="e-label" style={{ margin: 0 }}>{new Date(`${iso}T12:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</h2>
                <div className="cw-list-items">{byDay(iso).map(card)}</div>
              </section>
            ))}
          </div>
        ))}
        {campaign && <p className="e-caption" style={{ margin: 0 }}>Filtrando pela campanha {campaignName(campaign)}.</p>}
      </div>
    </EchoLayout>
  );
}
