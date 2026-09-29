import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Badge, Button, EmptyState, Skeleton } from "@/components/echo/primitives";
import { Alert, Field, LineTabs, Segmented, Switch, TextArea } from "@/components/echo/controls";
import { Drawer } from "@/components/echo/overlays";
import { Icon, type IconName } from "@/components/echo/icon";
import { EchoLogo } from "@/components/echo/logo";
import { ImagePick } from "@/components/echo/image-pick";
import { useAccess } from "@/components/echo/session";
import { PATHS, type Base, type PathKey } from "@/components/echo/appearance";
import { isSlowmo, setSlowmo } from "@/components/echo/slowmo";
import { INVITE_TEMPLATE_VARIABLES, renderInviteTemplate } from "@/lib/branding";
import { isDemoMode } from "@/lib/home-data";
import { DEFAULT_LIKE, loadAgencySettings, loadIntegrations, saveAgencySettings, saveConnection, type AgencySettings, type Connection, type LikeDefaults } from "@/lib/settings-data";

export const Route = createFileRoute("/agencia/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações · Echo" }, { name: "description", content: "Identidade, convites, padrões do Like e integrações da agência." }] }),
  component: SettingsPage,
});

type Tab = "identidade" | "convites" | "like" | "integracoes" | "revisao";
const TABS: { value: Tab; label: string; icon: IconName }[] = [
  { value: "identidade", label: "Identidade", icon: "palette" },
  { value: "convites", label: "Convites", icon: "send" },
  { value: "like", label: "Padrões do Like", icon: "heart" },
  { value: "integracoes", label: "Integrações", icon: "link" },
  { value: "revisao", label: "Revisão", icon: "play" },
];

function SettingsPage() {
  const navigate = useNavigate();
  const search = useRouterState({ select: (s) => s.location.search as Record<string, string | undefined> });
  const { session, can } = useAccess();
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("identidade");
  useEffect(() => setReady(true), []);
  useEffect(() => {
    // Abas antigas do piloto agora têm páginas próprias.
    const t = search.tab;
    if (t === "marcas") navigate({ to: "/clientes" });
    else if (t === "equipe" || t === "permissoes") navigate({ to: "/agencia/equipe" });
    else if (t === "agencia") setTab("identidade");
    else if (TABS.some((x) => x.value === t)) setTab(t as Tab);
  }, [search.tab]);
  const q = useQuery({ queryKey: ["agency-settings"], queryFn: loadAgencySettings, enabled: ready });
  const isAdmin = !!session?.isAdmin;
  const canEdit = isAdmin || can("configuracoes.administrar");
  const pick = (t: Tab) => { setTab(t); navigate({ to: "/agencia/configuracoes", search: { tab: t } as never, replace: true }); };

  return (
    <div className="stack-lg">
      <LineTabs<Tab> value={tab} onChange={pick} items={TABS.filter((t) => t.value !== "revisao" || isAdmin)} />
      {!canEdit && <Alert kind="info" title="Somente leitura">Para alterar as configurações, peça a permissão “Configurações · Administrar”.</Alert>}
      {!ready || q.isLoading ? <Skeleton h={420} r={24} /> : q.isError || !q.data ? (
        <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState kind="error" title="Não foi possível carregar as configurações" actions={<Button variant="secondary" icon="refresh" onClick={() => q.refetch()}>Tentar novamente</Button>} /></div>
      ) : (
        <>
          {tab === "identidade" && <IdentityTab s={q.data} canEdit={canEdit} />}
          {tab === "convites" && <InvitesTab s={q.data} canEdit={canEdit} />}
          {tab === "like" && <LikeTab s={q.data} canEdit={canEdit} />}
          {tab === "integracoes" && <IntegrationsTab canEdit={canEdit} />}
          {tab === "revisao" && isAdmin && <ReviewTab />}
        </>
      )}
    </div>
  );
}

/** Salvar com rascunho local, aviso de alteração pendente e botão de desfazer. */
function useDraft<T>(initial: T) {
  const [d, setD] = useState<T>(initial);
  const [base, setBase] = useState(JSON.stringify(initial));
  const dirty = JSON.stringify(d) !== base;
  return { d, set: (p: Partial<T>) => setD((x) => ({ ...x, ...p })), dirty, reset: () => setD(JSON.parse(base)), commit: () => setBase(JSON.stringify(d)) };
}

