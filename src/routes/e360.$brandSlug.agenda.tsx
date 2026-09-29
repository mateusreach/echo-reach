import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { goToLogin } from "@/lib/login-redirect";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { ReachIconAnimation } from "@/components/reach/reach-icon-animation";
import { SpaceShell } from "@/components/reach/space-shell";
import { PageHeader } from "@/components/reach/page-header";
import { GlassCard } from "@/components/reach/glass-card";
import { Btn, EmptyState, StatusChip } from "@/components/ui-reach/primitives";
import { isViewingAsClient } from "@/lib/view-as";
import { getAccess, modulePermissionKey } from "@/lib/agency-data";
import { supabase } from "@/integrations/supabase/client";
import {
  createCalendarEvent,
  brandModules,
  getBrandBySlug,
  getBrandMembership,
  getProfile,
  listCalendarEvents,
  listCampaigns,
  listDeliveries,
  listMeetings,
  listTasks,
  type Brand,
  type Campaign,
  type CalendarEvent,
  type Delivery,
  type Espaco360Task,
  type Meeting,
} from "@/lib/reach-data";

export const Route = createFileRoute("/e360/$brandSlug/agenda")({
  component: AgendaPage,
});

type ViewMode = "dia" | "semana" | "mes" | "ano" | "lista";
type Kind = "reuniao" | "tarefa" | "entrega" | "prazo" | "campanha" | "compromisso";

type AgendaItem = {
  id: string;
  date: string;
  title: string;
  kind: Kind;
  goTo: string;
  start?: string | null;
  end?: string | null;
  responsible?: string | null;
  status?: string | null;
  note?: string | null;
};

function hhmm(v?: string | null) {
  return v ? String(v).slice(0, 5) : null;
}
function timeLabel(it: AgendaItem) {
  const s = hhmm(it.start);
  const e = hhmm(it.end);
  if (s && e) return `${s}–${e}`;
  return s;
}

