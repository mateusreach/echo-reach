import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { EchoLayout } from "@/components/echo/layout";
import { Badge, Button, EmptyState } from "@/components/echo/primitives";
import { Icon } from "@/components/echo/icon";
import { useAccess } from "@/components/echo/session";
import { isDemoMode } from "@/lib/home-data";
import { demoOps } from "@/lib/ops-data";
import { demoLibraryStore } from "@/lib/library-data";
import { demoEventsFor } from "@/lib/space-data";
import {
  addComment, addVersion, countExamples, createItem, createRound, decide, demoActors, demoArt, getItem, listItems, purgeExamples, sendItems, undoDecision, LikeRuleError,
} from "@/lib/like-data";

export const Route = createFileRoute("/like/diagnostico")({
  head: () => ({ meta: [{ title: "Diagnóstico do Like · Echo" }] }),
  component: LikeDiagnostics,
});

type Step = { name: string; ok: boolean; detail: string };
const TABLES = ["like_rounds", "like_items", "like_versions", "like_comments", "like_decisions", "like_approvers", "like_settings", "like_views", "like_share_links", "notifications", "like_activity"];
const FUNCS = ["like_send_items", "like_decide", "like_apply_approval", "like_undo", "like_mark_published", "like_client_can_see"];
const TRIGGERS = ["like_decisions_immutable", "like_activity_immutable", "like_versions_frozen", "like_comments_status", "like_items_round_status"];

/** Teste ponta a ponta com dados de exemplo (is_example), apagados ao final. */
async function runEndToEnd(log: (s: Step) => void) {
  const check = (name: string, ok: boolean, detail: string) => { log({ name, ok, detail }); if (!ok) throw new Error(`${name}: ${detail}`); };
  const slug = "fina-fragrancia";
  const brandId = `b-${slug}`;
  const ops = demoOps();
  const front = ops.fronts.find((f) => f.brand.slug === slug && f.front.name === "Feed")!;
  const frontBefore = front.front.approved_until;
  const conteudo = demoLibraryStore(slug)!.conteudos.find((c) => c.id === "k2")!;
  const conteudoBefore = { status: conteudo.status, legenda: conteudo.legenda };
  const taskId = `t-diag-${Date.now()}`;
  ops.tasks.push({ id: taskId, title: "[Teste] Arte do diagnóstico", brand: { id: brandId, name: "Fina Fragrância", slug }, frontId: front.front.id, frontName: "Feed", workOrderId: null, status: "Avaliação interna", owner: "Helena Duarte", due: null, sector: null, note: null, requiresReview: true, since: new Date().toISOString(), remindedAt: null, likeMaterial: "post" });
  const publish = new Date(Date.now() + 40 * 86400e3); publish.setHours(11, 0, 0, 0);
  const publishDay = publish.toISOString().slice(0, 10);
  try {
    const round = await createRound({ brandId, brandSlug: slug, brandName: "Fina Fragrância", title: "[Teste] Rodada do diagnóstico", isExample: true });
    const item = await createItem({ brandId, brandSlug: slug, brandName: "Fina Fragrância", title: "[Teste] Post do diagnóstico", kind: "post", roundId: round.id, frontId: front.front.id, frontName: "Feed", taskId, conteudoId: conteudo.id, publishAt: publish.toISOString(), isExample: true }, { assets: [{ url: demoArt("Teste", 1080, 1350, 150), type: "image", width: 1080, height: 1350 }], caption: "Legenda da versão 1" });
    check("Criar material", item.status === "rascunho" && item.versions.length === 1, `status ${item.status}, versões ${item.versions.length}`);

    // A2: cliente não vê rascunho nem comentário interno.
    await addComment(item.id, { body: "Nota interna da equipe", internal: true }, demoActors.team);
    const asClient = (await listItems({ brandSlug: slug, includeExamples: true })).length;
    check("Cliente não vê rascunho", !(await getItemAs(item.id, "client")), "rascunho oculto para o cliente");

    await sendItems([item.id], round.id);
    let t = ops.tasks.find((x) => x.id === taskId)!;
    check("Enviar ao cliente", t.status === "Avaliação externa", `tarefa em ${t.status}`);
    const seen = await getItemAs(item.id, "client");
    check("Cliente não vê comentário interno", !!seen && seen.comments.every((c) => !c.internal), `${seen?.comments.length ?? 0} comentários visíveis`);

    await addComment(item.id, { body: "Troque a foto da capa, por favor.", anchor: { type: "point", slide: 0, x: 42, y: 30 } }, demoActors.client);
    check("Comentário do cliente", (await getItem(item.id))!.status === "em_revisao", "Aguardando → Em revisão");

    let blocked = false;
    try { await decide(item.id, item.currentVersionId!, "approved", { actor: demoActors.team }); } catch (e) { blocked = e instanceof LikeRuleError; }
    check("Equipe não aprova pelo cliente", blocked, "decisão da equipe recusada");

    await decide(item.id, item.currentVersionId!, "changes_requested", { phrases: ["Trocar imagem"], actor: demoActors.client });
    t = ops.tasks.find((x) => x.id === taskId)!;
    check("Pedir ajuste", (await getItem(item.id))!.status === "ajustes" && t.status === "Ajuste", `material ajustes, tarefa ${t.status}`);

    const v2 = await addVersion(item.id, { assets: [{ url: demoArt("Teste v2", 1080, 1350, 190), type: "image", width: 1080, height: 1350 }], caption: "Legenda aprovada", changesNote: "Nova capa" });
    await sendItems([item.id]);
    check("Nova versão", (await getItem(item.id))!.status === "aguardando" && v2.number === 2, `versão ${v2.number}`);

    const r1 = await decide(item.id, v2.id, "approved", { actor: demoActors.client });
    t = ops.tasks.find((x) => x.id === taskId)!;
    const ev1 = demoEventsFor(slug, item.id).length;
    check("Aprovar", r1.status === "aprovado" && t.status === "Concluído", `tarefa ${t.status}`);
    check("Conteúdo atualizado", conteudo.status === "aprovada" && conteudo.legenda === "Legenda aprovada", `conteúdo ${conteudo.status}`);
    check("Cobertura avançou", front.front.approved_until === publishDay, `aprovado até ${front.front.approved_until}`);
    check("Evento na agenda", ev1 === 1, `${ev1} evento`);

    // A3: aprovar de novo não duplica.
    const r2 = await decide(item.id, v2.id, "approved", { actor: demoActors.client });
    check("Aprovar de novo não duplica", r2.decisionId === null && demoEventsFor(slug, item.id).length === 1 && front.front.approved_until === publishDay, "sem nova decisão, evento ou avanço");

    // A4: desfazer restaura tudo.
    await undoDecision(r1.decisionId!, demoActors.client);
    t = ops.tasks.find((x) => x.id === taskId)!;
    check("Desfazer restaura", (await getItem(item.id))!.status === "aguardando" && t.status === "Avaliação externa" && front.front.approved_until === frontBefore && demoEventsFor(slug, item.id).length === 0 && conteudo.status === conteudoBefore.status,
      `material ${(await getItem(item.id))!.status}, tarefa ${t.status}, frente ${front.front.approved_until}, conteúdo ${conteudo.status}`);
    void asClient;
  } finally {
    const n = await purgeExamples();
    const i = ops.tasks.findIndex((x) => x.id === taskId);
    if (i >= 0) ops.tasks.splice(i, 1);
    Object.assign(conteudo, conteudoBefore);
    front.front.approved_until = frontBefore;
    log({ name: "Limpeza", ok: countExamples() === 0, detail: `${n} registros de exemplo apagados; restam ${countExamples()}` });
  }
}

