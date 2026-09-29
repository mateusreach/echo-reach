import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Avatar, Badge, Button, ClientLogo, EmptyState, Skeleton } from "@/components/echo/primitives";
import { Checkbox, Chip, LineTabs, TextArea } from "@/components/echo/controls";
import { Modal } from "@/components/echo/overlays";
import { Icon } from "@/components/echo/icon";
import { TaskDrawer } from "@/components/echo/task-drawer";
import { useAccess } from "@/components/echo/session";
import { REVIEW_PHRASES } from "@/lib/workspace-data";
import { daysSince, listOpsTasks, registerOutsideApproval, remindClient, submitInternalReview, type OpsTask } from "@/lib/ops-data";
import { loadIdentity } from "@/lib/brand-settings-data";

export const Route = createFileRoute("/workspace/avaliacoes")({
  head: () => ({ meta: [{ title: "Avaliações · Workspace · Echo" }, { name: "description", content: "Avaliação interna da equipe e materiais com o cliente." }] }),
  component: Reviews,
});

type Tab = "interna" | "cliente";
const ADJUST = ["Ajustar texto", "Ajustar informação", "Ajustar estratégia", "Ajustar CTA", "Rever briefing", "Rever formato", "Falta informação", "Precisa complementar"];
const FORMAT_OF: Record<string, string> = { carrossel: "carrossel", post: "estatico", peca: "estatico", stories: "stories", video: "stories" };

function Reviews() {
  const qc = useQueryClient();
  const { session } = useAccess();
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("interna");
  const [open, setOpen] = useState<string | null>(null);
  const [outside, setOutside] = useState<OpsTask | null>(null);
  useEffect(() => setReady(true), []);
  const q = useQuery({ queryKey: ["ops-tasks"], queryFn: listOpsTasks, enabled: ready });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["ops-tasks"] }); qc.invalidateQueries({ queryKey: ["task-reviews"] }); };
  if (!ready || q.isLoading) return <div className="stack-lg"><Skeleton h={44} r={14} /><Skeleton h={300} r={22} /></div>;
  if (q.isError) return <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState kind="error" title="Não foi possível carregar as avaliações" actions={<Button variant="secondary" icon="refresh" onClick={() => q.refetch()}>Tentar novamente</Button>} /></div>;
  const all = q.data ?? [];
  const internal = all.filter((t) => t.status === "Avaliação interna");
  const external = all.filter((t) => t.status === "Avaliação externa").sort((a, b) => daysSince(b.since) - daysSince(a.since));

  return (
    <div className="stack-lg">
      <LineTabs<Tab> value={tab} onChange={setTab} items={[{ value: "interna", label: `Avaliação interna · ${internal.length}`, icon: "eye" }, { value: "cliente", label: `Com o cliente · ${external.length}`, icon: "heart" }]} />
      {tab === "interna" && (internal.length === 0
        ? <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState icon="checkCircle" title="Nada esperando avaliação interna" text="Quando alguém mover uma tarefa para Avaliação interna, ela aparece aqui." /></div>
        : <div className="stack">{internal.map((t) => <ReviewCard key={t.id} task={t} onOpen={() => setOpen(t.id)} onDone={refresh} />)}</div>)}
      {tab === "cliente" && (
        <div className="stack">
          <p className="e-small" style={{ margin: 0 }}><Icon name="lock" size="sm" /> A decisão é do cliente, no Like. Aqui a equipe acompanha e lembra quem precisa decidir.</p>
          {external.length === 0 ? <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState icon="heart" title="Nada com o cliente agora" /></div> : external.map((t) => (
            <div key={t.id} className="ops-row" role="button" tabIndex={0} onClick={() => setOpen(t.id)} onKeyDown={(e) => e.key === "Enter" && setOpen(t.id)}>
              <ClientLogo name={t.brand.name} size="sm" />
              <span className="e-grow" style={{ minWidth: 0 }}><b className="e-ellipsis" style={{ display: "block" }}>{t.title}</b><span className="e-caption">{t.brand.name}{t.frontName ? ` · ${t.frontName}` : ""} · no Like: aguardando decisão</span></span>
              <Badge tone={daysSince(t.since) >= 2 ? "late" : "review"}>há {daysSince(t.since)} {daysSince(t.since) === 1 ? "dia" : "dias"}</Badge>
              <span className="e-row" style={{ gap: 4 }} onClick={(e) => e.stopPropagation()}>
                <Button size="sm" variant={t.remindedAt ? "ghost" : "secondary"} icon={t.remindedAt ? "check" : "bell"} disabled={!!t.remindedAt} onClick={async () => { await remindClient(t); toast.success("Lembrete enviado", { description: t.brand.name }); refresh(); }}>{t.remindedAt ? "Lembrado" : "Lembrar cliente"}</Button>
                {session?.isAdmin && <Button size="sm" variant="ghost" icon="more" aria-label="Registrar aprovação por outro canal" title="Registrar aprovação por outro canal" onClick={() => setOutside(t)} />}
              </span>
            </div>
          ))}
        </div>
      )}
      <TaskDrawer task={all.find((t) => t.id === open) ?? null} onClose={() => setOpen(null)} onChanged={refresh} />
      <OutsideApproval task={outside} onClose={() => setOutside(null)} onDone={refresh} />
    </div>
  );
}

