import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, ClientLogo, EmptyState, Skeleton } from "@/components/echo/primitives";
import { Chip, Field, Menu, Select } from "@/components/echo/controls";
import { Icon } from "@/components/echo/icon";
import { stagger } from "@/components/echo/motion";
import { ClientForm } from "@/components/echo/client-form";
import { listPortfolio, clientGradient, type ClientCard } from "@/lib/clients-data";
import { CLIENT_STATUSES, CONTRACT_TYPES } from "@/lib/reach-data";
import { RISK_LABELS, type RiskLevel } from "@/lib/workspace-data";
import { relDay } from "@/lib/home-data";
import { startViewAsClient } from "@/lib/view-as";
import { setClientContext } from "@/lib/ecosystem";

export const Route = createFileRoute("/clientes/")({
  head: () => ({ meta: [{ title: "Clientes · Echo" }, { name: "description", content: "Um cadastro por cliente para Brand, Workspace, Like e Espaço 360." }] }),
  component: Portfolio,
});

const RISK_ORDER: Record<RiskLevel, number> = { red: 0, orange: 1, yellow: 2, green: 3 };
const RISK_TONE: Record<RiskLevel, "late" | "adjust" | "review" | "done"> = { red: "late", orange: "adjust", yellow: "review", green: "done" };
const MODS = [
  { key: "biblioteca", label: "Brand", color: "var(--env-brand)" },
  { key: "workspace", label: "Workspace", color: "var(--env-workspace)" },
  { key: "like", label: "Like", color: "var(--env-like)" },
  { key: "espaco360", label: "Espaço 360", color: "var(--env-360)" },
] as const;
const PREF = "echo.portfolio";

function worstLevel(c: ClientCard): RiskLevel | null {
  if (!c.fronts.length) return null;
  return [...c.fronts].sort((a, b) => RISK_ORDER[a.level] - RISK_ORDER[b.level])[0].level;
}
const br = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "—");