function SaveBar({ dirty, saving, onSave, onReset, canEdit }: { dirty: boolean; saving: boolean; onSave: () => void; onReset: () => void; canEdit: boolean }) {
  if (!canEdit) return null;
  return (
    <div className={`settings-save${dirty ? " on" : ""}`} aria-hidden={!dirty}>
      <span className="tpl-dirty"><i />Alterações não salvas</span>
      <span style={{ flex: 1 }} />
      <Button variant="ghost" onClick={onReset} disabled={!dirty}>Desfazer</Button>
      <Button icon="check" loading={saving} disabled={!dirty} onClick={onSave}>Salvar</Button>
    </div>
  );
}

function Section({ title, desc, children, aside }: { title: string; desc?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="settings-section e-glass">
      <header className="e-row between" style={{ gap: 12, alignItems: "flex-start" }}>
        <div><h2 className="e-h3" style={{ margin: 0 }}>{title}</h2>{desc && <p className="e-small" style={{ margin: "4px 0 0" }}>{desc}</p>}</div>
        {aside}
      </header>
      {children}
    </section>
  );
}

function useSave<T>(draft: ReturnType<typeof useDraft<T>>, toPatch: (d: T) => Partial<AgencySettings>, label: string) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try { await saveAgencySettings(toPatch(draft.d)); draft.commit(); qc.invalidateQueries({ queryKey: ["agency-settings"] }); toast.success(label); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível salvar."); }
    finally { setSaving(false); }
  };
  return { saving, save };
}

// ----- Identidade --------------------------------------------------------------------

function IdentityTab({ s, canEdit }: { s: AgencySettings; canEdit: boolean }) {
  const pickKeys = ({ agency_name, agency_description, agency_email, agency_phone, agency_site, agency_address, logo_url, favicon_url, default_base, default_path }: AgencySettings) => ({ agency_name, agency_description, agency_email, agency_phone, agency_site, agency_address, logo_url, favicon_url, default_base, default_path });
  const draft = useDraft(pickKeys(s));
  const { saving, save } = useSave(draft, (d) => d, "Identidade salva");
  const d = draft.d;
  const ro = !canEdit;
  return (
    <div className="stack-lg">
      <Section title="Dados institucionais" desc="Aparecem em convites, relatórios e no rodapé dos e-mails.">
        <div className="grid-2" style={{ gap: 12 }}>
          <Field label="Nome da agência" value={d.agency_name} disabled={ro} onChange={(e) => draft.set({ agency_name: e.target.value })} />
          <Field label="E-mail institucional" type="email" value={d.agency_email} disabled={ro} optional onChange={(e) => draft.set({ agency_email: e.target.value })} />
          <Field label="Telefone" value={d.agency_phone} disabled={ro} optional onChange={(e) => draft.set({ agency_phone: e.target.value })} />
          <Field label="Site" value={d.agency_site} disabled={ro} optional icon="link" onChange={(e) => draft.set({ agency_site: e.target.value })} />
        </div>
        <Field label="Endereço" value={d.agency_address} disabled={ro} optional onChange={(e) => draft.set({ agency_address: e.target.value })} />
        <TextArea label="Descrição" value={d.agency_description} disabled={ro} optional max={280} rows={3} onChange={(e) => draft.set({ agency_description: e.target.value })} />
      </Section>

      <Section title="Marca da plataforma" desc="O Echo mantém o próprio logo na barra superior. O logo da agência aparece em convites, relatórios e na tela de acesso.">
        <div className="grid-2" style={{ gap: 16 }}>
          <ImagePick label="Logo da agência" value={d.logo_url} disabled={ro} onChange={(v) => draft.set({ logo_url: v })} hint="PNG ou SVG com fundo transparente, até 2 MB." />
          <ImagePick label="Favicon" value={d.favicon_url} disabled={ro} round onChange={(v) => draft.set({ favicon_url: v })} hint="Quadrado, 64 × 64 px ou maior." />
        </div>
      </Section>

      <Section title="Tema padrão para novas pessoas" desc="Vale para quem entra pela primeira vez. Cada pessoa pode mudar o próprio tema depois.">
        <Segmented<Base> label="Base" value={d.default_base} onChange={(v) => !ro && draft.set({ default_base: v })} items={[{ value: "light", label: "Clara", icon: "sun" }, { value: "dark", label: "Escura", icon: "moon" }, { value: "system", label: "Automática" }]} />
        <div className="path-pick" role="radiogroup" aria-label="Caminho de cor">
          {(Object.keys(PATHS) as PathKey[]).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={d.default_path === k} disabled={ro} className="path-opt" onClick={() => draft.set({ default_path: k })}>
              <i style={{ background: `linear-gradient(135deg, ${PATHS[k].p1}, ${PATHS[k].p2} 60%, ${PATHS[k].mix})` }} />
              <b>{PATHS[k].name}</b>
            </button>
          ))}
        </div>
        <div className="brand-preview" data-path={d.default_path} style={{ ["--p1" as string]: PATHS[d.default_path].p1, ["--p2" as string]: PATHS[d.default_path].p2, ["--mx" as string]: PATHS[d.default_path].mix }}>
          <EchoLogo size={26} />
          <span className="e-grow e-small">Prévia do primeiro acesso</span>
          <span className="brand-preview-btn">Entrar</span>
        </div>
      </Section>
      <SaveBar dirty={draft.dirty} saving={saving} onSave={save} onReset={draft.reset} canEdit={canEdit} />
    </div>
  );
}

