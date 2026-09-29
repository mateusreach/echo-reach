import { createFileRoute, Link } from "@tanstack/react-router";
import { LoadFailed } from "@/components/echo/blocks";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge, Button, EmptyState, Skeleton } from "@/components/echo/primitives";
import { Field, Menu, Select, Switch } from "@/components/echo/controls";
import { Drawer, Modal } from "@/components/echo/overlays";
import { Icon } from "@/components/echo/icon";
import { Panel } from "@/components/echo/blocks";
import { useAccess } from "@/components/echo/session";
import { WORK_STATUSES } from "@/lib/workspace-data";
import {
  EXEC_KINDS, MATERIAL_TYPES, addSector, listExecTemplates, listSectorsFull, removeExecTemplate, removeSector, renameSector, reorderSectors, saveExecTemplate,
  type ExecItem, type ExecTemplate, type MaterialType, type Sector,
} from "@/lib/settings-data";

export const Route = createFileRoute("/workspace/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações · Workspace · Echo" }, { name: "description", content: "Etapas oficiais, modelos de execução e setores da operação." }] }),
  component: WorkspaceSettings,
});

const kindLabel = (k: string) => EXEC_KINDS.find((x) => x.value === k)?.label ?? k;
const materialLabel = (m?: string | null) => MATERIAL_TYPES.find((x) => x.value === m)?.label ?? "Material";

function WorkspaceSettings() {
  const qc = useQueryClient();
  const { session, can } = useAccess();
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState<ExecTemplate | "new" | null>(null);
  useEffect(() => setReady(true), []);
  const templates = useQuery({ queryKey: ["exec-templates"], queryFn: listExecTemplates, enabled: ready });
  const sectors = useQuery({ queryKey: ["sectors"], queryFn: listSectorsFull, enabled: ready });
  const canEdit = !!session?.isAdmin || can("configuracoes.administrar") || can("modelos.editar");

  if (!ready || templates.isLoading || sectors.isLoading) return <div className="stack-lg"><Skeleton h={110} r={22} /><Skeleton h={320} r={22} /></div>;
  if (templates.isError || sectors.isError) return <LoadFailed what="as configurações" onRetry={() => { templates.refetch(); sectors.refetch(); }} />;

  return (
    <div className="stack-lg">
      <Panel title="Etapas oficiais" icon="checks" tone="var(--env-workspace)" action={<Link to="/agencia/configuracoes" className="e-link" style={{ fontSize: 13 }}>Configurações da agência <Icon name="arrowRight" size="sm" /></Link>}>
        <ol className="stage-flow">
          {WORK_STATUSES.map((s, i) => (
            <li key={s} className={s === "Avaliação externa" ? "like" : undefined}>
              <span className="tnum">{i + 1}</span>{s}
              {s === "Avaliação externa" && <small><Icon name="heart" size="sm" /> gera material no Like</small>}
            </li>
          ))}
        </ol>
      </Panel>

      <div className="grid-2 ws-settings">
        <Panel title="Modelos de execução" icon="kanban" count={templates.data?.length ?? 0} tone="var(--env-workspace)" action={canEdit ? <Button size="sm" icon="plus" onClick={() => setEditing("new")}>Novo modelo</Button> : undefined}>
          {(templates.data ?? []).length === 0 ? <EmptyState compact icon="kanban" title="Nenhum modelo" text="Modelos criam de uma vez as demandas de um ciclo que se repete." /> : (
            <div className="now-list">
              {templates.data!.map((t) => {
                const like = t.tasks.filter((x) => x.like_approval).length;
                return (
                  <button key={t.id} type="button" className="exec-row" onClick={() => setEditing(t)}>
                    <span className="e-grow" style={{ minWidth: 0 }}>
                      <b className="e-ellipsis" style={{ display: "block" }}>{t.name}</b>
                      <span className="e-caption">{kindLabel(t.kind)} · {t.tasks.length} {t.tasks.length === 1 ? "demanda" : "demandas"}</span>
                    </span>
                    {like > 0 && <Badge tone="glass" icon="heart">{like} no Like</Badge>}
                    <Icon name="chevRight" size="sm" />
                  </button>
                );
              })}
            </div>
          )}
        </Panel>
        <SectorsPanel sectors={sectors.data ?? []} canEdit={canEdit} onChanged={() => { qc.invalidateQueries({ queryKey: ["sectors"] }); qc.invalidateQueries({ queryKey: ["exec-templates"] }); }} />
      </div>

      <ExecEditor template={editing} sectors={sectors.data ?? []} canEdit={canEdit} onClose={() => setEditing(null)} onSaved={() => { qc.invalidateQueries({ queryKey: ["exec-templates"] }); setEditing(null); }} />
    </div>
  );
}

