import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar, Badge, Button, ClientLogo, EmptyState, Skeleton } from "@/components/echo/primitives";
import { Checkbox, Chip, Field, Menu, Segmented, Select } from "@/components/echo/controls";
import { Drawer } from "@/components/echo/overlays";
import { Icon } from "@/components/echo/icon";
import { StatusMenu, TaskDrawer } from "@/components/echo/task-drawer";
import { WORK_STATUSES } from "@/lib/workspace-data";
import { bulkUpdate, createOpsTask, DONE, isLateTask, listOpsTasks, type OpsTask } from "@/lib/ops-data";
import { listPickable } from "@/lib/team-data";
import { listPortfolio } from "@/lib/clients-data";
import { listSectorsFull } from "@/lib/settings-data";

export const Route = createFileRoute("/workspace/demandas")({
  head: () => ({ meta: [{ title: "Demandas · Workspace · Echo" }, { name: "description", content: "Todas as tarefas de todos os clientes." }] }),
  component: Demands,
});

type SortKey = "due" | "title" | "brand" | "owner" | "status";
const ddmm = (d?: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "—");
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const EMPTY = { q: "", brand: "", front: "", owner: "", status: "", sector: "", urgency: "", done: false };

function Demands() {
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const [f, setF] = useState(EMPTY);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "due", dir: 1 });
  const [sel, setSel] = useState<string[]>([]);
  const [view, setView] = useState<"tabela" | "lista">("tabela");
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  const prevPos = useRef(new Map<string, number>());
  useEffect(() => setReady(true), []);
  const q = useQuery({ queryKey: ["ops-tasks"], queryFn: listOpsTasks, enabled: ready });
  const people = useQuery({ queryKey: ["people-pickable"], queryFn: listPickable, enabled: ready, staleTime: 60_000 });
  const sectors = useQuery({ queryKey: ["sectors"], queryFn: listSectorsFull, enabled: ready });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["ops-tasks"] }); qc.invalidateQueries({ queryKey: ["client-ops"] }); };

  const all = q.data ?? [];
  const brands = useMemo(() => [...new Map(all.map((t) => [t.brand.id, t.brand])).values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")), [all]);
  const fronts = [...new Set(all.map((t) => t.frontName).filter(Boolean) as string[])].sort();
  const owners = [...new Set([...(people.data ?? []).map((p) => p.name), ...(all.map((t) => t.owner).filter(Boolean) as string[])])].sort();
  const shown = all
    .filter((t) => (f.done || t.status !== DONE) && (!f.brand || t.brand.id === f.brand) && (!f.front || t.frontName === f.front) && (!f.owner || (f.owner === "__none" ? !t.owner : t.owner === f.owner))
      && (!f.status || t.status === f.status) && (!f.sector || t.sector === f.sector) && (!f.urgency || (f.urgency === "atrasada" ? isLateTask(t) : t.urgency === f.urgency))
      && (!f.q || norm(`${t.title} ${t.owner ?? ""} ${t.sector ?? ""} ${t.brand.name}`).includes(norm(f.q))))
    .sort((a, b) => {
      const v = (t: OpsTask) => sort.key === "due" ? t.due ?? "9999" : sort.key === "title" ? t.title : sort.key === "brand" ? t.brand.name : sort.key === "owner" ? t.owner ?? "~" : String(WORK_STATUSES.indexOf(t.status));
      return v(a).localeCompare(v(b), "pt-BR") * sort.dir;
    });
  const activeFilters = Object.entries(f).filter(([k, v]) => k !== "done" && v).length;
  const selected = shown.filter((t) => sel.includes(t.id));

  // FLIP: linhas deslizam para a nova posição ao reordenar.
  useLayoutEffect(() => {
    const rows = body.current?.querySelectorAll<HTMLElement>("[data-row]");
    if (!rows) return;
    const next = new Map<string, number>();
    rows.forEach((el) => {
      const id = el.dataset.row!;
      const top = el.getBoundingClientRect().top;
      next.set(id, top);
      const before = prevPos.current.get(id);
      if (before !== undefined && Math.abs(before - top) > 2 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches)
        el.animate([{ transform: `translateY(${before - top}px)` }, { transform: "none" }], { duration: 320, easing: "cubic-bezier(.23,1,.32,1)" });
    });
    prevPos.current = next;
  });

  const runBulk = async (label: string, change: Parameters<typeof bulkUpdate>[1]) => {
    const n = selected.length;
    const undo = await bulkUpdate(selected, change);
    refresh();
    setSel([]);
    toast.success(`${label} · ${n} ${n === 1 ? "tarefa" : "tarefas"}`, { action: { label: "Desfazer", onClick: async () => { await undo(); refresh(); toast("Alteração desfeita"); } } });
  };
  const sortBy = (key: SortKey) => setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : 1 }));
  const th = (key: SortKey, label: string) => (
    <button type="button" className={`dm-th${sort.key === key ? " on" : ""}`} onClick={() => sortBy(key)} aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      {label}{sort.key === key && <Icon name={sort.dir === 1 ? "chevUp" : "chevDown"} size="sm" />}
    </button>
  );

  if (!ready || q.isLoading) return <div className="stack-lg" aria-busy="true"><Skeleton h={120} r={22} /><Skeleton h={420} r={22} /></div>;
  if (q.isError) return <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState kind="error" title="Não foi possível carregar as demandas" text="Verifique a conexão e tente de novo." actions={<Button variant="secondary" icon="refresh" onClick={() => q.refetch()}>Tentar novamente</Button>} /></div>;
  if (brands.length === 0) return <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState icon="briefcase" title="Nenhum cliente ativo" text="Cadastre um cliente para começar a registrar demandas." actions={<Link to="/clientes" className="e-btn secondary">Abrir clientes</Link>} /></div>;

  return (
    <div className="stack-lg">
      <div className="e-row between wrap" style={{ gap: 10 }}>
        <div className="ops-kpis">
          <span><b className="tnum">{all.filter((t) => t.status !== DONE).length}</b>abertas</span>
          <span><b className="tnum" style={{ color: "var(--danger)" }}>{all.filter(isLateTask).length}</b>atrasadas</span>
          <span><b className="tnum">{all.filter((t) => t.status !== DONE && !t.owner).length}</b>sem responsável</span>
        </div>
        <div className="e-row" style={{ gap: 8 }}>
          <Segmented value={view} onChange={setView} label="Visualização" items={[{ value: "tabela", label: "Tabela", icon: "grid" }, { value: "lista", label: "Lista", icon: "list" }]} />
          <Button icon="plus" onClick={() => setCreating(true)}>Nova demanda</Button>
        </div>
      </div>

      <div className="filter-bar e-glass">
        <Field icon="search" placeholder="Buscar por título, responsável, setor ou cliente" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} aria-label="Buscar demandas" />
        <div className="filter-grid">
          <Select value={f.brand} onChange={(v) => setF({ ...f, brand: v })} options={[{ value: "", label: "Todos os clientes" }, ...brands.map((b) => ({ value: b.id, label: b.name }))]} />
          <Select value={f.front} onChange={(v) => setF({ ...f, front: v })} options={[{ value: "", label: "Todas as frentes" }, ...fronts.map((x) => ({ value: x, label: x }))]} />
          <Select value={f.owner} onChange={(v) => setF({ ...f, owner: v })} options={[{ value: "", label: "Todos os responsáveis" }, { value: "__none", label: "Sem responsável" }, ...owners.map((x) => ({ value: x, label: x }))]} />
          <Select value={f.status} onChange={(v) => setF({ ...f, status: v })} options={[{ value: "", label: "Todas as etapas" }, ...WORK_STATUSES.map((s) => ({ value: s, label: s }))]} />
          <Select value={f.sector} onChange={(v) => setF({ ...f, sector: v })} options={[{ value: "", label: "Todos os setores" }, ...(sectors.data ?? []).map((s) => ({ value: s.name, label: s.name }))]} />
          <Select value={f.urgency} onChange={(v) => setF({ ...f, urgency: v })} options={[{ value: "", label: "Qualquer prioridade" }, { value: "atrasada", label: "Atrasadas" }, { value: "urgente", label: "Urgente" }, { value: "alta", label: "Alta" }]} />
        </div>
        <div className="e-row between wrap" style={{ gap: 8 }}>
          <div className="e-row" style={{ gap: 8 }}>
            <Chip icon="checkCircle" pressed={f.done} onClick={() => setF({ ...f, done: !f.done })}>Mostrar concluídas</Chip>
            <span className="e-caption tnum" aria-live="polite">{shown.length} de {all.length} tarefas</span>
            {activeFilters > 0 && <button type="button" className="e-link" onClick={() => setF(EMPTY)}>Limpar filtros</button>}
          </div>
        </div>
      </div>

      {selected.length > 0 && (
        <div className="bulk-bar e-glass" role="toolbar" aria-label="Ações em massa">
          <b className="tnum">{selected.length} {selected.length === 1 ? "selecionada" : "selecionadas"}</b>
          <Button size="sm" icon="checkCircle" onClick={() => runBulk("Concluídas", { status: DONE })}>Concluir</Button>
          <Menu trigger={({ toggle }) => <Button size="sm" variant="secondary" icon="user" onClick={toggle}>Atribuir</Button>} items={[{ title: "Responsável" }, { label: "Sem responsável", onSelect: () => runBulk("Responsável removido", { owner: null }) }, ...owners.map((o) => ({ label: o, onSelect: () => runBulk(`Atribuídas a ${o}`, { owner: o }) }))]} />
          <Menu trigger={({ toggle }) => <Button size="sm" variant="secondary" icon="calendar" onClick={toggle}>Adiar</Button>} items={[{ label: "+1 dia", onSelect: () => runBulk("Adiadas 1 dia", { shiftDays: 1 }) }, { label: "+3 dias", onSelect: () => runBulk("Adiadas 3 dias", { shiftDays: 3 }) }, { label: "+1 semana", onSelect: () => runBulk("Adiadas 1 semana", { shiftDays: 7 }) }]} />
          <Menu trigger={({ toggle }) => <Button size="sm" variant="secondary" icon="grid" onClick={toggle}>Setor</Button>} items={[{ title: "Mover para o setor" }, ...(sectors.data ?? []).map((s) => ({ label: s.name, onSelect: () => runBulk(`Setor: ${s.name}`, { sector: s.name }) }))]} />
          <span style={{ flex: 1 }} />
          <Button size="sm" variant="ghost" icon="x" onClick={() => setSel([])}>Limpar seleção</Button>
        </div>
      )}

      {shown.length === 0 ? (
        <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState kind="search" title="Nenhuma demanda com esses filtros" actions={<Button variant="secondary" onClick={() => setF(EMPTY)}>Limpar filtros</Button>} /></div>
      ) : (
        <div className={`dm-table e-glass ${view}`} ref={body}>
          {view === "tabela" && (
            <div className="dm-row head">
              <Checkbox checked={selected.length === shown.length} indeterminate={selected.length > 0 && selected.length < shown.length} onChange={(v) => setSel(v ? shown.map((t) => t.id) : [])} label={<span className="e-sr">Selecionar todas</span>} />
              {th("title", "Tarefa")}{th("brand", "Cliente")}{th("owner", "Responsável")}{th("due", "Prazo")}{th("status", "Etapa")}
            </div>
          )}
          {shown.map((t) => (
            <div key={t.id} data-row={t.id} className={`dm-row${sel.includes(t.id) ? " sel" : ""}${t.status === DONE ? " done" : ""}`} onClick={() => setOpen(t.id)}>
              <span onClick={(e) => e.stopPropagation()}><Checkbox checked={sel.includes(t.id)} onChange={(v) => setSel(v ? [...sel, t.id] : sel.filter((x) => x !== t.id))} label={<span className="e-sr">Selecionar {t.title}</span>} /></span>
              <span className="dm-title"><b className="e-ellipsis">{t.pinned && <Icon name="pin" size="sm" />} {t.title}</b><small className="e-caption e-ellipsis">{[t.frontName, t.sector].filter(Boolean).join(" · ") || "Avulsa"}</small></span>
              <span className="dm-brand"><ClientLogo name={t.brand.name} size="sm" /><span className="e-ellipsis">{t.brand.name}</span></span>
              <span className="dm-owner">{t.owner ? <><Avatar name={t.owner} size="xs" /><span className="e-ellipsis">{t.owner}</span></> : <span className="e-caption">Sem responsável</span>}</span>
              <span className={`dm-due tnum${isLateTask(t) ? " late" : ""}`}>{ddmm(t.due)}{t.urgency === "urgente" && <Badge tone="late">Urgente</Badge>}</span>
              <span onClick={(e) => e.stopPropagation()}><StatusMenu task={t} onChanged={refresh} /></span>
            </div>
          ))}
        </div>
      )}
      <TaskDrawer task={all.find((t) => t.id === open) ?? null} onClose={() => setOpen(null)} onChanged={refresh} />
      <NewDemand open={creating} owners={owners} sectors={(sectors.data ?? []).map((s) => s.name)} onClose={() => setCreating(false)} onDone={refresh} />
    </div>
  );
}

