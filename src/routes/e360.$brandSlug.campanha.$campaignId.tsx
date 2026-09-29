import { createFileRoute, Link } from "@tanstack/react-router";
import { LoadFailed } from "@/components/echo/blocks";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SpaceShell } from "@/components/reach/space-shell";
import { Alert, LineTabs, TextArea } from "@/components/echo/controls";
import { Badge, Button, EmptyState, Skeleton, type Tone } from "@/components/echo/primitives";
import { Icon, type IconName } from "@/components/echo/icon";
import { CAMPAIGN_STAGES, HORIZONS, SOLICITACAO_STATUSES, TASK_STATUSES } from "@/lib/reach-data";
import { toISO, today } from "@/lib/workspace-data";
import { loadCampaign, saveCampaign, saveTaskS, type CampaignFull } from "@/lib/space-data";

export const Route = createFileRoute("/e360/$brandSlug/campanha/$campaignId")({
  head: () => ({ meta: [{ title: "Campanha · Espaço 360 · Echo" }] }),
  component: CampaignPage,
  validateSearch: (s: Record<string, unknown>) => ({ tab: typeof s.tab === "string" ? s.tab : undefined, filtro: typeof s.filtro === "string" ? s.filtro : undefined }),
});

type Tab = "contexto" | "execucao" | "like" | "aprendizados";
const label = (list: readonly { key: string; label: string }[], k?: string | null) => list.find((x) => x.key === k)?.label ?? k ?? "";
const ddmm = (d?: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "—");
const LIKE_TONE: Record<string, Tone> = { aguardando: "review", aprovado: "approved", ajustes: "adjust", rascunho: "draft" };
const LIKE_LABEL: Record<string, string> = { aguardando: "Aguardando o cliente", aprovado: "Aprovado", ajustes: "Ajustes pedidos", rascunho: "Em preparo" };

