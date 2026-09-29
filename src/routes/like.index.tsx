import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { isViewingAsClient, viewingAsClientBrandName } from "@/lib/view-as";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { EchoLayout } from "@/components/echo/layout";
import { Badge, Button, ClientLogo, EmptyState, Skeleton, type Tone } from "@/components/echo/primitives";
import { Icon } from "@/components/echo/icon";
import { useAccess } from "@/components/echo/session";
import { KIND_LABEL, STATUS_LABEL, listItems, listRounds, type ItemStatus } from "@/lib/like-data";
import { listSpaces } from "@/lib/space-data";

export const Route = createFileRoute("/like/")({
  head: () => ({ meta: [{ title: "Like · Echo" }, { name: "description", content: "Aprovação de materiais com o cliente." }] }),
  component: LikeHome,
});

export const LIKE_TONE: Record<ItemStatus, Tone> = { rascunho: "draft", aguardando: "review", em_revisao: "review", aprovado: "approved", ajustes: "adjust", nova_versao: "doing", reprovado: "late", agendado: "approved", publicado: "done", cancelado: "blocked" };

function LikeHome() {
  const { isTeam } = useAccess();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  // Cliente (ou "ver como cliente") vai direto para a própria caixa de aprovação.
  const asClient = ready && (!isTeam || isViewingAsClient());
  const clientSpaces = useQuery({ queryKey: ["spaces", "client-box"], queryFn: listSpaces, enabled: asClient });
  useEffect(() => { const list = clientSpaces.data?.spaces ?? []; const first = list.find((s) => s.name === viewingAsClientBrandName()) ?? list[0]; if (asClient && first) navigate({ to: `/like/${first.slug}` as never, replace: true }); }, [asClient, clientSpaces.data]);
  const rounds = useQuery({ queryKey: ["like-rounds", "all"], queryFn: () => listRounds(), enabled: ready });
  const items = useQuery({ queryKey: ["like-items", "all"], queryFn: () => listItems(), enabled: ready });
  const spaces = useQuery({ queryKey: ["spaces"], queryFn: listSpaces, enabled: ready && !!isTeam });
  if (!ready || rounds.isLoading || items.isLoading) return <EchoLayout env="like" wide demoData eyebrow="Like" title="Aprovações"><div className="stack-lg"><Skeleton h={120} r={24} /><Skeleton h={320} r={24} /></div></EchoLayout>;
  const all = items.data ?? [];
  const adjust = all.filter((i) => i.status === "ajustes");
  const waiting = all.filter((i) => ["aguardando", "em_revisao", "nova_versao"].includes(i.status));
  const drafts = all.filter((i) => i.status === "rascunho");
  return (
    <EchoLayout env="like" wide demoData eyebrow="Like" title="Aprovações" titleAside={isTeam ? <Link to={"/like/painel" as never} className="e-btn primary sm"><Icon name="kanban" size="sm" /> Painel da agência</Link> : undefined}>
      <div className="stack-lg">
        <div className="stat-row four">
          <div className="stat-tile e-glass"><span className="e-kpi tnum">{waiting.length}</span><span className="stat-lbl">com o cliente</span></div>
          <div className="stat-tile e-glass"><span className="e-kpi tnum" style={{ color: "var(--warn)" }}>{adjust.length}</span><span className="stat-lbl">ajustes pedidos</span></div>
          <div className="stat-tile e-glass"><span className="e-kpi tnum">{all.filter((i) => ["aprovado", "agendado"].includes(i.status)).length}</span><span className="stat-lbl">aprovados para publicar</span></div>
          <div className="stat-tile e-glass"><span className="e-kpi tnum">{drafts.length}</span><span className="stat-lbl">rascunhos internos</span></div>
        </div>
        {isTeam && (spaces.data?.spaces ?? []).length > 0 && (
          <section className="settings-section e-glass">
            <h2 className="e-h3" style={{ margin: 0 }}>Enviar materiais</h2>
            <div className="e-row wrap" style={{ gap: 8 }}>
              {spaces.data!.spaces.map((s) => <Link key={s.slug} to={`/like/${s.slug}/enviar` as never} className="e-btn secondary sm"><ClientLogo name={s.name} size="sm" /> {s.name}</Link>)}
            </div>
          </section>
        )}
        {adjust.length > 0 && isTeam && (
          <section className="settings-section e-glass">
            <h2 className="e-h3" style={{ margin: 0 }}>Ajustes para fazer</h2>
            {adjust.map((i) => (
              <div key={i.id} className="ops-row" style={{ cursor: "default" }}>
                <ClientLogo name={i.brandName} size="sm" />
                <span className="e-grow" style={{ minWidth: 0 }}><b className="e-ellipsis" style={{ display: "block" }}>{i.title}</b><span className="e-caption">{i.brandName} · {KIND_LABEL[i.kind]} · {i.comments.filter((c) => !c.resolvedAt && !c.internal && c.authorKind !== "agency").length} pedidos em aberto</span></span>
                <Link to={`/like/${i.brandSlug}/enviar?item=${i.id}` as never} className="e-btn primary sm"><Icon name="refresh" size="sm" /> Nova versão</Link>
              </div>
            ))}
          </section>
        )}
        <section className="settings-section e-glass">
          <h2 className="e-h3" style={{ margin: 0 }}>Rodadas</h2>
          {(rounds.data ?? []).length === 0 ? <EmptyState compact icon="heart" title="Nenhuma rodada ainda" /> : (rounds.data ?? []).map((r) => (
            <div key={r.id} className="round-row">
              <ClientLogo name={r.brandName} size="sm" />
              <span className="e-grow" style={{ minWidth: 0 }}><b className="e-ellipsis" style={{ display: "block" }}>{r.title}</b><span className="e-caption">{r.brandName} · {r.total} {r.total === 1 ? "material" : "materiais"}{r.dueAt ? ` · decidir até ${new Date(r.dueAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}` : ""}</span></span>
              <span className="e-row wrap" style={{ gap: 4 }}>{Object.entries(r.counts).map(([k, n]) => <Badge key={k} tone={LIKE_TONE[k as ItemStatus]}>{n} {STATUS_LABEL[k as ItemStatus].toLowerCase()}</Badge>)}</span>
              <Badge tone={r.status === "concluida" ? "done" : r.status === "vencida" ? "late" : r.status === "cancelada" ? "blocked" : "doing"} dot>{r.status === "aberta" ? "Aberta" : r.status === "concluida" ? "Concluída" : r.status === "vencida" ? "Vencida" : "Cancelada"}</Badge>
            </div>
          ))}
        </section>
        {isTeam && <Link to="/like/diagnostico" className="e-link" style={{ fontSize: 13 }}><Icon name="sliders" size="sm" /> Diagnóstico do Like</Link>}
        {!isTeam && <Button variant="secondary" disabled>Caixa do cliente</Button>}
      </div>
    </EchoLayout>
  );
}
