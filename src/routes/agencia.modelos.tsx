import { createFileRoute, useBlocker } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { Badge, Button, EmptyState, Skeleton } from "@/components/echo/primitives";
import { Checkbox, Chip, Field, Menu, Select } from "@/components/echo/controls";
import { Modal } from "@/components/echo/overlays";
import { Icon } from "@/components/echo/icon";
import { stagger } from "@/components/echo/motion";
import { useAccess } from "@/components/echo/session";
import { PLANNING_TYPES, TEMPLATE_FIELD_TYPES, planningTypeLabel, slugKey, type PlanTemplate, type TemplateField, type TemplateFieldType, type TemplateSection, type TemplateStage } from "@/lib/agency-data";
import { duplicatePlan, listPlans, removePlan, savePlan, setPlanActive } from "@/lib/settings-data";

export const Route = createFileRoute("/agencia/modelos")({
  head: () => ({ meta: [{ title: "Modelos de plano · Echo" }, { name: "description", content: "Tipo de planejamento, etapas, seções e campos que geram o Plano de cada cliente." }] }),
  component: ModelsPage,
});

const count = (t: { stages: TemplateStage[] }) => ({
  stages: t.stages.length,
  sections: t.stages.reduce((n, s) => n + s.sections.length, 0),
  fields: t.stages.reduce((n, s) => n + s.sections.reduce((m, x) => m + x.fields.length, 0), 0),
});
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function ModelsPage() {
  const qc = useQueryClient();
  const { session, can } = useAccess();
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState<"todos" | "ativos" | "arquivados">("ativos");
  const [editing, setEditing] = useState<PlanTemplate | "new" | null>(null);
  const [removing, setRemoving] = useState<PlanTemplate | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  useEffect(() => setReady(true), []);
  const q = useQuery({ queryKey: ["plan-templates"], queryFn: listPlans, enabled: ready });
  const canManage = !!session?.isAdmin || can("modelos.editar") || can("modelos.administrar") || can("modelos_plano.gerenciar");
  const list = (q.data ?? []).filter((t) => filter === "todos" || (filter === "ativos" ? t.active : !t.active));
  useEffect(() => { if (grid.current && q.data && !editing) stagger(grid.current.querySelectorAll(".tpl-card"), { y: 10, dur: 420 }, 40); }, [!!q.data, filter, editing]);
  const refresh = () => qc.invalidateQueries({ queryKey: ["plan-templates"] });

  if (editing) return <TemplateEditor template={editing === "new" ? null : editing} canManage={canManage} onClose={() => setEditing(null)} onSaved={(t) => { refresh(); setEditing(t); }} />;
  if (!ready || q.isLoading) return <div className="tpl-grid">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} h={180} r={22} />)}</div>;
  if (q.isError) return <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState kind="error" title="Não foi possível carregar os modelos" actions={<Button variant="secondary" icon="refresh" onClick={() => q.refetch()}>Tentar novamente</Button>} /></div>;

  return (
    <div className="stack-lg">
      <div className="e-row between wrap" style={{ gap: 12 }}>
        <div className="e-row wrap" style={{ gap: 6 }}>
          {(["ativos", "arquivados", "todos"] as const).map((f) => (
            <Chip key={f} pressed={filter === f} onClick={() => setFilter(f)} count={(q.data ?? []).filter((t) => f === "todos" || (f === "ativos" ? t.active : !t.active)).length}>
              {f === "ativos" ? "Ativos" : f === "arquivados" ? "Arquivados" : "Todos"}
            </Chip>
          ))}
        </div>
        {canManage && <Button icon="plus" onClick={() => setEditing("new")}>Novo modelo</Button>}
      </div>
      {!canManage && <p className="e-caption" style={{ margin: 0 }}>Você pode ver os modelos. Para editar, peça a permissão “Modelos de plano · Editar”.</p>}

      {list.length === 0 ? (
        <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}>
          <EmptyState icon="layers" title={filter === "arquivados" ? "Nenhum modelo arquivado" : "Nenhum modelo ainda"} text="Um modelo define etapas, seções e campos. Ao aplicar em um cliente, ele gera o Plano sem apagar o que já foi preenchido." actions={canManage && filter !== "arquivados" ? <Button icon="plus" onClick={() => setEditing("new")}>Criar o primeiro</Button> : undefined} />
        </div>
      ) : (
        <div className="tpl-grid" ref={grid}>
          {list.map((t) => {
            const c = count(t);
            return (
              <article key={t.id} className={`tpl-card e-glass${t.active ? "" : " archived"}`}>
                <div className="e-row between" style={{ gap: 8, alignItems: "flex-start" }}>
                  <span className="tpl-ic"><Icon name="layers" size="sm" /></span>
                  <div className="e-row" style={{ gap: 6 }}>
                    {!t.active && <Badge tone="glass">Arquivado</Badge>}
                    {canManage && (
                      <Menu align="right" trigger={({ toggle }) => <Button size="sm" variant="ghost" icon="more" aria-label={`Ações de ${t.name}`} onClick={toggle} />} items={[
                        { label: "Editar", icon: "edit", onSelect: () => setEditing(t) },
                        { label: "Duplicar", icon: "copy", onSelect: async () => { await duplicatePlan(t); toast.success("Modelo duplicado"); refresh(); } },
                        { label: t.active ? "Arquivar" : "Reativar", icon: t.active ? "folder" : "refresh", onSelect: async () => { await setPlanActive(t.id, !t.active); toast.success(t.active ? "Modelo arquivado" : "Modelo reativado"); refresh(); } },
                        "-",
                        { label: "Excluir", icon: "trash", danger: true, onSelect: () => setRemoving(t) },
                      ]} />
                    )}
                  </div>
                </div>
                <button type="button" className="tpl-open" onClick={() => setEditing(t)}>
                  <span className="e-label">{planningTypeLabel(t.type)}</span>
                  <b className="tpl-name">{t.name}</b>
                  {t.description && <span className="e-small tpl-desc">{t.description}</span>}
                </button>
                <div className="tpl-meta e-caption tnum">
                  <span>{plural(c.stages, "etapa", "etapas")}</span><span>{plural(c.sections, "seção", "seções")}</span><span>{plural(c.fields, "campo", "campos")}</span>
                </div>
                {t.audience && <span className="e-caption e-ellipsis"><Icon name="users" size="sm" /> {t.audience}</span>}
              </article>
            );
          })}
        </div>
      )}

      <Modal open={!!removing} onClose={() => setRemoving(null)} icon="trash" tone="danger" title="Excluir este modelo?" sub={removing?.name}
        footer={<><Button variant="secondary" onClick={() => setRemoving(null)}>Cancelar</Button><Button variant="danger" onClick={async () => { if (!removing) return; try { await removePlan(removing.id); toast.success("Modelo excluído"); setRemoving(null); refresh(); } catch { toast.error("Não foi possível excluir."); } }}>Excluir modelo</Button></>}>
        <p className="e-small" style={{ margin: 0 }}>Os Planos já gerados nos clientes continuam intactos. Se quiser só tirar da lista, prefira arquivar.</p>
      </Modal>
    </div>
  );
}

