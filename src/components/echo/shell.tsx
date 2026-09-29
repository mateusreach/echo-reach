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

export type EnvDef = { id: "brand" | "workspace" | "like" | "e360"; name: string; tagline: string; icon: IconName; color: string; href?: string };

export const ENVS: EnvDef[] = [
  { id: "brand", name: "Brand", tagline: "Plano, identidade e biblioteca da marca", icon: "layers", color: "var(--env-brand)", href: "/agencia/clientes" },
  { id: "workspace", name: "Workspace", tagline: "Entregas, tarefas, prazos e cobertura", icon: "grid", color: "var(--env-workspace)", href: "/workspace" },
  { id: "like", name: "Like", tagline: "Aprovação de materiais com o cliente", icon: "heart", color: "var(--env-like)" },
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

function CommandPalette({ items, onClose }: { items: CommandItem[]; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useMemo(() => items.filter((it) => (it.label + " " + (it.sub ?? "")).toLowerCase().includes(q.toLowerCase())), [items, q]);
  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => setI(0), [q]);
  const groups = [...new Set(list.map((l) => l.group))];
  const run = (it?: CommandItem) => { if (!it) return; onClose(); it.run(); };
  return (
    <div className="e-layer e-cmdk-layer" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="e-scrim" onClick={onClose} />
      <div className="e-cmdk floating" role="dialog" aria-label="Paleta de comandos" style={{ width: "min(640px, 100%)" }}>
        <div className="e-cmdk-in">
          <Icon name="search" size="md" />
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar ambientes, clientes e ações…" aria-label="Buscar comandos"
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(list.length - 1, x + 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
              if (e.key === "Enter") { e.preventDefault(); run(list[i]); }
              if (e.key === "Escape") onClose();
            }} />
          <span className="e-kbd">esc</span>
        </div>
        <div className="e-cmdk-list" role="listbox">
          {list.length === 0 && <div className="e-state" style={{ padding: "22px 12px" }}><h4>Nada encontrado para “{q}”</h4><p>Tente o nome de um cliente ou de um ambiente.</p></div>}
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
  person: { name: string };
  activeEnv?: EnvDef["id"];
  envAvailability?: Partial<Record<EnvDef["id"], { available: boolean; reason?: string } | undefined>>;
  commands?: CommandItem[];
  onSignOut?: () => void;
}) {
  const navigate = useNavigate();
  const logo = useRef<EchoLogoHandle>(null);
  const [appearOpen, setAppearOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen((v) => !v); } };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, []);

  const [, setAppearance] = useAppearance();
  const envCommands: CommandItem[] = ENVS.filter((e) => e.href && (envAvailability ? envAvailability[e.id]?.available === true : true)).map((e) => ({
    id: `env-${e.id}`, group: "Ir para", label: e.name, sub: e.tagline, icon: e.icon, run: () => navigate({ to: e.href as never }),
  }));
  const baseCommands: CommandItem[] = [
    { id: "base", group: "Ações rápidas", label: "Alternar base clara ou escura", sub: "Aparência", icon: "moon", run: () => { const html = document.documentElement; setAppearance({ base: html.dataset.base === "dark" ? "light" : "dark" }); } },
    { id: "cores", group: "Ações rápidas", label: "Personalizar cores", sub: "Caminho, mistura e aura", icon: "palette", run: () => setAppearOpen(true) },
  ];

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
          <button type="button" className="e-btn secondary sm echo-search" onClick={() => setPaletteOpen(true)} aria-label="Buscar (⌘K)">
            <Icon name="search" /> <span className="lbl">Buscar</span> <span className="e-kbd">⌘K</span>
          </button>
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
                <button type="button" role="menuitem" className="e-menu-item" onClick={() => navigate({ to: "/workspace/meu-acesso" as never })}><Icon name="lock" />Meu acesso</button>
                {onSignOut && (<><div className="e-menu-sep" /><button type="button" role="menuitem" className="e-menu-item" onClick={onSignOut}><Icon name="logout" />Sair</button></>)}
              </div>
            )}
          </div>
        </div>
      </header>
      {paletteOpen && <CommandPalette items={[...baseCommands, ...envCommands, ...commands]} onClose={() => setPaletteOpen(false)} />}
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
