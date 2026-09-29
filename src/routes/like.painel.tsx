import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LoadFailed } from "@/components/echo/blocks";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { EchoBlocked, EchoLayout } from "@/components/echo/layout";
import { Checkbox, Field, LineTabs, Select } from "@/components/echo/controls";
import { Modal } from "@/components/echo/overlays";
import { Badge, Button, ClientLogo, EmptyState, Skeleton } from "@/components/echo/primitives";
import { Icon } from "@/components/echo/icon";
import { KIND_ICON, LIKE_STATUS_TONE } from "@/components/echo/like-cards";
import { useAccess } from "@/components/echo/session";
import { isViewingAsClient } from "@/lib/view-as";
import { KIND_LABEL, PENDING, STATUS_LABEL, coverCss, listItems, listRounds, markPublished, remindApprovers, schedule, sendItems, type ItemFull, type ItemStatus } from "@/lib/like-data";
import { clientStats, fmtHours } from "@/lib/like-report";

export const Route = createFileRoute("/like/painel")({
  head: () => ({ meta: [{ title: "Painel · Like · Echo" }] }),
  component: LikeBoard,
});

const COLUMNS: { status: ItemStatus; label: string }[] = [
  { status: "rascunho", label: "Rascunho interno" }, { status: "aguardando", label: "Aguardando" }, { status: "em_revisao", label: "Em revisão" },
  { status: "ajustes", label: "Ajustes solicitados" }, { status: "aprovado", label: "Aprovado" }, { status: "agendado", label: "Agendado" }, { status: "publicado", label: "Publicado" },
];
// Só estas passagens são feitas arrastando; as outras acontecem pelas ações do material.
const DRAG_OK: Record<string, ItemStatus[]> = { aprovado: ["agendado", "publicado"], agendado: ["publicado"] };
const colOf = (s: ItemStatus): ItemStatus => (s === "nova_versao" ? "aguardando" : s === "reprovado" ? "ajustes" : s);
const days = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400e3);

