// ---------------------------------------------------------------------------
// Echo · Like: caixa de aprovação do cliente (página 20)
// O que decidir, até quando, e começar a revisão em um toque. Nada da operação
// interna (setor, responsável, prioridade, comentários internos) aparece aqui.
// ---------------------------------------------------------------------------
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { EchoLayout } from "./layout";
import { Alert, Chip, LineTabs, Menu, Segmented, Select } from "./controls";
import { Badge, Button, ClientLogo, EmptyState, Skeleton } from "./primitives";
import { Icon } from "./icon";
import { EchoLogo } from "./logo";
import { stagger } from "./motion";
import { EditorialCalendar, LikeBrandNav, MaterialCard } from "./like-cards";
import { PeriodNavigator } from "./operations";
import { FramedImage } from "@/components/reach/framed-image";
import { useAccess } from "./session";
import { isViewingAsClient } from "@/lib/view-as";
import { loadBrandInfo } from "@/lib/brand-settings-data";
import { listSpaces } from "@/lib/space-data";
import { KIND_LABEL, PENDING, demoActor, getSettings, listApprovers, listItems, listRounds, type ItemFull, type ItemStatus } from "@/lib/like-data";
import { isDemoMode } from "@/lib/home-data";

type Tab = "decidir" | "ajuste" | "aprovados" | "publicados" | "todos";
const TAB_STATUS: Record<Tab, ItemStatus[] | null> = { decidir: PENDING, ajuste: ["ajustes", "reprovado"], aprovados: ["aprovado", "agendado"], publicados: ["publicado"], todos: null };