function ReviewCard({ task: t, onOpen, onDone }: { task: OpsTask; onOpen: () => void; onDone: () => void }) {
  const identity = useQuery({ queryKey: ["identity", t.brand.slug], queryFn: () => loadIdentity(t.brand.slug, t.brand.id), staleTime: 60_000 });
  const format = t.likeMaterial ? FORMAT_OF[t.likeMaterial] : null;
  const models = (identity.data?.channels ?? []).filter((c) => c.active).flatMap((c) => c.models.filter((m) => m.status !== "inativo" && (!format || m.format === format)));
  const modelItems = [...new Set(models.flatMap((m) => (m.carousel_required_elements ?? "").split("\n").map((x) => x.trim()).filter(Boolean)))];
  const taskItems = (t.reviewChecklist ?? "").split("\n").map((x) => x.trim()).filter(Boolean);
  const items = [...taskItems.map((i) => ({ item: i, from: "tarefa" })), ...modelItems.map((i) => ({ item: i, from: "modelo" }))];
  const [checked, setChecked] = useState<string[]>([]);
  const [phrases, setPhrases] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<"aprovado" | "ajuste" | null>(null);
  const toggle = (p: string) => setPhrases((x) => (x.includes(p) ? x.filter((y) => y !== p) : [...x, p]));
  const decide = async (decision: "aprovado" | "ajuste") => {
    if (decision === "ajuste" && !phrases.some((p) => ADJUST.includes(p)) && !comment.trim()) { toast.error("Diga o que ajustar: escolha uma frase ou escreva um comentário."); return; }
    setBusy(decision);
    try {
      const next = await submitInternalReview(t, { decision, phrases, comment, checklist: items.map((i) => ({ item: i.item, ok: checked.includes(i.item) })) });
      toast.success(decision === "ajuste" ? "Ajuste pedido" : next === "Avaliação externa" ? "Aprovado e enviado ao cliente no Like" : "Aprovado e concluído", { description: t.title });
      onDone();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível registrar."); } finally { setBusy(null); }
  };
  return (
    <article className="review-card e-glass">
      <header className="e-row" style={{ gap: 10 }}>
        <ClientLogo name={t.brand.name} size="sm" />
        <span className="e-grow" style={{ minWidth: 0 }}><button type="button" className="e-link" onClick={onOpen} style={{ fontSize: 15, fontWeight: 600 }}>{t.title}</button><span className="e-caption" style={{ display: "block" }}>{t.brand.name}{t.frontName ? ` · ${t.frontName}` : ""}{t.owner ? ` · feito por ${t.owner}` : ""}</span></span>
        {t.likeMaterial ? <Badge tone="glass" icon="heart">Vai para o Like · {t.likeMaterial}</Badge> : <Badge tone="glass">Conclui ao aprovar</Badge>}
      </header>
      <div className="review-body">
        <div className="review-preview">
          <span className={`review-frame ${format ?? "estatico"}`}><Icon name="image" /><small>Prévia do material</small></span>
          {(t.attachments ?? []).map((a) => <a key={a.url} className="e-chip" href={a.url} target="_blank" rel="noreferrer"><Icon name="paperclip" size="sm" /> {a.name}</a>)}
          {t.owner && <span className="e-row" style={{ gap: 6 }}><Avatar name={t.owner} size="xs" /><span className="e-caption">{t.owner}</span></span>}
        </div>
        <div className="e-stack" style={{ gap: 12 }}>
          {items.length > 0 && <div className="e-stack" style={{ gap: 4 }}>
            <span className="e-label">Checklist</span>
            {items.map((i) => <Checkbox key={i.item} checked={checked.includes(i.item)} onChange={(v) => setChecked(v ? [...checked, i.item] : checked.filter((x) => x !== i.item))} label={<span>{i.item} <span className="e-caption">· {i.from === "modelo" ? "modelo de peça" : "tarefa"}</span></span>} />)}
          </div>}
          <div className="e-stack" style={{ gap: 6 }}>
            <span className="e-label">Frases rápidas</span>
            <div className="e-row wrap" style={{ gap: 6 }}>{REVIEW_PHRASES.map((p) => <Chip key={p} pressed={phrases.includes(p)} onClick={() => toggle(p)}>{p}</Chip>)}</div>
          </div>
          <TextArea label="Comentário" optional rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
          <div className="e-row" style={{ gap: 8, justifyContent: "flex-end" }}>
            <Button variant="secondary" icon="edit" loading={busy === "ajuste"} disabled={!!busy} onClick={() => decide("ajuste")}>Pedir ajuste</Button>
            <Button icon={t.likeMaterial ? "send" : "check"} loading={busy === "aprovado"} disabled={!!busy} onClick={() => decide("aprovado")}>{t.likeMaterial ? "Aprovar e enviar ao cliente" : "Aprovar e concluir"}</Button>
          </div>
        </div>
      </div>
    </article>
  );
}

function OutsideApproval({ task, onClose, onDone }: { task: OpsTask | null; onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setText(""), [task?.id]);
  return (
    <Modal open={!!task} onClose={onClose} icon="alert" tone="soft" title="Aprovado por outro canal?" sub={task?.title}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={busy} disabled={text.trim().length < 10} onClick={async () => { if (!task) return; setBusy(true); try { await registerOutsideApproval(task, text); toast.success("Aprovação registrada com justificativa"); onDone(); onClose(); } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível registrar."); } finally { setBusy(false); } }}>Registrar e concluir</Button></>}>
      <p className="e-small" style={{ margin: "0 0 10px" }}>Use só quando o cliente aprovou fora do Echo (por exemplo, em uma reunião). O registro fica no histórico, com o seu nome.</p>
      <TextArea label="Justificativa" rows={3} value={text} autoFocus help="Como, quando e com quem foi a aprovação." onChange={(e) => setText(e.target.value)} />
    </Modal>
  );
}
