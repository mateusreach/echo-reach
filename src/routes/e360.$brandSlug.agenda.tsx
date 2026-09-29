import { createFileRoute } from "@tanstack/react-router";
import { LoadFailed } from "@/components/echo/blocks";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SpaceShell } from "@/components/reach/space-shell";
import { Badge, Button, EmptyState, Skeleton } from "@/components/echo/primitives";
import { Chip, Field, Segmented, Select } from "@/components/echo/controls";
import { Modal } from "@/components/echo/overlays";
import { Icon, type IconName } from "@/components/echo/icon";
import { PeriodNavigator } from "@/components/echo/operations";
import { addDays, toISO, today } from "@/lib/workspace-data";
import { loadAgenda, saveEvent, type AgendaItem } from "@/lib/space-data";

export const Route = createFileRoute("/e360/$brandSlug/agenda")({
  head: () => ({ meta: [{ title: "Agenda · Espaço 360 · Echo" }] }),
  component: SpaceAgenda,
  validateSearch: (s: Record<string, unknown>) => ({ tab: typeof s.tab === "string" ? s.tab : undefined, filtro: typeof s.filtro === "string" ? s.filtro : undefined }),
});

const KINDS: { key: AgendaItem["kind"]; label: string; icon: IconName; color: string }[] = [
  { key: "compromisso", label: "Compromisso", icon: "calendar", color: "var(--info-fill)" },
  { key: "reuniao", label: "Reunião", icon: "users", color: "var(--env-360)" },
  { key: "gravacao", label: "Gravação", icon: "video", color: "var(--review-fill)" },
  { key: "publicacao", label: "Publicação", icon: "heart", color: "var(--env-like)" },
  { key: "prazo", label: "Prazo", icon: "clock", color: "var(--warn-fill)" },
  { key: "campanha", label: "Campanha", icon: "megaphone", color: "var(--env-brand)" },
  { key: "entrega", label: "Entrega", icon: "checkCircle", color: "var(--ok-fill)" },
];
const STATUSES = [{ key: "agendado", label: "Agendado" }, { key: "confirmado", label: "Confirmado" }, { key: "concluido", label: "Concluído" }, { key: "cancelado", label: "Cancelado" }];
const kindOf = (k: string) => KINDS.find((x) => x.key === k) ?? KINDS[0];
const WEEK = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function SpaceAgenda() {
  const { brandSlug } = Route.useParams();
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<"mes" | "semana" | "lista">("mes");
  const [anchor, setAnchor] = useState(toISO(today()));
  const [kinds, setKinds] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [edit, setEdit] = useState<(Omit<AgendaItem, "id" | "auto"> & { id?: string }) | null>(null);
  useEffect(() => setReady(true), []);
  const q = useQuery({ queryKey: ["space-agenda", brandSlug], queryFn: () => loadAgenda(brandSlug), enabled: ready });
  const refresh = () => qc.invalidateQueries({ queryKey: ["space-agenda", brandSlug] });
  const d = q.data;
  const shell = (c: React.ReactNode) => <SpaceShell demoData brandSlug={brandSlug} brandName={d?.space.brand.name ?? ""} primaryColor={d?.space.brand.primary} accentColor={d?.space.brand.accent}>{c}</SpaceShell>;
  if (!ready || q.isLoading) return shell(<div className="stack-lg"><Skeleton h={56} r={18} /><Skeleton h={520} r={24} /></div>);
  if (q.isError) return shell(<LoadFailed what="a agenda" onRetry={() => q.refetch()} />);
  if (!d) return shell(<div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState icon="lock" title="Espaço 360 indisponível" /></div>);
  const todayISO = toISO(today());
  const items = d.items.filter((i) => (!kinds.length || kinds.includes(i.kind)) && (!status || i.status === status));
  const a = new Date(`${anchor}T12:00:00`);
  const monthStart = new Date(a.getFullYear(), a.getMonth(), 1);
  const weekStart = addDays(a, -((a.getDay() + 6) % 7));
  const range = view === "semana" ? Array.from({ length: 7 }, (_, i) => toISO(addDays(weekStart, i))) : (() => { const off = (monthStart.getDay() + 6) % 7; const n = new Date(a.getFullYear(), a.getMonth() + 1, 0).getDate(); return Array.from({ length: Math.ceil((off + n) / 7) * 7 }, (_, i) => toISO(addDays(monthStart, i - off))); })();
  const shift = (dir: number) => setAnchor(toISO(view === "semana" ? addDays(a, 7 * dir) : new Date(a.getFullYear(), a.getMonth() + dir, 1)));
  const lbl = view === "semana" ? `${new Date(`${range[0]}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "short" })} – ${new Date(`${range[6]}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}` : monthStart.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const listItems = items.filter((i) => view !== "lista" ? true : i.date >= toISO(addDays(today(), -7))).slice(0, 80);
  const chip = (i: AgendaItem) => { const k = kindOf(i.kind); return (
    <button key={i.id} type="button" className={`cal-chip ag ${i.status}`} style={{ ["--c" as string]: k.color }} title={`${k.label} · ${i.title}${i.start ? ` · ${i.start}` : ""}`} onClick={() => !i.auto && setEdit({ ...i })}>
      <Icon name={k.icon} size="sm" />{i.start && <b className="tnum">{i.start}</b>}{i.title}
    </button>
  ); };

  return shell(
    <div className="stack-lg">
      <div className="cal-bar">
        <PeriodNavigator unit={view === "semana" ? "semana" : "mês"} label={lbl[0].toUpperCase() + lbl.slice(1)} onPrevious={() => shift(-1)} onNext={() => shift(1)} onToday={() => setAnchor(todayISO)} current={view === "semana" ? range.includes(todayISO) : a.getMonth() === today().getMonth() && a.getFullYear() === today().getFullYear()} />
        <Segmented value={view} onChange={setView} label="Visualização" items={[{ value: "mes", label: "Mês" }, { value: "semana", label: "Semana" }, { value: "lista", label: "Lista" }]} />
        <span style={{ flex: 1 }} />
        {d.space.canEdit && <Button icon="plus" onClick={() => setEdit({ kind: "compromisso", title: "", date: anchor, start: "", end: "", status: "agendado", responsible: "", deliveryTitle: "", deliveryDate: "" })}>Novo compromisso</Button>}
      </div>
      <div className="e-row wrap" style={{ gap: 6 }}>
        {KINDS.map((k) => <Chip key={k.key} color={k.color} pressed={kinds.includes(k.key)} onClick={() => setKinds(kinds.includes(k.key) ? kinds.filter((x) => x !== k.key) : [...kinds, k.key])}>{k.label}</Chip>)}
        <div style={{ width: 170 }}><Select value={status} onChange={setStatus} options={[{ value: "", label: "Qualquer status" }, ...STATUSES.map((s) => ({ value: s.key, label: s.label }))]} /></div>
      </div>
      {view === "lista" ? (
        listItems.length === 0 ? <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState icon="calendar" title="Nada com esses filtros" /></div> : (
          <div className="stack">
            {[...new Set(listItems.map((i) => i.date))].map((day) => (
              <section key={day} className="cal-listday e-glass">
                <span className={`cal-listdate${day === todayISO ? " today" : ""}`}><b className="tnum">{day.slice(8, 10)}</b><small>{new Date(`${day}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", month: "short" }).replace(/\./g, "")}</small></span>
                <div className="stack" style={{ gap: 4, flex: 1, minWidth: 0 }}>
                  {listItems.filter((i) => i.date === day).map((i) => (
                    <div key={i.id} className="ops-row" style={{ cursor: i.auto ? "default" : "pointer" }} onClick={() => !i.auto && setEdit({ ...i })}>
                      <span className="kind-dot" style={{ ["--c" as string]: kindOf(i.kind).color }}><Icon name={kindOf(i.kind).icon} size="sm" /></span>
                      <span className="e-grow" style={{ minWidth: 0 }}><b className="e-ellipsis" style={{ display: "block" }}>{i.title}</b><span className="e-caption">{kindOf(i.kind).label}{i.start ? ` · ${i.start}${i.end ? `–${i.end}` : ""}` : ""}{i.responsible ? ` · ${i.responsible}` : ""}{i.deliveryTitle ? ` · entrega: ${i.deliveryTitle}${i.deliveryDate ? ` em ${i.deliveryDate.slice(8, 10)}/${i.deliveryDate.slice(5, 7)}` : ""}` : ""}{i.auto ? " · automático" : ""}</span></span>
                      <Badge tone={i.status === "concluido" ? "done" : i.status === "cancelado" ? "blocked" : i.status === "confirmado" ? "approved" : "todo"}>{STATUSES.find((s) => s.key === i.status)?.label ?? i.status}</Badge>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )
      ) : (
        <div className={`cal-month e-glass${view === "semana" ? " week" : ""}`}>
          {WEEK.map((w) => <span key={w} className="cal-wd">{w}</span>)}
          {range.map((iso) => {
            const list = items.filter((i) => i.date === iso);
            const out = view === "mes" && new Date(`${iso}T12:00:00`).getMonth() !== a.getMonth();
            return (
              <div key={iso} className={`cal-cell${out ? " out" : ""}${iso === todayISO ? " today" : ""}${iso < todayISO ? " past" : ""}`} style={{ cursor: "default" }}>
                <span className="cal-n tnum">{Number(iso.slice(8, 10))}</span>
                <div className="cal-items">{list.slice(0, view === "semana" ? 12 : 3).map(chip)}{view === "mes" && list.length > 3 && <span className="cal-more">+{list.length - 3}</span>}</div>
              </div>
            );
          })}
        </div>
      )}
      <p className="e-caption" style={{ margin: 0 }}><Icon name="info" size="sm" /> Publicações aprovadas no Like, reuniões, prazos, entregas e campanhas entram sozinhos. Compromissos e gravações são cadastrados aqui.</p>
      <Modal open={!!edit} onClose={() => setEdit(null)} icon="calendar" title={edit?.id ? "Editar compromisso" : "Novo compromisso"}
        footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancelar</Button><Button disabled={!edit?.title.trim() || !edit?.date} onClick={async () => { if (!edit) return; const { id, ...rest } = edit; await saveEvent(brandSlug, d.space.brand.id, id ?? null, { ...rest, title: rest.title.trim(), start: rest.start || null, end: rest.end || null, responsible: rest.responsible || null, deliveryTitle: rest.deliveryTitle || null, deliveryDate: rest.deliveryDate || null }); toast.success("Compromisso salvo"); setEdit(null); refresh(); }}>Salvar</Button></>}>
        {edit && <div className="e-stack" style={{ gap: 10 }}>
          <Field label="O quê" autoFocus value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
          <div className="grid-2" style={{ gap: 10 }}>
            <Select label="Tipo" value={edit.kind} onChange={(v) => setEdit({ ...edit, kind: v as AgendaItem["kind"] })} options={KINDS.filter((k) => ["compromisso", "reuniao", "gravacao", "publicacao"].includes(k.key)).map((k) => ({ value: k.key, label: k.label }))} />
            <Select label="Status" value={edit.status} onChange={(v) => setEdit({ ...edit, status: v })} options={STATUSES.map((s) => ({ value: s.key, label: s.label }))} />
            <Field label="Data" type="date" value={edit.date} onChange={(e) => setEdit({ ...edit, date: e.target.value })} />
            <Field label="Responsável" optional value={edit.responsible ?? ""} onChange={(e) => setEdit({ ...edit, responsible: e.target.value })} />
            <Field label="Início" type="time" optional value={edit.start ?? ""} onChange={(e) => setEdit({ ...edit, start: e.target.value })} />
            <Field label="Fim" type="time" optional value={edit.end ?? ""} onChange={(e) => setEdit({ ...edit, end: e.target.value })} />
            <Field label="O que será entregue" optional value={edit.deliveryTitle ?? ""} onChange={(e) => setEdit({ ...edit, deliveryTitle: e.target.value })} />
            <Field label="Data da entrega" type="date" optional value={edit.deliveryDate ?? ""} onChange={(e) => setEdit({ ...edit, deliveryDate: e.target.value })} />
          </div>
        </div>}
      </Modal>
    </div>,
  );
}
