import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2, X } from "lucide-react";
import { PillButton } from "@/components/reach/ui";
import { listBrands, type Brand } from "@/lib/reach-data";
import {
  EVENT_CATEGORIES,
  EVENT_STATUSES,
  createAgencyEvent,
  deleteAgencyEvent,
  listAgencyEvents,
  updateAgencyEvent,
  type AgencyEvent,
} from "@/lib/agency-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/agencia/calendario")({
  head: () => ({
    meta: [
      { title: "Calendário da Agência — Reach Brand OS" },
      { name: "description", content: "Calendário mensal editável com marcos da Reach e dos clientes." },
      { property: "og:title", content: "Calendário da Agência" },
      { property: "og:description", content: "Marcos, campanhas, reuniões e entregas em um só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CalendarioPage,
});

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function CalendarioPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [events, setEvents] = useState<AgencyEvent[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [editing, setEditing] = useState<Partial<AgencyEvent> | null>(null);

  async function refresh() {
    const [e, b] = await Promise.all([listAgencyEvents(), listBrands()]);
    setEvents(e);
    setBrands(b);
  }

  useEffect(() => {
    refresh().catch(() => undefined);
  }, []);

  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const start = first.getDay();
    const days = new Date(year, month + 1, 0).getDate();
    const arr: (string | null)[] = Array.from({ length: start }, () => null);
    for (let d = 1; d <= days; d++) {
      arr.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [year, month]);

  const byDate = useMemo(() => {
    const map = new Map<string, AgencyEvent[]>();
    for (const e of events) {
      const list = map.get(e.event_date) ?? [];
      list.push(e);
      map.set(e.event_date, list);
    }
    return map;
  }, [events]);

  function shift(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  const label = new Date(year, month, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="space-y-5">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold capitalize tracking-tight">{label}</h1>
          <p className="truncate text-sm text-muted-foreground">Marcos da agência e dos clientes.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={() => shift(-1)} aria-label="Mês anterior" className="grid h-10 w-10 place-items-center rounded-full border border-border text-muted-foreground">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => shift(1)} aria-label="Próximo mês" className="grid h-10 w-10 place-items-center rounded-full border border-border text-muted-foreground">
            <ChevronRight className="h-4 w-4" />
          </button>
          <PillButton onClick={() => setEditing({ event_date: todayInMonth(year, month), category: "interno", status: "planejado" })}>
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Novo marco</span>
          </PillButton>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {EVENT_CATEGORIES.map((c) => (
          <span key={c.key} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
            <span className="h-2 w-2 rounded-full" style={{ background: c.color }} /> {c.label}
          </span>
        ))}
      </div>

      <div className="surface overflow-hidden rounded-2xl">
        <div className="grid grid-cols-7 border-b border-border text-center text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-2">{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((iso, idx) => (
            <div key={idx} className="min-h-[92px] border-b border-r border-border p-1.5 last:border-r-0 sm:min-h-[112px]">
              {iso && (
                <button onClick={() => setEditing({ event_date: iso, category: "interno", status: "planejado" })} className="mb-1 text-[11px] text-muted-foreground hover:text-foreground">
                  {Number(iso.slice(-2))}
                </button>
              )}
              <div className="space-y-1">
                {iso &&
                  (byDate.get(iso) ?? []).map((e) => (
                    <button
                      key={e.id}
                      onClick={() => setEditing(e)}
                      className="block w-full truncate rounded-lg px-1.5 py-1 text-left text-[11px]"
                      style={{ background: `color-mix(in oklab, ${colorOf(e.category)} 14%, transparent)`, color: colorOf(e.category) }}
                    >
                      {e.title}
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {editing && (
        <EventDrawer
          event={editing}
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

function colorOf(category: string) {
  return EVENT_CATEGORIES.find((c) => c.key === category)?.color ?? "var(--muted-foreground)";
}

function todayInMonth(year: number, month: number) {
  const now = new Date();
  const d = now.getFullYear() === year && now.getMonth() === month ? now.getDate() : 1;
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function EventDrawer({
  event,
  brands,
  onClose,
  onSaved,
}: {
  event: Partial<AgencyEvent>;
  brands: Brand[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<AgencyEvent>>(event);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!form.title?.trim() || !form.event_date) {
      setErr("Título e data são obrigatórios.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const payload = {
        title: form.title.trim(),
        event_date: form.event_date,
        event_time: form.event_time || null,
        category: form.category ?? "interno",
        brand_id: form.brand_id || null,
        responsible: form.responsible || null,
        description: form.description || null,
        status: form.status ?? "planejado",
        notes: form.notes || null,
      };
      if (form.id) await updateAgencyEvent(form.id, payload);
      else await createAgencyEvent(payload as any);
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!form.id) return;
    await deleteAgencyEvent(form.id);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overlay-scrim p-0 sm:items-center sm:p-6">
      <div className="surface max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-t-3xl p-5 sm:rounded-3xl">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <h2 className="truncate text-sm font-semibold">{form.id ? "Editar marco" : "Novo marco"}</h2>
          <button onClick={onClose} aria-label="Fechar" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}

        <Field label="Título">
          <input value={form.title ?? ""} onChange={(e) => setForm((v) => ({ ...v, title: e.target.value }))} className={inputCls} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Data">
            <input type="date" value={form.event_date ?? ""} onChange={(e) => setForm((v) => ({ ...v, event_date: e.target.value }))} className={inputCls} />
          </Field>
          <Field label="Hora">
            <input type="time" value={form.event_time ?? ""} onChange={(e) => setForm((v) => ({ ...v, event_time: e.target.value }))} className={inputCls} />
          </Field>
          <Field label="Categoria">
            <select value={form.category ?? "interno"} onChange={(e) => setForm((v) => ({ ...v, category: e.target.value }))} className={inputCls}>
              {EVENT_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={form.status ?? "planejado"} onChange={(e) => setForm((v) => ({ ...v, status: e.target.value }))} className={inputCls}>
              {EVENT_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Cliente">
            <select value={form.brand_id ?? ""} onChange={(e) => setForm((v) => ({ ...v, brand_id: e.target.value || null }))} className={inputCls}>
              <option value="">Reach (interno)</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Responsável">
            <input value={form.responsible ?? ""} onChange={(e) => setForm((v) => ({ ...v, responsible: e.target.value }))} className={inputCls} />
          </Field>
        </div>
        <Field label="Descrição">
          <textarea rows={3} value={form.description ?? ""} onChange={(e) => setForm((v) => ({ ...v, description: e.target.value }))} className="w-full rounded-2xl border border-border bg-background/50 px-4 py-2.5 text-sm outline-none focus:border-primary" />
        </Field>

        <div className="flex flex-wrap items-center gap-2">
          <PillButton onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</PillButton>
          {form.id && (
            <button onClick={remove} className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs text-destructive">
              <Trash2 className="h-3.5 w-3.5" /> Excluir
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-full border border-border bg-background/50 px-4 py-2.5 text-sm outline-none focus:border-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className={cn("block space-y-1")}>
      <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