// ----- Convites ------------------------------------------------------------------------

function InvitesTab({ s, canEdit }: { s: AgencySettings; canEdit: boolean }) {
  const [kind, setKind] = useState<"colaborador" | "cliente">("colaborador");
  const draft = useDraft({ invite_colaborador_subject: s.invite_colaborador_subject, invite_colaborador_body: s.invite_colaborador_body, invite_cliente_subject: s.invite_cliente_subject, invite_cliente_body: s.invite_cliente_body });
  const { saving, save } = useSave(draft, (d) => d, "Modelos de convite salvos");
  const subjectKey = `invite_${kind}_subject` as const;
  const bodyKey = `invite_${kind}_body` as const;
  const vars = { nome: "Guilherme", agencia: s.agency_name || "Sua agência", email: "guilherme@exemplo.com", link_convite: "https://echo.reach.com.br/auth", cliente: "Fina Fragrância", cargo: kind === "colaborador" ? "Designer" : "Diretora de marketing", ano: String(new Date().getFullYear()) };
  const vs = INVITE_TEMPLATE_VARIABLES.filter((v) => kind === "cliente" || v.key !== "cliente");
  const insert = (k: string) => {
    const el = document.querySelector<HTMLTextAreaElement>(".invite-body textarea");
    const text = draft.d[bodyKey];
    const at = el?.selectionStart ?? text.length;
    draft.set({ [bodyKey]: `${text.slice(0, at)}{{${k}}}${text.slice(el?.selectionEnd ?? at)}` } as never);
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(at + k.length + 4, at + k.length + 4); });
  };
  // Markdown mínimo da prévia: [texto](link) vira botão.
  const preview = renderInviteTemplate(draft.d[bodyKey], vars).split(/(\[[^\]]+\]\([^)]+\))/g);
  return (
    <div className="stack-lg">
      <Segmented value={kind} onChange={setKind} label="Tipo de convite" items={[{ value: "colaborador", label: "Colaborador" }, { value: "cliente", label: "Cliente" }]} />
      <div className="invite-grid">
        <Section title="Mensagem" desc="Use as variáveis para personalizar. Elas são trocadas pelo valor real no envio.">
          <Field label="Assunto" value={draft.d[subjectKey]} disabled={!canEdit} onChange={(e) => draft.set({ [subjectKey]: e.target.value } as never)} />
          <div className="invite-body"><TextArea label="Corpo" rows={11} value={draft.d[bodyKey]} disabled={!canEdit} onChange={(e) => draft.set({ [bodyKey]: e.target.value } as never)} /></div>
          <div className="e-row wrap" style={{ gap: 6 }}>
            {vs.map((v) => <button key={v.key} type="button" className="var-chip" title={v.label} disabled={!canEdit} onClick={() => insert(v.key)}>{`{{${v.key}}}`}</button>)}
          </div>
        </Section>
        <section className="invite-preview e-glass" aria-label="Prévia do e-mail">
          <div className="e-label">Prévia</div>
          <div className="mail">
            <div className="mail-head">{s.logo_url ? <img src={s.logo_url} alt={s.agency_name} /> : <EchoLogo size={24} />}</div>
            <div className="mail-subject">{renderInviteTemplate(draft.d[subjectKey], vars)}</div>
            <div className="mail-body">
              {preview.map((part, i) => {
                const m = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
                return m ? <span key={i} className="mail-btn">{m[1]}</span> : <span key={i}>{part}</span>;
              })}
            </div>
            <div className="mail-foot">{s.agency_name}{s.agency_site ? ` · ${s.agency_site}` : ""}</div>
          </div>
        </section>
      </div>
      <SaveBar dirty={draft.dirty} saving={saving} onSave={save} onReset={draft.reset} canEdit={canEdit} />
    </div>
  );
}

