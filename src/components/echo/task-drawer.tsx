// ---------------------------------------------------------------------------
// Echo · Tarefa do Workspace em Drawer (abre sem sair da página)
// ---------------------------------------------------------------------------
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge, Button } from "./primitives";
import { Checkbox, Field, Menu, Select, Switch, TextArea, Tooltip } from "./controls";
import { Drawer } from "./overlays";
import { Icon } from "./icon";
import { WORK_TONE } from "./blocks";
import { WORK_STATUSES, type WorkStatus } from "@/lib/workspace-data";
import { daysSince, isLateTask, listTaskReviews, patchTask, setTaskStatus, type OpsTask, type TaskPatch } from "@/lib/ops-data";
import { listPickable } from "@/lib/team-data";

export function StatusMenu({ task, onChanged, size = "sm" }: { task: OpsTask; onChanged: () => void; size?: "sm" | "md" }) {
  return (
    <Menu align="right" trigger={({ toggle }) => (
      <button type="button" className={`status-trigger ${size}`} onClick={(e) => { e.stopPropagation(); toggle(); }} aria-label={`Etapa: ${task.status}. Mudar etapa`}>
        <Badge tone={WORK_TONE[task.status] ?? "todo"} dot>{task.status}</Badge><Icon name="chevDown" size="sm" />
      </button>
    )} items={[
      { title: "Mover para" },
      ...WORK_STATUSES.map((s) => {
        const blocked = task.status === "Avaliação externa" && s === "Concluído";
        return { label: blocked ? "Concluído · decisão do cliente no Like" : s, icon: s === task.status ? ("check" as const) : blocked ? ("lock" as const) : undefined, disabled: s === task.status || blocked, onSelect: async () => {
          try { await setTaskStatus(task.id, s as WorkStatus, { from: task.status }); toast.success(`Movida para ${s}`, { description: task.title }); onChanged(); }
          catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível mudar a etapa."); }
        } };
      }),
    ]} />
  );
}