function SectorsPanel({ sectors, canEdit, onChanged }: { sectors: Sector[]; canEdit: boolean; onChanged: () => void }) {
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState<{ s: Sector; name: string } | null>(null);
  const [removing, setRemoving] = useState<Sector | null>(null);
  const add = async () => {
    const n = name.trim();
    if (!n) return;
    try { await addSector(n, sectors.length + 1); setName(""); toast.success("Setor criado", { description: n }); onChanged(); } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível criar."); }
  };
  const moveTo = async (i: number, to: number) => { const next = [...sectors]; const [x] = next.splice(i, 1); next.splice(to, 0, x); await reorderSectors(next); onChanged(); };
  return (
    <Panel title="Setores" icon="grid" count={sectors.length} tone="var(--env-brand)">
      <div className="e-stack" style={{ gap: 6 }}>
        {sectors.map((s, i) => (
          <div key={s.id} className="sector-row">
            {renaming?.s.id === s.id ? (
              <form className="e-row e-grow" style={{ gap: 6 }} onSubmit={async (e) => { e.preventDefault(); const n = renaming.name.trim(); if (!n || n === s.name) { setRenaming(null); return; } try { await renameSector(s, n); toast.success("Setor renomeado", { description: "Tarefas e modelos acompanham o novo nome." }); setRenaming(null); onChanged(); } catch { toast.error("Não foi possível renomear."); } }}>
                <input className="e-input sm e-grow" autoFocus value={renaming.name} aria-label="Novo nome do setor" onChange={(e) => setRenaming({ s, name: e.target.value })} onKeyDown={(e) => e.key === "Escape" && setRenaming(null)} />
                <Button size="sm" type="submit" icon="check" aria-label="Salvar nome" />
              </form>
            ) : (
              <>
                <span className="tnum sector-n">{i + 1}</span>
                <span className="e-grow"><b>{s.name}</b> <span className="e-caption">{s.tasks} {s.tasks === 1 ? "tarefa" : "tarefas"}</span></span>
                {canEdit && (
                  <Menu align="right" trigger={({ toggle }) => <Button size="sm" variant="ghost" icon="more" aria-label={`Ações de ${s.name}`} onClick={toggle} />} items={[
                    { label: "Renomear", icon: "edit", onSelect: () => setRenaming({ s, name: s.name }) },
                    { label: "Subir", icon: "chevUp", disabled: i === 0, onSelect: () => moveTo(i, i - 1) },
                    { label: "Descer", icon: "chevDown", disabled: i === sectors.length - 1, onSelect: () => moveTo(i, i + 1) },
                    "-",
                    { label: "Excluir", icon: "trash", danger: true, onSelect: () => setRemoving(s) },
                  ]} />
                )}
              </>
            )}
          </div>
        ))}
        {sectors.length === 0 && <span className="e-caption">Nenhum setor cadastrado.</span>}
        {canEdit && (
          <form className="e-row" style={{ gap: 6, marginTop: 6 }} onSubmit={(e) => { e.preventDefault(); add(); }}>
            <input className="e-input sm e-grow" value={name} placeholder="Novo setor (ex.: Design)" aria-label="Nome do novo setor" onChange={(e) => setName(e.target.value)} />
            <Button size="sm" variant="secondary" icon="plus" type="submit" disabled={!name.trim()}>Adicionar</Button>
          </form>
        )}
      </div>
      <Modal open={!!removing} onClose={() => setRemoving(null)} icon="trash" tone="danger" title="Excluir este setor?" sub={removing?.name}
        footer={<><Button variant="secondary" onClick={() => setRemoving(null)}>Cancelar</Button><Button variant="danger" onClick={async () => { if (!removing) return; await removeSector(removing.id); toast.success("Setor excluído"); setRemoving(null); onChanged(); }}>Excluir setor</Button></>}>
        <p className="e-small" style={{ margin: 0 }}>{removing?.tasks ? `As ${removing.tasks} tarefas deste setor continuam existindo e mantêm o nome antigo. ` : ""}Ele só deixa de aparecer nas opções.</p>
      </Modal>
    </Panel>
  );
}