function CampaignPage() {
  const { brandSlug, campaignId } = Route.useParams();
  const search = Route.useSearch();
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>((["contexto", "execucao", "like", "aprendizados"] as Tab[]).includes(search.tab as Tab) ? (search.tab as Tab) : "contexto");
  useEffect(() => setReady(true), []);
  const q = useQuery({ queryKey: ["campaign", brandSlug, campaignId], queryFn: () => loadCampaign(brandSlug, campaignId), enabled: ready });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["campaign", brandSlug, campaignId] }); qc.invalidateQueries({ queryKey: ["space", brandSlug] }); qc.invalidateQueries({ queryKey: ["plan", brandSlug] }); qc.invalidateQueries({ queryKey: ["spaces"] }); };
  const d = q.data;
  const shell = (c: React.ReactNode) => <SpaceShell demoData brandSlug={brandSlug} brandName={d?.space.brand.name ?? ""} primaryColor={d?.space.brand.primary} accentColor={d?.space.brand.accent}>{c}</SpaceShell>;
  if (!ready || q.isLoading) return shell(<div className="stack-lg"><Skeleton h={150} r={24} /><Skeleton h={90} r={20} /><Skeleton h={300} r={24} /></div>);
  if (q.isError) return shell(<LoadFailed what="a campanha" onRetry={() => q.refetch()} />);
  if (!d) return shell(<div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState kind="search" title="Campanha não encontrada" actions={<Link to="/e360/$brandSlug" params={{ brandSlug }} search={{ tab: "campanhas", filtro: undefined }} className="e-btn secondary">Ver campanhas</Link>} /></div>);
  const { campaign: c, space: s, likeMaterials } = d;
  const canEdit = s.canEdit && s.isTeam;
  const idx = CAMPAIGN_STAGES.findIndex((x) => x.key === c.stage);
  const tasks = s.tasks.filter((t) => t.campaign_id === c.id);
  const required = tasks.filter((t) => t.is_required);
  const requiredOpen = required.filter((t) => t.status !== "concluida").length;
  const pendingLike = likeMaterials.filter((m) => m.status === "aguardando" || m.status === "ajustes").length;
  const save = async (patch: Partial<CampaignFull>, msg = "Campanha atualizada") => { try { await saveCampaign(brandSlug, c.id, patch); toast.success(msg); refresh(); } catch { toast.error("Não foi possível salvar."); } };
  const setStage = async (key: string) => {
    if ((key === "encerramento" || key === "analise") && requiredOpen > 0) { toast.error(`Faltam ${requiredOpen} tarefas obrigatórias para encerrar a campanha.`); return; }
    await save({ stage: key }, `Etapa: ${label(CAMPAIGN_STAGES, key)}`);
  };

  return shell(
    <div className="stack-lg">
      <Link to="/e360/$brandSlug" params={{ brandSlug }} search={{ tab: "campanhas", filtro: undefined }} className="e-link" style={{ fontSize: 13, fontWeight: 500 }}><Icon name="chevLeft" size="sm" /> Campanhas</Link>
      <section className="camp-head e-glass">
        <div className="e-row between wrap" style={{ gap: 10, alignItems: "flex-start" }}>
          <div style={{ minWidth: 0 }}>
            <span className="e-label">Campanha</span>
            <h1 className="e-h2" style={{ margin: "4px 0 0" }}>{c.title}</h1>
            {c.description && <p className="e-small" style={{ margin: "6px 0 0", maxWidth: "60ch" }}>{c.description}</p>}
          </div>
          <Badge tone={c.status === "concluida" ? "done" : c.status === "em_andamento" ? "doing" : "todo"} dot>{c.status === "concluida" ? "Concluída" : c.status === "em_andamento" ? "Em andamento" : "Planejada"}</Badge>
        </div>
        <dl className="camp-facts">
          <div><dt>Período</dt><dd className="tnum">{ddmm(c.start_date)} – {ddmm(c.end_date)}</dd></div>
          <div><dt>Estratégia</dt><dd>{s.initiatives.find((i) => i.id === c.initiative_id)?.title ?? "—"}</dd></div>
          <div><dt>Objetivo</dt><dd>{s.objectives.find((o) => o.id === c.objective_id)?.title ?? "—"}</dd></div>
          <div><dt>Responsável</dt><dd>{c.responsible ?? "—"}</dd></div>
          <div><dt>Prioridade</dt><dd>{c.priority === "alta" ? "Alta" : c.priority === "baixa" ? "Baixa" : label(HORIZONS, c.priority) || "Média"}</dd></div>
        </dl>
      </section>

      <section className="cycle e-glass" aria-label="Ciclo da campanha">
        <ol>
          {CAMPAIGN_STAGES.map((st, i) => (
            <li key={st.key} className={i < idx ? "done" : i === idx ? "now" : ""}>
              <button type="button" disabled={!canEdit || i === idx} onClick={() => setStage(st.key)} aria-current={i === idx ? "step" : undefined} title={canEdit ? `Mover para ${st.label}` : st.label}>
                <i>{i < idx ? <Icon name="check" size="sm" /> : i + 1}</i><span>{st.label}</span>
              </button>
            </li>
          ))}
        </ol>
        {c.stage === "aprovacao" && <Alert kind={pendingLike ? "warn" : "ok"} title={pendingLike ? `${pendingLike} ${pendingLike === 1 ? "material falta" : "materiais faltam"} decidir no Like` : "Todos os materiais foram decididos"}>{pendingLike ? "O cliente decide no Like; a campanha segue para Publicação quando tudo estiver aprovado." : "Pode seguir para Publicação."}</Alert>}
        {required.length > 0 && <p className="e-caption" style={{ margin: 0 }}>{required.length - requiredOpen} de {required.length} tarefas obrigatórias concluídas. Encerrar exige todas.</p>}
      </section>

      <LineTabs<Tab> value={tab} onChange={setTab} items={[{ value: "contexto", label: "Contexto", icon: "compass" }, { value: "execucao", label: `Execução · ${tasks.length}`, icon: "checks" }, { value: "like", label: `Materiais no Like · ${likeMaterials.length}`, icon: "heart" }, { value: "aprendizados", label: "Aprendizados", icon: "sparkle" }]} />
      {tab === "contexto" && <Context c={c} canEdit={canEdit} onSave={save} />}
      {tab === "execucao" && (
        <div className="grid-2" style={{ alignItems: "start" }}>
          <section className="now-panel e-glass" style={{ ["--c" as string]: "var(--env-workspace)" }}>
            <header><span className="now-ic"><Icon name="checks" size="sm" /></span><h3>Tarefas</h3><span className="e-badge glass tnum">{tasks.length}</span></header>
            <div className="now-body now-list">
              {tasks.map((t) => (
                <div key={t.id} className={`ops-row${t.status === "concluida" ? " is-done" : ""}`} style={{ cursor: "default" }}>
                  <input type="checkbox" checked={t.status === "concluida"} disabled={!s.canEdit || (!s.isTeam && t.owner_scope === "agencia")} aria-label={`Concluir ${t.title}`} onChange={async (e) => { await saveTaskS(brandSlug, s.brand.id, t.id, { status: e.target.checked ? "concluida" : "em_andamento" }); refresh(); }} />
                  <span className="e-grow e-ellipsis">{t.title}{t.is_required && <span className="req-mark" title="Obrigatória">•</span>}</span>
                  <Badge tone="glass">{label(TASK_STATUSES, t.status)}</Badge>
                </div>
              ))}
              {tasks.length === 0 && <EmptyState compact icon="checks" title="Nenhuma tarefa vinculada" />}
            </div>
          </section>
          <section className="now-panel e-glass" style={{ ["--c" as string]: "var(--env-360)" }}>
            <header><span className="now-ic"><Icon name="inbox" size="sm" /></span><h3>Solicitações e entregas</h3></header>
            <div className="now-body now-list">
              {s.requests.filter((r) => r.campaign_id === c.id).map((r) => <div key={r.id} className="ops-row" style={{ cursor: "default" }}><Icon name="inbox" size="sm" /><span className="e-grow e-ellipsis">{r.title}</span><Badge tone="glass">{label(SOLICITACAO_STATUSES, r.status)}</Badge></div>)}
              {s.deliveries.filter((x) => x.campaign_id === c.id).map((x) => <div key={x.id} className="ops-row" style={{ cursor: "default" }}><Icon name="checkCircle" size="sm" /><span className="e-grow e-ellipsis">{x.title}</span><span className="e-caption tnum">{ddmm(x.delivered_at)}</span></div>)}
              {!s.requests.some((r) => r.campaign_id === c.id) && !s.deliveries.some((x) => x.campaign_id === c.id) && <EmptyState compact icon="inbox" title="Nada por aqui ainda" />}
            </div>
          </section>
        </div>
      )}
      {tab === "like" && (
        likeMaterials.length === 0 ? <div className="e-glass" style={{ borderRadius: "var(--r-xl)" }}><EmptyState compact icon="heart" title="Nenhum material desta campanha no Like" /></div> : (
          <div className="material-grid">
            {likeMaterials.map((m) => (
              <article key={m.id} className="material-card e-glass">
                <span className={`material-thumb ${m.format.toLowerCase()}`}><Icon name={(m.format === "Vídeo" ? "play" : m.format === "Stories" ? "stories" : m.format === "Carrossel" ? "carousel" : "image") as IconName} /></span>
                <b>{m.title}</b>
                <span className="e-caption">{m.format}{m.front ? ` · ${m.front}` : ""}{m.round > 1 ? ` · rodada ${m.round}` : ""}</span>
                <Badge tone={LIKE_TONE[m.status]} dot>{LIKE_LABEL[m.status]}</Badge>
              </article>
            ))}
          </div>
        )
      )}
      {tab === "aprendizados" && <Learnings c={c} canEdit={s.canEdit} onSave={save} />}
    </div>,
  );
}

