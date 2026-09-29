import { createFileRoute, Link } from "@tanstack/react-router";
import { LoadFailed } from "@/components/echo/blocks";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EchoLayout } from "@/components/echo/layout";
import { Alert, Checkbox, Field, Segmented, Select, Switch } from "@/components/echo/controls";
import { Avatar, Badge, Button, EmptyState, Skeleton } from "@/components/echo/primitives";
import { Icon } from "@/components/echo/icon";
import { LikeBrandNav } from "@/components/echo/like-cards";
import { useAccess } from "@/components/echo/session";
import { isViewingAsClient } from "@/lib/view-as";
import { isDemoMode } from "@/lib/home-data";
import { loadAccess, loadBrandInfo, loadIdentity } from "@/lib/brand-settings-data";
import { createLink, demoActor, getSettings, listApprovers, listItems, listLinks, listRounds, revokeLink, saveApprovers, saveSettings, type Approver, type Settings } from "@/lib/like-data";
import { DEFAULT_PREFS, EVENTS, getPrefs, savePrefs, whatsappMessage, type Prefs } from "@/lib/notify-data";

export const Route = createFileRoute("/like/$brandSlug/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações · Like · Echo" }] }),
  component: LikeSettings,
});

const ROLE_LABEL: Record<Approver["role"], string> = { aprovador: "Aprovador", revisor: "Revisor (só comenta)", observador: "Observador (só vê)" };
const copy = (text: string, what: string) => navigator.clipboard?.writeText(text).then(() => toast.success(`${what} copiado`), () => toast.error("Não foi possível copiar"));

