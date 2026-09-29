// ---------------------------------------------------------------------------
// Echo · Controles de formulário e navegação
// Mesma marcação e classes da Biblioteca Echo (components.css).
// ---------------------------------------------------------------------------
import { useEffect, useId, useLayoutEffect, useRef, useState, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { Icon, type IconName } from "./icon";

// ----- Campo -------------------------------------------------------------------

type FieldBase = { label?: string; help?: string; error?: string; optional?: boolean; icon?: IconName; suffix?: ReactNode; pill?: boolean; loading?: boolean };

export function Field({ label, help, error, optional, icon, suffix, pill, loading, type = "text", className = "", ...rest }: FieldBase & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const [show, setShow] = useState(false);
  const isPass = type === "password";
  const lead = type === "search" ? "search" : isPass ? "lock" : icon;
  return (
    <div className={`e-field ${className}`}>
      {label && <label htmlFor={id}>{label}{optional && <span style={{ fontWeight: 500, color: "var(--ink-4)" }}>Opcional</span>}</label>}
      <div className={`e-input${pill ? " pill" : ""}${error ? " is-error" : ""}${rest.disabled ? " is-disabled" : ""}`}>
        {lead && <Icon name={lead} size="md" />}
        <input id={id} type={isPass && show ? "text" : type} aria-invalid={error ? true : undefined} aria-describedby={error || help ? `${id}-h` : undefined} {...rest} />
        {loading && <span className="e-spin-sm" aria-label="Carregando" />}
        {error && !loading && <span style={{ color: "var(--danger)" }}><Icon name="alert" size="md" /></span>}
        {isPass && (
          <button type="button" className="e-inline-btn" aria-label={show ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShow((v) => !v)}>
            <Icon name={show ? "eyeOff" : "eye"} size="md" />
          </button>
        )}
        {suffix}
      </div>
      {(error || help) && <div id={`${id}-h`} className={`e-help${error ? " error" : ""}`}>{error && <Icon name="info" size="sm" />}{error ?? help}</div>}
    </div>
  );
}

export function TextArea({ label, help, error, optional, max, className = "", value, ...rest }: FieldBase & TextareaHTMLAttributes<HTMLTextAreaElement> & { max?: number }) {
  const id = useId();
  const len = typeof value === "string" ? value.length : 0;
  return (
    <div className={`e-field ${className}`}>
      {label && (
        <label htmlFor={id}>
          {label}
          <span style={{ display: "inline-flex", gap: 8 }}>{optional && <span style={{ fontWeight: 500, color: "var(--ink-4)" }}>Opcional</span>}{max && <span className="e-count">{len}/{max}</span>}</span>
        </label>
      )}
      <div className={`e-input${error ? " is-error" : ""}`} style={{ alignItems: "flex-start", paddingTop: 2 }}>
        <textarea id={id} value={value} maxLength={max} aria-invalid={error ? true : undefined} {...rest} />
      </div>
      {(error || help) && <div className={`e-help${error ? " error" : ""}`}>{error && <Icon name="info" size="sm" />}{error ?? help}</div>}
    </div>
  );
}

// ----- Popover com saída animada -------------------------------------------------

function usePopover() {
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const close = () => { if (!open) return; setLeaving(true); window.setTimeout(() => { setOpen(false); setLeaving(false); }, 150); };
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) close(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { close(); (wrap.current?.querySelector("button") as HTMLButtonElement | null)?.focus(); } };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  });
  const arrows = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...(wrap.current?.querySelectorAll<HTMLButtonElement>(".e-pop .e-menu-item:not(:disabled)") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
  };
  return { open, setOpen, leaving, close, wrap, arrows };
}

// ----- Select ------------------------------------------------------------------------

export type Option = { value: string; label: string; icon?: IconName };