// ----- Padrões do Like --------------------------------------------------------------

function LikeTab({ s, canEdit }: { s: AgencySettings; canEdit: boolean }) {
  const draft = useDraft<LikeDefaults>(s.like_defaults);
  const { saving, save } = useSave(draft, (d) => ({ like_defaults: d }), "Padrões do Like salvos");
  const d = draft.d;
  const ro = !canEdit;
  const row = (k: keyof LikeDefaults, title: string, desc: string) => (
    <div className="module-row" key={k}><span className="e-grow"><b>{title}</b><small>{desc}</small></span><Switch checked={!!d[k]} disabled={ro} onChange={(v) => draft.set({ [k]: v } as Partial<LikeDefaults>)} label={<span className="e-sr">{title}</span>} /></div>
  );
  return (
    <div className="stack-lg">
      <Alert kind="accent" title="Valores iniciais">Cada nova rodada de aprovação começa com estes padrões. Dá para mudar por cliente e em cada envio.</Alert>
      <Section title="Prazo de decisão" desc="Quanto tempo o cliente tem para aprovar ou pedir ajustes, contado em dias úteis.">
        <div className="stepper" role="group" aria-label="Prazo em dias úteis">
          <Button variant="secondary" icon="minus" aria-label="Menos um dia" disabled={ro || d.decisionDays <= 1} onClick={() => draft.set({ decisionDays: d.decisionDays - 1 })} />
          <span className="stepper-val tnum"><b>{d.decisionDays}</b> {d.decisionDays === 1 ? "dia útil" : "dias úteis"}</span>
          <Button variant="secondary" icon="plus" aria-label="Mais um dia" disabled={ro || d.decisionDays >= 15} onClick={() => draft.set({ decisionDays: d.decisionDays + 1 })} />
        </div>
      </Section>
      <Section title="Lembretes automáticos" desc="Enviados ao cliente por e-mail e dentro do Echo.">
        {row("remindBefore", "1 dia antes do prazo", "Um aviso gentil de que há material aguardando.")}
        {row("remindOnDay", "No dia do prazo", "Lembrete pela manhã, com os itens pendentes.")}
        {row("remindLate", "Após o atraso", "Aviso diário até a decisão; a equipe também é notificada.")}
      </Section>
      <Section title="Regras da revisão">
        {row("requireCommentOnAdjust", "Exigir comentário ao pedir ajuste", "O cliente explica o que mudar; evita idas e voltas.")}
        {row("allowDownload", "Permitir download pelo cliente", "Libera baixar os arquivos em alta antes da aprovação.")}
        {row("watermark", "Marca d’água nas prévias", "Mostra “Prévia · não aprovado” sobre imagens e vídeos.")}
      </Section>
      {canEdit && JSON.stringify(d) !== JSON.stringify(DEFAULT_LIKE) && <div><Button variant="ghost" icon="refresh" onClick={() => draft.set(DEFAULT_LIKE)}>Voltar aos padrões do Echo</Button></div>}
      <SaveBar dirty={draft.dirty} saving={saving} onSave={save} onReset={draft.reset} canEdit={canEdit} />
    </div>
  );
}

// ----- Integrações ------------------------------------------------------------------

const DISPATCH_TONE: Record<string, "done" | "late" | "todo"> = { enviado: "done", erro: "late" };

function IntegrationsTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["integrations"], queryFn: loadIntegrations });
  const [edit, setEdit] = useState<Connection | null>(null);
  const [f, setF] = useState({ connected: false, url: "", clientId: "" });
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (edit) { setF({ connected: edit.connected, url: edit.url ?? "", clientId: edit.clientId ?? "" }); setErr(null); } }, [edit]);
  if (q.isLoading) return <Skeleton h={300} r={24} />;
  if (!q.data) return <EmptyState kind="error" title="Não foi possível carregar as integrações" />;
  const { connections, dispatches } = q.data;
  return (
    <div className="stack-lg">
      <Section title="Workspace externo" desc="Clientes cujas criações e solicitações também são entregues ao Workspace anterior por webhook." aside={<Badge tone="glass">{connections.filter((c) => c.connected).length} de {connections.length} conectados</Badge>}>
        <div className="conn-grid">
          {connections.map((c) => (
            <div key={c.brandId} className="conn-row">
              <span className={`conn-dot${c.connected ? " on" : ""}`} aria-hidden="true" />
              <span className="e-grow" style={{ minWidth: 0 }}><b className="e-ellipsis" style={{ display: "block" }}>{c.name}</b><span className="e-caption e-ellipsis" style={{ display: "block" }}>{c.url ?? "Sem webhook"}</span></span>
              <Button size="sm" variant="ghost" disabled={!canEdit} onClick={() => setEdit(c)}>Configurar</Button>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Envios recentes" desc="Tudo que saiu do Echo para o Workspace externo.">
        {dispatches.length === 0 ? <EmptyState compact icon="send" title="Nenhum envio ainda" /> : (
          <div className="now-list">
            {dispatches.map((d) => (
              <div key={d.id} className="team-item">
                <span className="e-grow" style={{ minWidth: 0 }}><b className="e-ellipsis" style={{ display: "block", fontWeight: 500 }}>{d.title}</b><span className="e-caption">{d.brandName} · {d.origin === "solicitacao" ? "Solicitação" : "Criação"}{d.response ? ` · ${d.response}` : ""}</span></span>
                <Badge tone={DISPATCH_TONE[d.status] ?? "todo"} dot>{d.status === "enviado" ? "Enviado" : d.status === "erro" ? "Erro" : "Registrado"}</Badge>
                <span className="team-due tnum">{new Date(d.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
              </div>
            ))}
          </div>
        )}
      </Section>
      <Drawer open={!!edit} onClose={() => setEdit(null)} eyebrow="Integração" title={edit?.name ?? ""}
        footer={<><Button variant="ghost" onClick={() => setEdit(null)}>Cancelar</Button><Button icon="check" onClick={async () => {
          if (!edit) return;
          if (f.connected && !/^https:\/\/\S+$/.test(f.url.trim())) { setErr("Use um endereço https:// válido."); return; }
          try { await saveConnection(edit.brandId, f); toast.success("Integração salva", { description: edit.name }); setEdit(null); qc.invalidateQueries({ queryKey: ["integrations"] }); } catch { toast.error("Não foi possível salvar."); }
        }}>Salvar</Button></>}>
        <div className="module-row"><span className="e-grow"><b>Conectado</b><small>Novos envios deste cliente vão também para o Workspace externo.</small></span><Switch checked={f.connected} onChange={(v) => setF({ ...f, connected: v })} label={<span className="e-sr">Conectado</span>} /></div>
        <Field label="Webhook" icon="link" value={f.url} error={err ?? undefined} placeholder="https://workspace…/api/intake" onChange={(e) => { setF({ ...f, url: e.target.value }); setErr(null); }} />
        <Field label="ID do cliente no Workspace" value={f.clientId} optional onChange={(e) => setF({ ...f, clientId: e.target.value })} />
      </Drawer>
    </div>
  );
}

// ----- Revisão ----------------------------------------------------------------------

function ReviewTab() {
  const [on, setOn] = useState(false);
  const demo = useRef<HTMLDivElement>(null);
  useEffect(() => setOn(isSlowmo()), []);
  const play = () => demo.current?.querySelectorAll("i").forEach((el, i) => el.animate([{ transform: "translateY(10px) scale(.9)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 420, delay: i * 60, easing: "cubic-bezier(.23,1,.32,1)", fill: "backwards" }));
  return (
    <Section title="Câmera lenta 4×" desc="Desacelera todas as animações para inspecionar movimento, ritmo e suavidade. Vale só para você e só nesta sessão do navegador.">
      <div className="module-row"><span className="e-grow"><b>Ativar câmera lenta</b><small>Transições, menus, drawers e contadores passam a rodar a 25% da velocidade.</small></span><Switch checked={on} onChange={(v) => { setSlowmo(v); setOn(v); toast(v ? "Câmera lenta ligada" : "Câmera lenta desligada"); }} label={<span className="e-sr">Câmera lenta</span>} /></div>
      <div className="slowmo-demo" ref={demo}>{[0, 1, 2, 3, 4].map((i) => <i key={i} />)}</div>
      <div><Button variant="secondary" icon="play" onClick={play}>Tocar animação de teste</Button></div>
      <p className="e-caption" style={{ margin: 0 }}>Dica: com a câmera lenta ligada, abra um drawer ou um menu em outra tela. <Link to="/" className="e-link">Ir para o Início</Link></p>
    </Section>
  );
}
