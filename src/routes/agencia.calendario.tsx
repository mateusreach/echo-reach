import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PeriodNavigator } from "@/components/echo/operations";
import { AgendaRow } from "@/components/echo/blocks";
import { Button, EmptyState, Skeleton } from "@/components/echo/primitives";
import { Chip, Field, Segmented, Select, TextArea } from "@/components/echo/controls";
import { Drawer, HoldButton } from "@/components/echo/overlays";
import { Icon } from "@/components/echo/icon";
import { enter } from "@/components/echo/motion";
import { useAccess } from "@/components/echo/session";
import { EVENT_CATEGORIES, EVENT_STATUSES } from "@/lib/agency-data";
import { loadCalendar, removeEvent, saveEvent, type AgendaEntry } from "@/lib/agency-page-data";
import { toISO, today } from "@/lib/workspace-data";
import { entryTone } from "@/components/echo/blocks";

export const Route = createFileRoute("/agencia/calendario")({
  head: () => ({ meta: [{ title: "Calendário · Agência · Echo" }] }),
  component: AgencyCalendar,
});

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const DIAS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
const LAYERS = [
  { key: "marco", label: "Marcos", icon: "flag", color: "var(--env-brand)" },
  { key: "prazo", label: "Prazos do Workspace", icon: "checkCircle", color: "var(--env-workspace)" },
  { key: "reuniao", label: "Reuniões do 360", icon: "users", color: "var(--env-360)" },
] as const;
const PREF = "echo.agency-calendar";

type Draft = { id?: string; title: string; event_date: string; event_time: string; category: string; status: string; brand_id: string; responsible: string; description: string };

function monthGrid(y: number, m: number) {
  const first = new Date(y, m, 1);
  const start = (first.getDay() + 6) % 7;
  const cells: { iso: string; day: number; out: boolean }[] = [];
  for (let i = -start; cells.length < 42; i++) {
    const d = new Date(y, m, 1 + i);
    cells.push({ iso: toISO(d), day: d.getDate(), out: d.getMonth() !== m });
    if (cells.length >= 35 && cells.length % 7 === 0 && new Date(y, m, 2 + i).getMonth() !== m) break;
  }
  return cells;
}

function readPref(): { layers: string[]; brand: string; view: "mes" | "lista" } {
  try { return { layers: ["marco", "prazo", "reuniao"], brand: "todos", view: "mes", ...JSON.parse(sessionStorage.getItem(PREF) || "{}") }; }
  catch { return { layers: ["marco", "prazo", "reuniao"], brand: "todos", view: "mes" }; }
}