/** Lê o material como cliente (no exemplo, simulando a visão do cliente). */
async function getItemAs(id: string, who: "client" | "team") {
  const key = "reach_view_as_client";
  const prev = sessionStorage.getItem(key);
  if (who === "client") sessionStorage.setItem(key, "Fina Fragrância"); else sessionStorage.removeItem(key);
  try { return await getItem(id); } finally { if (prev) sessionStorage.setItem(key, prev); else sessionStorage.removeItem(key); }
}

function LikeDiagnostics() {
  const { session } = useAccess();
  const [steps, setSteps] = useState<Step[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (session && !session.isAdmin) return <EchoLayout env="like" eyebrow="Like" title="Diagnóstico"><div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState icon="lock" title="Só para administradores" /></div></EchoLayout>;
  const run = async () => {
    setSteps([]); setError(null); setRunning(true);
    try { await runEndToEnd((s) => setSteps((x) => [...x, s])); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setRunning(false); }
  };
  const passed = steps.length > 0 && !error && steps.every((s) => s.ok);
  return (
    <EchoLayout env="like" wide demoData eyebrow="Like · administração" title="Diagnóstico do Like">
      <div className="stack-lg">
        <section className="settings-section e-glass">
          <h2 className="e-h3" style={{ margin: 0 }}>Estrutura</h2>
          <p className="e-small" style={{ margin: 0 }}>{isDemoMode() ? "Modo demonstração: as regras rodam no motor em memória, igual às funções do banco." : "Criado pela migração 20260929150000_echo_like.sql."}</p>
          <div className="diag-grid">
            <div><span className="e-label">Tabelas</span>{TABLES.map((t) => <code key={t}>{t}</code>)}</div>
            <div><span className="e-label">Funções</span>{FUNCS.map((t) => <code key={t}>{t}</code>)}</div>
            <div><span className="e-label">Gatilhos</span>{TRIGGERS.map((t) => <code key={t}>{t}</code>)}</div>
          </div>
        </section>
        <section className="settings-section e-glass">
          <div className="e-row between wrap" style={{ gap: 10 }}>
            <div><h2 className="e-h3" style={{ margin: 0 }}>Teste ponta a ponta</h2><p className="e-small" style={{ margin: "4px 0 0" }}>Criar → enviar → comentar → pedir ajuste → nova versão → aprovar → aprovar de novo → desfazer. Confere tarefa, conteúdo, cobertura e agenda, e apaga os dados de teste.</p></div>
            <Button icon="play" loading={running} onClick={run} disabled={!isDemoMode()} title={isDemoMode() ? undefined : "Com o banco, rode o teste pelo SQL da migração"}>Rodar teste</Button>
          </div>
          {steps.length > 0 && <ol className="diag-steps">{steps.map((s, i) => <li key={i} className={s.ok ? "ok" : "fail"}><Icon name={s.ok ? "checkCircle" : "xCircle"} size="sm" /><b>{s.name}</b><span className="e-caption">{s.detail}</span></li>)}</ol>}
          {error && <p className="diag-error" role="alert">{error}</p>}
          {passed && <Badge tone="done" icon="checkCircle">Todas as regras passaram e nenhum registro de exemplo ficou</Badge>}
          {!isDemoMode() && <p className="e-caption" style={{ margin: 0 }}>Com o Supabase conectado, este botão fica desativado para não gravar em produção; as mesmas regras estão nas funções <code>like_decide</code> e <code>like_undo</code>.</p>}
        </section>
        <Link to="/" className="e-link"><Icon name="chevLeft" size="sm" /> Voltar ao Echo</Link>
      </div>
    </EchoLayout>
  );
}