export function Select({ label, value, options, placeholder = "Selecione", onChange, error, disabled, icon }: { label?: string; value?: string; options: Option[]; placeholder?: string; onChange: (v: string) => void; error?: string; disabled?: boolean; icon?: IconName }) {
  const id = useId();
  const p = usePopover();
  const cur = options.find((o) => o.value === value);
  useEffect(() => { if (p.open) (p.wrap.current?.querySelector('.e-pop [aria-selected="true"], .e-pop .e-menu-item') as HTMLButtonElement | null)?.focus(); }, [p.open]);
  return (
    <div className="e-field">
      {label && <span className="e-field-label" id={`${id}-l`}>{label}</span>}
      <div className={`e-select${p.open ? " open" : ""}`} ref={p.wrap} onKeyDown={p.arrows}>
        <button type="button" className={`e-input e-select-btn${error ? " is-error" : ""}`} aria-haspopup="listbox" aria-expanded={p.open} aria-labelledby={label ? `${id}-l` : undefined} disabled={disabled} onClick={() => (p.open ? p.close() : p.setOpen(true))}>
          {icon && <Icon name={icon} size="md" />}
          <span className={`val${cur ? "" : " ph"}`}>{cur?.label ?? placeholder}</span>
          <Icon name="chevDown" size="md" className="chev" />
        </button>
        {p.open && (
          <div className={`e-pop${p.leaving ? " leaving" : ""}`} role="listbox" style={{ width: "100%" }}>
            {options.map((o) => (
              <button key={o.value} type="button" role="option" aria-selected={o.value === value} className="e-menu-item" onClick={() => { onChange(o.value); p.close(); }}>
                {o.icon && <Icon name={o.icon} />}
                <span className="e-grow e-ellipsis">{o.label}</span>
                {o.value === value && <Icon name="check" size="sm" />}
              </button>
            ))}
          </div>
        )}
      </div>
      {error && <div className="e-help error"><Icon name="info" size="sm" />{error}</div>}
    </div>
  );
}

// ----- Menu -----------------------------------------------------------------------------

export type MenuItem = { label: string; icon?: IconName; danger?: boolean; disabled?: boolean; kbd?: string; onSelect: () => void } | "-" | { title: string };

