import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { EchoLayout } from "@/components/echo/layout";
import { Alert } from "@/components/echo/controls";
import { Avatar, Button, EmptyState, Skeleton } from "@/components/echo/primitives";
import { Icon } from "@/components/echo/icon";
import { LikeBrandNav } from "@/components/echo/like-cards";
import { PeriodNavigator } from "@/components/echo/operations";
import { useAccess } from "@/components/echo/session";
import { isViewingAsClient } from "@/lib/view-as";
import { loadBrandInfo } from "@/lib/brand-settings-data";
import { loadSpace } from "@/lib/space-data";
import { KIND_LABEL, listItems } from "@/lib/like-data";
import { buildReport, decisionsCsv, downloadText, fmtHours, plainSummary } from "@/lib/like-report";

export const Route = createFileRoute("/like/$brandSlug/historico")({
  head: () => ({ meta: [{ title: "Histórico · Like · Echo" }] }),
  component: History,
});

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const DEC: Record<string, { label: string; icon: string; tone: string }> = {
  approved: { label: "Aprovou", icon: "checkCircle", tone: "ok" },
  changes_requested: { label: "Pediu ajustes", icon: "refresh", tone: "warn" },
  rejected: { label: "Reprovou", icon: "xCircle", tone: "danger" },
};

