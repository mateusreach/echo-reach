// Echo · Operational patterns. Shared tokens/markup with css/operations.css in the catalog.
import type { CSSProperties, ReactNode } from "react";
import { Button, ClientLogo } from "./primitives";
import { Chip } from "./controls";
import { Icon } from "./icon";
import { addDaysISO, daysBetween, monthScale, windowScale } from "@/lib/coverage-scale";

export function PeriodNavigator({
  label,
  onPrevious,
  onNext,
  onToday,
  current,
}: {
  label: string;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  current?: boolean;
}) {
  return (
    <div className="e-period" role="group" aria-label="Período exibido">
      <Button
        iconOnly
        size="sm"
        variant="ghost"
        icon="chevLeft"
        aria-label="Mês anterior"
        onClick={onPrevious}
      />
      <span className="e-period-label" aria-live="polite">
        {label}
      </span>
      <Button
        iconOnly
        size="sm"
        variant="ghost"
        icon="chevRight"
        aria-label="Próximo mês"
        onClick={onNext}
      />
      <span className="e-period-divider" />
      <Button size="sm" variant="ghost" onClick={onToday} disabled={current}>
        Hoje
      </Button>
    </div>
  );
}

export type Metric = {
  id: string;
  label: string;
  value: number;
  hint: string;
  color: string;
  icon: string;
};
export function MetricFilters({
  items,
  value,
  onChange,
}: {
  items: Metric[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="e-metric-filters" role="group" aria-label="Filtrar por situação atual">
      {items.map((item) => (
        <button
          type="button"
          key={item.id}
          className="e-metric-filter"
          style={{ "--metric-color": item.color } as CSSProperties}
          aria-pressed={value === item.id}
          onClick={() => onChange(value === item.id ? "" : item.id)}
        >
          <span className="e-metric-top">
            <Icon name={item.icon} size="sm" />
            <span>{item.label}</span>
            <Icon name="arrowUpRight" size="sm" />
          </span>
          <span className="e-metric-value tnum">
            {item.value}
            <small>{item.hint}</small>
          </span>
        </button>
      ))}
    </div>
  );
}

export function ActiveFilters({
  items,
  onClear,
  children,
}: {
  items: { id: string; label: string; onRemove: () => void }[];
  onClear: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="e-active-filters">
      <span className="e-caption" role="status">
        {children}
      </span>
      {items.map((item) => (
        <Chip key={item.id} removable onClick={item.onRemove}>
          {item.label}
        </Chip>
      ))}
      {items.length > 0 && (
        <Button size="sm" variant="ghost" onClick={onClear}>
          Limpar filtros
        </Button>
      )}
    </div>
  );
}

export function DetailFacts({
  items,
}: {
  items: { label: string; value: ReactNode; hint?: string }[];
}) {
  return (
    <dl className="e-detail-facts">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
          {item.hint && <small>{item.hint}</small>}
        </div>
      ))}
    </dl>
  );
}

export type CoverageRow = {
  id: string;
  name: string;
  logo?: string | null;
  front: string;
  recurrence: string;
  approved: string | null;
  produce: string | null;
  nextStart: string;
  nextEnd: string;
  status: string;
  color: string;
  hint: string;
  lead: number;
  updated?: boolean;
  /** Cor de preenchimento (faixas e pílulas). A cor `color` fica para texto e pontos. */
  fill?: string;
  /** Tamanho do ciclo em dias (semanal 7, quinzenal 14…): a pílula mostra só o último ciclo aprovado. */
  cycleDays?: number;
  /** Dias entre hoje e o fim da cobertura (negativo = vencida). */
  diff?: number;
};
export const shortDate = (iso?: string | null) =>
  iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "—";

export function CoverageLegend() {
  return (
    <div className="e-coverage-legend" aria-label="Legenda da cobertura">
      <span>
        <i className="covered" />
        Aprovado
      </span>
      <span>
        <i className="next" />
        Próximo ciclo
      </span>
      <span>
        <i className="production" />
        Início da produção
      </span>
      <span>
        <i className="today" />
        Hoje
      </span>
    </div>
  );
}

