import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/reach/ui";
import { EmptyState, RiskBadge, StatCard } from "@/components/reach/workspace-ui";
import { Btn, SelectInput } from "@/components/ui-reach/primitives";
import { cn } from "@/lib/utils";
import {
  addDays,
  listFrontsWithRisk,
  localDate,
  RECURRENCES,
  RISK_LABELS,
  toISO,
  today,
  type RiskLevel,
} from "@/lib/workspace-data";

export const Route = createFileRoute("/workspace/controle")({
  head: () => ({
    meta: [
      { title: "Controle — Reach Echo · Workspace" },
      {
        name: "description",
        content: "Nenhum cliente sem post: cobertura mensal, antecedência de produção e risco por frente de conteúdo.",
      },
      { property: "og:title", content: "Controle — Reach Echo · Workspace" },
      { property: "og:description", content: "Linha do tempo mensal da cobertura de conteúdo de cada cliente." },
    ],
  }),
  component: CoverageControl,
});

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const approvedDate = (date: string | null) => date ? date.split("-").reverse().join("/") : "—";

/**
 * CONTROLE — o coração do "nenhum cliente sem post".
 * Uma linha por CLIENTE + FRENTE, com a linha do tempo do mês inteiro:
 * até que dia existe conteúdo aprovado, onde está hoje e a partir de quando
 * a próxima pauta precisa começar (aprovado até − antecedência).
 */