function LikeSettings() {
  const { brandSlug } = Route.useParams();
  const qc = useQueryClient();
  const { isTeam, session } = useAccess();
  const [ready, setReady] = useState(false);
  const [viewAs, setViewAs] = useState(false);
  useEffect(() => { setReady(true); setViewAs(isViewingAsClient()); }, []);
  const team = ready && !!isTeam && !viewAs;
  const meId = isDemoMode() ? demoActor().id : session?.userId ?? "";
  const brand = useQuery({ queryKey: ["brand-info", brandSlug], queryFn: () => loadBrandInfo(brandSlug), enabled: ready });
  const b = brand.data;
  const approversQ = useQuery({ queryKey: ["like-approvers", b?.id], queryFn: () => listApprovers(b!.id), enabled: !!b });
  const settingsQ = useQuery({ queryKey: ["like-settings", b?.id], queryFn: () => getSettings(b!.id), enabled: !!b });
  const access = useQuery({ queryKey: ["brand-access", brandSlug], queryFn: () => loadAccess(brandSlug, b!.id, true), enabled: !!b && team });
  const identity = useQuery({ queryKey: ["identity", brandSlug], queryFn: () => loadIdentity(brandSlug, b!.id), enabled: !!b });
  const links = useQuery({ queryKey: ["like-links", b?.id], queryFn: () => listLinks(b!.id), enabled: !!b && team });
  const rounds = useQuery({ queryKey: ["like-rounds", brandSlug, viewAs], queryFn: () => listRounds(brandSlug), enabled: ready && team });
  const items = useQuery({ queryKey: ["like-items", brandSlug, viewAs], queryFn: () => listItems({ brandSlug }), enabled: ready });
  const prefsQ = useQuery({ queryKey: ["notif-prefs", meId], queryFn: () => getPrefs(meId), enabled: ready && !!meId });

  const [appr, setAppr] = useState<Approver[] | null>(null);
  const [st, setSt] = useState<Settings | null>(null);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [addId, setAddId] = useState("");
  const [nl, setNl] = useState({ scope: "", comment: true, decide: false, days: "7", email: "", label: "" });
  const [fresh, setFresh] = useState<{ url: string } | null>(null);
  useEffect(() => { if (approversQ.data && !appr) setAppr(approversQ.data); }, [approversQ.data]);
  useEffect(() => { if (settingsQ.data && !st) setSt(settingsQ.data); }, [settingsQ.data]);
  useEffect(() => { if (prefsQ.data && !prefs) setPrefs(prefsQ.data); }, [prefsQ.data]);

  const nav = <LikeBrandNav slug={brandSlug} team={team} />;
  if (approversQ.isError || settingsQ.isError || brand.isError) return <EchoLayout env="like" wide nav={nav} eyebrow="Like" title="Configurações"><LoadFailed what="as configurações do Like" onRetry={() => { brand.refetch(); approversQ.refetch(); settingsQ.refetch(); }} /></EchoLayout>;
  if (!ready || !b || !appr || !st) return <EchoLayout env="like" wide demoData nav={nav} eyebrow="Like" title="Configurações"><Skeleton h={480} r={24} /></EchoLayout>;

  const dirtyA = JSON.stringify(appr) !== JSON.stringify(approversQ.data);
  const dirtyS = JSON.stringify(st) !== JSON.stringify(settingsQ.data);
  const members = (access.data?.members ?? []).filter((m) => !appr.some((a) => a.userId === m.user_id));
  const move = (i: number, d: number) => setAppr((l) => { const n = [...l!]; const [x] = n.splice(i, 1); n.splice(i + d, 0, x); return n.map((a, k) => ({ ...a, orderIndex: k })); });
  const pending = (items.data ?? []).filter((i) => ["aguardando", "em_revisao", "nova_versao"].includes(i.status));
  const boxUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/like/${brandSlug}`;
  const firstApprover = appr.find((a) => a.role === "aprovador");
  const firstDue = pending.map((i) => i.dueAt).filter(Boolean).sort()[0];
  const wa = whatsappMessage({ brandName: b.name, firstName: firstApprover?.name.split(" ")[0], pending: pending.length, dueLabel: firstDue ? new Date(firstDue).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : null, url: boxUrl });
  const linkState = (l: { revokedAt: string | null; expiresAt: string }) => (l.revokedAt ? { label: "Revogado", tone: "blocked" as const } : l.expiresAt < new Date().toISOString() ? { label: "Expirado", tone: "late" as const } : { label: "Ativo", tone: "approved" as const });

  const saveAll = async () => {
    try {
      if (dirtyA) { if (!appr.some((a) => a.role === "aprovador")) { toast.error("Deixe pelo menos um aprovador."); return; } await saveApprovers(b.id, appr); }
      if (dirtyS) await saveSettings(b.id, st);
      for (const k of [["like-approvers", b.id], ["like-settings", b.id]]) await qc.invalidateQueries({ queryKey: k });
      toast.success("Configurações do Like salvas");
    } catch (e) { toast.error((e as Error).message); }
  };
  const genLink = async () => {
    const [kind, id] = nl.scope.split(":");
    if (!id) { toast.error("Escolha a rodada ou o material."); return; }
    try {
      const r = await createLink({ brandId: b.id, roundId: kind === "r" ? id : null, itemId: kind === "i" ? id : null, canComment: nl.comment || nl.decide, canDecide: nl.decide, days: Number(nl.days), email: nl.email || null, label: nl.label || null });
      setFresh({ url: r.url });
      qc.invalidateQueries({ queryKey: ["like-links", b.id] });
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <EchoLayout env="like" wide demoData nav={nav} eyebrow="Like" title="Configurações"
      titleAside={team && (dirtyA || dirtyS) ? <Button icon="save" onClick={saveAll}>Salvar</Button> : undefined}>
      <div className="stack-lg ls-page">
        {!team && <Alert kind="info" title="Somente leitura">Quem ajusta aprovadores e regras é a equipe da Reach. Aqui você escolhe como quer ser avisado.</Alert>}

        {/* Aprovadores e regra */}
        <section className="settings-section e-glass">
          <div className="e-row between wrap"><h2 className="e-h3" style={{ margin: 0 }}>Quem aprova</h2>
            <Segmented value={st.rule} onChange={(r) => team && setSt({ ...st, rule: r })} label="Regra de aprovação" items={[{ value: "qualquer", label: "Qualquer aprovador" }, { value: "todos", label: "Todos" }, { value: "sequencial", label: "Em sequência" }]} />
          </div>
          <p className="e-caption" style={{ margin: 0 }}>{st.rule === "qualquer" ? "Basta um aprovador para o material seguir." : st.rule === "todos" ? "O material só é aprovado quando todos os aprovadores aprovarem." : "Cada aprovador decide na ordem abaixo; o próximo só é chamado depois do anterior."}</p>
          <ul className="ls-approvers">
            {appr.map((a, i) => (
              <li key={a.userId}>
                {st.rule === "sequencial" && <span className="ls-order tnum">{i + 1}</span>}
                <Avatar name={a.name} size="sm" />
                <span className="e-grow" style={{ minWidth: 0 }}><b>{a.name}</b><small className="e-caption">{a.email ?? ""}</small></span>
                {team ? <>
                  <div style={{ width: 200 }}><Select value={a.role} onChange={(v) => setAppr((l) => l!.map((x) => (x.userId === a.userId ? { ...x, role: v as Approver["role"] } : x)))} options={(Object.keys(ROLE_LABEL) as Approver["role"][]).map((r) => ({ value: r, label: ROLE_LABEL[r] }))} /></div>
                  <Button variant="ghost" size="sm" icon="chevUp" iconOnly aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)} />
                  <Button variant="ghost" size="sm" icon="chevDown" iconOnly aria-label="Descer" disabled={i === appr.length - 1} onClick={() => move(i, 1)} />
                  <Button variant="ghost" size="sm" icon="x" iconOnly aria-label={`Remover ${a.name}`} onClick={() => setAppr((l) => l!.filter((x) => x.userId !== a.userId))} />
                </> : <Badge tone="glass">{ROLE_LABEL[a.role]}</Badge>}
              </li>
            ))}
          </ul>
          {team && (members.length > 0 ? (
            <div className="e-row wrap" style={{ gap: 8 }}>
              <div style={{ minWidth: 240 }}><Select value={addId} onChange={setAddId} placeholder="Pessoa do cliente" options={members.map((m) => ({ value: m.user_id, label: m.name ?? m.email ?? "Pessoa" }))} /></div>
              <Button variant="secondary" icon="plus" disabled={!addId} onClick={() => { const m = members.find((x) => x.user_id === addId)!; setAppr((l) => [...l!, { userId: m.user_id, name: m.name ?? m.email ?? "Pessoa", email: m.email, role: "aprovador", orderIndex: l!.length }]); setAddId(""); }}>Adicionar</Button>
            </div>
          ) : <p className="e-caption" style={{ margin: 0 }}>Todas as pessoas do cliente já estão na lista. Para convidar alguém, use <Link to={`/b/${brandSlug}/configuracoes` as never} className="e-link">Acessos da marca</Link>.</p>)}
        </section>

        {/* Prazos e regras */}
        <section className="settings-section e-glass">
          <h2 className="e-h3" style={{ margin: 0 }}>Prazos e regras</h2>
          <div className="ls-grid">
            <Field label="Prazo padrão para decidir" type="number" min={1} max={20} suffix="dias úteis" value={String(st.decisionDays)} disabled={!team} onChange={(e) => setSt({ ...st, decisionDays: Math.max(1, Number(e.target.value) || 1) })} />
            <div className="stack" style={{ gap: 8 }}>
              <span className="e-label">Lembretes automáticos</span>
              <Checkbox label="1 dia antes do prazo" checked={st.remindBefore} disabled={!team} onChange={(v) => setSt({ ...st, remindBefore: v })} />
              <Checkbox label="No dia do prazo" checked={st.remindOnDay} disabled={!team} onChange={(v) => setSt({ ...st, remindOnDay: v })} />
              <Checkbox label="Depois do vencimento" checked={st.remindLate} disabled={!team} onChange={(v) => setSt({ ...st, remindLate: v })} />
            </div>
          </div>
          <div className="ls-switches">
            <Switch label="Exigir comentário ao pedir ajuste" checked={st.requireCommentOnAdjust} disabled={!team} onChange={(v) => setSt({ ...st, requireCommentOnAdjust: v })} />
            <Switch label="Permitir baixar os arquivos" checked={st.allowDownload} disabled={!team} onChange={(v) => setSt({ ...st, allowDownload: v })} />
            <Switch label="Marca d'água nas prévias" checked={st.watermark} disabled={!team} onChange={(v) => setSt({ ...st, watermark: v })} />
            <Switch label="Permitir links externos (sem conta)" checked={st.allowShareLinks} disabled={!team} onChange={(v) => setSt({ ...st, allowShareLinks: v })} />
          </div>
          <p className="e-caption" style={{ margin: 0 }}><Icon name="clock" size="sm" /> Nunca sai mais de um lembrete por dia para a mesma pessoa, e nada chega no horário silencioso dela.</p>
        </section>

        {/* Links externos */}
        {team && (
          <section className="settings-section e-glass">
            <div className="e-row between wrap"><h2 className="e-h3" style={{ margin: 0 }}>Links de aprovação externos</h2>{!st.allowShareLinks && <Badge tone="glass" icon="lock">Desligado</Badge>}</div>
            <p className="e-caption" style={{ margin: 0 }}>Para quem decide mas não tem conta (ex.: um diretor do cliente). A pessoa informa nome e e-mail antes de agir, e tudo fica no histórico.</p>
            {!st.allowShareLinks ? <Alert kind="info" title="Ligue “Permitir links externos” e salve para gerar links." /> : dirtyS ? <Alert kind="warn" title="Salve as configurações antes de gerar um link." /> : (
              <div className="ls-link-form">
                <Select label="Para" value={nl.scope} onChange={(v) => setNl({ ...nl, scope: v })} placeholder="Rodada ou material" options={[
                  ...(rounds.data ?? []).filter((r) => r.status === "aberta" || r.status === "vencida").map((r) => ({ value: `r:${r.id}`, label: `Rodada · ${r.title}` })),
                  ...pending.map((i) => ({ value: `i:${i.id}`, label: `Material · ${i.title}` })),
                ]} />
                <Select label="Validade" value={nl.days} onChange={(v) => setNl({ ...nl, days: v })} options={["1", "3", "7", "15", "30"].map((d) => ({ value: d, label: `${d} ${d === "1" ? "dia" : "dias"}` }))} />
                <Field label="Restringir a um e-mail" optional type="email" value={nl.email} onChange={(e) => setNl({ ...nl, email: e.target.value })} placeholder="diretor@cliente.com.br" help="Pede um código enviado para esse e-mail." />
                <Field label="Nome do link" optional value={nl.label} onChange={(e) => setNl({ ...nl, label: e.target.value })} placeholder="Ex.: Diretoria" />
                <div className="stack" style={{ gap: 8 }}>
                  <span className="e-label">Pode</span>
                  <Checkbox label="Ver" checked disabled onChange={() => undefined} />
                  <Checkbox label="Comentar" checked={nl.comment || nl.decide} disabled={nl.decide} onChange={(v) => setNl({ ...nl, comment: v })} />
                  <Checkbox label="Decidir (aprovar ou pedir ajustes)" checked={nl.decide} onChange={(v) => setNl({ ...nl, decide: v })} />
                </div>
                <div className="ls-link-go"><Button icon="link" onClick={genLink}>Gerar link</Button></div>
              </div>
            )}
            {fresh && (
              <div className="ls-fresh">
                <Icon name="checkCircle" />
                <div className="e-grow" style={{ minWidth: 0 }}><b>Link criado</b><code>{fresh.url}</code><small className="e-caption">Copie agora: por segurança, ele não aparece de novo.</small></div>
                <Button size="sm" icon="copy" onClick={() => copy(fresh.url, "Link")}>Copiar</Button>
                <a className="e-btn ghost sm" href={fresh.url} target="_blank" rel="noreferrer"><Icon name="external" size="sm" /> Abrir</a>
              </div>
            )}
            {(links.data ?? []).length > 0 && (
              <div className="lb-table-wrap">
                <table className="lb-table">
                  <thead><tr><th>Link</th><th>Pode</th><th>Validade</th><th>Último uso</th><th>Estado</th><th /></tr></thead>
                  <tbody>{links.data!.map((l) => { const s = linkState(l); const target = l.itemId ? (items.data ?? []).find((i) => i.id === l.itemId)?.title : (rounds.data ?? []).find((r) => r.id === l.roundId)?.title; return (
                    <tr key={l.id}>
                      <td><b>{l.label ?? target ?? "Link"}</b><br /><small className="e-caption">{l.itemId ? "Material" : "Rodada"}{target && l.label ? ` · ${target}` : ""}{l.email ? ` · só ${l.email}` : ""}</small></td>
                      <td>{l.canDecide ? "Decidir" : l.canComment ? "Comentar" : "Ver"}</td>
                      <td className="tnum">{new Date(l.expiresAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</td>
                      <td className="tnum">{l.lastUsedAt ? `${new Date(l.lastUsedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} · ${l.uses}×` : "—"}</td>
                      <td><Badge tone={s.tone} dot>{s.label}</Badge></td>
                      <td>{!l.revokedAt && <Button size="sm" variant="ghost" icon="ban" onClick={async () => { await revokeLink(l.id); qc.invalidateQueries({ queryKey: ["like-links", b.id] }); toast.success("Link revogado"); }}>Revogar</Button>}</td>
                    </tr>
                  ); })}</tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* WhatsApp e prévias */}
        {team && (
          <div className="hr-grid">
            <section className="settings-section e-glass">
              <div className="e-row between"><h2 className="e-h3" style={{ margin: 0 }}>Mensagem para WhatsApp</h2><Button size="sm" variant="secondary" icon="copy" onClick={() => copy(wa, "Texto")}>Copiar</Button></div>
              <pre className="ls-wa">{wa}</pre>
              <p className="e-caption" style={{ margin: 0 }}>Texto pronto para a equipe mandar do próprio WhatsApp.</p>
            </section>
            <section className="settings-section e-glass">
              <h2 className="e-h3" style={{ margin: 0 }}>Como o cliente recebe</h2>
              <div className="ls-mail" aria-label="Prévia do e-mail">
                <div className="ls-mail-bar" />
                <div className="ls-mail-body">
                  <span className="ls-mail-logo">echo <small>por Reach</small></span>
                  <b>Oi{firstApprover ? `, ${firstApprover.name.split(" ")[0]}` : ""}! Tem {pending.length || 3} {pending.length === 1 ? "material" : "materiais"} de {b.name} para você aprovar.</b>
                  <p>{firstDue ? `O prazo é ${new Date(firstDue).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}.` : "Leva poucos minutos."} Você pode comentar no ponto exato do material.</p>
                  <span className="ls-mail-btn">Revisar agora</span>
                </div>
              </div>
              <div className="ls-toast"><Icon name="bell" size="sm" /><span><b>Novos materiais para aprovar</b><small>{b.name}: a Reach enviou materiais para você revisar.</small></span></div>
              <p className="e-caption" style={{ margin: 0 }}>{identity.data?.channels.length ? `Molduras das prévias: ${identity.data.channels.filter((c) => c.active).map((c) => c.name).join(", ")}. ` : ""}<Link to={`/b/${brandSlug}/configuracoes` as never} className="e-link">Canais e formatos</Link></p>
            </section>
          </div>
        )}

        {/* Preferências da pessoa */}
        {prefs && (
          <section className="settings-section e-glass">
            <div className="e-row between wrap"><h2 className="e-h3" style={{ margin: 0 }}>Suas notificações</h2>
              <Button size="sm" variant="secondary" icon="save" onClick={async () => { await savePrefs(meId, prefs); qc.invalidateQueries({ queryKey: ["notif-prefs", meId] }); toast.success("Preferências salvas"); }}>Salvar preferências</Button></div>
            <div className="ls-switches">
              <Switch label="No Echo (sino)" checked={prefs.inApp} onChange={(v) => setPrefs({ ...prefs, inApp: v })} />
              <Switch label="Por e-mail" checked={prefs.email} onChange={(v) => setPrefs({ ...prefs, email: v })} />
              <Switch label="Resumo diário em vez de um e-mail por evento" checked={prefs.dailyDigest} disabled={!prefs.email} onChange={(v) => setPrefs({ ...prefs, dailyDigest: v })} />
            </div>
            <div className="ls-events">
              {EVENTS.filter((e) => e.who === (team ? "equipe" : "cliente") || e.kind === "like.mencao").map((e) => (
                <Checkbox key={e.kind} label={e.label} checked={prefs.events[e.kind] !== false} onChange={(v) => setPrefs({ ...prefs, events: { ...prefs.events, [e.kind]: v } })} />
              ))}
            </div>
            <div className="e-row wrap" style={{ gap: 10 }}>
              <Switch label="Horário silencioso" checked={!!prefs.quietStart} onChange={(v) => setPrefs({ ...prefs, quietStart: v ? DEFAULT_PREFS.quietStart : null, quietEnd: v ? DEFAULT_PREFS.quietEnd : null })} />
              {prefs.quietStart && <>
                <div style={{ width: 130 }}><Field label="Das" type="time" value={prefs.quietStart} onChange={(e) => setPrefs({ ...prefs, quietStart: e.target.value })} /></div>
                <div style={{ width: 130 }}><Field label="Até" type="time" value={prefs.quietEnd ?? ""} onChange={(e) => setPrefs({ ...prefs, quietEnd: e.target.value })} /></div>
              </>}
            </div>
          </section>
        )}
        {!prefs && <EmptyState compact kind="empty" title="Carregando suas preferências" />}
      </div>
    </EchoLayout>
  );
}
