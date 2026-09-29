// ---------------------------------------------------------------------------
// Echo · Like: números do histórico, do relatório mensal e do painel.
// Funções puras sobre os itens (com versões e decisões). Tudo sai das decisões
// registradas, para o relatório bater com like_decisions.
// ---------------------------------------------------------------------------
import { PENDING, type DecisionRow, type ItemFull, type Round } from "./like-data";

/** Decisões que valem: sem as desfeitas e sem os registros de "desfazer". */
export function liveDecisions(items: ItemFull[]): (DecisionRow & { item: ItemFull })[] {
  const out: (DecisionRow & { item: ItemFull })[] = [];
  for (const it of items) {
    const undone = new Set(it.decisions.filter((d) => d.undoes).map((d) => d.undoes));
    for (const d of it.decisions) if (d.decision !== "undone" && !undone.has(d.id)) out.push({ ...d, item: it });
  }
  return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

const inRange = (iso: string | null | undefined, from: string, to: string) => !!iso && iso >= from && iso < to;
const hoursBetween = (a: string, b: string) => Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 3600e3);
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

/** Quando a versão decidida chegou ao cliente. */
export function versionSentAt(it: ItemFull, versionId: string): string | null {
  const v = it.versions.find((x) => x.id === versionId);
  if (!v) return it.sentAt;
  return v.number === 1 ? it.sentAt ?? v.createdAt : v.createdAt;
}

export type Report = {
  sent: number; approved: number; approvedFirst: number; avgVersions: number | null; avgDecisionHours: number | null;
  adjustments: number; rejected: number; byPhrase: { label: string; n: number }[];
  byFront: { label: string; sent: number; approved: number; adjustments: number }[];
  byCampaign: { label: string; sent: number; approved: number; adjustments: number }[];
  byApprover: { name: string; decisions: number; avgHours: number | null }[];
  decisions: (DecisionRow & { item: ItemFull })[];
};

/** Relatório de um período [from, to) (ISO). */
export function buildReport(items: ItemFull[], from: string, to: string, campaignName: (id: string) => string = (id) => id): Report {
  const decisions = liveDecisions(items).filter((d) => inRange(d.createdAt, from, to));
  const sentItems = items.filter((i) => inRange(i.sentAt, from, to));
  const approvals = decisions.filter((d) => d.decision === "approved");
  // Um material aprovado conta uma vez (a última aprovação do período).
  const approvedByItem = new Map<string, DecisionRow & { item: ItemFull }>();
  for (const d of approvals) approvedByItem.set(d.itemId, d);
  const approvedList = [...approvedByItem.values()];
  const vNum = (d: DecisionRow & { item: ItemFull }) => d.item.versions.find((v) => v.id === d.versionId)?.number ?? 1;
  const adjustments = decisions.filter((d) => d.decision === "changes_requested");
  const phrases = new Map<string, number>();
  for (const d of adjustments) {
    if (!d.phrases.length) phrases.set("Sem frase (só observação)", (phrases.get("Sem frase (só observação)") ?? 0) + 1);
    for (const p of d.phrases) phrases.set(p, (phrases.get(p) ?? 0) + 1);
  }
  const group = (key: (i: ItemFull) => string | null) => {
    const m = new Map<string, { label: string; sent: number; approved: number; adjustments: number }>();
    const row = (k: string) => m.get(k) ?? m.set(k, { label: k, sent: 0, approved: 0, adjustments: 0 }).get(k)!;
    for (const i of sentItems) { const k = key(i); if (k) row(k).sent++; }
    for (const d of approvedList) { const k = key(d.item); if (k) row(k).approved++; }
    for (const d of adjustments) { const k = key(d.item); if (k) row(k).adjustments++; }
    return [...m.values()].sort((a, b) => b.sent + b.approved - (a.sent + a.approved));
  };
  const clientDecisions = decisions.filter((d) => d.via === "like");
  const byApprover = new Map<string, number[]>();
  for (const d of clientDecisions) {
    const s = versionSentAt(d.item, d.versionId);
    if (!byApprover.has(d.deciderName ?? "—")) byApprover.set(d.deciderName ?? "—", []);
    if (s) byApprover.get(d.deciderName ?? "—")!.push(hoursBetween(s, d.createdAt));
  }
  return {
    sent: sentItems.length,
    approved: approvedList.length,
    approvedFirst: approvedList.filter((d) => vNum(d) === 1).length,
    avgVersions: mean(approvedList.map(vNum)),
    avgDecisionHours: mean(clientDecisions.map((d) => { const s = versionSentAt(d.item, d.versionId); return s ? hoursBetween(s, d.createdAt) : null; }).filter((x): x is number => x !== null)),
    adjustments: adjustments.length,
    rejected: decisions.filter((d) => d.decision === "rejected").length,
    byPhrase: [...phrases.entries()].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n),
    byFront: group((i) => i.frontName),
    byCampaign: group((i) => (i.campaignId ? campaignName(i.campaignId) : null)),
    byApprover: [...byApprover.entries()].map(([name, hs]) => ({ name, decisions: hs.length, avgHours: mean(hs) })).sort((a, b) => (b.avgHours ?? 0) - (a.avgHours ?? 0)),
    decisions,
  };
}