export function TaskDrawer({ task, onClose, onChanged }: { task: OpsTask | null; onClose: () => void; onChanged: () => void }) {
  type Draft = { owner: string; due: string; note: string; time: string; location: string; urgency: string; highlighted: boolean; pinned: boolean; requiresReview: boolean; reviewChecklist: string; reviewText: string };
  const [d, setD] = useState<Draft | null>(null);
  const [more, setMore] = useState(false);
  const [checked, setChecked] = useState<string[]>([]);
  const [last, setLast] = useState<OpsTask | null>(null);
  const [saving, setSaving] = useState(false);
  if (task && task !== last) setLast(task);
  const t = task ?? last;
  const people = useQuery({ queryKey: ["people-pickable"], queryFn: listPickable, staleTime: 60_000 });
  const reviews = useQuery({ queryKey: ["task-reviews", t?.id, t?.status], queryFn: () => listTaskReviews(t!.id), enabled: !!t });
  const draftOf = (x: OpsTask): Draft => ({ owner: x.owner ?? "", due: x.due ?? "", note: x.note ?? "", time: x.time ?? "", location: x.location ?? "", urgency: x.urgency ?? "", highlighted: !!x.highlighted, pinned: !!x.pinned, requiresReview: !!x.requiresReview, reviewChecklist: x.reviewChecklist ?? "", reviewText: x.reviewText ?? "" });
  useEffect(() => { if (task) { setD(draftOf(task)); setMore(!!(task.time || task.location || task.requiresReview)); setChecked([]); } }, [task?.id]);
  if (!t || !d) return <Drawer open={false} onClose={onClose} title="" />;
  const dirty = !!task && JSON.stringify(d) !== JSON.stringify(draftOf(task));
  const checklist = d.reviewChecklist.split("\n").map((x) => x.trim()).filter(Boolean);
  const canSendLike = !!t.likeMaterial && ["Avaliação interna", "Ajuste", "Aguardando retorno externo"].includes(t.status);
  const idx = WORK_STATUSES.indexOf(t.status);
  const owners = [...new Set([...(people.data ?? []).map((p) => p.name), ...(t.owner ? [t.owner] : [])])];
  return (
    <Drawer open={!!task} onClose={onClose} eyebrow={`${t.brand.name}${t.frontName ? ` · ${t.frontName}` : ""}`} title={t.title}
      footer={<><Button variant="ghost" onClick={onClose}>Fechar</Button><Button icon="check" loading={saving} disabled={!dirty} onClick={async () => {
        setSaving(true);
        try { const p: TaskPatch = { owner: d.owner || null, due: d.due || null, note: d.note || null, time: d.time || null, location: d.location || null, urgency: d.urgency || null, highlighted: d.highlighted, pinned: d.pinned, requiresReview: d.requiresReview, reviewChecklist: d.reviewChecklist || null, reviewText: d.reviewText || null }; await patchTask(t.id, p); toast.success("Tarefa atualizada"); onChanged(); onClose(); }
        catch { toast.error("Não foi possível salvar."); } finally { setSaving(false); }
      }}>Salvar</Button></>}>
      <div className="drawer-actions">
        <StatusMenu task={t} onChanged={onChanged} size="md" />
        {isLateTask(t) && <Badge tone="late" dot>Atrasada</Badge>}
        {t.status === "Avaliação externa" && <Badge tone="glass" icon="heart">Com o cliente há {daysSince(t.since)} {daysSince(t.since) === 1 ? "dia" : "dias"}</Badge>}
        {t.likeMaterial && <Badge tone="glass" icon="heart">Vai para o Like · {t.likeMaterial}</Badge>}
      </div>
      <ol className="flow-steps" aria-label="Etapas">
        {WORK_STATUSES.map((s, i) => <li key={s} className={i < idx ? "done" : i === idx ? "now" : ""} title={s}><i />{i === idx && <span>{s}</span>}</li>)}
      </ol>
      <div className="grid-2" style={{ gap: 12 }}>
        <Select label="Responsável" value={d.owner} placeholder="Sem responsável" onChange={(v) => setD({ ...d, owner: v })} options={[{ value: "", label: "Sem responsável" }, ...owners.map((o) => ({ value: o, label: o }))]} icon="user" />
        <Field label="Prazo" type="date" value={d.due} onChange={(e) => setD({ ...d, due: e.target.value })} />
      </div>
      {t.sector && <span className="e-caption"><Icon name="grid" size="sm" /> Setor: {t.sector}</span>}
      <TextArea label="Observações" optional rows={3} value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} />
      <button type="button" className="plan-toggle" aria-expanded={more} onClick={() => setMore(!more)} style={{ justifySelf: "start" }}><Icon name={more ? "chevUp" : "chevDown"} size="sm" /> Mais detalhes</button>
      {more && <div className="e-stack" style={{ gap: 12 }}>
        <div className="grid-2" style={{ gap: 12 }}>
          <Field label="Horário" type="time" optional value={d.time} onChange={(e) => setD({ ...d, time: e.target.value })} />
          <Field label="Local" optional icon="pin" value={d.location} onChange={(e) => setD({ ...d, location: e.target.value })} />
          <Select label="Urgência" value={d.urgency} placeholder="Normal" onChange={(v) => setD({ ...d, urgency: v })} options={[{ value: "", label: "Normal" }, { value: "alta", label: "Alta" }, { value: "urgente", label: "Urgente" }]} />
        </div>
        <div className="e-row wrap" style={{ gap: 16 }}>
          <Switch checked={d.highlighted} onChange={(v) => setD({ ...d, highlighted: v })} label="Destacar" />
          <Switch checked={d.pinned} onChange={(v) => setD({ ...d, pinned: v })} label="Fixar no topo" />
          <Switch checked={d.requiresReview} onChange={(v) => setD({ ...d, requiresReview: v })} label="Requer avaliação" />
        </div>
        {d.requiresReview && <>
          <TextArea label="Checklist da avaliação" optional rows={3} help="Um item por linha. Aparece para quem avalia." value={d.reviewChecklist} onChange={(e) => setD({ ...d, reviewChecklist: e.target.value })} />
          {checklist.length > 0 && <div className="e-stack" style={{ gap: 4 }}>{checklist.map((c) => <Checkbox key={c} checked={checked.includes(c)} onChange={(v) => setChecked(v ? [...checked, c] : checked.filter((x) => x !== c))} label={c} />)}</div>}
          <TextArea label="Texto da avaliação" optional rows={2} value={d.reviewText} onChange={(e) => setD({ ...d, reviewText: e.target.value })} />
        </>}
        {(t.attachments ?? []).length > 0 && <div className="e-row wrap" style={{ gap: 6 }}>{t.attachments!.map((a) => <a key={a.url} className="e-chip" href={a.url} target="_blank" rel="noreferrer"><Icon name="paperclip" size="sm" /> {a.name}</a>)}</div>}
      </div>}
      {t.likeMaterial && <div className="like-send">
        <Icon name="heart" />
        <span className="e-grow"><b>Material para aprovação</b><span className="e-caption" style={{ display: "block" }}>{canSendLike ? "Passou pela avaliação interna: pode seguir para o cliente." : "Fica disponível depois da avaliação interna."}</span></span>
        <Tooltip text="O envio abre no Like"><span><Button size="sm" icon="send" disabled>Enviar para aprovação</Button></span></Tooltip>
      </div>}
      {(reviews.data ?? []).length > 0 && <div className="e-stack" style={{ gap: 6 }}>
        <span className="e-label">Histórico de avaliações</span>
        {reviews.data!.map((r) => (
          <div key={r.id} className={`review-log ${r.decision}`}>
            <b>{r.scope === "externa_excecao" ? "Aprovado pelo cliente por outro canal" : r.scope === "externa" ? (r.decision === "aprovado" ? "Cliente aprovou" : "Cliente pediu ajustes") : r.decision === "aprovado" ? "Aprovado internamente" : "Ajuste pedido internamente"}</b>
            <span className="e-caption">{r.reviewer ?? "Equipe"} · {new Date(r.at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
            {r.phrases.length > 0 && <span className="e-row wrap" style={{ gap: 4 }}>{r.phrases.map((p) => <span key={p} className="member-tag">{p}</span>)}</span>}
            {r.comment && <p>{r.comment}</p>}
          </div>
        ))}
      </div>}
      <Link to={`/workspace/cliente/${t.brand.slug}` as never} className="e-btn ghost sm" style={{ justifySelf: "start" }}><Icon name="external" size="sm" /> Abrir operação de {t.brand.name}</Link>
    </Drawer>
  );
}