function Portfolio() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string[]>([]);
  const [contract, setContract] = useState<string[]>([]);
  const [mods, setMods] = useState<string[]>([]);
  const [risk, setRisk] = useState<RiskLevel[]>([]);
  const [sort, setSort] = useState("risco");
  const [form, setForm] = useState<{ open: boolean; client?: ClientCard | null }>({ open: false });
  const grid = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { const p = JSON.parse(sessionStorage.getItem(PREF) || "{}"); if (p.sort) setSort(p.sort); if (p.risk) setRisk(p.risk); } catch { /* ok */ }
    setReady(true);
  }, []);
  useEffect(() => { if (ready) try { sessionStorage.setItem(PREF, JSON.stringify({ sort, risk })); } catch { /* ok */ } }, [sort, risk, ready]);

  const data = useQuery({ queryKey: ["portfolio"], queryFn: listPortfolio, enabled: ready });
  const all = data.data ?? [];
  const visible = useMemo(() => {
    const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const list = all.filter((c) =>
      norm(`${c.name} ${c.segment ?? ""}`).includes(norm(q.trim())) &&
      (!status.length || status.includes(c.status)) &&
      (!contract.length || contract.includes(c.contract ?? "")) &&
      (!mods.length || mods.every((m) => c.modules[m as keyof typeof c.modules])) &&
      (!risk.length || c.fronts.some((f) => risk.includes(f.level))),
    );
    return list.sort((a, b) => {
      if (sort === "nome") return a.name.localeCompare(b.name, "pt-BR");
      if (sort === "atividade") return (b.lastActivity?.at ?? "").localeCompare(a.lastActivity?.at ?? "");
      const ra = worstLevel(a), rb = worstLevel(b);
      return (ra ? RISK_ORDER[ra] : 9) - (rb ? RISK_ORDER[rb] : 9) || b.lateTasks - a.lateTasks;
    });
  }, [all, q, status, contract, mods, risk, sort]);

  useEffect(() => { if (grid.current && data.data) stagger(grid.current.querySelectorAll(".client-card"), { y: 14, scale: 0.98, dur: 480 }, 35); }, [!!data.data]);

  const toggle = <T,>(list: T[], set: (v: T[]) => void, v: T) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const filtersOn = status.length + contract.length + mods.length + risk.length > 0 || q.trim().length > 0;
  const clear = () => { setQ(""); setStatus([]); setContract([]); setMods([]); setRisk([]); };
  const riskCount = (l: RiskLevel) => all.filter((c) => c.fronts.some((f) => f.level === l)).length;

  return (
    <div className="stack-lg">
      <div className="echo-envhead" style={{ paddingTop: 6 }}>
        <div>
          <span className="e-label">Carteira</span>
          <h1 className="e-h2" style={{ margin: "4px 0 0" }}>Clientes</h1>
          <p className="e-small" style={{ margin: "6px 0 0" }}>Um cadastro por cliente para Brand, Workspace, Like e Espaço 360.</p>
        </div>
        <Button icon="plus" onClick={() => setForm({ open: true, client: null })}>Novo cliente</Button>
      </div>

      <div className="portfolio-bar e-glass">
        <div style={{ flex: "1 1 260px", minWidth: 0 }}><Field type="search" pill value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente ou segmento" aria-label="Buscar cliente" /></div>
        <div style={{ width: 220 }}><Select value={sort} onChange={setSort} icon="sort" options={[{ value: "risco", label: "Ordenar por risco" }, { value: "nome", label: "Ordenar por nome" }, { value: "atividade", label: "Última atividade" }]} /></div>
      </div>

      <div className="filter-rows">
        <div className="e-row wrap" style={{ gap: 6 }}><span className="e-label">Cobertura</span>
          {(["red", "orange", "yellow", "green"] as RiskLevel[]).map((l) => <Chip key={l} pressed={risk.includes(l)} color={`var(--${l === "red" ? "danger" : l === "orange" ? "warn" : l === "yellow" ? "review" : "ok"})`} count={riskCount(l)} onClick={() => toggle(risk, setRisk, l)}>{RISK_LABELS[l]}</Chip>)}
        </div>
        <div className="e-row wrap" style={{ gap: 6 }}><span className="e-label">Ambiente</span>
          {MODS.map((m) => <Chip key={m.key} pressed={mods.includes(m.key)} color={m.color} onClick={() => toggle(mods, setMods, m.key)}>{m.label}</Chip>)}
          <span className="e-label" style={{ marginLeft: 8 }}>Status</span>
          {CLIENT_STATUSES.map((s) => <Chip key={s.key} pressed={status.includes(s.key)} onClick={() => toggle(status, setStatus, s.key)}>{s.label}</Chip>)}
          <span className="e-label" style={{ marginLeft: 8 }}>Contrato</span>
          {CONTRACT_TYPES.map((s) => <Chip key={s.key} pressed={contract.includes(s.key)} onClick={() => toggle(contract, setContract, s.key)}>{s.label}</Chip>)}
        </div>
        <div className="e-row between" style={{ gap: 8 }}>
          <span className="e-results"><b>{visible.length}</b> de {all.length} clientes</span>
          {filtersOn && <Button variant="ghost" size="sm" icon="x" onClick={clear}>Limpar filtros</Button>}
        </div>
      </div>

      {!ready || data.isLoading ? (
        <div className="client-grid" aria-busy="true">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="client-card e-glass" style={{ padding: 16, gap: 12 }}><Skeleton h={70} r={16} /><Skeleton w="60%" h={16} /><Skeleton w="40%" h={11} /><Skeleton h={48} r={12} /></div>)}</div>
      ) : data.isError ? (
        <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState kind="error" title="Não foi possível carregar a carteira" text="Tente de novo em instantes." actions={<Button variant="secondary" icon="refresh" onClick={() => data.refetch()}>Tentar novamente</Button>} /></div>
      ) : all.length === 0 ? (
        <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState icon="briefcase" title="Nenhum cliente cadastrado" text="Cadastre o cliente uma única vez: ele passa a existir em todos os ambientes contratados." actions={<Button icon="plus" onClick={() => setForm({ open: true })}>Cadastrar cliente</Button>} /></div>
      ) : visible.length === 0 ? (
        <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState kind="search" title="Nenhum cliente com esses filtros" text="Ajuste a busca ou limpe os filtros." actions={<Button variant="secondary" icon="x" onClick={clear}>Limpar filtros</Button>} /></div>
      ) : (
        <div className="client-grid" ref={grid}>
          {visible.map((c) => (
            <article key={c.id} className="client-card e-glass">
              <div className="client-cover" style={{ background: clientGradient(c) }}>
                <Badge tone="glass">{CLIENT_STATUSES.find((s) => s.key === c.status)?.label ?? c.status}{c.contract ? ` · ${CONTRACT_TYPES.find((t) => t.key === c.contract)?.label ?? c.contract}` : ""}</Badge>
                <span className="mods" aria-label="Ambientes ativos">{MODS.map((m) => <i key={m.key} title={`${m.label}${c.modules[m.key] ? "" : " (não contratado)"}`} style={{ background: c.modules[m.key] ? m.color : "rgba(255,255,255,.25)" }} />)}</span>
              </div>
              <div className="client-body">
                <div className="e-row" style={{ gap: 12, marginTop: -30 }}>
                  <span className="client-logo-wrap"><ClientLogo name={c.name} logoUrl={c.logoUrl} gradient={clientGradient(c)} size="lg" /></span>
                  <span className="sp" style={{ flex: 1 }} />
                  <Menu
                    align="right"
                    trigger={({ open, toggle: t }) => <Button variant="secondary" size="sm" iconOnly icon="more" aria-label={`Ações de ${c.name}`} aria-expanded={open} onClick={t} />}
                    items={[
                      { label: "Abrir hub do cliente", icon: "briefcase", onSelect: () => navigate({ to: `/clientes/${c.slug}` as never }) },
                      { label: "Editar cadastro", icon: "edit", onSelect: () => setForm({ open: true, client: c }) },
                      "-",
                      { label: "Abrir no Workspace", icon: "grid", disabled: !c.modules.workspace, onSelect: () => { setClientContext(c.slug); navigate({ to: `/workspace/cliente/${c.slug}` as never }); } },
                      { label: "Abrir no Espaço 360", icon: "orbit", disabled: !c.modules.espaco360, onSelect: () => { setClientContext(c.slug); navigate({ to: `/e360/${c.slug}` as never }); } },
                      { label: "Abrir no Like · em breve", icon: "heart", disabled: true, onSelect: () => undefined },
                      { label: "Ver como cliente", icon: "eye", disabled: !c.modules.espaco360, onSelect: () => { startViewAsClient(c.name); navigate({ to: `/e360/${c.slug}` as never }); } },
                    ]}
                  />
                </div>
                <Link to={`/clientes/${c.slug}` as never} className="client-name">
                  <h3 className="e-h4 e-ellipsis" style={{ margin: 0 }}>{c.name}</h3>
                  <span className="e-caption e-ellipsis">{c.segment ?? "Sem segmento"}</span>
                </Link>
                {c.modules.workspace && (
                  <div className="client-fronts">
                    {c.fronts.length === 0 ? <span className="e-caption">Nenhuma frente de conteúdo cadastrada.</span> : c.fronts.map((f) => (
                      <div key={f.id} className="front-line">
                        <b>{f.name}</b>
                        <span className="e-caption tnum">aprovado até {br(f.approvedUntil)}</span>
                        <Badge tone={RISK_TONE[f.level]} dot>{RISK_LABELS[f.level]}</Badge>
                      </div>
                    ))}
                  </div>
                )}
                <div className="client-stats">
                  <span><b className="tnum">{c.openTasks}</b> tarefas abertas</span>
                  {c.lateTasks > 0 && <span className="tone-late"><b className="tnum">{c.lateTasks}</b> atrasada{c.lateTasks > 1 ? "s" : ""}</span>}
                  {c.awaitingClient > 0 && <span style={{ color: "var(--env-like)" }}><b className="tnum">{c.awaitingClient}</b> com o cliente</span>}
                  {c.nextDue && <span>próximo prazo <b>{relDay(c.nextDue).toLowerCase()}</b></span>}
                </div>
                {c.lastActivity && <p className="client-last"><Icon name="history" size="sm" /><span className="e-clamp2">{c.lastActivity.text} · {relDay(c.lastActivity.at).toLowerCase()}</span></p>}
              </div>
            </article>
          ))}
        </div>
      )}

      <ClientForm
        open={form.open}
        client={form.client}
        onClose={() => setForm({ open: false })}
        onSaved={(slug) => { setForm({ open: false }); qc.invalidateQueries({ queryKey: ["portfolio"] }); qc.invalidateQueries({ queryKey: ["client-hub"] }); if (!form.client) navigate({ to: `/clientes/${slug}` as never }); }}
      />
    </div>
  );
}
