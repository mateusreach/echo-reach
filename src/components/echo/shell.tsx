// ---------------------------------------------------------------------------
// Echo · Shell (barra superior, ambientes, ⌘K e aparência)
// ---------------------------------------------------------------------------
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./icon";
import { EchoLogo, type EchoLogoHandle } from "./logo";
import { Avatar } from "./primitives";
import { MIXES, PATHS, resolvedBase, useAppearance, type PathKey } from "./appearance";
import { viewTransition } from "./motion";
import { useEchoSession } from "./session";
import { useQuery } from "@tanstack/react-query";
import { isDemoMode } from "@/lib/home-data";
import { KIND_META, listRecent, norm, searchAll, trackRecent, warmSearch, type Hit, type HitKind } from "@/lib/search-data";
import { isViewingAsClient, startViewAsClient } from "@/lib/view-as";
import { NotificationBell } from "./notifications";

const DEMO_CLIENTS = ["Dra. Giuliana", "Fina Fragrância", "A Emporium", "Esense", "Eliza", "Pão de Queijo da Maria", "Gaby Mota Cachos", "Gamô Ateliê", "Zelus", "Spirale", "Isabela Gomes"];
const slugify = (n: string) => n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function loadClients(): Promise<{ name: string; slug: string; segment?: string | null }[]> {
  if (isDemoMode()) return DEMO_CLIENTS.map((name) => ({ name, slug: slugify(name) }));
  const { data } = await supabase.from("brands").select("name, slug, segment").order("name");
  return (data ?? []) as { name: string; slug: string; segment: string | null }[];
}
import { supabase } from "@/integrations/supabase/client";

export type EnvDef = { id: "brand" | "workspace" | "like" | "e360"; name: string; tagline: string; icon: IconName; color: string; href?: string };

export const ENVS: EnvDef[] = [
  { id: "brand", name: "Brand", tagline: "Plano, identidade e biblioteca da marca", icon: "layers", color: "var(--env-brand)", href: "/agencia/clientes" },
  { id: "workspace", name: "Workspace", tagline: "Entregas, tarefas, prazos e cobertura", icon: "grid", color: "var(--env-workspace)", href: "/workspace" },
  { id: "like", name: "Like", tagline: "Aprovação de materiais com o cliente", icon: "heart", color: "var(--env-like)", href: "/like" },
  { id: "e360", name: "Espaço 360", tagline: "Plano, campanhas e solicitações do cliente", icon: "orbit", color: "var(--env-360)", href: "/e360" },
];

// ----- Aparência ---------------------------------------------------------------