const KIND_LABELS: Record<Kind, string> = {
  reuniao: "Reunião",
  tarefa: "Tarefa",
  entrega: "Entrega",
  prazo: "Prazo",
  campanha: "Campanha",
  compromisso: "Compromisso",
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function addDaysISO(base: string, days: number) {
  const d = new Date(base + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function rangeForView(view: ViewMode, anchor: string) {
  if (view === "lista") return { from: anchor, to: addDaysISO(anchor, 90) };
  if (view === "dia") return { from: anchor, to: anchor };
  if (view === "semana") return { from: anchor, to: addDaysISO(anchor, 6) };
  if (view === "mes") {
    const d = new Date(anchor + "T00:00:00");
    const from = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
    const to = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
    return { from, to };
  }
  const d = new Date(anchor + "T00:00:00");
  const from = new Date(d.getFullYear(), 0, 1).toISOString().slice(0, 10);
  const to = new Date(d.getFullYear(), 11, 31).toISOString().slice(0, 10);
  return { from, to };
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const KIND_DOT: Record<Kind, string> = {
  reuniao: "bg-reach-violet",
  tarefa: "bg-reach-blue",
  entrega: "bg-reach-mint",
  prazo: "bg-reach-rose",
  campanha: "bg-reach-coral",
  compromisso: "bg-reach-amber",
};

function monthLabel(anchor: string) {
  const d = new Date(anchor + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

/** Grade mensal estilo calendário — 7 colunas, semanas completas. */
function MonthGrid({ anchor, items, onOpenDay, onOpenItem }: { anchor: string; items: AgendaItem[]; onOpenDay: (iso: string) => void; onOpenItem: (it: AgendaItem) => void }) {
  const d = new Date(anchor + "T00:00:00");
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const cells: string[] = [];
  for (let i = 0; i < 42; i++) {
    const c = new Date(start);
    c.setDate(start.getDate() + i);
    cells.push(c.toISOString().slice(0, 10));
  }
  const byDay: Record<string, AgendaItem[]> = {};
  for (const it of items) (byDay[it.date] ||= []).push(it);
  const today = todayISO();
  const month = d.getMonth();

  return (
    <GlassCard level={2} className="overflow-hidden p-0">
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAYS.map((w) => (
          <div key={w} className="px-2 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((iso) => {
          const dayItems = byDay[iso] ?? [];
          const outside = new Date(iso + "T00:00:00").getMonth() !== month;
          return (
            <div
              key={iso}
              onDoubleClick={() => onOpenDay(iso)}
              className={`min-h-[104px] border-b border-r border-border p-1.5 ${outside ? "opacity-40" : ""}`}
            >
              <button onClick={() => onOpenDay(iso)} className={`mb-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11.5px] ${iso === today ? "bg-reach-coral font-semibold text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                {Number(iso.slice(8, 10))}
              </button>
              <div className="space-y-1">
                {dayItems.slice(0, 3).map((it) => (
                  <button key={it.id} onClick={() => onOpenItem(it)} title={`${KIND_LABELS[it.kind]} · ${it.title}`} className="flex w-full items-center gap-1.5 rounded-md bg-card px-1.5 py-1 text-left hover:bg-muted">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${KIND_DOT[it.kind]}`} />
                    <span className="min-w-0 flex-1 truncate text-[11px]">{timeLabel(it) ? `${timeLabel(it)} ` : ""}{it.title}</span>
                  </button>
                ))}
                {dayItems.length > 3 && (
                  <button onClick={() => onOpenDay(iso)} className="px-1.5 text-[10.5px] text-muted-foreground hover:text-foreground">+{dayItems.length - 3} mais</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

function AgendaPage() {
  const { brandSlug } = Route.useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [displayName, setDisplayName] = useState("Você");
  const [canEdit, setCanEdit] = useState(false);

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [tasks, setTasks] = useState<Espaco360Task[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  const [view, setView] = useState<ViewMode>("semana");
  const [anchor, setAnchor] = useState(todayISO());
  const [kindFilter, setKindFilter] = useState<Kind | "todas">("todas");
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayISO());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [responsible, setResponsible] = useState("");
  const [eventStatus, setEventStatus] = useState("confirmado");
  const [eventNote, setEventNote] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTitle, setDeliveryTitle] = useState("");

  async function refresh() {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) {
      goToLogin(navigate as never);
      return;
    }
    const b = await getBrandBySlug(brandSlug);
    if (!b || !brandModules(b).espaco360) {
      setLoading(false);
      return;
    }
    const access = await getAccess();
    const membership = access.isAgency ? null : await getBrandMembership(b.id);
    if (!access.isAgency && !membership?.isAdmin && !membership?.permissions.includes(modulePermissionKey("espaco360", "visualizar"))) {
      setLoading(false);
      return;
    }
    setBrand(b);
    const [profile, meets, tks, dels, camps, evs] = await Promise.all([
      getProfile(session.user.id),
      listMeetings(b.id),
      listTasks(b.id),
      listDeliveries(b.id),
      listCampaigns(b.id),
      listCalendarEvents(b.id),
    ]);
    setCanEdit(!isViewingAsClient() && (access.isAgency || !!membership?.isAdmin || !!membership?.permissions.includes(modulePermissionKey("espaco360", "editar"))));
    if (profile?.display_name) setDisplayName(profile.display_name);
    setMeetings(meets);
    setTasks(tks);
    setDeliveries(dels);
    setCampaigns(camps);
    setEvents(evs);
    setLoading(false);
  }

  useEffect(() => {
    setLoading(true);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandSlug]);

  const { from, to } = rangeForView(view, anchor);

  const items: AgendaItem[] = useMemo(() => {
    const list: AgendaItem[] = [];
    for (const m of meetings) list.push({ id: `meeting-${m.id}`, date: m.meeting_date, title: m.title, kind: "reuniao", goTo: "Reuniões" });
    for (const t of tasks) {
      if (!t.due_date) continue;
      list.push({ id: `task-${t.id}`, date: t.due_date, title: t.title, kind: "tarefa", goTo: "Tarefas", status: t.status, responsible: (t as any).responsible ?? null });
    }
    for (const d of deliveries) {
      if (!d.due_date) continue;
      list.push({ id: `delivery-${d.id}`, date: d.due_date, title: d.title, kind: "entrega", goTo: "Entregas", status: d.status });
    }
    for (const c of campaigns) {
      if (c.end_date) list.push({ id: `campaign-end-${c.id}`, date: c.end_date, title: `${c.title} (encerramento)`, kind: "prazo", goTo: "Campanhas" });
      if (c.start_date) list.push({ id: `campaign-start-${c.id}`, date: c.start_date, title: `${c.title} (início)`, kind: "campanha", goTo: "Campanhas" });
    }
    for (const e of events) {
      const ev = e as any;
      list.push({
        id: `event-${e.id}`,
        date: e.event_date,
        title: e.title,
        kind: "compromisso",
        goTo: "",
        start: ev.start_time ?? null,
        end: ev.end_time ?? null,
        responsible: ev.responsible ?? null,
        status: ev.status ?? null,
        note: e.description ?? null,
      });
      if (ev.delivery_date) {
        list.push({
          id: `event-delivery-${e.id}`,
          date: ev.delivery_date,
          title: ev.delivery_title || `Entrega · ${e.title}`,
          kind: "entrega",
          goTo: "",
          responsible: ev.responsible ?? null,
        });
      }
    }
    return list
      .filter((i) => i.date >= from && i.date <= to)
      .filter((i) => kindFilter === "todas" || i.kind === kindFilter)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? -1 : 1;
        return (hhmm(a.start) ?? "99:99").localeCompare(hhmm(b.start) ?? "99:99");
      });
  }, [meetings, tasks, deliveries, campaigns, events, from, to, kindFilter]);

  const grouped = useMemo(() => {
    const map: Record<string, AgendaItem[]> = {};
    for (const it of items) {
      map[it.date] = map[it.date] || [];
      map[it.date].push(it);
    }
    return Object.entries(map).sort(([a], [b]) => (a < b ? -1 : 1));
  }, [items]);

  async function addEvent() {
    if (!brand || !title.trim() || !date) return;
    await createCalendarEvent({
      brand_id: brand.id,
      title: title.trim(),
      event_date: date,
      event_type: "compromisso",
      description: eventNote.trim() || null,
      start_time: startTime || null,
      end_time: endTime || null,
      responsible: responsible.trim() || null,
      status: eventStatus,
      delivery_date: deliveryDate || null,
      delivery_title: deliveryTitle.trim() || null,
    } as any);
    setTitle("");
    setEventNote("");
    setResponsible("");
    setDeliveryDate("");
    setDeliveryTitle("");
    setAdding(false);
    refresh();
  }

  function openItem(it: AgendaItem) {
    if (!it.goTo) return;
    navigate({ to: "/e360/$brandSlug", params: { brandSlug }, search: { tab: it.goTo } as any });
  }

  function shiftAnchor(days: number) {
    setAnchor((a) => {
      if (view === "mes" || view === "ano") {
        const d = new Date(a + "T00:00:00");
        const next = view === "mes"
          ? new Date(d.getFullYear(), d.getMonth() + (days > 0 ? 1 : -1), 1)
          : new Date(d.getFullYear() + (days > 0 ? 1 : -1), d.getMonth(), 1);
        return next.toISOString().slice(0, 10);
      }
      return addDaysISO(a, days);
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <ReachIconAnimation size={48} context="page-loading" />
        <p className="text-sm text-muted-foreground">Carregando Agenda…</p>
      </div>
    );
  }
  if (!brand) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <p className="text-lg font-semibold">Marca não encontrada</p>
      </div>
    );
  }

  const stepDays = view === "dia" ? 1 : view === "semana" ? 7 : view === "mes" ? 30 : view === "lista" ? 30 : 365;

  return (
    <SpaceShell brandSlug={brandSlug} brandName={brand.name} primaryColor={(brand as any)?.primary_color} accentColor={(brand as any)?.accent_color}>
      <PageHeader eyebrow="Organização" title="Agenda" description="Reuniões, tarefas, entregas, prazos, campanhas e compromissos em um só lugar." />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <GlassCard level={1} className="flex flex-wrap gap-1 p-1">
          {(["dia", "semana", "mes", "ano", "lista"] as ViewMode[]).map((v) => (
            <button key={v} onClick={() => setView(v)} className={view === v ? "rounded-xl bg-reach-coral px-3 py-1.5 text-[12.5px] font-medium text-primary-foreground" : "rounded-xl px-3 py-1.5 text-[12.5px] text-muted-foreground hover:bg-muted"}>
              {v === "dia" ? "Dia" : v === "semana" ? "Semana" : v === "mes" ? "Mês" : v === "ano" ? "Ano" : "Lista"}
            </button>
          ))}
        </GlassCard>
        <div className="flex items-center gap-2">
          <Btn size="sm" variant="ghost" onClick={() => shiftAnchor(-stepDays)}>← Anterior</Btn>
          <Btn size="sm" variant="ghost" onClick={() => setAnchor(todayISO())}>Hoje</Btn>
          <Btn size="sm" variant="ghost" onClick={() => shiftAnchor(stepDays)}>Próximo →</Btn>
        </div>
      </div>

      <GlassCard level={1} className="mb-6 flex flex-wrap gap-1 p-1">
        {(["todas", "reuniao", "tarefa", "entrega", "prazo", "campanha", "compromisso"] as const).map((k) => (
          <button key={k} onClick={() => setKindFilter(k)} className={kindFilter === k ? "rounded-xl bg-reach-violet px-3 py-1.5 text-[12.5px] font-medium text-primary-foreground" : "rounded-xl px-3 py-1.5 text-[12.5px] text-muted-foreground hover:bg-muted"}>
            {k === "todas" ? "Todas" : KIND_LABELS[k]}
          </button>
        ))}
      </GlassCard>

      <p className="mb-4 text-[12px] capitalize text-muted-foreground">{view === "mes" ? monthLabel(anchor) : `Período: ${from} até ${to}`}</p>

      {view === "mes" && (
        <MonthGrid
          anchor={anchor}
          items={items}
          onOpenDay={(iso) => { setAnchor(iso); setView("dia"); }}
          onOpenItem={openItem}
        />
      )}

      <div className={view === "mes" ? "hidden" : "space-y-5"}>
        {grouped.map(([d, its]) => (
          <GlassCard key={d} level={2} className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <CalendarDays className="h-3.5 w-3.5 text-reach-amber" />
              <h3 className="text-[13px] font-semibold">{d}</h3>
            </div>
            <div className="space-y-2">
              {its.map((it) => (
                <button key={it.id} onClick={() => openItem(it)} disabled={!it.goTo} className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-3.5 py-2.5 text-left transition-colors enabled:hover:bg-muted disabled:cursor-default">
                  <span className="w-[86px] shrink-0 text-[12px] tabular-nums text-muted-foreground">{timeLabel(it) ?? "Dia todo"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${KIND_DOT[it.kind]}`} />
                      <span className="truncate text-[13px]">{it.title}</span>
                    </span>
                    {(it.responsible || it.note) && (
                      <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">
                        {[it.responsible ? `Responsável: ${it.responsible}` : null, it.note].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </span>
                  <StatusChip status="planejamento" label={KIND_LABELS[it.kind]} />
                </button>
              ))}
            </div>
          </GlassCard>
        ))}
        {grouped.length === 0 && <EmptyState title="Nada neste período" description="Ajuste a visualização ou o filtro para ver outros itens da agenda." />}
      </div>

      {canEdit && (
        <GlassCard level={2} className="mt-6 p-4">
          {adding ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <input autoFocus placeholder="Título do compromisso" value={title} onChange={(e) => setTitle(e.target.value)} className="input-reach min-w-[220px] flex-1" />
                <input type="date" aria-label="Data" value={date} onChange={(e) => setDate(e.target.value)} className="input-reach w-40" />
                <input type="time" aria-label="Início" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="input-reach w-28" />
                <input type="time" aria-label="Término" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="input-reach w-28" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input placeholder="Responsável" value={responsible} onChange={(e) => setResponsible(e.target.value)} className="input-reach w-48" />
                <select aria-label="Status" value={eventStatus} onChange={(e) => setEventStatus(e.target.value)} className="input-reach w-40">
                  <option value="confirmado">Confirmado</option>
                  <option value="pendente">Pendente</option>
                  <option value="cancelado">Cancelado</option>
                </select>
                <input placeholder="Observações" value={eventNote} onChange={(e) => setEventNote(e.target.value)} className="input-reach min-w-[200px] flex-1" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11.5px] text-muted-foreground">Entrega vinculada:</span>
                <input type="date" aria-label="Data de entrega" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="input-reach w-40" />
                <input placeholder="O que será entregue" value={deliveryTitle} onChange={(e) => setDeliveryTitle(e.target.value)} className="input-reach min-w-[200px] flex-1" />
              </div>
              <div className="flex justify-end gap-2">
                <Btn size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancelar</Btn>
                <Btn size="sm" onClick={addEvent}>Adicionar compromisso</Btn>
              </div>
            </div>
          ) : (
            <Btn variant="outline" size="sm" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" /> Novo compromisso</Btn>
          )}
        </GlassCard>
      )}
    </SpaceShell>
  );
}
