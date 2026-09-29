// ---------------------------------------------------------------------------
// Echo · Pessoas: PeoplePicker (responsáveis) e matriz de permissões
// ---------------------------------------------------------------------------
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Avatar } from "./primitives";
import { Checkbox, Chip, usePopover } from "./controls";
import { Icon } from "./icon";
import { PATHS, type PathKey } from "./appearance";
import { PERMISSION_ACTIONS, PERMISSION_MODULES, modulePermissionKey, type PermissionAction } from "@/lib/agency-data";
import { ACTION_HELP, PERMISSION_PRESETS, listPickable, type Pickable } from "@/lib/team-data";

export const personGradient = (p: PathKey) => `linear-gradient(135deg, ${PATHS[p].p1}, ${PATHS[p].p2})`;

/**
 * Escolha de responsáveis. Só lista pessoas ativas; mostra setor e carga para
 * ajudar a distribuir. `multiple` troca a seleção única por várias.
 */
export function PeoplePicker({ label, value, onChange, multiple, placeholder = "Escolher pessoa", disabled }: { label?: string; value: string[]; onChange: (ids: string[]) => void; multiple?: boolean; placeholder?: string; disabled?: boolean }) {
  const p = usePopover();
  const [q, setQ] = useState("");
  const [sector, setSector] = useState<string | null>(null);
  const search = useRef<HTMLInputElement>(null);
  const list = useQuery({ queryKey: ["people-pickable"], queryFn: listPickable, staleTime: 60_000 });
  const people = list.data ?? [];
  const sectors = useMemo(() => [...new Set(people.flatMap((x) => x.sectors))].sort((a, b) => a.localeCompare(b, "pt-BR")), [people]);
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const shown = people.filter((x) => (!sector || x.sectors.includes(sector)) && (!q || norm(`${x.name} ${x.jobTitle ?? ""}`).includes(norm(q))));
  const chosen = value.map((id) => people.find((x) => x.id === id)).filter(Boolean) as Pickable[];
  useEffect(() => { if (p.open) window.setTimeout(() => search.current?.focus(), 20); else { setQ(""); } }, [p.open]);

  const toggle = (id: string) => {
    if (!multiple) { onChange(value[0] === id ? [] : [id]); p.close(); return; }
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  return (
    <div className="e-field">
      {label && <span className="e-field-label">{label}</span>}
      <div className={`e-select${p.open ? " open" : ""}`} ref={p.wrap} onKeyDown={p.arrows}>
        <button type="button" className="e-input e-select-btn" aria-haspopup="listbox" aria-expanded={p.open} disabled={disabled} onClick={() => (p.open ? p.close() : p.setOpen(true))}>
          {chosen.length ? (
            <span className="picker-chosen">
              <span className="e-avs">{chosen.slice(0, 4).map((x) => <Avatar key={x.id} name={x.name} size="xs" gradient={personGradient(x.palette)} />)}</span>
              <span className="val e-ellipsis">{chosen.length === 1 ? chosen[0].name : `${chosen.length} pessoas`}</span>
            </span>
          ) : <span className="val ph"><Icon name="user" size="sm" /> {placeholder}</span>}
          <Icon name="chevDown" size="md" className="chev" />
        </button>
        {p.open && (
          <div className={`e-pop picker-pop${p.leaving ? " leaving" : ""}`} role="listbox" aria-multiselectable={multiple || undefined}>
            <div className="picker-search">
              <Icon name="search" size="sm" />
              <input ref={search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar pessoa ou função" aria-label="Buscar pessoa" />
            </div>
            {sectors.length > 1 && (
              <div className="picker-sectors">
                <Chip pressed={!sector} onClick={() => setSector(null)}>Todos</Chip>
                {sectors.map((s) => <Chip key={s} pressed={sector === s} onClick={() => setSector(sector === s ? null : s)}>{s}</Chip>)}
              </div>
            )}
            <div className="picker-list">
              {list.isLoading && <div className="e-caption" style={{ padding: 12 }}>Carregando equipe…</div>}
              {!list.isLoading && shown.length === 0 && <div className="e-caption" style={{ padding: 12 }}>Ninguém encontrado{q ? ` para “${q}”` : ""}.</div>}
              {shown.map((x) => {
                const on = value.includes(x.id);
                const busy = x.late > 0 ? "busy" : x.open >= 6 ? "away" : "on";
                return (
                  <button key={x.id} type="button" role="option" aria-selected={on} className={`e-menu-item picker-item${on ? " on" : ""}`} onClick={() => toggle(x.id)}>
                    <Avatar name={x.name} size="sm" gradient={personGradient(x.palette)} status={busy} />
                    <span className="e-grow" style={{ minWidth: 0 }}>
                      <b className="e-ellipsis" style={{ display: "block" }}>{x.name}</b>
                      <small className="e-caption e-ellipsis" style={{ display: "block" }}>{x.jobTitle ?? "Equipe"}{x.sectors[0] ? ` · ${x.sectors[0]}` : ""}</small>
                    </span>
                    <span className={`picker-load tnum${x.late ? " late" : ""}`}>{x.open} {x.open === 1 ? "item" : "itens"}{x.late ? ` · ${x.late} atras.` : ""}</span>
                    {on && <Icon name="check" size="sm" />}
                  </button>
                );
              })}
            </div>
            {multiple && value.length > 0 && (
              <div className="picker-foot">
                <span className="e-caption">{value.length} {value.length === 1 ? "selecionada" : "selecionadas"}</span>
                <button type="button" className="e-link" onClick={() => onChange([])}>Limpar</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Matriz módulo × ação, com perfis prontos e explicação de cada ação. */
export function PermissionMatrix({ value, onChange, disabled, allowAll }: { value: string[]; onChange: (v: string[]) => void; disabled?: boolean; allowAll?: boolean }) {
  const set = new Set(value);
  const cols = PERMISSION_ACTIONS.filter((a) => PERMISSION_MODULES.some((m) => m.actions.includes(a.key)));
  const presetOf = PERMISSION_PRESETS.find((p) => { const k = p.perms(); return k.length === value.length && k.every((x) => set.has(x)); })?.key;
  const flip = (key: string, on: boolean) => {
    const next = new Set(set);
    if (on) next.add(key); else next.delete(key);
    // Qualquer ação depende de ver o módulo.
    const [mod, act] = key.split(".");
    if (on && act !== "visualizar") next.add(`${mod}.visualizar`);
    if (!on && act === "visualizar") for (const a of PERMISSION_ACTIONS) next.delete(`${mod}.${a.key}`);
    onChange([...next]);
  };
  const rowAll = (mod: string, acts: PermissionAction[], on: boolean) => {
    const next = new Set(set);
    for (const a of acts) { const k = modulePermissionKey(mod, a); if (on) next.add(k); else next.delete(k); }
    onChange([...next]);
  };
  return (
    <div className="e-stack" style={{ gap: 12 }}>
      {allowAll ? (
        <div className="perm-all"><Icon name="checkCircle" size="sm" /> Administradores têm todas as permissões automaticamente.</div>
      ) : (
        <div className="e-row wrap" style={{ gap: 6 }} role="group" aria-label="Perfis prontos">
          {PERMISSION_PRESETS.map((p) => (
            <Chip key={p.key} pressed={presetOf === p.key} disabled={disabled} onClick={() => onChange(p.perms())}>{p.label}</Chip>
          ))}
          <Chip pressed={value.length === 0} disabled={disabled} onClick={() => onChange([])}>Nenhuma</Chip>
        </div>
      )}
      <div className="perm-wrap">
        <table className="perm-table">
          <thead>
            <tr>
              <th scope="col">Módulo</th>
              {cols.map((a) => <th key={a.key} scope="col" title={ACTION_HELP[a.key]}>{a.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_MODULES.map((m) => {
              const rowOn = m.actions.every((a) => allowAll || set.has(modulePermissionKey(m.key, a)));
              return (
                <tr key={m.key}>
                  <th scope="row">
                    <button type="button" className="perm-row-btn" disabled={disabled || allowAll} onClick={() => rowAll(m.key, m.actions, !rowOn)} title={rowOn ? "Remover todas" : "Liberar todas"}>{m.label}</button>
                  </th>
                  {cols.map((a) => {
                    if (!m.actions.includes(a.key)) return <td key={a.key} className="na" aria-hidden="true">·</td>;
                    const k = modulePermissionKey(m.key, a.key);
                    return (
                      <td key={a.key}>
                        <Checkbox checked={allowAll || set.has(k)} disabled={disabled || allowAll} onChange={(v) => flip(k, v)} label={<span className="e-sr">{m.label}: {a.label}</span>} />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <dl className="perm-help">
        {cols.map((a) => <div key={a.key}><dt>{a.label}</dt><dd>{ACTION_HELP[a.key]}</dd></div>)}
      </dl>
    </div>
  );
}

/** Cartão de pessoa da equipe: presença, função, setores, carga e clientes. */
export function MemberCard({ person: p, max, onOpen }: { person: import("@/lib/team-data").TeamPerson; max: number; onOpen?: () => void }) {
  const pct = max ? Math.min(100, Math.round((p.open / max) * 100)) : 0;
  const load = p.late > 0 ? "danger" : pct > 80 ? "warn" : "ok";
  const status = !p.active ? "off" : p.late > 0 ? "busy" : p.open >= 6 ? "away" : "on";
  const availability = !p.active ? "Inativa" : p.late > 0 ? "Com atrasos" : p.open >= 6 ? "Carga alta" : p.open === 0 ? "Disponível" : "Com espaço";
  const body = (
    <>
      <div className="member-top">
        <Avatar name={p.name} size="lg" gradient={personGradient(p.palette)} status={status} />
        <div style={{ minWidth: 0 }}>
          <div className="e-row" style={{ gap: 6 }}>
            <b className="e-ellipsis member-name">{p.name}</b>
            {p.leader && <span className="member-lead" title="Liderança"><Icon name="star" size="sm" /></span>}
          </div>
          <span className="e-caption e-ellipsis" style={{ display: "block" }}>{p.jobTitle ?? "Equipe"}{p.role === "agency_admin" ? " · Admin" : ""}</span>
        </div>
      </div>
      <div className="member-sectors">
        {p.sectors.slice(0, 3).map((s) => <span key={s} className="member-tag">{s}</span>)}
        <span className={`member-avail ${status}`}>{availability}</span>
      </div>
      <div className="member-load">
        <div className={`e-bar sm ${load}`} role="progressbar" aria-valuenow={p.open} aria-valuemin={0} aria-valuemax={max} aria-label={`Carga de ${p.name}`}><i style={{ ["--v" as string]: `${pct}%` }} /></div>
        <div className="e-row between e-caption tnum">
          <span>{p.open} em aberto · {p.weekDue} na semana</span>
          {p.late > 0 && <span style={{ color: "var(--danger)", fontWeight: 600 }}>{p.late} atrasad{p.late > 1 ? "os" : "o"}</span>}
        </div>
      </div>
      {p.clients.length > 0 && (
        <div className="member-clients e-caption e-ellipsis">
          <Icon name="briefcase" size="sm" /> {p.clients.slice(0, 3).map((c) => c.name).join(", ")}{p.clients.length > 3 ? ` +${p.clients.length - 3}` : ""}
        </div>
      )}
    </>
  );
  return onOpen
    ? <button type="button" className={`member-card e-glass${p.active ? "" : " inactive"}`} onClick={onOpen} aria-label={`Abrir ${p.name}`}>{body}</button>
    : <div className={`member-card e-glass${p.active ? "" : " inactive"}`}>{body}</div>;
}