function Context({ c, canEdit, onSave }: { c: CampaignFull; canEdit: boolean; onSave: (p: Partial<CampaignFull>) => Promise<void> }) {
  const init = { opportunity: c.opportunity ?? "", message: c.message ?? "", offer: c.offer ?? "", products: c.products ?? "", target_audience: c.target_audience ?? "", channels: c.channels.join(", ") };
  const [d, setD] = useState(init);
  useEffect(() => setD(init), [c.id]);
  const dirty = JSON.stringify(d) !== JSON.stringify(init);
  const fields: [keyof typeof d, string][] = [["opportunity", "Oportunidade"], ["message", "Mensagem principal"], ["offer", "Oferta"], ["products", "Produtos"], ["target_audience", "Público-alvo"], ["channels", "Canais"]];
  return (
    <section className="settings-section e-glass">
      <div className="grid-2" style={{ gap: 12 }}>
        {fields.map(([k, l]) => canEdit
          ? <TextArea key={k} label={l} rows={2} optional value={d[k]} help={k === "channels" ? "Separe por vírgula." : undefined} onChange={(e) => setD({ ...d, [k]: e.target.value })} />
          : <div key={k} className="e-field"><span className="e-field-label">{l}</span><p className="plan-text" style={{ margin: 0 }}>{d[k] || "—"}</p></div>)}
      </div>
      {canEdit && dirty && <div className="e-row" style={{ gap: 8, justifyContent: "flex-end" }}><Button variant="ghost" onClick={() => setD(init)}>Desfazer</Button><Button icon="check" onClick={() => onSave({ ...d, channels: d.channels.split(",").map((x) => x.trim()).filter(Boolean) })}>Salvar</Button></div>}
    </section>
  );
}

