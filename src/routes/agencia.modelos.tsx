import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Plus, Sparkles, Trash2, X } from "lucide-react";
import { PillButton } from "@/components/reach/ui";
import {
  PLANNING_TYPES,
  TEMPLATE_FIELD_TYPES,
  createPlanTemplate,
  deletePlanTemplate,
  duplicatePlanTemplate,
  getFullAccess,
  listPlanTemplates,
  planningTypeLabel,
  seedBaseTemplates,
  updatePlanTemplate,
  type PlanTemplate,
  type TemplateField,
  type TemplateFieldType,
  type TemplateSection,
  type TemplateStage,
} from "@/lib/agency-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/agencia/modelos")({
  head: () => ({
    meta: [
      { title: "Modelos de Plano — Reach Brand OS" },
      { name: "description", content: "Construtor estruturado de modelos de planejamento usado pela equipe da Reach para gerar o Plano de cada cliente." },
      { property: "og:title", content: "Modelos de Plano da Reach" },
      { property: "og:description", content: "Tipo de planejamento, etapas, seções e campos reutilizáveis para gerar o plano de cada cliente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ModelosPage,
});

const input = "w-full rounded-2xl border border-border bg-background/50 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60";

function ModelosPage() {
  const [templates, setTemplates] = useState<PlanTemplate[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);
  const [editing, setEditing] = useState<PlanTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    try {
      setTemplates(await listPlanTemplates());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao carregar modelos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    getFullAccess()
      .then((a) => setCanManage(a.can("modelos_plano.gerenciar")))
      .catch(() => setErr("Não foi possível verificar sua permissão de acesso."))
      .finally(() => setAccessChecked(true));
    refresh();
  }, []);

  async function seed() {
    setSeeding(true);
    setErr(null);
    try {
      const count = await seedBaseTemplates();
      await refresh();
      if (count === 0) setErr("Os modelos-base já existem — nada novo para criar.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao criar modelos-base");
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight">Modelos de Plano</h1>
          <p className="truncate text-sm text-muted-foreground">
            Tipo de planejamento → etapas → seções → campos. O modelo gera o Plano de um cliente; o original permanece intacto.
          </p>
        </div>
        {canManage && (
          <PillButton onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Criar Plano
          </PillButton>
        )}
      </header>

      {err && <p className="text-sm text-destructive">{err}</p>}

      {!loading && accessChecked && !canManage && (
        <p className="text-sm text-muted-foreground">
          Você não tem permissão para gerenciar modelos de plano — apenas visualizar os modelos ativos abaixo.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <article key={t.id} className={cn("surface space-y-2 rounded-2xl p-4", !t.active && "opacity-60")}>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{t.name}</p>
                <p className="truncate text-[11px] text-reach-coral">{planningTypeLabel(t.type)}</p>
              </div>
              <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[10.5px]", t.active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>
                {t.active ? "Ativo" : "Arquivado"}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {t.stages.length} etapa(s) · {t.stages.reduce((n, s) => n + s.sections.length, 0)} seção(ões) ·{" "}
              {t.stages.reduce((n, s) => n + s.sections.reduce((m, sec) => m + sec.fields.length, 0), 0)} campo(s)
            </p>
            {t.description && <p className="line-clamp-2 text-xs text-muted-foreground">{t.description}</p>}
            <div className="flex flex-wrap gap-2 pt-1">
              <button onClick={() => setEditing(t)} className="rounded-full border border-border px-3 py-1.5 text-xs">
                {canManage ? "Editar" : "Visualizar"}
              </button>
              {canManage && (
                <>
                  <button
                    onClick={async () => { await duplicatePlanTemplate(t); await refresh(); }}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs"
                  >
                    <Copy className="h-3.5 w-3.5" /> Duplicar
                  </button>
                  <button
                    onClick={async () => { await updatePlanTemplate(t.id, { active: !t.active }); await refresh(); }}
                    className="rounded-full border border-border px-3 py-1.5 text-xs"
                  >
                    {t.active ? "Arquivar" : "Reativar"}
                  </button>
                  <button
                    onClick={async () => {
                      if (!window.confirm(`Excluir o modelo "${t.name}"? Essa ação não pode ser desfeita.`)) return;
                      await deletePlanTemplate(t.id);
                      await refresh();
                    }}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Excluir
                  </button>
                </>
              )}
            </div>
          </article>
        ))}
      </div>

      {!loading && templates.length === 0 && (
        <div className="surface space-y-3 rounded-2xl p-6 text-center">
          <p className="text-sm text-muted-foreground">Nenhum modelo cadastrado ainda.</p>
          {canManage && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <PillButton onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" /> Criar Plano
              </PillButton>
              <PillButton variant="secondary" onClick={seed} disabled={seeding}>
                <Sparkles className="h-4 w-4" /> {seeding ? "Criando…" : "Usar modelos-base"}
              </PillButton>
            </div>
          )}
        </div>
      )}

      {creating && <CreateTemplateModal onClose={() => setCreating(false)} onCreated={(t) => { setCreating(false); setEditing(t); refresh(); }} />}

      {editing && (
        <TemplateEditor
          template={editing}
          canManage={canManage}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await refresh(); }}
        />
      )}
    </div>
  );
}