function AppearancePanel({ onClose, onPathChange }: { onClose: () => void; onPathChange: () => void }) {
  const [a, set] = useAppearance();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const down = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node) && !(e.target as HTMLElement).closest("[data-appearance-trigger]")) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [onClose]);
  const setBase = (base: "light" | "dark" | "system", e: React.MouseEvent) => {
    const before = resolvedBase(a);
    const after = base === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : base;
    if (before === after) { set({ base }); return; }
    viewTransition(() => set({ base }), e.clientX, e.clientY);
  };
  return (
    <div ref={ref} className="e-pop right echo-appearance" role="dialog" aria-label="Aparência">
      <div className="e-menu-title e-label">Base</div>
      <div className="e-seg e-lite" role="radiogroup" aria-label="Base" style={{ display: "flex", margin: "2px 4px 10px" }}>
        {([["light", "Clara", "sun"], ["dark", "Escura", "moon"], ["system", "Automática", "refresh"]] as const).map(([k, l, ic]) => (
          <button key={k} type="button" role="radio" aria-checked={a.base === k} aria-selected={a.base === k} onClick={(e) => setBase(k, e)} style={{ flex: 1, justifyContent: "center", background: a.base === k ? "var(--glass-strong)" : undefined, boxShadow: a.base === k ? "var(--glass-inset), 0 0 0 1px var(--line)" : undefined }}>
            <Icon name={ic} size="sm" />{l}
          </button>
        ))}
      </div>
      <div className="e-menu-title e-label">Caminho de cor</div>
      <div className="echo-paths" role="radiogroup" aria-label="Caminho de cor">
        {(Object.keys(PATHS) as PathKey[]).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={a.path === k} className="echo-path" data-on={a.path === k} onClick={() => { set({ path: k }); onPathChange(); }}>
            <img src={PATHS[k].img} alt="" />
            <span>{PATHS[k].name}</span>
          </button>
        ))}
      </div>
      <div className="e-menu-title e-label" style={{ marginTop: 8 }}>Mistura do degradê</div>
      <div className="echo-mixes" role="radiogroup" aria-label="Mistura do degradê">
        {MIXES.map((m) => (
          <button key={m.key} type="button" role="radio" aria-checked={a.mix === m.key} aria-label={m.name} title={m.name} data-on={a.mix === m.key} onClick={() => { set({ mix: m.key }); onPathChange(); }}
            style={{ ["--c" as string]: m.color ?? "conic-gradient(from 0deg, #5AA6F2, #A58BF5, #EF7FB4, #F59A4A, #5AA6F2)" }} />
        ))}
      </div>
      <div className="e-range" style={{ ["--v" as string]: `${(a.angle / 360) * 100}%`, padding: "8px 8px 0" }}>
        <div className="e-range-top"><label htmlFor="ap-angle">Ângulo</label><output>{a.angle}°</output></div>
        <input id="ap-angle" type="range" min={0} max={360} step={5} value={a.angle} onChange={(e) => set({ angle: +e.target.value })} />
      </div>
      <div className="e-range" style={{ ["--v" as string]: `${a.aura}%`, padding: "4px 8px 6px" }}>
        <div className="e-range-top"><label htmlFor="ap-aura">Intensidade da aura</label><output>{a.aura}%</output></div>
        <input id="ap-aura" type="range" min={0} max={100} value={a.aura} onChange={(e) => set({ aura: +e.target.value })} />
      </div>
    </div>
  );
}

// ----- Paleta de comandos (sem animação: ação de teclado frequente) -------------

export type CommandItem = { id: string; group: string; label: string; sub?: string; icon: IconName; run: () => void };

