import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Plus, Search, Trash2, X } from "lucide-react";
import { PillButton } from "@/components/reach/ui";
import { ImageField } from "@/components/reach/uploader";
import { listBrands, type Brand } from "@/lib/reach-data";
import {
  REF_PURPOSES,
  REF_WHEN,
  createRefCategoria,
  createReferencia,
  deleteReferencia,
  listRefCategorias,
  listReferencias,
  updateReferencia,
  type RefCategoria,
  type Referencia,
} from "@/lib/agency-data";
import { cn } from "@/lib/utils";

export function ReferenciasPanel({
  brandId,
  channelId,
  modelId,
  canEdit = true,
}: {
  brandId: string;
  /** Quando definido, mostra só (e cria já vinculada a) as referências deste canal/modelo em vez do acervo geral do cliente. */
  channelId?: string;
  modelId?: string;
  canEdit?: boolean;
}) {
  const [refs, setRefs] = useState<Referencia[]>([]);
  const [cats, setCats] = useState<RefCategoria[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState("todas");
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<Partial<Referencia> | null>(null);

  async function refresh() {
    const [r, c, b] = await Promise.all([listReferencias(brandId, { channelId, modelId }), listRefCategorias(), listBrands()]);
    setRefs(r);
    setCats(c);
    setBrands(b);
  }

  useEffect(() => {
    refresh().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId, channelId, modelId]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return refs.filter((r) => {
      if (!showInactive && r.active === false) return false;
      if (catFilter !== "todas" && r.category !== catFilter) return false;
      if (!q) return true;
      return `${r.title} ${r.description ?? ""} ${(r.tags ?? []).join(" ")}`.toLowerCase().includes(q);
    });
  }, [refs, query, catFilter, showInactive]);

  return (
    <div className="space-y-5">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{channelId ? "Referências deste canal" : "Referências deste cliente"}</h2>
          <p className="truncate text-xs text-muted-foreground">Acervo estratégico e criativo específico da marca.</p>
        </div>
        {canEdit && (
          <PillButton onClick={() => setEditing({ tags: [], links: [], attachments: [], brand_id: brandId, channel_id: channelId ?? null, model_id: modelId ?? null, active: true })} className="shrink-0">
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Nova referência</span>
          </PillButton>
        )}
      </header>


      <div className="flex flex-wrap items-center gap-3">
        <label className="surface flex min-w-[220px] flex-1 items-center gap-2 rounded-full px-4 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por título ou tag…" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </label>
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="rounded-full border border-border bg-background/50 px-4 py-2 text-sm outline-none">
          <option value="todas">Todas as categorias</option>
          {cats.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
          Mostrar inativas
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((r) => (
          <button key={r.id} onClick={() => setEditing(r)} className={cn("surface flex flex-col gap-2 rounded-2xl p-4 text-left transition-transform hover:-translate-y-0.5", r.active === false && "opacity-50")}>
            {r.cover_url && <img src={r.cover_url} alt={r.title} className="aspect-video w-full rounded-xl object-cover" loading="lazy" />}
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{r.category || "Sem categoria"}{r.active === false && " · Inativa"}</p>
            <p className="text-sm font-medium">{r.title}</p>
            {r.description && <p className="line-clamp-2 text-xs text-muted-foreground">{r.description}</p>}
            <div className="mt-1 flex flex-wrap gap-1.5">
              {(r.tags ?? []).slice(0, 4).map((t) => (
                <span key={t} className="rounded-full bg-muted px-2.5 py-1 text-[10.5px] text-muted-foreground">{t}</span>
              ))}
            </div>
            {r.purpose && <p className="text-[11px] text-brand">{r.purpose}</p>}
          </button>
        ))}
        {visible.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma referência cadastrada.</p>}
      </div>

      {editing && (
        <RefDrawer
          value={editing}
          cats={cats}
          brands={brands}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

const inputCls = "w-full rounded-full border border-border bg-background/50 px-4 py-2.5 text-sm outline-none focus:border-primary";

function RefDrawer({
  value,
  cats,
  brands,
  onClose,
  onSaved,
}: {
  value: Partial<Referencia>;
  cats: RefCategoria[];
  brands: Brand[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<Referencia>>(value);
  const [tagInput, setTagInput] = useState((value.tags ?? []).join(", "));
  const [linkInput, setLinkInput] = useState((value.links ?? []).map((l) => l.url).join("\n"));
  const [newCat, setNewCat] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!form.title?.trim()) {
      setErr("Informe um título.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      if (newCat.trim()) await createRefCategoria(newCat.trim());
      const payload = {
        title: form.title.trim(),
        description: form.description || null,
        category: newCat.trim() || form.category || "",
        tags: tagInput.split(",").map((t) => t.trim()).filter(Boolean),
        purpose: form.purpose || null,
        when_to_use: form.when_to_use || null,
        usage_notes: form.usage_notes || null,
        links: linkInput.split("\n").map((u) => u.trim()).filter(Boolean).map((url) => ({ url })),
        attachments: form.attachments ?? [],
        cover_url: form.cover_url || null,
        brand_id: form.brand_id || null,
        channel_id: form.channel_id ?? null,
        model_id: form.model_id ?? null,
        active: form.active !== false,
      };
      if (form.id) await updateReferencia(form.id, payload as any);
      else await createReferencia(payload as any);
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overlay-scrim p-0 sm:items-center sm:p-6">
      <div className="surface max-h-[92vh] w-full max-w-xl space-y-3 overflow-y-auto rounded-t-3xl p-5 sm:rounded-3xl">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <h2 className="truncate text-sm font-semibold">{form.id ? "Editar referência" : "Nova referência"}</h2>
          <button onClick={onClose} aria-label="Fechar" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}

        <Field label="Título">
          <input value={form.title ?? ""} onChange={(e) => setForm((v) => ({ ...v, title: e.target.value }))} className={inputCls} />
        </Field>
        <Field label="Descrição">
          <textarea rows={3} value={form.description ?? ""} onChange={(e) => setForm((v) => ({ ...v, description: e.target.value }))} className="w-full rounded-2xl border border-border bg-background/50 px-4 py-2.5 text-sm outline-none focus:border-primary" />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Categoria">
            <select value={form.category ?? ""} onChange={(e) => setForm((v) => ({ ...v, category: e.target.value }))} className={inputCls}>
              <option value="">Selecione…</option>
              {cats.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Nova categoria">
            <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Criar categoria" className={inputCls} />
          </Field>
          <Field label="Finalidade estratégica">
            <select value={form.purpose ?? ""} onChange={(e) => setForm((v) => ({ ...v, purpose: e.target.value }))} className={inputCls}>
              <option value="">Selecione…</option>
              {REF_PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Quando usar">
            <select value={form.when_to_use ?? ""} onChange={(e) => setForm((v) => ({ ...v, when_to_use: e.target.value }))} className={inputCls}>
              <option value="">Selecione…</option>
              {REF_WHEN.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Cliente relacionado">
            <select value={form.brand_id ?? ""} onChange={(e) => setForm((v) => ({ ...v, brand_id: e.target.value || null }))} className={inputCls}>
              <option value="">Geral (Reach)</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Tags (separadas por vírgula)">
            <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} className={inputCls} />
          </Field>
        </div>

        <Field label="Links (um por linha)">
          <textarea rows={3} value={linkInput} onChange={(e) => setLinkInput(e.target.value)} className="w-full rounded-2xl border border-border bg-background/50 px-4 py-2.5 text-sm outline-none focus:border-primary" />
        </Field>
        <Field label="Observações de uso">
          <textarea rows={2} value={form.usage_notes ?? ""} onChange={(e) => setForm((v) => ({ ...v, usage_notes: e.target.value }))} className="w-full rounded-2xl border border-border bg-background/50 px-4 py-2.5 text-sm outline-none focus:border-primary" />
        </Field>

        <Field label="Capa / anexo visual">
          <ImageField
            folder="referencias"
            value={form.cover_url ?? null}
            onChange={(url) => setForm((v) => ({ ...v, cover_url: url }))}
          />
        </Field>

        <label className="flex items-center gap-2 text-[12.5px]">
          <input type="checkbox" checked={form.active !== false} onChange={(e) => setForm((v) => ({ ...v, active: e.target.checked }))} className="h-4 w-4 accent-[var(--primary)]" />
          Referência ativa
        </label>

        {(form.links ?? []).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {(form.links ?? []).map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                <ExternalLink className="h-3 w-3" /> {l.label ?? "Abrir"}
              </a>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <PillButton onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</PillButton>
          {form.id && (
            <button
              onClick={async () => {
                await deleteReferencia(form.id!);
                onSaved();
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" /> Excluir
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className={cn("block space-y-1")}>
      <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