function AgencyCalendar() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { can } = useAccess();
  const canEdit = can("calendario.criar") || can("calendario.editar");
  const canDelete = can("calendario.excluir");
  const now = today();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [ready, setReady] = useState(false);
  const [layers, setLayers] = useState<string[]>(["marco", "prazo", "reuniao"]);
  const [brand, setBrand] = useState("todos");
  const [view, setView] = useState<"mes" | "lista">("mes");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [err, setErr] = useState<{ title?: string; date?: string }>({});
  const [saving, setSaving] = useState(false);
  const grid = useRef<HTMLDivElement>(null);
  const dir = useRef(0);

  useEffect(() => { const p = readPref(); setLayers(p.layers); setBrand(p.brand); setView(p.view); setReady(true); }, []);
  useEffect(() => { if (ready) try { sessionStorage.setItem(PREF, JSON.stringify({ layers, brand, view })); } catch { /* ok */ } }, [layers, brand, view, ready]);

  const cells = useMemo(() => monthGrid(ym.y, ym.m), [ym]);
  const range = { start: cells[0].iso, end: cells[cells.length - 1].iso };
  const q = useQuery({ queryKey: ["agency-calendar", range.start, range.end], queryFn: () => loadCalendar(range.start, range.end), enabled: ready });

  useEffect(() => { if (grid.current && dir.current) enter(grid.current, { x: dir.current * 18, y: 0, blur: 3, dur: 320 }); }, [ym]);

  const brands = q.data?.brands ?? [];
  const brandName = (id?: string | null) => (id ? brands.find((b) => b.id === id)?.name ?? "Cliente" : "Reach (interno)");
  const all: AgendaEntry[] = q.data ? [...q.data.marcos, ...q.data.prazos, ...q.data.reunioes] : [];
  const entries = all
    .filter((e) => layers.includes(e.layer))
    .filter((e) => brand === "todos" || (brand === "interno" ? !e.brandId : e.brandId === brand))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));
  const byDay = (iso: string) => entries.filter((e) => e.date === iso);
  const colorOf = (e: AgendaEntry) => (e.layer === "marco" ? EVENT_CATEGORIES.find((c) => c.key === e.category)?.color ?? "var(--env-brand)" : LAYERS.find((l) => l.key === e.layer)!.color);

  const go = (delta: number) => { dir.current = delta; setYm(({ y, m }) => { const d = new Date(y, m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() }; }); };
  const goToday = () => { dir.current = 0; setYm({ y: now.getFullYear(), m: now.getMonth() }); };

  const open = (e: AgendaEntry) => {
    if (e.layer === "marco" && e.source) {
      const s = e.source;
      setErr({});
      setDraft({ id: s.id, title: s.title, event_date: s.event_date, event_time: s.event_time?.slice(0, 5) ?? "", category: s.category, status: s.status, brand_id: s.brand_id ?? "interno", responsible: s.responsible ?? "", description: s.description ?? "" });
      return;
    }
    const slug = brands.find((b) => b.id === e.brandId)?.slug;
    if (e.layer === "prazo") navigate({ to: (slug ? `/workspace/cliente/${slug}` : "/workspace") as never });
    else navigate({ to: (slug ? `/e360/${slug}/agenda` : "/e360") as never });
  };
  const newOn = (iso: string) => { if (!canEdit) return; setErr({}); setDraft({ title: "", event_date: iso, event_time: "", category: "reuniao", status: "planejado", brand_id: "interno", responsible: "", description: "" }); };

  const save = async () => {
    if (!draft) return;
    const e: typeof err = {};
    if (!draft.title.trim()) e.title = "Dê um título ao marco.";
    if (!draft.event_date) e.date = "Escolha a data.";
    setErr(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      await saveEvent({ id: draft.id, title: draft.title.trim(), event_date: draft.event_date, event_time: draft.event_time || null, category: draft.category, status: draft.status, brand_id: draft.brand_id === "interno" ? null : draft.brand_id, responsible: draft.responsible || null, description: draft.description || null });
      toast.success(draft.id ? "Marco atualizado" : "Marco criado");
      setDraft(null);
      qc.invalidateQueries({ queryKey: ["agency-calendar"] });
      qc.invalidateQueries({ queryKey: ["agency-home"] });
    } catch {
      toast.error("Não foi possível salvar o marco.");
    } finally {
      setSaving(false);
    }
  };
  const del = async () => {
    if (!draft?.id) return;
    try { await removeEvent(draft.id); toast.success("Marco excluído"); setDraft(null); qc.invalidateQueries({ queryKey: ["agency-calendar"] }); qc.invalidateQueries({ queryKey: ["agency-home"] }); }
    catch { toast.error("Não foi possível excluir."); }
  };

  const todayISO = toISO(now);
  const monthEntries = entries.filter((e) => Number(e.date.slice(5, 7)) - 1 === ym.m);

  return (
    <div className="stack-lg">
      <div className="cal-toolbar e-glass">
        <PeriodNavigator label={`${MESES[ym.m]} de ${ym.y}`} onPrevious={() => go(-1)} onNext={() => go(1)} onToday={goToday} current={ym.y === now.getFullYear() && ym.m === now.getMonth()} />
        <span className="sp" />
        <Segmented label="Visualização" value={view} onChange={setView} items={[{ value: "mes", label: "Mês", icon: "calendar" }, { value: "lista", label: "Lista", icon: "list" }]} />
        {canEdit && <Button icon="plus" onClick={() => newOn(todayISO)}>Novo marco</Button>}
      </div>

      <div className="e-row wrap" style={{ gap: 8 }}>
        {LAYERS.map((l) => (
          <Chip key={l.key} color={l.color} pressed={layers.includes(l.key)} count={all.filter((e) => e.layer === l.key).length} onClick={() => setLayers((cur) => (cur.includes(l.key) ? cur.filter((x) => x !== l.key) : [...cur, l.key]))}>{l.label}</Chip>
        ))}
        <Chip color="var(--env-like)" disabled>Publicações do Like · em breve</Chip>
        <span className="sp" style={{ flex: 1 }} />
        <div style={{ minWidth: 220 }}>
          <Select value={brand} onChange={setBrand} icon="briefcase" options={[{ value: "todos", label: "Todos os clientes" }, { value: "interno", label: "Reach (interno)" }, ...brands.map((b) => ({ value: b.id, label: b.name }))]} />
        </div>
      </div>

      {!ready || q.isLoading ? (
        <div className="e-glass" style={{ borderRadius: "var(--r-2xl)", padding: 18 }} aria-busy="true"><Skeleton h={420} r={16} /></div>
      ) : q.isError ? (
        <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState kind="error" title="Não foi possível carregar o calendário" text="Tente de novo em instantes." actions={<Button variant="secondary" icon="refresh" onClick={() => q.refetch()}>Tentar novamente</Button>} /></div>
      ) : view === "mes" ? (
        <div className="mcal e-glass" ref={grid}>
          {DIAS.map((d) => <div key={d} className="mcal-wd">{d}</div>)}
          {cells.map((c) => {
            const list = byDay(c.iso);
            return (
              <div key={c.iso} className={`mcal-day${c.out ? " out" : ""}${c.iso === todayISO ? " today" : ""}`}>
                <button type="button" className="mcal-num" onClick={() => newOn(c.iso)} aria-label={`${c.day} de ${MESES[Number(c.iso.slice(5, 7)) - 1]}${list.length ? `, ${list.length} itens` : ""}${canEdit ? ". Criar marco neste dia" : ""}`} disabled={!canEdit}>{c.day}</button>
                <div className="mcal-items">
                  {list.slice(0, 3).map((e) => (
                    <button key={`${e.layer}-${e.id}`} type="button" className="mcal-item" style={{ ["--c" as string]: colorOf(e) }} onClick={() => open(e)} title={`${e.title} · ${brandName(e.brandId)}`}>
                      <i />{e.time && <span className="t">{e.time.slice(0, 5)}</span>}<span className="e-ellipsis">{e.title}</span>
                    </button>
                  ))}
                  {list.length > 3 && <button type="button" className="mcal-more" onClick={() => setView("lista")}>+{list.length - 3} itens</button>}
                </div>
              </div>
            );
          })}
        </div>
      ) : monthEntries.length === 0 ? (
        <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState icon="calendar" title="Nada neste mês" text="Ajuste as camadas e o filtro de cliente, ou crie um marco." /></div>
      ) : (
        <div className="now-panel e-glass">
          <div className="now-list">
            {monthEntries.map((e) => (
              <AgendaRow key={`${e.layer}-${e.id}`} date={e.date} tone={e.layer === "prazo" ? entryTone(e.date) : undefined} color={colorOf(e)} title={e.title}
                meta={[LAYERS.find((l) => l.key === e.layer)?.label, brandName(e.brandId), e.time?.slice(0, 5), e.who].filter(Boolean).join(" · ")}
                badge={e.layer === "marco" && e.status ? { label: EVENT_STATUSES.find((s) => s.key === e.status)?.label ?? e.status, tone: e.status === "concluido" ? "done" : e.status === "cancelado" ? "blocked" : e.status === "confirmado" ? "approved" : "todo" } : undefined}
                onClick={() => open(e)} />
            ))}
          </div>
        </div>
      )}

      <div className="e-row wrap cal-legend" aria-label="Legenda das categorias">
        {EVENT_CATEGORIES.map((c) => <span key={c.key}><i style={{ background: c.color }} />{c.label}</span>)}
      </div>

      <Drawer
        open={!!draft}
        onClose={() => setDraft(null)}
        eyebrow="Calendário da agência"
        title={draft?.id ? "Editar marco" : "Novo marco"}
        footer={<>{draft?.id && canDelete && <HoldButton label="Segure para excluir" size="sm" onConfirm={del} />}<span style={{ flex: 1 }} /><Button variant="ghost" onClick={() => setDraft(null)}>Cancelar</Button><Button icon="check" loading={saving} onClick={save} disabled={!canEdit}>Salvar</Button></>}
      >
        {draft && (
          <>
            <Field label="Título" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Ex.: Apresentação do plano de novembro" error={err.title} autoFocus />
            <div className="grid-2" style={{ gap: 12 }}>
              <Field label="Data" type="date" value={draft.event_date} onChange={(e) => setDraft({ ...draft, event_date: e.target.value })} error={err.date} />
              <Field label="Horário" type="time" value={draft.event_time} onChange={(e) => setDraft({ ...draft, event_time: e.target.value })} optional />
            </div>
            <div className="grid-2" style={{ gap: 12 }}>
              <Select label="Categoria" value={draft.category} onChange={(v) => setDraft({ ...draft, category: v })} options={EVENT_CATEGORIES.map((c) => ({ value: c.key, label: c.label }))} />
              <Select label="Status" value={draft.status} onChange={(v) => setDraft({ ...draft, status: v })} options={EVENT_STATUSES.map((s) => ({ value: s.key, label: s.label }))} />
            </div>
            <Select label="Cliente" value={draft.brand_id} onChange={(v) => setDraft({ ...draft, brand_id: v })} icon="briefcase" options={[{ value: "interno", label: "Reach (interno)" }, ...brands.map((b) => ({ value: b.id, label: b.name }))]} />
            <Field label="Responsável" value={draft.responsible} onChange={(e) => setDraft({ ...draft, responsible: e.target.value })} placeholder="Nome de quem conduz" icon="user" optional />
            <TextArea label="Descrição" value={draft.description} rows={4} max={1000} onChange={(e) => setDraft({ ...draft, description: e.target.value })} optional />
            {draft.id && <p className="e-caption" style={{ margin: 0 }}><Icon name="info" size="sm" /> Prazos do Workspace e reuniões do 360 são editados no próprio ambiente.</p>}
          </>
        )}
      </Drawer>
    </div>
  );
}