function CoverageControl() {
  const navigate = useNavigate();
  const fronts = useQuery({ queryKey: ["ws-fronts-risk"], queryFn: listFrontsWithRisk });
  const now = today();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [brandId, setBrandId] = useState("");
  const [recurrence, setRecurrence] = useState("");
  const [level, setLevel] = useState("");

  const all = fronts.data ?? [];
  const brands = useMemo(() => {
    const map = new Map(all.map((item) => [item.brand.id, item.brand]));
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [all]);

  const visible = all
    .filter((item) => !brandId || item.brand.id === brandId)
    .filter((item) => !recurrence || item.front.recurrence === recurrence)
    .filter((item) => !level || item.level === level);

  const days = new Date(year, month + 1, 0).getDate();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const todayDay = isCurrentMonth ? now.getDate() : null;

  function shift(by: number) {
    const d = new Date(year, month + by, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  /** Dia do mês exibido (1..days) ou null quando a data cai fora do mês. */
  function dayInMonth(iso: string | null | undefined) {
    if (!iso) return null;
    const d = localDate(iso);
    if (d.getFullYear() !== year || d.getMonth() !== month) {
      // antes do mês → 0 (sem cobertura no mês); depois do mês → cobre tudo
      return d < new Date(year, month, 1) ? 0 : days;
    }
    return d.getDate();
  }

  const count = (value: RiskLevel) => all.filter((item) => item.level === value).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="Controle"
        description="Até quando cada cliente está aprovado, quando a próxima pauta precisa começar e qual é o próximo ciclo."
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Coberto" value={count("green")} hint="Cobertura em dia" />
        <StatCard label="Atenção" value={count("yellow")} hint="Perto da antecedência" />
        <StatCard label="Produzir agora" value={count("orange")} hint="Dentro da antecedência" />
        <StatCard label="Sem cobertura" value={count("red")} hint="Prazo aprovado vencido" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-full border border-border/70 px-1 py-1">
          <Btn variant="ghost" size="sm" aria-label="Mês anterior" onClick={() => shift(-1)}>
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          </Btn>
          <span className="min-w-[9.5rem] text-center text-[12.5px] font-medium capitalize">
            {MONTHS[month]} de {year}
          </span>
          <Btn variant="ghost" size="sm" aria-label="Próximo mês" onClick={() => shift(1)}>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Btn>
        </div>
        <SelectInput value={brandId} onChange={(e) => setBrandId(e.target.value)} aria-label="Filtrar por cliente">
          <option value="">Todos os clientes</option>
          {brands.map((brand) => (
            <option key={brand.id} value={brand.id}>{brand.name}</option>
          ))}
        </SelectInput>
        <SelectInput value={recurrence} onChange={(e) => setRecurrence(e.target.value)} aria-label="Filtrar por frente">
          <option value="">Todas as recorrências</option>
          {Object.entries(RECURRENCES).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </SelectInput>
        <SelectInput value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Filtrar por situação">
          <option value="">Todas as situações</option>
          {Object.entries(RISK_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </SelectInput>
      </div>

      {fronts.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando cobertura dos clientes…</p>
      ) : visible.length === 0 ? (
        <EmptyState
          title="Nenhuma frente para estes filtros."
          description="Cadastre as frentes de conteúdo do cliente para acompanhar a cobertura ciclo a ciclo."
        />
      ) : (
        <section className="surface overflow-x-auto rounded-2xl p-4 sm:p-5">
          <div className="min-w-[46rem] space-y-2">
            <header className="grid grid-cols-[14rem_minmax(0,1fr)] items-end gap-3">
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Cliente · frente
              </span>
              <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(${days}, minmax(0,1fr))` }}>
                {Array.from({ length: days }, (_, i) => (
                  <span key={i} className="text-center text-[9px] text-muted-foreground">
                    {i + 1}
                  </span>
                ))}
              </div>
            </header>

            {visible.map(({ front, brand, level: risk, slack, period }) => {
              const coverEnd = dayInMonth(front.approved_until);
              const startBy = front.approved_until
                ? dayInMonth(toISO(addDays(localDate(front.approved_until), -Number(front.lead_days ?? 0))))
                : null;
              return (
                <button
                  key={front.id}
                  type="button"
                  onClick={() =>
                    navigate({
                      to: "/workspace/cliente/$brandSlug",
                      params: { brandSlug: brand.slug },
                      search: { frente: front.id } as never,
                    })
                  }
                  className="grid w-full grid-cols-[14rem_minmax(0,1fr)] items-center gap-3 rounded-xl border border-border/70 bg-card px-3 py-2 text-left transition-colors hover:border-primary/50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium">
                      {brand.name} <span className="text-muted-foreground">· {front.name}</span>
                    </p>
                    <p className="truncate text-[11.5px] text-muted-foreground">
                      aprovado até {approvedDate(front.approved_until)} · antecedência {front.lead_days ?? 0}d · próxima pauta{" "}
                      {period.start} a {period.end}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <div
                      className="relative grid h-5 gap-px overflow-hidden rounded-md bg-muted/60"
                      style={{ gridTemplateColumns: `repeat(${days}, minmax(0,1fr))` }}
                      aria-label={`Cobertura de ${brand.name} em ${MONTHS[month]}`}
                    >
                      {Array.from({ length: days }, (_, i) => {
                        const day = i + 1;
                        const covered = coverEnd !== null && day <= coverEnd;
                        return (
                          <span
                            key={day}
                            className={cn(
                              "h-full",
                              covered ? "bg-emerald-500/70" : "bg-transparent",
                              todayDay === day && "outline outline-1 outline-offset-[-1px] outline-foreground",
                              startBy === day && "border-x-2 border-amber-500",
                            )}
                          />
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <RiskBadge level={risk} />
                      {startBy !== null && startBy > 0 && startBy <= days && (
                        <span>começar até dia {startBy}</span>
                      )}
                      <span>
                        {slack >= 0 ? `${slack} dia(s) de folga` : `atrasado ${Math.abs(slack)} dia(s)`}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}

            <footer className="flex flex-wrap items-center gap-4 pt-2 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-5 rounded-sm bg-emerald-500/70" /> cobertura aprovada
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-5 rounded-sm border-x-2 border-amber-500 bg-muted/60" /> começar a próxima pauta
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-5 rounded-sm bg-muted/60 outline outline-1 outline-foreground" /> hoje
              </span>
            </footer>
          </div>
        </section>
      )}
    </div>
  );
}