export function CoverageTimeline({
  rows,
  year,
  month,
  today,
  view = "timeline",
  busyId,
  createdIds = [],
  onInspect,
  onCreate,
}: {
  rows: CoverageRow[];
  year: number;
  month: number;
  today: string;
  view?: "timeline" | "list";
  busyId?: string | null;
  createdIds?: string[];
  onInspect: (id: string) => void;
  onCreate: (id: string) => void;
}) {
  const scale = monthScale(year, month);
  const now = scale.marker(today);
  const weekends = Array.from({ length: scale.days }, (_, i) =>
    [0, 6].includes(new Date(year, month, i + 1).getDay()),
  );
  const createAction = (row: CoverageRow, compact = false) => (
    <Button
      size="sm"
      variant={compact ? "ghost" : "secondary"}
      iconOnly={compact}
      icon={createdIds.includes(row.id) ? "check" : "plus"}
      loading={busyId === row.id}
      disabled={!!busyId || createdIds.includes(row.id)}
      aria-label={
        createdIds.includes(row.id)
          ? `Ciclo criado para ${row.name} · ${row.front}`
          : `Criar entrega do ciclo de ${row.name} · ${row.front}`
      }
      title={createdIds.includes(row.id) ? "Entrega do ciclo criada" : "Criar entrega do ciclo"}
      onClick={() => onCreate(row.id)}
    >
      {createdIds.includes(row.id) ? "Ciclo criado" : "Criar ciclo"}
    </Button>
  );
  const identity = (row: CoverageRow) => (
    <>
      <ClientLogo name={row.name} logoUrl={row.logo} size="sm" />
      <span className="e-coverage-name">
        <b>{row.name}</b>
        <small>
          {row.front} <span>· {row.recurrence}</span>
        </small>
      </span>
    </>
  );
  return (
    <div className={`e-coverage-view${view === "list" ? " is-list" : " force-timeline"}`}>
      <div
        className="e-coverage-scroll"
        role="region"
        aria-label="Cobertura mensal por cliente e frente. Role horizontalmente para ver todas as datas."
        tabIndex={0}
      >
        <table className="e-coverage-table" style={{ "--days": scale.days } as CSSProperties}>
          <caption className="e-sr-only">
            Cobertura de conteúdo em {month + 1}/{year}. Situações calculadas em {shortDate(today)}.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="e-coverage-identity">
                Cliente / frente
              </th>
              <th scope="col" className="e-coverage-calendar">
                <div className="e-coverage-days">
                  {weekends.map((wk, i) => (
                    <span
                      key={i}
                      className={`${wk ? "weekend" : ""}${now !== null && i + 1 === Number(today.slice(8, 10)) ? " is-today" : ""}`}
                    >
                      {i + 1}
                    </span>
                  ))}
                </div>
              </th>
              <th scope="col" className="e-coverage-status">
                Situação hoje
              </th>
              <th scope="col" className="e-coverage-action">
                <span className="e-sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const next = scale.interval(row.nextStart, row.nextEnd);
              const production = scale.marker(row.produce);
              const covered = scale.covered(row.approved);
              return (
                <tr
                  key={row.id}
                  className={row.updated ? "is-updated" : undefined}
                  style={{ "--coverage-color": row.color } as CSSProperties}
                >
                  <th scope="row" className="e-coverage-identity">
                    <button
                      type="button"
                      className="e-coverage-client"
                      onClick={() => onInspect(row.id)}
                      aria-label={`Ver cobertura de ${row.name} · ${row.front}`}
                    >
                      {identity(row)}
                    </button>
                  </th>
                  <td className="e-coverage-calendar">
                    <button
                      type="button"
                      className="e-coverage-track"
                      onClick={() => onInspect(row.id)}
                      aria-label={`${row.name}, ${row.front}: ${row.status}. Aprovado até ${shortDate(row.approved)}. Produzir em ${shortDate(row.produce)}. Próximo ciclo ${shortDate(row.nextStart)} a ${shortDate(row.nextEnd)}.`}
                    >
                      <span className="e-coverage-grid" aria-hidden="true">
                        {weekends.map((wk, i) => (
                          <i key={i} className={wk ? "weekend" : undefined} />
                        ))}
                      </span>
                      {covered > 0 && (
                        <span className="e-coverage-band" style={{ width: `${covered}%` }} />
                      )}
                      {next && (
                        <span
                          className="e-coverage-next"
                          style={{ left: `${next.left}%`, width: `${next.width}%` }}
                        />
                      )}
                      {production !== null && (
                        <span
                          className="e-coverage-production"
                          style={{ left: `${production}%` }}
                        />
                      )}
                      {now !== null && (
                        <span className="e-coverage-today" style={{ left: `${now}%` }} />
                      )}
                      {covered === 0 && !next && (
                        <span className="e-coverage-offscreen">
                          {row.approved ? "Sem cobertura neste mês" : "Sem aprovação registrada"}
                        </span>
                      )}
                    </button>
                  </td>
                  <td className="e-coverage-status">
                    <span className="e-coverage-state">
                      <i />
                      {row.status}
                    </span>
                    <small>
                      {row.approved && `Até ${shortDate(row.approved)} · `}
                      {row.hint}
                    </small>
                  </td>
                  <td className="e-coverage-action">{createAction(row, true)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="e-coverage-cards">
        {rows.map((row) => (
          <article
            key={row.id}
            className={`e-coverage-card${row.updated ? " is-updated" : ""}`}
            style={{ "--coverage-color": row.color } as CSSProperties}
          >
            <button type="button" className="e-coverage-client" onClick={() => onInspect(row.id)}>
              {identity(row)}
              <Icon name="chevRight" size="sm" />
            </button>
            <div className="e-coverage-card-state">
              <span className="e-coverage-state">
                <i />
                {row.status}
              </span>
              <small>{row.hint}</small>
            </div>
            <DetailFacts
              items={[
                { label: "Aprovado até", value: shortDate(row.approved) },
                {
                  label: "Próximo ciclo",
                  value: `${shortDate(row.nextStart)} – ${shortDate(row.nextEnd)}`,
                },
              ]}
            />
            <div className="e-coverage-card-foot">
              <Button size="sm" variant="ghost" onClick={() => onInspect(row.id)}>
                Ver detalhes
              </Button>
              {createAction(row)}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grade de cobertura em linhas (pílulas por frente, ligação com o próximo ciclo)
// Referências: linhas do tempo em pílula com rótulo interno, linha até o marco
// seguinte, hoje destacado com etiqueta, fins de semana hachurados.
// ---------------------------------------------------------------------------

const WEEKDAY = ["D", "S", "T", "Q", "Q", "S", "S"];
const weekday = (iso: string) => new Date(`${iso}T12:00:00`).getDay();

export function CoverageGantt({
  rows,
  start,
  days,
  today,
  busyId,
  createdIds = [],
  onInspect,
  onCreate,
  chart = true,
}: {
  rows: CoverageRow[];
  start: string;
  days: number;
  /** Mostra o gráfico de horizonte alinhado às colunas da grade. */
  chart?: boolean;
  today: string;
  busyId?: string | null;
  createdIds?: string[];
  onInspect: (id: string) => void;
  onCreate: (id: string) => void;
}) {
  const s = windowScale(start, days);
  const now = s.marker(today);
  const cols = { "--days": days } as CSSProperties;
  return (
    <div className="e-gantt" role="region" aria-label="Cobertura por cliente e frente" tabIndex={0} style={cols}>
      <div className="e-gantt-inner">
      {chart && <HorizonPlot rows={rows} start={start} days={days} today={today} />}
      <div className="e-gantt-head" style={cols}>
        <span className="e-gantt-corner">Cliente · frente</span>
        <div className="e-gantt-scale">
          {s.dates.map((iso, i) => {
            const d = Number(iso.slice(8, 10));
            const wk = [0, 6].includes(weekday(iso));
            return (
              <span key={iso} className={`${wk ? "wk" : ""}${iso === today ? " today" : ""}${d === 1 || i === 0 ? " month" : ""}`}>
                {(d === 1 || i === 0) && <em>{new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</em>}
                <small>{WEEKDAY[weekday(iso)]}</small>
                <b className="tnum">{d}</b>
              </span>
            );
          })}
          {now !== null && <i className="e-gantt-now-tag" style={{ left: `${now}%` }}>Hoje</i>}
        </div>
        <span className="e-gantt-corner right">Cobertura</span>
      </div>
      <div className="e-gantt-body" style={cols}>
        <div className="e-gantt-bg" aria-hidden="true">
          {s.dates.map((iso) => <i key={iso} className={[0, 6].includes(weekday(iso)) ? "wk" : undefined} />)}
          {now !== null && <b className="e-gantt-now" style={{ left: `${now}%` }} />}
        </div>
        {rows.map((r, i) => {
          const cyc = Math.max(1, r.cycleDays ?? 7);
          const approvedFrom = r.approved ? addDaysISO(r.approved, -(cyc - 1)) : null;
          const pill = r.approved && approvedFrom ? s.interval(approvedFrom, r.approved) : null;
          const next = s.interval(r.nextStart, r.nextEnd);
          const produce = s.marker(r.produce);
          const overdue = r.approved && (r.diff ?? 0) < 0 ? s.interval(addDaysISO(r.approved, 1), today) : null;
          // Linha que liga o fim do aprovado ao início do próximo ciclo.
          const linkFrom = r.approved ? Math.max(0, Math.min(100, s.at(addDaysISO(r.approved, 1)))) : 0;
          const linkTo = next ? next.left : null;
          const created = createdIds.includes(r.id);
          const d = r.diff ?? 0;
          return (
            <div key={r.id} className={`e-gantt-row${r.updated ? " is-updated" : ""}`} style={{ "--c": r.color, "--cf": r.fill ?? r.color, "--i": i } as CSSProperties}>
              <button type="button" className="e-gantt-id" onClick={() => onInspect(r.id)} aria-label={`Ver ${r.name} · ${r.front}`}>
                <ClientLogo name={r.name} logoUrl={r.logo} size="sm" />
                <span><b>{r.name}</b><small>{r.front} · {r.recurrence}</small></span>
              </button>
              <div
                className="e-gantt-lane"
                role="img"
                aria-label={`${r.name}, ${r.front}: ${r.status}. Aprovado até ${shortDate(r.approved)}. Produzir em ${shortDate(r.produce)}. Próximo ciclo ${shortDate(r.nextStart)} a ${shortDate(r.nextEnd)}.`}
                onClick={() => onInspect(r.id)}
              >
                {linkTo !== null && linkTo > linkFrom && <span className="e-gantt-link" style={{ left: `${linkFrom}%`, width: `${linkTo - linkFrom}%` }} />}
                {overdue && <span className="e-gantt-gap" style={{ left: `${overdue.left}%`, width: `${overdue.width}%` }}><em>{-d} {d === -1 ? "dia" : "dias"} sem conteúdo</em></span>}
                {pill && (
                  <span className={`e-gantt-pill${pill.clippedLeft ? " cut-left" : ""}${pill.clippedRight ? " cut-right" : ""}`} style={{ left: `${pill.left}%`, width: `${pill.width}%` }}>
                    <ClientLogo name={r.name} logoUrl={r.logo} size="sm" />
                    <b className="tnum">até {shortDate(r.approved)}</b>
                  </span>
                )}
                {!pill && r.approved && daysBetween(r.approved, start) > 0 && (
                  <span className="e-gantt-edge">‹ aprovado até {shortDate(r.approved)}</span>
                )}
                {next && (
                  <span className={`e-gantt-next${created ? " is-created" : ""}`} style={{ left: `${next.left}%`, width: `${next.width}%` }} title={`Próximo ciclo ${shortDate(r.nextStart)}–${shortDate(r.nextEnd)}`}>
                    <Icon name={created ? "check" : "circleDash"} size="sm" />
                    <small className="tnum">{shortDate(r.nextStart)}–{shortDate(r.nextEnd)}</small>
                  </span>
                )}
                {produce !== null && (
                  <span className={`e-gantt-produce${r.produce && r.produce <= today ? " due" : ""}`} style={{ left: `${produce}%` }} title={`Começar a produzir em ${shortDate(r.produce)}`}>
                    <i />
                  </span>
                )}
              </div>
              <div className="e-gantt-state">
                <span className={`e-gantt-days tnum${d < 0 ? " neg" : ""}`}>{d < 0 ? d : `+${d}`}<small>{Math.abs(d) === 1 ? "dia" : "dias"}</small></span>
                <span className="e-gantt-status"><i />{r.status}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  iconOnly
                  icon={created ? "check" : "plus"}
                  loading={busyId === r.id}
                  disabled={!!busyId || created}
                  aria-label={created ? "Entrega do ciclo criada" : `Criar entrega do ciclo de ${r.name} · ${r.front}`}
                  title={created ? "Entrega do ciclo criada" : "Criar entrega do próximo ciclo"}
                  onClick={() => onCreate(r.id)}
                />
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Horizonte de cobertura: quantas frentes têm conteúdo aprovado em cada dia
// ---------------------------------------------------------------------------

function horizonData(rows: CoverageRow[], start: string, days: number) {
  const s = windowScale(start, days);
  return s.dates.map((iso) => ({ iso, n: rows.filter((r) => r.approved && r.approved >= iso).length }));
}

/** Resumo do horizonte: hoje, primeiro dia com falta e quando tudo fica descoberto. */
export function CoverageHorizon({ rows, start, days, today }: { rows: CoverageRow[]; start: string; days: number; today: string }) {
  const data = horizonData(rows, start, days);
  const total = rows.length;
  const future = data.filter((x) => x.iso >= today);
  const t = data.find((x) => x.iso === today);
  const firstGap = future.find((x) => x.n < total);
  const zero = future.find((x) => x.n === 0);
  return (
    <section className="e-horizon" aria-label="Horizonte de cobertura">
      <div>
        <span className="e-label">Horizonte de cobertura</span>
        <p>Quantas frentes têm conteúdo aprovado em cada dia. As colunas acompanham as datas da grade.</p>
      </div>
      <dl>
        <div><dt>Cobertas hoje</dt><dd className="tnum">{t?.n ?? 0}<small>/{total}</small></dd></div>
        <div><dt>Primeira falta</dt><dd className="tnum">{firstGap ? shortDate(firstGap.iso) : "—"}</dd></div>
        <div><dt>Nenhuma coberta</dt><dd className="tnum">{zero ? shortDate(zero.iso) : "—"}</dd></div>
      </dl>
    </section>
  );
}

function HorizonPlot({ rows, start, days, today }: { rows: CoverageRow[]; start: string; days: number; today: string }) {
  const data = horizonData(rows, start, days);
  const total = rows.length || 1;
  return (
    <div className="e-horizon-plot" aria-hidden="true">
      <span className="e-horizon-max tnum">{rows.length} frentes</span>
      <div className="e-horizon-bars">
        {data.map((x, i) => {
          const pct = (x.n / total) * 100;
          const tone = x.n === total ? "full" : x.n === 0 ? "none" : pct < 50 ? "low" : "mid";
          return (
            <span key={x.iso} className={`${tone}${x.iso < today ? " past" : ""}${x.iso === today ? " today" : ""}`} style={{ "--h": `${Math.max(pct, x.n ? 6 : 3)}%`, "--i": i } as CSSProperties} title={`${shortDate(x.iso)}: ${x.n} de ${rows.length} frentes cobertas`}>
              <i />
              {x.n > 0 && x.n < total && <em className="tnum">{x.n}</em>}
            </span>
          );
        })}
      </div>
    </div>
  );
}