// ----- Editor ---------------------------------------------------------------------

type Meta = { name: string; type: string; description: string; objective: string; audience: string; notes: string };
const key = (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}`;
function move<T>(list: T[], from: number, to: number) { const next = [...list]; const [x] = next.splice(from, 1); next.splice(to, 0, x); return next; }

/** Arrastar para reordenar dentro de uma mesma lista (etapas, seções ou campos). */
function useDrag(scope: string, onMove: (from: number, to: number) => void, enabled: boolean) {
  const [over, setOver] = useState<number | null>(null);
  return {
    over,
    props: (i: number) => enabled ? {
      draggable: true,
      onDragStart: (e: DragEvent) => { e.stopPropagation(); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData(`text/x-${scope}`, String(i)); },
      onDragOver: (e: DragEvent) => { if (!e.dataTransfer.types.includes(`text/x-${scope}`)) return; e.preventDefault(); e.stopPropagation(); setOver(i); },
      onDragLeave: () => setOver((o) => (o === i ? null : o)),
      onDrop: (e: DragEvent) => { const from = Number(e.dataTransfer.getData(`text/x-${scope}`)); setOver(null); if (Number.isNaN(from) || from === i) return; e.preventDefault(); e.stopPropagation(); onMove(from, i); },
      onDragEnd: () => setOver(null),
    } : {},
  };
}

function TemplateEditor({ template, canManage, onClose, onSaved }: { template: PlanTemplate | null; canManage: boolean; onClose: () => void; onSaved: (t: PlanTemplate) => void }) {
  const [meta, setMeta] = useState<Meta>({ name: template?.name ?? "", type: template?.type ?? "", description: template?.description ?? "", objective: template?.objective ?? "", audience: template?.audience ?? "", notes: template?.notes ?? "" });
  const [stages, setStages] = useState<TemplateStage[]>(() => structuredClone(template?.stages ?? []));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameErr, setNameErr] = useState<string | null>(null);
  const [openStage, setOpenStage] = useState<number>(0);
  const ro = !canManage;

  const blocker = useBlocker({ shouldBlockFn: () => dirty, enableBeforeUnload: () => dirty, withResolver: true });
  const [askClose, setAskClose] = useState(false);

  const edit = (fn: (s: TemplateStage[]) => TemplateStage[]) => { setStages((s) => fn(structuredClone(s))); setDirty(true); };
  const setM = (p: Partial<Meta>) => { setMeta((m) => ({ ...m, ...p })); setDirty(true); };
  const stageDrag = useDrag("stage", (a, b) => { edit((s) => move(s, a, b)); setOpenStage(b); }, !ro);

  const save = async () => {
    if (!meta.name.trim()) { setNameErr("Dê um nome ao modelo."); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    const empty = stages.flatMap((s) => [s.title, ...s.sections.flatMap((x) => [x.title, ...x.fields.map((f) => f.label)])]).some((t) => !t.trim());
    if (empty) { toast.error("Há etapas, seções ou campos sem nome.", { description: "Preencha ou remova antes de salvar." }); return; }
    setSaving(true);
    try {
      const t = await savePlan(template?.id ?? null, { name: meta.name.trim(), type: meta.type || null, description: meta.description.trim() || null, objective: meta.objective.trim() || null, audience: meta.audience.trim() || null, notes: meta.notes.trim() || null, stages });
      setDirty(false);
      toast.success(template ? "Modelo salvo" : "Modelo criado");
      onSaved(t);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };
  const close = () => (dirty ? setAskClose(true) : onClose());
  const c = count({ stages });

  return (
    <div className="stack-lg tpl-editor">
      <div className="tpl-bar e-glass">
        <Button variant="ghost" icon="chevLeft" onClick={close}>Modelos</Button>
        <span className="e-grow e-ellipsis" style={{ fontWeight: 600 }}>{meta.name || "Novo modelo"}</span>
        {dirty && <span className="tpl-dirty"><i />Alterações não salvas</span>}
        <span className="e-caption tnum hide-sm">{plural(c.stages, "etapa", "etapas")} · {plural(c.fields, "campo", "campos")}</span>
        {canManage && <Button icon="check" loading={saving} onClick={save}>Salvar</Button>}
      </div>

      <section className="e-glass tpl-meta-form">
        <div className="grid-2" style={{ gap: 12 }}>
          <Field label="Nome do modelo" value={meta.name} error={nameErr ?? undefined} disabled={ro} autoFocus={!template} placeholder="Ex.: Plano Estratégico de Comunicação" onChange={(e) => { setM({ name: e.target.value }); setNameErr(null); }} />
          <Select label="Tipo de planejamento" value={meta.type} disabled={ro} placeholder="Selecione" onChange={(v) => setM({ type: v })} options={PLANNING_TYPES.map((p) => ({ value: p.key, label: p.label }))} />
        </div>
        {meta.type && <p className="e-caption" style={{ margin: 0 }}>{PLANNING_TYPES.find((p) => p.key === meta.type)?.description}</p>}
        <Field label="Descrição" value={meta.description} optional disabled={ro} placeholder="O que este modelo cobre" onChange={(e) => setM({ description: e.target.value })} />
        <div className="grid-2" style={{ gap: 12 }}>
          <Field label="Objetivo" value={meta.objective} optional disabled={ro} placeholder="Para que este planejamento serve" onChange={(e) => setM({ objective: e.target.value })} />
          <Field label="Público" value={meta.audience} optional disabled={ro} placeholder="Ex.: clientes de conteúdo recorrente" onChange={(e) => setM({ audience: e.target.value })} />
        </div>
      </section>

      <div className="tpl-stages">
        {stages.map((st, si) => (
          <section key={st.key} className={`tpl-stage e-glass${stageDrag.over === si ? " drop" : ""}${openStage === si ? " open" : ""}`} {...stageDrag.props(si)}>
            <header className="tpl-stage-head">
              {!ro && <span className="tpl-grip" title="Arraste para reordenar" aria-hidden="true"><Icon name="grip" size="sm" /></span>}
              <span className="tpl-num tnum">{si + 1}</span>
              <input className="tpl-title-input" value={st.title} disabled={ro} placeholder="Nome da etapa (ex.: Diagnóstico)" aria-label={`Nome da etapa ${si + 1}`} onChange={(e) => edit((s) => { s[si].title = e.target.value; return s; })} onFocus={() => setOpenStage(si)} />
              <span className="e-caption tnum hide-sm">{plural(st.sections.length, "seção", "seções")}</span>
              {!ro && <Reorder label="etapa" i={si} n={stages.length} onMove={(to) => { edit((s) => move(s, si, to)); setOpenStage(to); }} onRemove={() => edit((s) => s.filter((_, i) => i !== si))} />}
              <Button size="sm" variant="ghost" icon={openStage === si ? "chevUp" : "chevDown"} aria-label={openStage === si ? "Recolher etapa" : "Abrir etapa"} aria-expanded={openStage === si} onClick={() => setOpenStage(openStage === si ? -1 : si)} />
            </header>
            {openStage === si && <StageBody stage={st} ro={ro} onChange={(fn) => edit((s) => { s[si] = fn(s[si]); return s; })} />}
          </section>
        ))}
        {stages.length === 0 && <div className="e-glass" style={{ borderRadius: "var(--r-xl)" }}><EmptyState compact icon="layers" title="Nenhuma etapa ainda" text="Comece pela primeira etapa, como Diagnóstico ou Estratégia." /></div>}
        {!ro && <Button variant="secondary" icon="plus" onClick={() => { edit((s) => [...s, { key: key("etapa"), title: "", sections: [{ key: key("secao"), title: "", fields: [] }] }]); setOpenStage(stages.length); }}>Adicionar etapa</Button>}
      </div>

      <Modal open={askClose || blocker.status === "blocked"} onClose={() => { setAskClose(false); blocker.reset?.(); }} icon="alert" tone="soft" title="Sair sem salvar?"
        footer={<><Button variant="secondary" onClick={() => { setAskClose(false); blocker.reset?.(); }}>Continuar editando</Button><Button variant="danger" onClick={() => { setDirty(false); if (blocker.status === "blocked") blocker.proceed?.(); else { setAskClose(false); onClose(); } }}>Descartar alterações</Button></>}>
        <p className="e-small" style={{ margin: 0 }}>As mudanças neste modelo ainda não foram salvas e serão perdidas.</p>
      </Modal>
    </div>
  );
}

function Reorder({ label, i, n, onMove, onRemove }: { label: string; i: number; n: number; onMove: (to: number) => void; onRemove: () => void }) {
  return (
    <span className="tpl-actions">
      <Button size="sm" variant="ghost" icon="chevUp" aria-label={`Subir ${label}`} disabled={i === 0} onClick={() => onMove(i - 1)} />
      <Button size="sm" variant="ghost" icon="chevDown" aria-label={`Descer ${label}`} disabled={i === n - 1} onClick={() => onMove(i + 1)} />
      <Button size="sm" variant="ghost" icon="trash" aria-label={`Excluir ${label}`} onClick={onRemove} />
    </span>
  );
}

function StageBody({ stage, ro, onChange }: { stage: TemplateStage; ro: boolean; onChange: (fn: (s: TemplateStage) => TemplateStage) => void }) {
  const secDrag = useDrag(`sec-${stage.key}`, (a, b) => onChange((s) => ({ ...s, sections: move(s.sections, a, b) })), !ro);
  const patchSec = (i: number, fn: (x: TemplateSection) => TemplateSection) => onChange((s) => ({ ...s, sections: s.sections.map((x, j) => (j === i ? fn(x) : x)) }));
  return (
    <div className="tpl-stage-body">
      {stage.sections.map((sec, ci) => (
        <div key={sec.key} className={`tpl-section${secDrag.over === ci ? " drop" : ""}`} {...secDrag.props(ci)}>
          <div className="tpl-section-head">
            {!ro && <span className="tpl-grip" aria-hidden="true"><Icon name="grip" size="sm" /></span>}
            <input className="tpl-title-input sm" value={sec.title} disabled={ro} placeholder="Nome da seção (ex.: Público)" aria-label="Nome da seção" onChange={(e) => patchSec(ci, (x) => ({ ...x, title: e.target.value }))} />
            {!ro && <Reorder label="seção" i={ci} n={stage.sections.length} onMove={(to) => onChange((s) => ({ ...s, sections: move(s.sections, ci, to) }))} onRemove={() => onChange((s) => ({ ...s, sections: s.sections.filter((_, j) => j !== ci) }))} />}
          </div>
          <FieldList section={sec} ro={ro} onChange={(fields) => patchSec(ci, (x) => ({ ...x, fields }))} />
        </div>
      ))}
      {!ro && <Button size="sm" variant="ghost" icon="plus" onClick={() => onChange((s) => ({ ...s, sections: [...s.sections, { key: key("secao"), title: "", fields: [] }] }))}>Adicionar seção</Button>}
    </div>
  );
}

function FieldList({ section, ro, onChange }: { section: TemplateSection; ro: boolean; onChange: (f: TemplateField[]) => void }) {
  const fields = section.fields;
  const drag = useDrag(`field-${section.key}`, (a, b) => onChange(move(fields, a, b)), !ro);
  const patch = (i: number, p: Partial<TemplateField>) => onChange(fields.map((f, j) => (j === i ? { ...f, ...p, ...(p.label !== undefined && f.key.startsWith("campo_") ? { key: `${slugKey(p.label) || "campo"}_${f.key.slice(-6)}` } : {}) } : f)));
  return (
    <div className="tpl-fields">
      {fields.map((f, fi) => {
        const def = TEMPLATE_FIELD_TYPES.find((d) => d.key === f.type);
        return (
          <div key={f.key} className={`tpl-field${drag.over === fi ? " drop" : ""}`} {...drag.props(fi)}>
            <div className="tpl-field-row">
              {!ro && <span className="tpl-grip" aria-hidden="true"><Icon name="grip" size="sm" /></span>}
              <input className="e-input tpl-field-label" value={f.label} disabled={ro} placeholder="Pergunta ou nome do campo" aria-label="Nome do campo" onChange={(e) => patch(fi, { label: e.target.value })} />
              <div className="tpl-field-type"><Select value={f.type} disabled={ro} onChange={(v) => patch(fi, { type: v as TemplateFieldType })} options={TEMPLATE_FIELD_TYPES.map((t) => ({ value: t.key, label: t.label }))} /></div>
              <Checkbox checked={!!f.required} disabled={ro} onChange={(v) => patch(fi, { required: v })} label="Obrigatório" />
              {!ro && <Reorder label="campo" i={fi} n={fields.length} onMove={(to) => onChange(move(fields, fi, to))} onRemove={() => onChange(fields.filter((_, j) => j !== fi))} />}
            </div>
            <div className="tpl-field-extra">
              <input className="e-input sm" value={f.help ?? ""} disabled={ro} placeholder="Ajuda para quem preenche (opcional)" aria-label="Texto de ajuda" onChange={(e) => patch(fi, { help: e.target.value || null })} />
              {def?.hasOptions && <input className="e-input sm" value={(f.options ?? []).join(", ")} disabled={ro} placeholder="Opções separadas por vírgula" aria-label="Opções" onChange={(e) => patch(fi, { options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean) })} />}
            </div>
          </div>
        );
      })}
      {fields.length === 0 && <span className="e-caption">Nenhum campo nesta seção.</span>}
      {!ro && <button type="button" className="tpl-add" onClick={() => onChange([...fields, { key: key("campo"), label: "", type: "texto_longo", value: "" }])}><Icon name="plus" size="sm" /> Adicionar campo</button>}
    </div>
  );
}