/** Passo 1 de "Criar Plano": informações básicas do modelo antes de montar a estrutura. */
function CreateTemplateModal({ onClose, onCreated }: { onClose: () => void; onCreated: (t: PlanTemplate) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("");
  const [objective, setObjective] = useState("");
  const [audience, setAudience] = useState("");
  const [notes, setNotes] = useState("");
  const [nameErr, setNameErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    if (!name.trim()) {
      setNameErr("Dê um nome ao modelo para continuar.");
      return;
    }
    setNameErr(null);
    setErr(null);
    setSaving(true);
    try {
      const t = await createPlanTemplate({
        name: name.trim(),
        description: description.trim() || null,
        type: type || null,
        objective: objective.trim() || null,
        audience: audience.trim() || null,
        notes: notes.trim() || null,
        stages: [],
      });
      onCreated(t);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao criar modelo. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overlay-scrim p-0 sm:items-center sm:p-6">
      <div className="surface max-h-[92vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-t-3xl p-5 sm:rounded-3xl">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div>
            <h2 className="text-sm font-semibold">Criar Plano</h2>
            <p className="text-xs text-muted-foreground">Defina o que esse modelo é e para que serve. As etapas vêm no próximo passo.</p>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}

        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Nome do modelo *</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => { setName(e.target.value); if (nameErr) setNameErr(null); }}
            className={input}
            placeholder="Ex.: Plano Estratégico de Comunicação"
          />
          {nameErr && <span className="text-xs text-destructive">{nameErr}</span>}
        </label>

        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Tipo de planejamento</span>
          <select value={type} onChange={(e) => setType(e.target.value)} className={input}>
            <option value="">Selecione…</option>
            {PLANNING_TYPES.map((pt) => <option key={pt.key} value={pt.key}>{pt.label}</option>)}
          </select>
          {type && <span className="text-[11px] text-muted-foreground">{PLANNING_TYPES.find((pt) => pt.key === type)?.description}</span>}
        </label>

        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Descrição</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={input} placeholder="O que este modelo cobre" />
        </label>

        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Objetivo do modelo</span>
          <textarea value={objective} onChange={(e) => setObjective(e.target.value)} rows={2} className={cn(input, "resize-y")} placeholder="Para que esse planejamento serve" />
        </label>

        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Para quem será utilizado</span>
          <input value={audience} onChange={(e) => setAudience(e.target.value)} className={input} placeholder="Ex.: clientes de comunicação recorrente" />
        </label>

        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Observações</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={cn(input, "resize-y")} />
        </label>

        <div className="flex items-center gap-2">
          <PillButton onClick={create} disabled={saving}>{saving ? "Criando…" : "Criar e montar etapas"}</PillButton>
          <PillButton variant="secondary" onClick={onClose} disabled={saving}>Cancelar</PillButton>
        </div>
      </div>
    </div>
  );
}