function Learnings({ c, canEdit, onSave }: { c: CampaignFull; canEdit: boolean; onSave: (p: Partial<CampaignFull>, msg?: string) => Promise<void> }) {
  const [text, setText] = useState("");
  const [ref, setRef] = useState({ title: "", url: "" });
  return (
    <div className="grid-2" style={{ alignItems: "start" }}>
      <section className="settings-section e-glass">
        <h3 className="e-h3" style={{ margin: 0 }}>Aprendizados</h3>
        {c.learnings.length ? <ol className="hub-activity">{[...c.learnings].reverse().map((l, i) => <li key={i}><span className="node" style={{ ["--c" as string]: "var(--env-360)" }}><Icon name="sparkle" size="sm" /></span><div><span>{l.text}</span><div className="e-caption tnum">{ddmm(l.date)}</div></div></li>)}</ol> : <span className="e-caption">Nenhum aprendizado registrado.</span>}
        {canEdit && <form className="e-row" style={{ gap: 6 }} onSubmit={async (e) => { e.preventDefault(); if (!text.trim()) return; await onSave({ learnings: [...c.learnings, { date: toISO(today()), text: text.trim() }] }, "Aprendizado registrado"); setText(""); }}>
          <input className="e-input sm e-grow" value={text} placeholder="O que aprendemos?" aria-label="Novo aprendizado" onChange={(e) => setText(e.target.value)} />
          <Button size="sm" icon="plus" type="submit" disabled={!text.trim()} aria-label="Registrar aprendizado" />
        </form>}
      </section>
      <section className="settings-section e-glass">
        <h3 className="e-h3" style={{ margin: 0 }}>Materiais e referências</h3>
        <div className="e-row wrap" style={{ gap: 6 }}>{c.materials.map((m) => <a key={m.url} className="e-chip" href={m.url} target="_blank" rel="noreferrer"><Icon name="link" size="sm" /> {m.title}</a>)}{c.materials.length === 0 && <span className="e-caption">Nenhum material.</span>}</div>
        {canEdit && <form className="e-row wrap" style={{ gap: 6 }} onSubmit={async (e) => { e.preventDefault(); if (!ref.title.trim() || !/^https?:\/\//.test(ref.url)) { toast.error("Informe nome e um link começando com http."); return; } await onSave({ materials: [...c.materials, { title: ref.title.trim(), url: ref.url.trim() }] }, "Material adicionado"); setRef({ title: "", url: "" }); }}>
          <input className="e-input sm" style={{ flex: "1 1 140px" }} value={ref.title} placeholder="Nome" aria-label="Nome do material" onChange={(e) => setRef({ ...ref, title: e.target.value })} />
          <input className="e-input sm" style={{ flex: "2 1 200px" }} value={ref.url} placeholder="https://" aria-label="Link" onChange={(e) => setRef({ ...ref, url: e.target.value })} />
          <Button size="sm" variant="secondary" icon="plus" type="submit">Adicionar</Button>
        </form>}
      </section>
    </div>
  );
}

