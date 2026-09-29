// ---------------------------------------------------------------------------
// Echo · Tarefa do Workspace em Drawer (abre sem sair da página)
// ---------------------------------------------------------------------------
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge, Button } from "./primitives";
import { Field, Menu, Select, TextArea } from "./controls";
import { Drawer } from "./overlays";
import { Icon } from "./icon";
import { WORK_TONE } from "./blocks";
import { WORK_STATUSES, type WorkStatus } from "@/lib/workspace-data";
import { daysSince, isLateTask, patchTask, setTaskStatus, type OpsTask } from "@/lib/ops-data";
import { listPickable } from "@/lib/team-data";

export function StatusMenu({ task, onChanged, size = "sm" }: { task: OpsTask; onChanged: () => void; size?: "sm" | "md" }) {
  return (
    <Menu align="right" trigger={({ toggle }) => (
      <button type="button" className={`status-trigger ${size}`} onClick={(e) => { e.stopPropagation(); toggle(); }} aria-label={`Etapa: ${task.status}. Mudar etapa`}>
        <Badge tone={WORK_TONE[task.status] ?? "todo"} dot>{task.status}</Badge><Icon name="chevDown" size="sm" />
      </button>
    )} items={[
      { title: "Mover para" },
      ...WORK_STATUSES.map((s) => ({ label: s, icon: s === task.status ? ("check" as const) : undefined, disabled: s === task.status, onSelect: async () => { await setTaskStatus(task.id, s as WorkStatus); toast.success(`Movida para ${s}`, { description: task.title }); onChanged(); } })),
    ]} />
  );
}

export function TaskDrawer({ task, onClose, onChanged }: { task: OpsTask | null; onClose: () => void; onChanged: () => void }) {
  const [d, setD] = useState<{ owner: string; due: string; note: string } | null>(null);
  const [last, setLast] = useState<OpsTask | null>(null);
  const [saving, setSaving] = useState(false);
  if (task && task !== last) setLast(task);
  const t = task ?? last;
  const people = useQuery({ queryKey: ["people-pickable"], queryFn: listPickable, staleTime: 60_000 });
  useEffect(() => { if (task) setD({ owner: task.owner ?? "", due: task.due ?? "", note: task.note ?? "" }); }, [task?.id]);
  if (!t || !d) return <Drawer open={false} onClose={onClose} title="" />;
  const dirty = !!task && (d.owner !== (task.owner ?? "") || d.due !== (task.due ?? "") || d.note !== (task.note ?? ""));
  const idx = WORK_STATUSES.indexOf(t.status);
  const owners = [...new Set([...(people.data ?? []).map((p) => p.name), ...(t.owner ? [t.owner] : [])])];
  return (
    <Drawer open={!!task} onClose={onClose} eyebrow={`${t.brand.name}${t.frontName ? ` · ${t.frontName}` : ""}`} title={t.title}
      footer={<><Button variant="ghost" onClick={onClose}>Fechar</Button><Button icon="check" loading={saving} disabled={!dirty} onClick={async () => {
        setSaving(true);
        try { await patchTask(t.id, { owner: d.owner || null, due: d.due || null, note: d.note || null }); toast.success("Tarefa atualizada"); onChanged(); onClose(); }
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
      <TextArea label="Observações" optional rows={4} value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} />
      <Link to={`/workspace/cliente/${t.brand.slug}` as never} className="e-btn ghost sm" style={{ justifySelf: "start" }}><Icon name="external" size="sm" /> Abrir operação de {t.brand.name}</Link>
    </Drawer>
  );
}