function LikeBoard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isTeam } = useAccess();
  const [ready, setReady] = useState(false);
  const [viewAs, setViewAs] = useState(false);
  useEffect(() => { setReady(true); setViewAs(isViewingAsClient()); }, []);
  const items = useQuery({ queryKey: ["like-items", "all", viewAs], queryFn: () => listItems(), enabled: ready });
  const rounds = useQuery({ queryKey: ["like-rounds", "all", viewAs], queryFn: () => listRounds(), enabled: ready });
  const [tab, setTab] = useState<"quadro" | "prazos" | "clientes">("quadro");
  const [f, setF] = useState({ brand: "", round: "", channel: "", kind: "", campaign: "", status: "" });
  const [overCol, setOverCol] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<{ item: ItemFull; link: string } | null>(null);
  const [waitDays, setWaitDays] = useState("2");
  const [sel, setSel] = useState<Set<string>>(new Set());

  const all = useMemo(() => (items.data ?? []).filter((i) => i.status !== "cancelado"), [items.data]);
  if (ready && (!isTeam || viewAs)) return <EchoLayout env="like"><EchoBlocked title="Painel da equipe" text="Este painel é só para a equipe da Reach." /></EchoLayout>;
  if (!ready || items.isLoading) return <EchoLayout env="like" wide demoData eyebrow="Like" title="Painel"><Skeleton h={520} r={24} /></EchoLayout>;
  if (items.isError) return <EchoLayout env="like" wide eyebrow="Like" title="Painel"><LoadFailed what="o painel" onRetry={() => items.refetch()} /></EchoLayout>;

  const refresh = () => { for (const k of [["like-items"], ["like-rounds"], ["like-item"], ["ops-fronts"]]) qc.invalidateQueries({ queryKey: k }); };
  const opt = (xs: (string | null | undefined)[]) => [...new Set(xs.filter(Boolean))] as string[];
  const brands = opt(all.map((i) => i.brandSlug)).map((slug) => ({ slug, name: all.find((i) => i.brandSlug === slug)!.brandName }));
  const shown = all.filter((i) => (!f.brand || i.brandSlug === f.brand) && (!f.round || i.roundId === f.round) && (!f.channel || i.channelName === f.channel) && (!f.kind || i.kind === f.kind) && (!f.campaign || i.campaignId === f.campaign) && (!f.status || colOf(i.status) === f.status));
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const pendingItems = shown.filter((i) => PENDING.includes(i.status));
  const late = pendingItems.filter((i) => i.dueAt && i.dueAt < now);
  const dueToday = pendingItems.filter((i) => i.dueAt && i.dueAt >= now && i.dueAt.slice(0, 10) === today);
  const waiting = pendingItems.filter((i) => i.sentAt && days(i.sentAt) >= Number(waitDays) && !late.includes(i) && !dueToday.includes(i));

  const drop = async (col: ItemStatus, id: string) => {
    const it = all.find((x) => x.id === id);
    setOverCol(null);
    if (!it || colOf(it.status) === col) return;
    if (!(DRAG_OK[it.status] ?? []).includes(col)) { toast.error("Essa mudança acontece pelas ações do material", { description: "Arrastando, só dá para passar de Aprovado para Agendado e Publicado." }); return; }
    if (col === "agendado") { await schedule(it.id, it.publishAt ?? new Date().toISOString()); refresh(); toast.success(`${it.title} agendado`); return; }
    setPublishing({ item: it, link: "" });
  };
  const remind = async (ids: string[]) => {
    const n = await remindApprovers(ids);
    setSel(new Set());
    refresh();
    toast.success(n === 1 ? "Lembrete enviado" : `${n} lembretes enviados`, { description: "Fica registrado no histórico de cada material." });
  };
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const mini = (i: ItemFull, draggable = false) => {
    const art = i.current?.assets.find((a) => a.type === "image")?.url;
    const due = PENDING.includes(i.status) && i.dueAt ? Math.ceil((new Date(i.dueAt).getTime() - Date.now()) / 86400e3) : null;
    return (
      <button key={i.id} type="button" className="lb-card" draggable={draggable} onDragStart={(e: DragEvent) => { e.dataTransfer.setData("text/x-like", i.id); e.dataTransfer.effectAllowed = "move"; }}
        onClick={() => navigate({ to: `/like/${i.brandSlug}/m/${i.id}` as never })}>
        <span className="lb-thumb" style={art ? undefined : { background: coverCss(i.coverTone) }}>{art ? <img src={art} alt="" draggable={false} /> : <Icon name={KIND_ICON[i.kind]} size="sm" />}</span>
        <span className="lb-body">
          <b>{i.title}</b>
          <small><ClientLogo name={i.brandName} size="sm" /> {i.brandName}</small>
          <small>{KIND_LABEL[i.kind]}{i.channelName ? ` · ${i.channelName}` : ""}{(i.current?.number ?? 1) > 1 ? ` · v${i.current!.number}` : ""}</small>
          {due !== null && <small className={due < 0 ? "t-danger" : due <= 1 ? "t-warn" : ""}>{due < 0 ? `venceu há ${-due}d` : due === 0 ? "vence hoje" : `vence em ${due}d`}</small>}
          {i.status === "nova_versao" && <Badge tone="doing">Nova versão</Badge>}
          {i.status === "reprovado" && <Badge tone="late">Reprovado</Badge>}
        </span>
      </button>
    );
  };

  const deadlineGroup = (title: string, list: ItemFull[], tone: string) => (
    <section className="settings-section e-glass">
      <div className="e-row between"><h2 className="e-h3" style={{ margin: 0 }}><span className={`lb-dot ${tone}`} /> {title} <span className="e-caption tnum">· {list.length}</span></h2>
        {list.length > 1 && <Button size="sm" variant="secondary" icon="bell" onClick={() => remind(list.map((i) => i.id))}>Lembrar todos</Button>}</div>
      {list.length === 0 ? <p className="e-caption" style={{ margin: 0 }}>Nada aqui.</p> : list.map((i) => (
        <div key={i.id} className="ops-row" style={{ cursor: "default" }}>
          <Checkbox checked={sel.has(i.id)} onChange={() => toggle(i.id)} label={<span className="sr-only">Selecionar {i.title}</span>} />
          <ClientLogo name={i.brandName} size="sm" />
          <span className="e-grow" style={{ minWidth: 0 }}><Link to={`/like/${i.brandSlug}/m/${i.id}` as never} className="e-ellipsis" style={{ display: "block", fontWeight: 600, color: "var(--ink)" }}>{i.title}</Link><span className="e-caption">{i.brandName} · enviado há {i.sentAt ? days(i.sentAt) : "?"}d{i.dueAt ? ` · prazo ${new Date(i.dueAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}` : ""}</span></span>
          <Badge tone={LIKE_STATUS_TONE[i.status]} dot>{STATUS_LABEL[i.status]}</Badge>
          <Button size="sm" variant="ghost" icon="bell" onClick={() => remind([i.id])}>Lembrar</Button>
        </div>
      ))}
    </section>
  );

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return (
    <EchoLayout env="like" wide demoData eyebrow="Like" title="Painel da agência" titleAside={<Link to={"/like" as never} className="e-btn secondary sm"><Icon name="chevLeft" size="sm" /> Resumo</Link>}>
      <div className="stack-lg">
        <div className="lb-filters e-glass">
          <Select value={f.brand} onChange={(v) => setF({ ...f, brand: v, round: "" })} placeholder="Cliente" options={[{ value: "", label: "Todos os clientes" }, ...brands.map((b) => ({ value: b.slug, label: b.name }))]} />
          <Select value={f.round} onChange={(v) => setF({ ...f, round: v })} placeholder="Rodada" options={[{ value: "", label: "Todas as rodadas" }, ...(rounds.data ?? []).filter((r) => !f.brand || r.brandSlug === f.brand).map((r) => ({ value: r.id, label: `${r.brandName} · ${r.title}` }))]} />
          <Select value={f.channel} onChange={(v) => setF({ ...f, channel: v })} placeholder="Canal" options={[{ value: "", label: "Todos os canais" }, ...opt(all.map((i) => i.channelName)).map((c) => ({ value: c, label: c }))]} />
          <Select value={f.kind} onChange={(v) => setF({ ...f, kind: v })} placeholder="Formato" options={[{ value: "", label: "Todos os formatos" }, ...opt(all.map((i) => i.kind)).map((k) => ({ value: k, label: KIND_LABEL[k as keyof typeof KIND_LABEL] }))]} />
          <Select value={f.campaign} onChange={(v) => setF({ ...f, campaign: v })} placeholder="Campanha" options={[{ value: "", label: "Todas as campanhas" }, ...opt(all.map((i) => i.campaignId)).map((c) => ({ value: c, label: `Campanha · ${all.find((i) => i.campaignId === c)?.brandName ?? ""}` }))]} />
          <Select value={f.status} onChange={(v) => setF({ ...f, status: v })} placeholder="Estado" options={[{ value: "", label: "Todos os estados" }, ...COLUMNS.map((c) => ({ value: c.status, label: c.label }))]} />
        </div>

        <LineTabs value={tab} onChange={setTab} items={[{ value: "quadro", label: "Quadro", icon: "kanban", count: shown.length }, { value: "prazos", label: "Prazos", icon: "clock", count: late.length + dueToday.length }, { value: "clientes", label: "Por cliente", icon: "users" }]} />

        {tab === "quadro" && (
          <div className="lb-board">
            {COLUMNS.filter((c) => !f.status || c.status === f.status).map((c) => {
              const list = shown.filter((i) => colOf(i.status) === c.status);
              return (
                <section key={c.status} className={`lb-col e-glass${overCol === c.status ? " over" : ""}`} aria-label={c.label}
                  onDragOver={(e: DragEvent) => { if (["agendado", "publicado"].includes(c.status)) { e.preventDefault(); setOverCol(c.status); } }}
                  onDragLeave={() => setOverCol((o) => (o === c.status ? null : o))}
                  onDrop={(e: DragEvent) => { e.preventDefault(); drop(c.status, e.dataTransfer.getData("text/x-like")); }}>
                  <header><span className={`lb-dot s-${c.status}`} /><b>{c.label}</b><span className="e-caption tnum">{list.length}</span></header>
                  <div className="lb-col-body">{list.length ? list.map((i) => mini(i, i.status in DRAG_OK)) : <span className="e-caption lb-empty">Vazio</span>}</div>
                </section>
              );
            })}
          </div>
        )}

        {tab === "prazos" && (
          <div className="stack">
            <div className="e-row between wrap" style={{ gap: 8 }}>
              <div className="e-row" style={{ gap: 8 }}><span className="e-caption">Aguardando há mais de</span><div style={{ width: 120 }}><Select value={waitDays} onChange={setWaitDays} options={["1", "2", "3", "5", "7"].map((d) => ({ value: d, label: `${d} ${d === "1" ? "dia" : "dias"}` }))} /></div></div>
              <Button icon="bell" disabled={!sel.size} onClick={() => remind([...sel])}>Lembrar selecionados{sel.size ? ` (${sel.size})` : ""}</Button>
            </div>
            {deadlineGroup("Vencidos", late, "t-danger")}
            {deadlineGroup("Vencem hoje", dueToday, "t-warn")}
            {deadlineGroup(`Aguardando há ${waitDays}+ dias`, waiting, "t-review")}
          </div>
        )}

        {tab === "clientes" && (
          <section className="settings-section e-glass">
            <div className="lb-table-wrap">
              <table className="lb-table">
                <thead><tr><th>Cliente</th><th>Para decidir</th><th>Tempo médio de decisão</th><th>Ajustes por material</th><th>Rodadas no prazo</th><th>Aprovador mais lento</th><th /></tr></thead>
                <tbody>
                  {brands.filter((b) => !f.brand || b.slug === f.brand).map((b) => {
                    const its = all.filter((i) => i.brandSlug === b.slug);
                    const s = clientStats(its, (rounds.data ?? []).filter((r) => r.brandSlug === b.slug));
                    const drafts = its.filter((i) => i.status === "rascunho");
                    const wa = `https://wa.me/?text=${encodeURIComponent(`Oi! Tem ${s.pending} ${s.pending === 1 ? "material esperando" : "materiais esperando"} sua aprovação no Like: ${origin}/like/${b.slug}`)}`;
                    return (
                      <tr key={b.slug}>
                        <td><Link to={`/like/${b.slug}` as never} className="e-row" style={{ gap: 8, color: "var(--ink)", fontWeight: 600 }}><ClientLogo name={b.name} size="sm" /> {b.name}</Link></td>
                        <td className="tnum">{s.pending}</td>
                        <td className="tnum">{fmtHours(s.avgDecisionHours)}</td>
                        <td className="tnum">{s.adjustmentsPerItem === null ? "—" : s.adjustmentsPerItem.toFixed(1).replace(".", ",")}</td>
                        <td className="tnum">{s.rounds.closed ? `${s.rounds.onTime} de ${s.rounds.closed}` : "—"}</td>
                        <td>{s.slowest ? `${s.slowest.name} · ${fmtHours(s.slowest.h)}` : "—"}</td>
                        <td>
                          <div className="e-row" style={{ gap: 6, justifyContent: "flex-end" }}>
                            {drafts.length > 0 && <Button size="sm" variant="secondary" icon="send" onClick={async () => { const n = await sendItems(drafts.map((d) => d.id), drafts[0].roundId); refresh(); toast.success(`${n} ${n === 1 ? "rascunho enviado" : "rascunhos enviados"} para ${b.name}`); }}>Enviar rascunhos ({drafts.length})</Button>}
                            {s.pending > 0 && <a className="e-btn ghost sm" href={wa} target="_blank" rel="noreferrer" aria-label={`Avisar ${b.name} pelo WhatsApp`}><Icon name="message" size="sm" /> WhatsApp</a>}
                            <Link to={`/like/${b.slug}/historico` as never} className="e-btn ghost sm"><Icon name="chart" size="sm" /> Relatório</Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="e-caption" style={{ margin: 0 }}><Icon name="lock" size="sm" /> Visão interna: o cliente não vê esta tabela.</p>
          </section>
        )}
        {shown.length === 0 && tab === "quadro" && <EmptyState kind="search" title="Nenhum material com esses filtros" />}
      </div>

      <Modal open={!!publishing} onClose={() => setPublishing(null)} title="Marcar como publicado" sub={publishing?.item.title} icon="megaphone"
        footer={<><Button variant="ghost" onClick={() => setPublishing(null)}>Cancelar</Button><Button disabled={!/^https?:\/\//.test(publishing?.link ?? "")} onClick={async () => { try { await markPublished(publishing!.item.id, publishing!.link); setPublishing(null); refresh(); toast.success("Material publicado"); } catch (e) { toast.error((e as Error).message); } }}>Marcar publicado</Button></>}>
        <Field label="Link do post" type="url" value={publishing?.link ?? ""} onChange={(e) => setPublishing((p) => (p ? { ...p, link: e.target.value } : p))} placeholder="https://instagram.com/p/…" />
      </Modal>
    </EchoLayout>
  );
}