function History() {
  const { brandSlug } = Route.useParams();
  const { isTeam } = useAccess();
  const [ready, setReady] = useState(false);
  const [viewAs, setViewAs] = useState(false);
  useEffect(() => { setReady(true); setViewAs(isViewingAsClient()); }, []);
  const team = !!isTeam && !viewAs;
  const brand = useQuery({ queryKey: ["brand-info", brandSlug], queryFn: () => loadBrandInfo(brandSlug), enabled: ready });
  const items = useQuery({ queryKey: ["like-items", brandSlug, viewAs], queryFn: () => listItems({ brandSlug }), enabled: ready });
  const space = useQuery({ queryKey: ["space", brandSlug], queryFn: () => loadSpace(brandSlug), enabled: ready });
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });

  const nav = <LikeBrandNav slug={brandSlug} team={team} />;
  if (!ready || items.isLoading) return <EchoLayout env="like" wide demoData nav={nav}><Skeleton h={520} r={24} /></EchoLayout>;

  const from = new Date(cursor.y, cursor.m, 1).toISOString();
  const to = new Date(cursor.y, cursor.m + 1, 1).toISOString();
  const monthLabel = `${MONTHS[cursor.m]} de ${cursor.y}`;
  const campaignName = (id: string) => space.data?.campaigns.find((c) => c.id === id)?.title ?? "Campanha";
  const r = buildReport(items.data ?? [], from, to, campaignName);
  const step = (n: number) => setCursor((c) => { const d = new Date(c.y, c.m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const isNow = cursor.y === new Date().getFullYear() && cursor.m === new Date().getMonth();
  const name = brand.data?.name ?? brandSlug;
  const maxPhrase = Math.max(1, ...r.byPhrase.map((p) => p.n));
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

  return (
    <EchoLayout env="like" wide demoData nav={nav} eyebrow="Like" title="Histórico e relatório"
      titleAside={team ? <div className="e-row no-print" style={{ gap: 8 }}>
        <Button variant="secondary" size="sm" icon="download" disabled={!r.decisions.length} onClick={() => downloadText(`like-${brandSlug}-${cursor.y}-${String(cursor.m + 1).padStart(2, "0")}.csv`, decisionsCsv(r))}>CSV</Button>
        <Button variant="secondary" size="sm" icon="file" onClick={() => window.print()}>PDF</Button>
      </div> : undefined}>
      <div className="stack-lg lk-report">
        <div className="no-print"><PeriodNavigator label={monthLabel} onPrevious={() => step(-1)} onNext={() => step(1)} onToday={() => setCursor({ y: new Date().getFullYear(), m: new Date().getMonth() })} current={isNow} /></div>
        <h2 className="print-only e-h2">{name} · Like · {monthLabel}</h2>

        <section className="hr-summary e-glass">
          <Icon name="sparkle" />
          <p>{plainSummary(r, monthLabel)}</p>
        </section>

        <div className="stat-row four">
          <div className="stat-tile e-glass"><span className="e-kpi tnum">{r.sent}</span><span className="stat-lbl">materiais enviados</span></div>
          <div className="stat-tile e-glass"><span className="e-kpi tnum">{r.approved}</span><span className="stat-lbl">aprovados · {pct(r.approvedFirst, r.approved)} na 1ª versão</span></div>
          <div className="stat-tile e-glass"><span className="e-kpi tnum">{r.avgVersions === null ? "—" : r.avgVersions.toFixed(1).replace(".", ",")}</span><span className="stat-lbl">versões até aprovar (média)</span></div>
          <div className="stat-tile e-glass"><span className="e-kpi tnum">{fmtHours(r.avgDecisionHours)}</span><span className="stat-lbl">tempo médio de decisão</span></div>
        </div>

        {team && (
          <div className="hr-grid">
            <section className="settings-section e-glass">
              <h3 className="e-h3" style={{ margin: 0 }}>Ajustes por motivo</h3>
              {r.byPhrase.length === 0 ? <p className="e-caption" style={{ margin: 0 }}>Nenhum pedido de ajuste neste mês.</p> : (
                <ul className="hr-bars">{r.byPhrase.map((p) => <li key={p.label}><span>{p.label}</span><i style={{ ["--w" as string]: `${(p.n / maxPhrase) * 100}%` }} /><b className="tnum">{p.n}</b></li>)}</ul>
              )}
            </section>
            <section className="settings-section e-glass">
              <h3 className="e-h3" style={{ margin: 0 }}>Por frente e campanha</h3>
              {[...r.byFront.map((x) => ({ ...x, kind: "Frente" })), ...r.byCampaign.map((x) => ({ ...x, kind: "Campanha" }))].length === 0 ? <p className="e-caption" style={{ margin: 0 }}>Sem movimento neste mês.</p> : (
                <table className="lb-table">
                  <thead><tr><th /><th>Enviados</th><th>Aprovados</th><th>Ajustes</th></tr></thead>
                  <tbody>{[...r.byFront.map((x) => ({ ...x, kind: "Frente" })), ...r.byCampaign.map((x) => ({ ...x, kind: "Campanha" }))].map((x) => <tr key={x.kind + x.label}><td><span className="e-caption">{x.kind}</span> {x.label}</td><td className="tnum">{x.sent}</td><td className="tnum">{x.approved}</td><td className="tnum">{x.adjustments}</td></tr>)}</tbody>
                </table>
              )}
              {r.byApprover.length > 0 && <p className="e-caption" style={{ margin: 0 }}><Icon name="lock" size="sm" /> Tempo por aprovador (interno): {r.byApprover.map((a) => `${a.name} ${fmtHours(a.avgHours)}`).join(" · ")}</p>}
            </section>
          </div>
        )}

        <section className="settings-section e-glass">
          <h3 className="e-h3" style={{ margin: 0 }}>Decisões de {MONTHS[cursor.m]}</h3>
          {r.decisions.length === 0 ? <EmptyState compact kind="empty" title="Nenhuma decisão neste mês" text={isNow ? "Quando alguém aprovar ou pedir ajustes, aparece aqui." : undefined} /> : (
            <ol className="hr-timeline">
              {[...r.decisions].reverse().map((d) => { const m = DEC[d.decision]; const v = d.item.versions.find((x) => x.id === d.versionId)?.number ?? 1; return (
                <li key={d.id}>
                  <span className={`hr-ic t-${m.tone}`}><Icon name={m.icon} size="sm" /></span>
                  <div>
                    <div className="hr-line"><Avatar name={d.deciderName ?? "?"} size="xs" /><b>{d.deciderName}</b> {m.label.toLowerCase()} <Link to={`/like/${brandSlug}/m/${d.itemId}${v !== (d.item.current?.number ?? 1) ? `?v=${v}` : ""}` as never} className="e-link">{d.item.title}</Link> <span className="e-caption">· {KIND_LABEL[d.item.kind]} · v{v}</span></div>
                    {d.phrases.length > 0 && <div className="hr-phrases">{d.phrases.map((p) => <span key={p}>{p}</span>)}</div>}
                    {d.note && <p className="hr-note">{d.note}</p>}
                    {d.via === "outro_canal" && <p className="hr-note"><Icon name="info" size="sm" /> Registrado pela equipe (outro canal){team && d.justification ? `: ${d.justification}` : ""}</p>}
                    <small className="e-caption">{new Date(d.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</small>
                  </div>
                </li>
              ); })}
            </ol>
          )}
        </section>
        {team && <Alert kind="info" title="De onde vêm os números">Tudo sai das decisões registradas no Like (as desfeitas não contam). O CSV tem uma linha por decisão.</Alert>}
      </div>
    </EchoLayout>
  );
}