function CommandPalette({ items, onClose, client }: { items: CommandItem[]; onClose: () => void; client?: boolean }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const [hits, setHits] = useState<Hit[]>([]);
  const input = useRef<HTMLInputElement>(null);
  // Busca global com pequeno atraso para não consultar a cada tecla.
  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    let alive = true;
    const t = setTimeout(() => { searchAll(q, { client, limit: 30, perKind: 4 }).then((h) => { if (alive) setHits(h); }).catch(() => undefined); }, 60);
    return () => { alive = false; clearTimeout(t); };
  }, [q, client]);
  const open = (h: { kind: HitKind; id: string; title: string; sub: string | null; href: string }) => { trackRecent({ kind: h.kind, id: h.id, title: h.title, sub: h.sub, href: h.href }); navigate({ to: h.href as never }); };
  const recentItems: CommandItem[] = q ? [] : listRecent().slice(0, 5).map((r) => ({ id: `rec-${r.href}`, group: "Recentes", label: r.title, sub: r.sub ?? KIND_META[r.kind]?.label, icon: (KIND_META[r.kind]?.icon ?? "history") as IconName, run: () => open(r) }));
  const hitItems: CommandItem[] = hits.filter((h) => h.kind !== "cliente" || !items.some((it) => it.id === `cli-${h.brandSlug}`)).map((h) => ({ id: `hit-${h.kind}-${h.id}`, group: KIND_META[h.kind].plural, label: h.title, sub: h.sub ?? undefined, icon: KIND_META[h.kind].icon as IconName, run: () => open(h) }));
  const filtered = useMemo(() => items.filter((it) => norm(it.label + " " + (it.sub ?? "")).includes(norm(q))), [items, q]);
  const more: CommandItem[] = q.trim().length >= 2 ? [{ id: "all", group: "Pesquisa", label: `Ver todos os resultados para “${q.trim()}”`, icon: "search", run: () => navigate({ to: "/pesquisa" as never, search: { q: q.trim() } as never }) }] : [];
  const list = [...recentItems, ...filtered, ...hitItems, ...more];
  useEffect(() => { input.current?.focus(); warmSearch(client); }, []);
  useEffect(() => setI(0), [q]);
  const groups = [...new Set(list.map((l) => l.group))];
  const run = (it?: CommandItem) => { if (!it) return; onClose(); it.run(); };
  return (
    <div className="e-layer e-cmdk-layer" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="e-scrim" onClick={onClose} />
      <div className="e-cmdk floating" role="dialog" aria-label="Paleta de comandos" style={{ width: "min(640px, 100%)" }}>
        <div className="e-cmdk-in">
          <Icon name="search" size="md" />
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar clientes, tarefas, materiais, pessoas…" aria-label="Buscar em todo o Echo"
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(list.length - 1, x + 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
              if (e.key === "Enter") { e.preventDefault(); run(list[i]); }
              if (e.key === "Escape") onClose();
            }} />
          <span className="e-kbd">esc</span>
        </div>
        <div className="e-cmdk-list" role="listbox">
          {list.length === 0 && <div className="e-state" style={{ padding: "22px 12px" }}><h4>Nada encontrado para “{q}”</h4><p>{q.trim().length < 2 ? "Digite pelo menos duas letras." : "Tente o nome de um cliente, de um material ou de uma pessoa."}</p></div>}
          {groups.map((g) => (
            <div key={g}>
              <div className="e-cmdk-group e-label">{g}</div>
              {list.filter((l) => l.group === g).map((it) => {
                const idx = list.indexOf(it);
                return (
                  <button key={it.id} type="button" role="option" aria-selected={idx === i} className="e-cmdk-item" onMouseMove={() => setI(idx)} onClick={() => run(it)}>
                    <span className="ic"><Icon name={it.icon} size="sm" /></span>
                    <span style={{ minWidth: 0 }}><span className="e-ellipsis" style={{ display: "block" }}>{it.label}</span>{it.sub && <span className="sub">{it.sub}</span>}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="e-cmdk-foot"><span><span className="e-kbd">↑</span><span className="e-kbd">↓</span> navegar</span><span><span className="e-kbd">↵</span> abrir</span><span><span className="e-kbd">⌘</span><span className="e-kbd">K</span> em qualquer tela</span></div>
      </div>
    </div>
  );
}

// ----- Barra superior ------------------------------------------------------------

export function EchoTopbar({
  person,
  activeEnv,
  envAvailability,
  commands = [],
  onSignOut,
}: {
  person?: { name: string };
  activeEnv?: EnvDef["id"];
  envAvailability?: Partial<Record<EnvDef["id"], { available: boolean; reason?: string } | undefined>>;
  commands?: CommandItem[];
  onSignOut?: () => void;
}) {
  const navigate = useNavigate();
  const session = useEchoSession();
  // O primeiro render precisa ser igual ao do servidor: dados da sessão só depois de montar.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const sess = mounted ? session.data : undefined;
  person = mounted && person ? person : { name: sess?.name || "…" };
  envAvailability = mounted ? envAvailability ?? sess?.envs : undefined;
  if (!onSignOut && sess?.mode === "live" && sess.signedIn) onSignOut = async () => { await supabase.auth.signOut(); navigate({ to: "/auth" }); };
  const logo = useRef<EchoLogoHandle>(null);
  const [envOpen, setEnvOpen] = useState(false);
  const [appearOpen, setAppearOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen((v) => !v); } };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, []);

  const [, setAppearance] = useAppearance();
  const clients = useQuery({ queryKey: ["echo-clients"], queryFn: loadClients, enabled: paletteOpen && mounted, staleTime: 120_000 });
  const isClient = sess?.role === "client";
  const clientCommands: CommandItem[] = (clients.data ?? []).map((c) => ({
    id: `cli-${c.slug}`, group: "Clientes", label: c.name, sub: c.segment ?? (isClient ? "Espaço 360" : "Hub do cliente"), icon: "briefcase",
    run: () => navigate({ to: (isClient ? `/e360/${c.slug}` : `/clientes/${c.slug}`) as never }),
  }));
  const envCommands: CommandItem[] = ENVS.filter((e) => e.href && (envAvailability ? envAvailability[e.id]?.available === true : true)).map((e) => ({
    id: `env-${e.id}`, group: "Ir para", label: e.name, sub: e.tagline, icon: e.icon, run: () => navigate({ to: e.href as never }),
  }));
  const baseCommands: CommandItem[] = [
    { id: "base", group: "Ações rápidas", label: "Alternar base clara ou escura", sub: "Aparência", icon: "moon", run: () => { const html = document.documentElement; setAppearance({ base: html.dataset.base === "dark" ? "light" : "dark" }); } },
    { id: "cores", group: "Ações rápidas", label: "Personalizar cores", sub: "Caminho, mistura e aura", icon: "palette", run: () => setAppearOpen(true) },
    { id: "sol", group: "Ações rápidas", label: "Nova solicitação", sub: "Espaço 360", icon: "message", run: () => navigate({ to: "/e360" as never }) },
    ...(isClient ? [] : [
      { id: "tarefa", group: "Ações rápidas", label: "Nova tarefa", sub: "Workspace · Demandas", icon: "plus" as IconName, run: () => navigate({ to: "/workspace/demandas" as never }) },
      { id: "like", group: "Ações rápidas", label: "Enviar para aprovação", sub: "Like", icon: "send" as IconName, run: () => navigate({ to: "/like" as never }) },
      { id: "busca", group: "Ações rápidas", label: "Pesquisa completa", sub: "Filtros por ambiente, cliente, tipo e período", icon: "search" as IconName, run: () => navigate({ to: "/pesquisa" as never }) },
    ]),
  ];
  // Equipe: "ver como cliente" direto do ⌘K.
  const viewAsCommands: CommandItem[] = isClient || !mounted || isViewingAsClient() ? [] : (clients.data ?? []).map((c) => ({
    id: `va-${c.slug}`, group: "Ver como cliente", label: `Ver como ${c.name}`, sub: "Abre o Like como o cliente vê", icon: "eye",
    run: () => { startViewAsClient(c.name); window.location.assign(`/like/${c.slug}`); },
  }));

  return (
    <>
      <header className="cat-top e-glass e-blur echo-topbar">
        <Link to="/" className="cat-brand e-echo-host" aria-label="Echo, início">
          <EchoLogo ref={logo} size={34} />
          <span className="by">por Reach</span>
        </Link>
        <nav className="echo-envnav" aria-label="Ambientes">
          {ENVS.map((e) => {
            const av = envAvailability?.[e.id];
            if (av === undefined && envAvailability) return null;
            const locked = av ? !av.available : false;
            const inner = (<><span className="dot" style={{ background: e.color }} />{e.name}{locked && <Icon name="lock" size="sm" />}</>);
            return locked || !e.href ? (
              <span key={e.id} className="echo-envlink" aria-disabled="true" title={av?.reason ?? "Em construção"}>{inner}</span>
            ) : (
              <Link key={e.id} to={e.href as never} className={`echo-envlink${activeEnv === e.id ? " on" : ""}`}>{inner}</Link>
            );
          })}
        </nav>
        <span className="sp" />
        <div className="tools">
          <div className="echo-envmenu" style={{ position: "relative" }}>
            <button type="button" className="e-btn secondary icon" aria-label="Ambientes" aria-expanded={envOpen} onClick={() => setEnvOpen((v) => !v)}>
              <Icon name="grid" />
            </button>
            {envOpen && (
              <div className="e-pop right" role="menu" onMouseLeave={() => setEnvOpen(false)}>
                <div className="e-menu-title e-label">Ambientes</div>
                {ENVS.map((e) => {
                  const av = envAvailability?.[e.id];
                  if (av === undefined && envAvailability) return null;
                  const locked = !e.href || (av ? !av.available : false);
                  return (
                    <button key={e.id} type="button" role="menuitem" className="e-menu-item" disabled={locked} onClick={() => { setEnvOpen(false); navigate({ to: e.href as never }); }}>
                      <span className="dot" style={{ width: 9, height: 9, borderRadius: "50%", background: e.color, flex: "none" }} />
                      <span className="e-grow">{e.name}</span>
                      {locked && <span className="meta">{av?.reason ?? "Em construção"}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <button type="button" className="e-btn secondary sm echo-search" onClick={() => setPaletteOpen(true)} aria-label="Buscar (⌘K)">
            <Icon name="search" /> <span className="lbl">Buscar</span> <span className="e-kbd">⌘K</span>
          </button>
          {mounted && sess?.signedIn && <NotificationBell userId={sess.userId} />}
          <div style={{ position: "relative" }}>
            <button type="button" className="e-btn secondary icon" data-appearance-trigger aria-label="Aparência" aria-expanded={appearOpen} onClick={() => setAppearOpen((v) => !v)}>
              <Icon name="palette" />
            </button>
            {appearOpen && <AppearancePanel onClose={() => setAppearOpen(false)} onPathChange={() => logo.current?.play()} />}
          </div>
          <div style={{ position: "relative" }}>
            <button type="button" className="echo-avatar-btn" aria-label={`Conta de ${person.name}`} aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
              <Avatar name={person.name || "?"} size="sm" />
            </button>
            {menuOpen && (
              <div className="e-pop right" role="menu" onMouseLeave={() => setMenuOpen(false)}>
                <div className="e-menu-title" style={{ fontWeight: 600, fontSize: 13.5 }}>{person.name}</div>
                <button type="button" role="menuitem" className="e-menu-item" onClick={() => { setMenuOpen(false); setAppearOpen(true); }}><Icon name="palette" />Aparência</button>
                <button type="button" role="menuitem" className="e-menu-item" onClick={() => navigate({ to: "/meu-acesso" as never })}><Icon name="lock" />Meu acesso</button>
                {onSignOut && (<><div className="e-menu-sep" /><button type="button" role="menuitem" className="e-menu-item" onClick={onSignOut}><Icon name="logout" />Sair</button></>)}
              </div>
            )}
          </div>
        </div>
      </header>
      {paletteOpen && <CommandPalette client={isClient || isViewingAsClient()} items={[...baseCommands, ...envCommands, ...commands.filter((c) => c.group !== "Clientes"), ...clientCommands, ...viewAsCommands]} onClose={() => setPaletteOpen(false)} />}
    </>
  );
}

/** Faixa do modo demonstração: dados de exemplo e troca de papel. */
export function DemoBanner({ role, onRole }: { role: "team" | "client"; onRole: (r: "team" | "client") => void }) {
  return (
    <div className="echo-demo" role="status">
      <Icon name="info" size="sm" />
      <span><b>Modo demonstração.</b> O banco não está conectado neste ambiente; os dados são de exemplo.</span>
      <span className="sp" />
      <div className="e-seg e-lite" role="tablist" aria-label="Ver a Home como">
        {([["team", "Equipe", "users"], ["client", "Cliente", "user"]] as const).map(([k, l, ic]) => (
          <button key={k} type="button" role="tab" aria-selected={role === k} onClick={() => onRole(k)} style={{ background: role === k ? "var(--glass-strong)" : undefined, boxShadow: role === k ? "var(--glass-inset), 0 0 0 1px var(--line)" : undefined }}>
            <Icon name={ic} size="sm" />{l}
          </button>
        ))}
      </div>
    </div>
  );
}

export function EchoBackdrop({ children }: { children?: ReactNode }) {
  return (
    <>
      <div className="e-aura" aria-hidden="true"><i /></div>
      <div className="e-grain" aria-hidden="true" />
      {children}
    </>
  );
}