export function ClientBox({ brandSlug, roundId }: { brandSlug: string; roundId?: string }) {
  const navigate = useNavigate();
  const { session } = useAccess();
  const [ready, setReady] = useState(false);
  const [viewAs, setViewAs] = useState(false);
  useEffect(() => { setReady(true); setViewAs(isViewingAsClient()); }, []);
  const brand = useQuery({ queryKey: ["brand-info", brandSlug], queryFn: () => loadBrandInfo(brandSlug), enabled: ready });
  const items = useQuery({ queryKey: ["like-items", brandSlug, viewAs], queryFn: () => listItems({ brandSlug }), enabled: ready });
  const rounds = useQuery({ queryKey: ["like-rounds", brandSlug, viewAs], queryFn: () => listRounds(brandSlug), enabled: ready });
  const approvers = useQuery({ queryKey: ["like-approvers", brand.data?.id], queryFn: () => listApprovers(brand.data!.id), enabled: !!brand.data });
  const settings = useQuery({ queryKey: ["like-settings", brand.data?.id], queryFn: () => getSettings(brand.data!.id), enabled: !!brand.data });
  const spaces = useQuery({ queryKey: ["spaces"], queryFn: listSpaces, enabled: ready });
  const [tab, setTab] = useState<Tab>("decidir");
  const [view, setView] = useState<"grade" | "calendario">("grade");
  const [f, setF] = useState({ round: roundId ?? "", kind: "", channel: "" });
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const grid = useRef<HTMLDivElement>(null);
  useEffect(() => { if (grid.current && items.data) stagger(grid.current.querySelectorAll(".mat-card"), { y: 10, dur: 400 }, 40); }, [!!items.data, tab, view]);

  const b = brand.data;
  const isTeamPreview = session?.role === "team" && !viewAs;
  const me = isDemoMode() ? demoActor() : { id: session?.userId ?? "", name: session?.name ?? "", kind: session?.role === "team" ? "agency" as const : "client" as const };
  const myRole = (approvers.data ?? []).find((a) => a.userId === me.id)?.role ?? (isTeamPreview ? "aprovador" : "observador");
  const canDecide = myRole === "aprovador";

  if (!ready || brand.isLoading || items.isLoading) return <EchoLayout env="like" wide demoData><div className="stack-lg"><Skeleton h={180} r={28} /><Skeleton h={120} r={24} /><div className="mat-grid">{[0, 1, 2].map((i) => <Skeleton key={i} h={420} r={22} />)}</div></div></EchoLayout>;
  if (!b) return <EchoLayout env="like"><div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState kind="search" title="Espaço não encontrado" /></div></EchoLayout>;

  const all = (items.data ?? []).filter((i) => i.status !== "cancelado");
  const pending = all.filter((i) => PENDING.includes(i.status)).sort((a, x) => (a.dueAt ?? "9").localeCompare(x.dueAt ?? "9"));
  const firstDue = pending[0]?.dueAt ? Math.ceil((new Date(pending[0].dueAt).getTime() - Date.now()) / 86400e3) : null;
  const shown = all.filter((i) => (!TAB_STATUS[tab] || TAB_STATUS[tab]!.includes(i.status)) && (!f.round || i.roundId === f.round) && (!f.kind || i.kind === f.kind) && (!f.channel || i.channelName === f.channel));
  const openRounds = (rounds.data ?? []).filter((r) => r.status === "aberta" || r.status === "vencida");
  const late = openRounds.filter((r) => r.status === "vencida" || (r.dueAt && r.dueAt < new Date().toISOString() && (r.counts.aguardando || r.counts.em_revisao || r.counts.nova_versao)));
  const upcoming = all.filter((i) => ["aprovado", "agendado"].includes(i.status) && i.publishAt && i.publishAt >= new Date().toISOString()).sort((a, x) => a.publishAt!.localeCompare(x.publishAt!)).slice(0, 4);
  const approvalsOf = (i: ItemFull) => {
    const rule = settings.data?.rule ?? "qualquer";
    if (rule === "qualquer") return undefined;
    const done = new Set(i.decisions.filter((d) => d.versionId === i.currentVersionId && d.decision === "approved" && !i.decisions.some((u) => u.undoes === d.id)).map((d) => d.decidedBy));
    const aprov = (approvers.data ?? []).filter((a) => a.role === "aprovador");
    const waiting = aprov.filter((a) => !done.has(a.userId));
    return { done: aprov.filter((a) => done.has(a.userId)).map((a) => a.name), waiting: (rule === "sequencial" ? waiting.slice(0, 1) : waiting).map((a) => a.name) };
  };
  const reviewUrl = (id: string, seq = false) => `/like/${brandSlug}/m/${id}${seq ? "?sequencia=1" : ""}`;
  const greeting = now.getHours() < 12 ? "Bom dia" : now.getHours() < 18 ? "Boa tarde" : "Boa noite";
  const counts: Record<Tab, number> = { decidir: pending.length, ajuste: all.filter((i) => ["ajustes", "reprovado"].includes(i.status)).length, aprovados: all.filter((i) => ["aprovado", "agendado"].includes(i.status)).length, publicados: all.filter((i) => i.status === "publicado").length, todos: all.length };
  const brands = spaces.data?.spaces ?? [];

  return (
    <EchoLayout env="like" wide demoData nav={<LikeBrandNav slug={brandSlug} team={isTeamPreview} />}>
      <div className="stack-lg">
        <section className="box-head e-glass">
          <div className="box-cover">{b.cover_url ? <FramedImage src={b.cover_url} frame={b.cover_frame} shape="rect" className="box-cover-img" /> : <span className="box-cover-fallback" />}</div>
          <div className="box-id">
            <ClientLogo name={b.name} logoUrl={b.logo_url} size="lg" />
            <div style={{ minWidth: 0 }}><span className="e-caption">{greeting}{me.name ? `, ${me.name.split(" ")[0]}` : ""}</span><h1 className="e-h2" style={{ margin: 0 }}>{b.name}</h1></div>
            <span style={{ flex: 1 }} />
            {brands.length > 1 && (
              <Menu align="right" trigger={({ toggle }) => <Button variant="secondary" size="sm" icon="grid" onClick={toggle}>Trocar marca</Button>} items={[{ title: "Suas marcas" }, ...brands.map((x) => ({ label: `${x.name}${x.pending ? ` · ${x.pending}` : ""}`, onSelect: () => navigate({ to: `/like/${x.slug}` as never }) }))]} />
            )}
            <span className="box-mark" aria-hidden="true"><EchoLogo size={20} /></span>
          </div>
        </section>
        {isTeamPreview && <Alert kind="info" title="Você está vendo a caixa como o cliente vê">A equipe não decide por aqui. Use “Ver como cliente” para testar a decisão.</Alert>}

        <section className="box-decide e-glass">
          <div className="box-count"><b className="tnum">{pending.length}</b><span>{pending.length === 1 ? "material para você decidir" : "materiais para você decidir"}{firstDue !== null && <><br /><small className={firstDue <= 1 ? "soon" : ""}>{firstDue < 0 ? "o primeiro já venceu" : firstDue === 0 ? "o primeiro vence hoje" : firstDue === 1 ? "o primeiro vence amanhã" : `o primeiro vence em ${firstDue} dias`}</small></>}</span></div>
          {pending.length > 0 && canDecide && <Link to={reviewUrl(pending[0].id, true) as never} className="e-btn primary lg box-start"><Icon name="play" size="sm" /> Começar revisão</Link>}
          {!canDecide && !isTeamPreview && <p className="e-small" style={{ margin: 0 }}>Você pode ver{myRole === "revisor" ? " e comentar" : ""}. Quem aprova: {(approvers.data ?? []).filter((a) => a.role === "aprovador").map((a) => a.name).join(", ") || "—"}.</p>}
        </section>

        {late.length > 0 && <Alert kind="danger" title={`${late.length === 1 ? "Uma rodada passou" : `${late.length} rodadas passaram`} do prazo`} actions={pending[0] && canDecide ? <Link to={reviewUrl(pending[0].id, true) as never} className="e-btn secondary sm">Decidir agora</Link> : undefined}>Se precisar de mais tempo, fale com o atendimento da Reach.</Alert>}

        {openRounds.length > 0 && (
          <div className="round-cards">
            {openRounds.map((r) => {
              const decided = r.total - (r.counts.aguardando ?? 0) - (r.counts.em_revisao ?? 0) - (r.counts.nova_versao ?? 0) - (r.counts.rascunho ?? 0);
              const thumbs = all.filter((i) => i.roundId === r.id).slice(0, 4);
              const days = r.dueAt ? Math.ceil((new Date(r.dueAt).getTime() - Date.now()) / 86400e3) : null;
              return (
                <Link key={r.id} to={`/like/${brandSlug}/rodada/${r.id}` as never} className={`round-card e-glass${f.round === r.id ? " on" : ""}`}>
                  <span className="round-thumbs">{thumbs.map((t) => { const a = t.current?.assets.find((x) => x.type === "image")?.url; return <i key={t.id} style={a ? { backgroundImage: `url("${a}")` } : undefined} />; })}</span>
                  <b>{r.title}</b>
                  <span className="e-caption tnum">{decided} de {r.total} decididos</span>
                  <span className="e-bar sm"><i style={{ ["--v" as string]: `${r.total ? (decided / r.total) * 100 : 0}%` }} /></span>
                  {days !== null && <span className={`mat-due ${days < 0 ? "late" : days <= 1 ? "soon" : "ok"}`}>{days < 0 ? `prazo venceu há ${-days}d` : days === 0 ? "prazo hoje" : `prazo em ${days} ${days === 1 ? "dia" : "dias"}`}</span>}
                </Link>
              );
            })}
          </div>
        )}

        <div className="e-row between wrap" style={{ gap: 10 }}>
          <LineTabs<Tab> value={tab} onChange={setTab} items={[{ value: "decidir", label: `Para decidir · ${counts.decidir}` }, { value: "ajuste", label: `Em ajuste · ${counts.ajuste}` }, { value: "aprovados", label: `Aprovados · ${counts.aprovados}` }, { value: "publicados", label: `Publicados · ${counts.publicados}` }, { value: "todos", label: "Todos" }]} />
          <Segmented value={view} onChange={setView} label="Visualização" items={[{ value: "grade", label: "Grade", icon: "grid" }, { value: "calendario", label: "Calendário", icon: "calendar" }]} />
        </div>
        <div className="e-row wrap" style={{ gap: 6 }}>
          <div style={{ width: 220 }}><Select value={f.round} onChange={(v) => setF({ ...f, round: v })} options={[{ value: "", label: "Todas as rodadas" }, ...(rounds.data ?? []).map((r) => ({ value: r.id, label: r.title }))]} /></div>
          {[...new Set(all.map((i) => i.kind))].map((k) => <Chip key={k} pressed={f.kind === k} onClick={() => setF({ ...f, kind: f.kind === k ? "" : k })}>{KIND_LABEL[k]}</Chip>)}
          {[...new Set(all.map((i) => i.channelName).filter(Boolean) as string[])].map((c) => <Chip key={c} pressed={f.channel === c} onClick={() => setF({ ...f, channel: f.channel === c ? "" : c })}>{c}</Chip>)}
        </div>

        {view === "calendario" ? (
          <>
            <PeriodNavigator label={(() => { const l = new Date(ym.y, ym.m, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); return l[0].toUpperCase() + l.slice(1); })()} onPrevious={() => setYm(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }))} onNext={() => setYm(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }))} onToday={() => setYm({ y: now.getFullYear(), m: now.getMonth() })} current={ym.y === now.getFullYear() && ym.m === now.getMonth()} />
            <EditorialCalendar items={shown} year={ym.y} month={ym.m} onOpen={(id) => navigate({ to: reviewUrl(id) as never })} />
          </>
        ) : shown.length === 0 ? (
          tab === "decidir" ? (
            <div className="e-glass box-empty" style={{ borderRadius: "var(--r-2xl)" }}>
              <EchoLogo size={44} />
              <EmptyState icon="checkCircle" title="Tudo decidido por aqui" text={upcoming[0] ? `Próxima publicação: ${upcoming[0].title}, em ${new Date(upcoming[0].publishAt!).toLocaleDateString("pt-BR", { day: "numeric", month: "long" })}.` : "Quando a Reach enviar novos materiais, eles aparecem aqui."} />
            </div>
          ) : <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState compact kind="search" title="Nada nesta aba" /></div>
        ) : (
          <div className="mat-grid" ref={grid}>{shown.map((i) => <MaterialCard key={i.id} item={i} onOpen={() => navigate({ to: reviewUrl(i.id) as never })} approvals={approvalsOf(i)} />)}</div>
        )}

        {upcoming.length > 0 && (
          <section className="settings-section e-glass">
            <h2 className="e-h3" style={{ margin: 0 }}>Próximas publicações</h2>
            {upcoming.map((i) => <div key={i.id} className="ops-row" style={{ cursor: "default" }}><span className="date-chip tnum">{new Date(i.publishAt!).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span><span className="e-grow e-ellipsis">{i.title}</span><Badge tone="glass">{i.channelName ?? KIND_LABEL[i.kind]}</Badge></div>)}
          </section>
        )}
      </div>
    </EchoLayout>
  );
}