function ExecEditor({ template, sectors, canEdit, onClose, onSaved }: { template: ExecTemplate | "new" | null; sectors: Sector[]; canEdit: boolean; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState("content_cycle");
  const [items, setItems] = useState<ExecItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const t = template === "new" ? null : template;
  useEffect(() => {
    if (!template) return;
    setName(t?.name ?? ""); setKind(t?.kind ?? "content_cycle"); setErr(null);
    setItems(t ? t.tasks.map((x) => ({ ...x })) : [{ title: "", sector: sectors[0]?.name ?? null, days_before: 0 }]);
  }, [template]);
  const patch = (i: number, p: Partial<ExecItem>) => setItems((l) => l.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const move = (i: number, to: number) => setItems((l) => { const n = [...l]; const [x] = n.splice(i, 1); n.splice(to, 0, x); return n; });
  const sectorOpts = [{ value: "", label: "Sem setor" }, ...sectors.map((s) => ({ value: s.name, label: s.name })), ...items.filter((i) => i.sector && !sectors.some((s) => s.name === i.sector)).map((i) => ({ value: i.sector!, label: `${i.sector} (antigo)` }))];
  const ro = !canEdit;

  const save = async () => {
    if (!name.trim()) { setErr("Dê um nome ao modelo."); return; }
    if (!items.some((i) => i.title.trim())) { toast.error("Inclua pelo menos uma demanda."); return; }
    setSaving(true);
    try { await saveExecTemplate(t?.id ?? null, { name: name.trim(), kind, tasks: items }); toast.success(t ? "Modelo salvo" : "Modelo criado", { description: name }); onSaved(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível salvar."); }
    finally { setSaving(false); }
  };

  return (
    <>
      <Drawer open={!!template} onClose={onClose} eyebrow="Modelo de execução" title={t?.name ?? "Novo modelo"}
        footer={canEdit ? <>{t && <Button variant="ghost" icon="trash" onClick={() => setRemoving(true)}>Excluir</Button>}<span style={{ flex: 1 }} /><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="check" loading={saving} onClick={save}>Salvar</Button></> : undefined}>
        <div className="grid-2" style={{ gap: 12 }}>
          <Field label="Nome" value={name} error={err ?? undefined} disabled={ro} placeholder="Ex.: Feed" onChange={(e) => { setName(e.target.value); setErr(null); }} />
          <Select label="Tipo" value={kind} disabled={ro} onChange={setKind} options={EXEC_KINDS} />
        </div>
        <div className="e-stack" style={{ gap: 8 }}>
          <div className="e-row between"><span className="e-label">Demandas, na ordem</span><span className="e-caption">{items.filter((i) => i.like_approval).length} vão para o Like</span></div>
          {items.map((it, i) => (
            <div key={i} className={`exec-item${it.like_approval ? " like" : ""}`}>
              <div className="exec-item-row">
                <span className="tnum sector-n">{i + 1}</span>
                <input className="e-input sm e-grow" value={it.title} disabled={ro} placeholder="Nome da demanda" aria-label={`Demanda ${i + 1}`} onChange={(e) => patch(i, { title: e.target.value })} />
                {!ro && (
                  <span className="tpl-actions">
                    <Button size="sm" variant="ghost" icon="chevUp" aria-label="Subir" disabled={i === 0} onClick={() => move(i, i - 1)} />
                    <Button size="sm" variant="ghost" icon="chevDown" aria-label="Descer" disabled={i === items.length - 1} onClick={() => move(i, i + 1)} />
                    <Button size="sm" variant="ghost" icon="x" aria-label="Remover demanda" onClick={() => setItems((l) => l.filter((_, j) => j !== i))} />
                  </span>
                )}
              </div>
              <div className="exec-item-grid">
                <Select value={it.sector ?? ""} disabled={ro} onChange={(v) => patch(i, { sector: v || null })} options={sectorOpts} icon="grid" />
                <label className="days-field"><input className="e-input sm tnum" type="number" min={0} max={60} value={it.days_before} disabled={ro} aria-label="Dias de antecedência" onChange={(e) => patch(i, { days_before: Math.max(0, Math.min(60, Number(e.target.value) || 0)) })} /><span className="e-caption">dias antes</span></label>
              </div>
              <div className="exec-like">
                <Switch checked={!!it.like_approval} disabled={ro} onChange={(v) => patch(i, { like_approval: v, material_type: v ? it.material_type ?? "post" : null })} label={<span className="e-small"><Icon name="heart" size="sm" /> Vai para aprovação no Like</span>} />
                {it.like_approval && <div className="exec-material"><Select value={it.material_type ?? "post"} disabled={ro} onChange={(v) => patch(i, { material_type: v as MaterialType })} options={MATERIAL_TYPES.map((m) => ({ value: m.value, label: m.label }))} /></div>}
              </div>
            </div>
          ))}
          {!ro && <button type="button" className="tpl-add" onClick={() => setItems((l) => [...l, { title: "", sector: sectors[0]?.name ?? null, days_before: 0 }])}><Icon name="plus" size="sm" /> Adicionar demanda</button>}
          <p className="e-caption" style={{ margin: 0 }}>Demandas marcadas geram um material do tipo escolhido no Like quando chegam em <b>Avaliação externa</b>. {items.filter((i) => i.like_approval).map((i) => `${i.title || "…"} (${materialLabel(i.material_type)})`).join(", ")}</p>
        </div>
      </Drawer>
      <Modal open={removing} onClose={() => setRemoving(false)} icon="trash" tone="danger" title="Excluir este modelo?" sub={t?.name}
        footer={<><Button variant="secondary" onClick={() => setRemoving(false)}>Cancelar</Button><Button variant="danger" onClick={async () => { if (!t) return; await removeExecTemplate(t.id); toast.success("Modelo excluído"); setRemoving(false); onSaved(); }}>Excluir modelo</Button></>}>
        <p className="e-small" style={{ margin: 0 }}>As demandas já criadas a partir dele continuam como estão.</p>
      </Modal>
    </>
  );
}