export function Menu({ trigger, items, align = "left" }: { trigger: (p: { open: boolean; toggle: () => void }) => ReactNode; items: MenuItem[]; align?: "left" | "right" }) {
  const p = usePopover();
  useEffect(() => { if (p.open) (p.wrap.current?.querySelector(".e-pop .e-menu-item:not(:disabled)") as HTMLButtonElement | null)?.focus(); }, [p.open]);
  return (
    <div className="e-select" ref={p.wrap} onKeyDown={p.arrows} style={{ display: "inline-block" }}>
      {trigger({ open: p.open, toggle: () => (p.open ? p.close() : p.setOpen(true)) })}
      {p.open && (
        <div className={`e-pop${align === "right" ? " right" : ""}${p.leaving ? " leaving" : ""}`} role="menu">
          {items.map((it, i) =>
            it === "-" ? <div key={i} className="e-menu-sep" /> : "title" in it ? <div key={i} className="e-menu-title e-label">{it.title}</div> : (
              <button key={i} type="button" role="menuitem" className={`e-menu-item${it.danger ? " danger" : ""}`} disabled={it.disabled} onClick={() => { p.close(); it.onSelect(); }}>
                {it.icon && <Icon name={it.icon} />}<span className="e-grow">{it.label}</span>{it.kbd && <span className="meta e-mono">{it.kbd}</span>}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

// ----- Seleção ---------------------------------------------------------------------------

const CHECK = <svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" /></svg>;

export function Checkbox({ label, desc, checked, indeterminate, onChange, disabled, error, radio, name, value }: { label?: ReactNode; desc?: string; checked: boolean; indeterminate?: boolean; onChange: (v: boolean) => void; disabled?: boolean; error?: boolean; radio?: boolean; name?: string; value?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = !!indeterminate; }, [indeterminate]);
  return (
    <label className={`e-check${radio ? " radio" : ""}${error ? " is-error" : ""}`}>
      <input ref={ref} type={radio ? "radio" : "checkbox"} name={name} value={value} checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="box">{!radio && CHECK}</span>
      {label && <span>{label}{desc && <small>{desc}</small>}</span>}
    </label>
  );
}

export function Switch({ label, checked, onChange, disabled, size }: { label?: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; size?: "lg" }) {
  return (
    <label className={`e-switch${size === "lg" ? " lg" : ""}`}>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" />
      {label && <span>{label}</span>}
    </label>
  );
}

export function Chip({ children, pressed, onClick, icon, count, removable, color, disabled }: { children: ReactNode; pressed?: boolean; onClick?: () => void; icon?: IconName; count?: number; removable?: boolean; color?: string; disabled?: boolean }) {
  return (
    <button type="button" className="e-chip" aria-pressed={pressed} onClick={onClick} disabled={disabled}>
      {color && <i className="sw" style={{ ["--c" as string]: color }} />}
      {icon && <Icon name={icon} size="sm" />}
      {children}
      {count !== undefined && <span className="n">{count}</span>}
      {removable && <Icon name="x" className="x" />}
    </button>
  );
}

// ----- Segmentado e abas ------------------------------------------------------------------

export function Segmented<T extends string>({ items, value, onChange, label }: { items: { value: T; label: string; icon?: IconName }[]; value: T; onChange: (v: T) => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const on = ref.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]');
    if (on && pill.current) { pill.current.style.left = `${on.offsetLeft}px`; pill.current.style.width = `${on.offsetWidth}px`; }
  }, [value, items.length]);
  return (
    <div ref={ref} className="e-seg e-lite" role="tablist" aria-label={label}
      onKeyDown={(e) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        const i = items.findIndex((it) => it.value === value);
        const n = items[(i + (e.key === "ArrowRight" ? 1 : -1) + items.length) % items.length];
        onChange(n.value);
        window.setTimeout(() => ref.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus());
      }}>
      <span className="e-seg-pill" ref={pill} aria-hidden="true" />
      {items.map((it) => (
        <button key={it.value} type="button" role="tab" aria-selected={it.value === value} tabIndex={it.value === value ? 0 : -1} onClick={() => onChange(it.value)}>
          {it.icon && <Icon name={it.icon} size="sm" />}{it.label}
        </button>
      ))}
    </div>
  );
}

export function LineTabs<T extends string>({ items, value, onChange }: { items: { value: T; label: string; icon?: IconName; count?: number; disabled?: boolean }[]; value: T; onChange: (v: T) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const ind = useRef<HTMLSpanElement>(null);
  const first = useRef(true);
  useLayoutEffect(() => {
    const on = ref.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]');
    const el = ind.current;
    if (!on || !el) return;
    if (first.current) el.style.transition = "none";
    el.style.transform = `translateX(${on.offsetLeft + 12}px) scaleX(${(on.offsetWidth - 24) / 100})`;
    if (first.current) { void el.getBoundingClientRect(); el.style.transition = ""; first.current = false; }
  }, [value, items.length]);
  return (
    <div className="e-tabs-line" role="tablist" ref={ref}>
      <span className="e-tab-ind" ref={ind} aria-hidden="true" />
      {items.map((it) => (
        <button key={it.value} type="button" role="tab" aria-selected={it.value === value} disabled={it.disabled} onClick={() => onChange(it.value)}>
          {it.icon && <Icon name={it.icon} size="sm" />}{it.label}{it.count !== undefined && <span className="n">{it.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ----- Tooltip e alerta --------------------------------------------------------------------

export function Tooltip({ text, kbd, children, bottom }: { text: string; kbd?: string; children: ReactNode; bottom?: boolean }) {
  return (
    <span className={`e-tip${bottom ? " bottom" : ""}`}>
      {children}
      <span className="bubble" role="tooltip">{text}{kbd && <kbd>{kbd}</kbd>}</span>
    </span>
  );
}

export function Alert({ kind = "info", title, children, actions, onDismiss }: { kind?: "info" | "ok" | "warn" | "danger" | "accent"; title: string; children?: ReactNode; actions?: ReactNode; onDismiss?: () => void }) {
  const ic = ({ info: "info", ok: "checkCircle", warn: "alert", danger: "xCircle", accent: "sparkle" } as const)[kind];
  return (
    <div className={`e-alert ${kind}`} role={kind === "danger" ? "alert" : "status"}>
      <span className="ico"><Icon name={ic} /></span>
      <div><b>{title}</b>{children && <p>{children}</p>}{actions && <div className="actions">{actions}</div>}</div>
      {onDismiss ? <button type="button" className="e-btn ghost sm icon" aria-label="Fechar alerta" onClick={onDismiss}><Icon name="x" /></button> : <span />}
    </div>
  );
}
