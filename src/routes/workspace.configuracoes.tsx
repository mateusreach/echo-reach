import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { PageHeader } from "@/components/reach/ui";
import { FormModal } from "@/components/reach/form-modal";
import { Btn, Field, TextArea, TextInput } from "@/components/ui-reach/primitives";
import { EmptyState } from "@/components/reach/workspace-ui";
import {
  createSector,
  createTemplate,
  deleteSector,
  deleteTemplate,
  listSectors,
  listTemplates,
  templateTasks,
  updateTemplate,
  WORK_STATUSES,
  type WorkTemplate,
} from "@/lib/workspace-data";

export const Route = createFileRoute("/workspace/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Reach Workspace" },
      { name: "description", content: "Modelos de demanda, setores e etapas oficiais da operação da Reach." },
      { property: "og:title", content: "Configurações — Reach Workspace" },
      { property: "og:description", content: "Como a operação da agência é padronizada." },
    ],
  }),
  component: WorkspaceSettings,
});

/** CONFIGURAÇÕES — modelos de demanda, setores e as 7 etapas oficiais. */
function WorkspaceSettings() {
  const qc = useQueryClient();
  const templates = useQuery({ queryKey: ["ws-templates"], queryFn: listTemplates });
  const sectors = useQuery({ queryKey: ["ws-sectors"], queryFn: listSectors });
  const [form, setForm] = useState<{ open: boolean; template?: WorkTemplate | null }>({ open: false });
  const [sectorName, setSectorName] = useState("");

  async function addSector() {
    if (!sectorName.trim()) return;
    await createSector(sectorName.trim(), (sectors.data?.length ?? 0) + 1);
    setSectorName("");
    qc.invalidateQueries({ queryKey: ["ws-sectors"] });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="Configurações"
        description="Padrões da operação. Identidade da agência e clientes continuam sendo definidos na área da agência."
        actions={
          <Link
            to="/agencia/configuracoes"
            className="inline-flex h-9 items-center rounded-full border border-border px-4 text-sm font-medium"
          >
            Configurações da agência
          </Link>
        }
      />

      <section className="surface rounded-2xl p-5 sm:p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Etapas oficiais
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Toda demanda percorre estas etapas, na mesma ordem, em qualquer cliente.
        </p>
        <ol className="flex flex-wrap gap-1.5">
          {WORK_STATUSES.map((s, i) => (
            <li key={s} className="rounded-full bg-muted px-3 py-1.5 text-[12px] font-medium text-muted-foreground">
              {i + 1}. {s}
            </li>
          ))}
        </ol>
      </section>

      <section className="surface rounded-2xl p-5 sm:p-6">
        <header className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <h2 className="truncate text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Modelos de demanda
          </h2>
          <Btn variant="primary" size="sm" onClick={() => setForm({ open: true, template: null })}>
            <Plus className="h-3.5 w-3.5" aria-hidden /> Novo modelo
          </Btn>
        </header>
        {(templates.data?.length ?? 0) === 0 ? (
          <EmptyState
            title="Nenhum modelo cadastrado."
            description="Modelos evitam recriar do zero demandas que se repetem toda semana."
          />
        ) : (
          <ul className="space-y-2">
            {templates.data!.map((t) => (
              <li
                key={t.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border/70 bg-card px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{t.name}</p>
                  <p className="truncate text-[12.5px] text-muted-foreground">
                    {t.kind} · {templateTasks(t).length} demanda(s)
                  </p>
                </div>
                <Btn variant="ghost" size="sm" aria-label={`Editar ${t.name}`} onClick={() => setForm({ open: true, template: t })}>
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                </Btn>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="surface rounded-2xl p-5 sm:p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Setores</h2>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {(sectors.data ?? []).map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-[12px] font-medium text-muted-foreground"
            >
              {s.name}
              <button
                type="button"
                aria-label={`Remover ${s.name}`}
                onClick={async () => {
                  await deleteSector(s.id);
                  qc.invalidateQueries({ queryKey: ["ws-sectors"] });
                }}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </span>
          ))}
          {(sectors.data?.length ?? 0) === 0 && <p className="text-sm text-muted-foreground">Nenhum setor cadastrado.</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TextInput
            value={sectorName}
            onChange={(e) => setSectorName(e.target.value)}
            placeholder="Novo setor (ex.: Design)"
            className="max-w-xs"
          />
          <Btn variant="outline" onClick={addSector} disabled={!sectorName.trim()}>
            Adicionar
          </Btn>
        </div>
      </section>

      {form.open && (
        <TemplateModal
          template={form.template}
          onClose={() => setForm({ open: false })}
          onSaved={() => qc.invalidateQueries({ queryKey: ["ws-templates"] })}
        />
      )}
    </div>
  );
}

/** Editor de modelo: nome, tipo e a lista de demandas, uma por linha. */
function TemplateModal({
  template,
  onClose,
  onSaved,
}: {
  template?: WorkTemplate | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(template?.name ?? "");
  const [kind, setKind] = useState(template?.kind ?? "ciclo");
  const [lines, setLines] = useState(
    template ? templateTasks(template).map((t) => [t.title, t.sector].filter(Boolean).join(" | ")).join("\n") : "",
  );
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const tasks = lines
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const [title, sector] = l.split("|").map((p) => p.trim());
          return { title, sector: sector || null };
        });
      if (template) await updateTemplate(template.id, { name: name.trim(), kind, tasks });
      else await createTemplate({ name: name.trim(), kind, tasks });
      onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!template) return;
    setBusy(true);
    try {
      await deleteTemplate(template.id);
      onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormModal
      title={template ? "Editar modelo" : "Novo modelo de demanda"}
      description="Cada linha vira uma demanda. Use “título | setor” para já indicar o setor."
      onClose={onClose}
      footer={
        <>
          {template && (
            <Btn variant="danger" onClick={remove} disabled={busy} className="mr-auto">
              Excluir
            </Btn>
          )}
          <Btn variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Btn>
          <Btn variant="primary" onClick={save} disabled={busy || !name.trim()}>
            {busy ? "Salvando…" : "Salvar"}
          </Btn>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Semana padrão" />
        </Field>
        <Field label="Tipo">
          <TextInput value={kind} onChange={(e) => setKind(e.target.value)} placeholder="ciclo, campanha…" />
        </Field>
      </div>
      <Field label="Demandas do modelo" hint="Uma por linha.">
        <TextArea
          rows={7}
          value={lines}
          onChange={(e) => setLines(e.target.value)}
          placeholder={"Carrossel semanal | Design\nStories da semana | Social\nLegenda do post | Redação"}
        />
      </Field>
    </FormModal>
  );
}
