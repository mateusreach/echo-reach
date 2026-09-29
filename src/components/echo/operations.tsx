// Echo · Operational patterns. Shared tokens/markup with css/operations.css in the catalog.
import type { CSSProperties, ReactNode } from "react";
import { Button, ClientLogo } from "./primitives";
import { Chip } from "./controls";
import { Icon } from "./icon";
import { monthScale } from "@/lib/coverage-scale";

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