/** Frase simples para o cliente. */
export function plainSummary(r: Report, monthLabel: string): string {
  if (!r.sent && !r.approved) return `Nenhum material foi enviado em ${monthLabel}.`;
  const parts = [`Aprovamos ${r.approved} ${r.approved === 1 ? "material" : "materiais"} em ${monthLabel}`];
  if (r.approved) parts[0] += `, ${r.approvedFirst} na primeira versão`;
  if (r.adjustments) parts.push(`${r.adjustments} ${r.adjustments === 1 ? "pedido de ajuste" : "pedidos de ajuste"}`);
  if (r.avgDecisionHours !== null) parts.push(`você levou em média ${fmtHours(r.avgDecisionHours)} para decidir`);
  return `${parts.join(" · ")}.`;
}

export const fmtHours = (h: number | null) => (h === null ? "—" : h < 1 ? "menos de 1 h" : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} dias`);

/** Linhas do CSV (uma por decisão), no mesmo formato de like_decisions. */
export function decisionsCsv(r: Report): string {
  const DEC: Record<string, string> = { approved: "aprovado", changes_requested: "ajustes", rejected: "reprovado" };
  const esc = (v: unknown) => { const s = v === null || v === undefined ? "" : String(v); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const head = ["data", "cliente", "material", "formato", "frente", "versao", "decisao", "quem", "via", "frases", "observacao", "justificativa"];
  const rows = r.decisions.map((d) => [d.createdAt, d.item.brandName, d.item.title, d.item.kind, d.item.frontName ?? "", d.item.versions.find((v) => v.id === d.versionId)?.number ?? "", DEC[d.decision] ?? d.decision, d.deciderName ?? "", d.via, d.phrases.join(" | "), d.note ?? "", d.justification ?? ""]);
  return "﻿" + [head, ...rows].map((row) => row.map(esc).join(";")).join("\n");
}

export function downloadText(name: string, text: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Métricas do painel por cliente. */
export function clientStats(items: ItemFull[], rounds: Round[]) {
  const live = liveDecisions(items);
  const hs = live.filter((d) => d.via === "like").map((d) => { const s = versionSentAt(d.item, d.versionId); return s ? hoursBetween(s, d.createdAt) : null; }).filter((x): x is number => x !== null);
  const decided = items.filter((i) => i.sentAt);
  const adjustments = live.filter((d) => d.decision === "changes_requested").length;
  const closed = rounds.filter((r) => r.status === "concluida" || r.status === "vencida");
  const onTime = closed.filter((r) => {
    if (!r.dueAt) return true;
    const last = live.filter((d) => d.item.roundId === r.id).map((d) => d.createdAt).sort().pop();
    return r.status === "concluida" && (!last || last <= r.dueAt);
  }).length;
  const byApprover = new Map<string, number[]>();
  for (const d of live.filter((x) => x.via === "like")) { const s = versionSentAt(d.item, d.versionId); if (s) byApprover.set(d.deciderName ?? "—", [...(byApprover.get(d.deciderName ?? "—") ?? []), hoursBetween(s, d.createdAt)]); }
  const slowest = [...byApprover.entries()].map(([name, xs]) => ({ name, h: mean(xs) ?? 0 })).sort((a, b) => b.h - a.h)[0] ?? null;
  return {
    pending: items.filter((i) => PENDING.includes(i.status)).length,
    drafts: items.filter((i) => i.status === "rascunho").length,
    avgDecisionHours: mean(hs),
    adjustmentsPerItem: decided.length ? adjustments / decided.length : null,
    rounds: { onTime, closed: closed.length },
    slowest,
  };
}