function NewDemand({ open, owners, sectors, onClose, onDone }: { open: boolean; owners: string[]; sectors: string[]; onClose: () => void; onDone: () => void }) {
  const clients = useQuery({ queryKey: ["portfolio"], queryFn: listPortfolio, enabled: open });
  const [d, setD] = useState({ brand: "", title: "", sector: "", owner: "", due: "" });
  const [err, setErr] = useState<{ brand?: string; title?: string }>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setD({ brand: "", title: "", sector: "", owner: "", due: "" }); setErr({}); } }, [open]);
  return (
    <Drawer open={open} onClose={onClose} eyebrow="Workspace" title="Nova demanda"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="check" loading={busy} onClick={async () => {
        const e: typeof err = {};
        if (!d.brand) e.brand = "Escolha o cliente.";
        if (!d.title.trim()) e.title = "Descreva a demanda.";
        setErr(e); if (Object.keys(e).length) return;
        const b = clients.data?.find((c) => c.id === d.brand)!;
        setBusy(true);
        try { await createOpsTask({ brand: { id: b.id, name: b.name, slug: b.slug }, workOrderId: null, title: d.title.trim(), sector: d.sector || null, owner: d.owner || null, due: d.due || null }); toast.success("Demanda criada", { description: `${b.name} · ${d.title}` }); onDone(); onClose(); }
        catch { toast.error("Não foi possível criar."); } finally { setBusy(false); }
      }}>Criar demanda</Button></>}>
      <Select label="Cliente" value={d.brand} error={err.brand} placeholder={clients.isLoading ? "Carregando…" : "Escolha o cliente"} onChange={(v) => setD({ ...d, brand: v })} options={(clients.data ?? []).map((c) => ({ value: c.id, label: c.name }))} icon="briefcase" />
      <Field label="Demanda" autoFocus value={d.title} error={err.title} placeholder="Ex.: Ajustar legenda do carrossel" onChange={(e) => setD({ ...d, title: e.target.value })} />
      <div className="grid-2" style={{ gap: 12 }}>
        <Select label="Setor" value={d.sector} placeholder="Sem setor" onChange={(v) => setD({ ...d, sector: v })} options={[{ value: "", label: "Sem setor" }, ...sectors.map((s) => ({ value: s, label: s }))]} />
        <Select label="Responsável" value={d.owner} placeholder="Sem responsável" onChange={(v) => setD({ ...d, owner: v })} options={[{ value: "", label: "Sem responsável" }, ...owners.map((o) => ({ value: o, label: o }))]} />
        <Field label="Prazo" type="date" optional value={d.due} onChange={(e) => setD({ ...d, due: e.target.value })} />
      </div>
      <p className="e-caption" style={{ margin: 0 }}>A demanda entra como avulsa. Para ligá-la a uma entrega, abra a operação do cliente.</p>
    </Drawer>
  );
}