function TemplateEditor({
  template,
  canManage,
  onClose,
  onSaved,
}: {
  template: PlanTemplate;
  canManage: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description ?? "");
  const [type, setType] = useState(template.type ?? "");
  const [objective, setObjective] = useState(template.objective ?? "");
  const [audience, setAudience] = useState(template.audience ?? "");
  const [notes, setNotes] = useState(template.notes ?? "");
  const [stages, setStages] = useState<TemplateStage[]>(template.stages ?? []);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  function markDirty() {
    setDirty(true);
  }

  function patchStage(si: number, patch: Partial<TemplateStage>) {
    setStages((prev) => prev.map((s, idx) => (idx === si ? { ...s, ...patch } : s)));
    markDirty();
  }

  function moveStage(si: number, delta: number) {
    setStages((prev) => {
      const next = [...prev];
      const j = si + delta;
      if (j < 0 || j >= next.length) return prev;
      [next[si], next[j]] = [next[j]!, next[si]!];
      return next;
    });
    markDirty();
  }

  function patchSection(si: number, sci: number, patch: Partial<TemplateSection>) {
    setStages((prev) =>
      prev.map((s, idx) => (idx !== si ? s : { ...s, sections: s.sections.map((sec, i) => (i === sci ? { ...sec, ...patch } : sec)) })),
    );
    markDirty();
  }

  function moveSection(si: number, sci: number, delta: number) {
    setStages((prev) =>
      prev.map((s, idx) => {
        if (idx !== si) return s;
        const sections = [...s.sections];
        const j = sci + delta;
        if (j < 0 || j >= sections.length) return s;
        [sections[sci], sections[j]] = [sections[j]!, sections[sci]!];
        return { ...s, sections };
      }),
    );
    markDirty();
  }

  function patchField(si: number, sci: number, fi: number, patch: Partial<TemplateField>) {
    setStages((prev) =>
      prev.map((s, idx) => {
        if (idx !== si) return s;
        return {
          ...s,
          sections: s.sections.map((sec, i) => {
            if (i !== sci) return sec;
            return { ...sec, fields: sec.fields.map((f, j) => (j === fi ? { ...f, ...patch } : f)) };
          }),
        };
      }),
    );
    markDirty();
  }

  function moveField(si: number, sci: number, fi: number, delta: number) {
    setStages((prev) =>
      prev.map((s, idx) => {
        if (idx !== si) return s;
        return {
          ...s,
          sections: s.sections.map((sec, i) => {
            if (i !== sci) return sec;
            const fields = [...sec.fields];
            const j = fi + delta;
            if (j < 0 || j >= fields.length) return sec;
            [fields[fi], fields[j]] = [fields[j]!, fields[fi]!];
            return { ...sec, fields };
          }),
        };
      }),
    );
    markDirty();
  }

  function addStage() {
    setStages((prev) => [...prev, { key: `etapa_${prev.length + 1}_${Date.now()}`, title: "", sections: [] }]);
    markDirty();
  }
  function removeStage(si: number) {
    setStages((prev) => prev.filter((_, idx) => idx !== si));
    markDirty();
  }
  function addSection(si: number) {
    patchStage(si, {
      sections: [...stages[si]!.sections, { key: `secao_${stages[si]!.sections.length + 1}_${Date.now()}`, title: "", fields: [] }],
    });
  }
  function removeSection(si: number, sci: number) {
    patchStage(si, { sections: stages[si]!.sections.filter((_, i) => i !== sci) });
  }
  function addField(si: number, sci: number) {
    const sec = stages[si]!.sections[sci]!;
    patchSection(si, sci, {
      fields: [...sec.fields, { key: `campo_${sec.fields.length + 1}_${Date.now()}`, label: "", type: "texto_curto", value: "" }],
    });
  }
  function removeField(si: number, sci: number, fi: number) {
    const sec = stages[si]!.sections[sci]!;
    patchSection(si, sci, { fields: sec.fields.filter((_, i) => i !== fi) });
  }

  async function save() {
    if (!name.trim()) {
      setErr("O modelo precisa de um nome.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await updatePlanTemplate(template.id, {
        name: name.trim(),
        description: description.trim() || null,
        type: type || null,
        objective: objective.trim() || null,
        audience: audience.trim() || null,
        notes: notes.trim() || null,
        stages,
      });
      setDirty(false);
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao salvar modelo");
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    if (dirty && canManage && !window.confirm("Existem alterações não salvas. Fechar mesmo assim?")) return;
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overlay-scrim p-0 sm:items-center sm:p-6">
      <div className="surface max-h-[92vh] w-full max-w-3xl space-y-4 overflow-y-auto rounded-t-3xl p-5 sm:rounded-3xl">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <h2 className="truncate text-sm font-semibold">{canManage ? "Editar modelo" : "Modelo de plano"}</h2>
          <button onClick={handleClose} aria-label="Fechar" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Nome</span>
            <input value={name} onChange={(e) => { setName(e.target.value); markDirty(); }} className={input} disabled={!canManage} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Tipo de planejamento</span>
            <select value={type} onChange={(e) => { setType(e.target.value); markDirty(); }} className={input} disabled={!canManage}>
              <option value="">Selecione…</option>
              {PLANNING_TYPES.map((pt) => <option key={pt.key} value={pt.key}>{pt.label}</option>)}
            </select>
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs text-muted-foreground">Descrição</span>
            <input value={description} onChange={(e) => { setDescription(e.target.value); markDirty(); }} className={input} disabled={!canManage} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Objetivo do modelo</span>
            <input value={objective} onChange={(e) => { setObjective(e.target.value); markDirty(); }} className={input} disabled={!canManage} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Para quem</span>
            <input value={audience} onChange={(e) => { setAudience(e.target.value); markDirty(); }} className={input} disabled={!canManage} />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs text-muted-foreground">Observações</span>
            <input value={notes} onChange={(e) => { setNotes(e.target.value); markDirty(); }} className={input} disabled={!canManage} />
          </label>
        </div>

        <div className="space-y-4">
          {stages.map((st, si) => (
            <section key={st.key} className="space-y-3 rounded-2xl border border-border p-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <input
                  value={st.title}
                  onChange={(e) => patchStage(si, { title: e.target.value })}
                  className={cn(input, "font-medium")}
                  disabled={!canManage}
                  placeholder="Título da etapa (ex.: Diagnóstico)"
                />
                {canManage && (
                  <div className="flex shrink-0 gap-1">
                    <button aria-label="Subir etapa" onClick={() => moveStage(si, -1)} className="grid h-9 w-9 place-items-center rounded-full border border-border"><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button aria-label="Descer etapa" onClick={() => moveStage(si, 1)} className="grid h-9 w-9 place-items-center rounded-full border border-border"><ArrowDown className="h-3.5 w-3.5" /></button>
                    <button aria-label="Excluir etapa" onClick={() => removeStage(si)} className="grid h-9 w-9 place-items-center rounded-full border border-border text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                )}
              </div>

              <div className="space-y-3 pl-3">
                {st.sections.map((sec, sci) => (
                  <div key={sec.key} className="space-y-2 rounded-xl border border-dashed border-border p-3">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                      <input
                        value={sec.title}
                        onChange={(e) => patchSection(si, sci, { title: e.target.value })}
                        className={input}
                        disabled={!canManage}
                        placeholder="Título da seção"
                      />
                      {canManage && (
                        <div className="flex shrink-0 gap-1">
                          <button aria-label="Subir seção" onClick={() => moveSection(si, sci, -1)} className="grid h-8 w-8 place-items-center rounded-full border border-border"><ArrowUp className="h-3 w-3" /></button>
                          <button aria-label="Descer seção" onClick={() => moveSection(si, sci, 1)} className="grid h-8 w-8 place-items-center rounded-full border border-border"><ArrowDown className="h-3 w-3" /></button>
                          <button aria-label="Excluir seção" onClick={() => removeSection(si, sci)} className="grid h-8 w-8 place-items-center rounded-full border border-border text-destructive"><Trash2 className="h-3 w-3" /></button>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      {sec.fields.map((f, fi) => {
                        const def = TEMPLATE_FIELD_TYPES.find((d) => d.key === f.type);
                        return (
                          <div key={f.key} className="space-y-1.5 rounded-lg bg-muted/30 p-2">
                            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_160px]">
                                <input
                                  value={f.label}
                                  onChange={(e) => patchField(si, sci, fi, { label: e.target.value })}
                                  className={input}
                                  disabled={!canManage}
                                  placeholder="Nome do campo / pergunta"
                                />
                                <select
                                  value={f.type}
                                  onChange={(e) => patchField(si, sci, fi, { type: e.target.value as TemplateFieldType })}
                                  className={input}
                                  disabled={!canManage}
                                >
                                  {TEMPLATE_FIELD_TYPES.map((ft) => <option key={ft.key} value={ft.key}>{ft.label}</option>)}
                                </select>
                              </div>
                              {canManage && (
                                <div className="flex shrink-0 items-center gap-1">
                                  <label className="mr-1 flex items-center gap-1 text-[11px] text-muted-foreground" title="Campo obrigatório">
                                    <input type="checkbox" checked={!!f.required} onChange={(e) => patchField(si, sci, fi, { required: e.target.checked })} />
                                    Obrig.
                                  </label>
                                  <button aria-label="Subir campo" onClick={() => moveField(si, sci, fi, -1)} className="grid h-8 w-8 place-items-center rounded-full border border-border"><ArrowUp className="h-3 w-3" /></button>
                                  <button aria-label="Descer campo" onClick={() => moveField(si, sci, fi, 1)} className="grid h-8 w-8 place-items-center rounded-full border border-border"><ArrowDown className="h-3 w-3" /></button>
                                  <button aria-label="Excluir campo" onClick={() => removeField(si, sci, fi)} className="grid h-8 w-8 place-items-center rounded-full border border-border text-destructive"><Trash2 className="h-3 w-3" /></button>
                                </div>
                              )}
                            </div>
                            {def?.hasOptions && canManage && (
                              <input
                                value={(f.options ?? []).join(", ")}
                                onChange={(e) => patchField(si, sci, fi, { options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean) })}
                                className={cn(input, "text-xs")}
                                placeholder="Opções separadas por vírgula (ex.: Alta, Média, Baixa)"
                              />
                            )}
                          </div>
                        );
                      })}
                      {canManage && (
                        <button
                          onClick={() => addField(si, sci)}
                          className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs"
                        >
                          <Plus className="h-3.5 w-3.5" /> Adicionar campo
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {canManage && (
                  <button onClick={() => addSection(si)} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs">
                    <Plus className="h-3.5 w-3.5" /> Adicionar seção
                  </button>
                )}
                {st.sections.length === 0 && !canManage && <p className="text-xs text-muted-foreground">Nenhuma seção nesta etapa.</p>}
              </div>
            </section>
          ))}
          {stages.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma etapa neste modelo ainda.</p>}
        </div>

        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={addStage} className="inline-flex items-center gap-1 rounded-full border border-border px-4 py-2 text-xs">
              <Plus className="h-3.5 w-3.5" /> Adicionar etapa
            </button>
            <PillButton onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar modelo"}</PillButton>
            {dirty && <span className="text-[11px] text-muted-foreground">Alterações não salvas</span>}
          </div>
        )}
      </div>
    </div>
  );
}
