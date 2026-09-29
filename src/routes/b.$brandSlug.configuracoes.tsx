import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BrandShell } from "@/components/reach/brand-shell";
import { Avatar, Badge, Button, EmptyState, Skeleton } from "@/components/echo/primitives";
import { Alert, Checkbox, Field, LineTabs, Segmented, Select, Switch, TextArea } from "@/components/echo/controls";
import { Drawer, Modal } from "@/components/echo/overlays";
import { Icon, type IconName } from "@/components/echo/icon";
import { IdentityEditor, SpaceCustomizer } from "@/components/echo/identity";
import { PATHS, useAppearance, type Base, type PathKey } from "@/components/echo/appearance";
import { useAccess } from "@/components/echo/session";
import { supabase } from "@/integrations/supabase/client";
import { isViewingAsClient } from "@/lib/view-as";
import { isDemoMode, relDay } from "@/lib/home-data";
import { cancelInvite, inviteClientUser, linkExisting, loadAccess, loadBrandInfo, removeMember, saveBrandPatch, setMemberAccess, type BrandInfo, type Member } from "@/lib/brand-settings-data";
import { loadIntegrations } from "@/lib/settings-data";

type Tab = "informacoes" | "identidade" | "acessos" | "historico" | "integracoes" | "preferencias";
const TABS: { value: Tab; label: string; icon: IconName }[] = [
  { value: "informacoes", label: "Informações", icon: "briefcase" },
  { value: "identidade", label: "Identidade", icon: "palette" },
  { value: "acessos", label: "Usuários e acessos", icon: "users" },
  { value: "historico", label: "Histórico", icon: "history" },
  { value: "integracoes", label: "Integrações", icon: "link" },
  { value: "preferencias", label: "Preferências", icon: "sliders" },
];

export const Route = createFileRoute("/b/$brandSlug/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações do cliente · Echo" }] }),
  component: BrandSettings,
  validateSearch: (search: Record<string, unknown>) => ({ tab: typeof search.tab === "string" ? search.tab : undefined }),
});

/** O que o cliente pode fazer: ver cada área e, no Like, comentar e aprovar. */
const CLIENT_RIGHTS: { key: string; label: string; desc: string; needs?: string }[] = [
  { key: "espaco360.visualizar", label: "Espaço 360", desc: "Plano, campanhas, agenda e solicitações." },
  { key: "like.visualizar", label: "Like · ver materiais", desc: "Abre a caixa de aprovação." },
  { key: "like.comentar", label: "Like · comentar", desc: "Comenta e marca pontos no material.", needs: "like.visualizar" },
  { key: "like.aprovar", label: "Like · decidir", desc: "Aprova ou pede ajustes.", needs: "like.visualizar" },
  { key: "biblioteca.visualizar", label: "Biblioteca", desc: "Consulta ideias e referências." },
  { key: "biblioteca.criar", label: "Sugerir ideias", desc: "Envia sugestões para a equipe classificar.", needs: "biblioteca.visualizar" },
  { key: "plano.visualizar", label: "Plano", desc: "Acompanha o plano estratégico." },
  { key: "calendario.visualizar", label: "Calendário", desc: "Vê datas e publicações." },
];
const DEFAULT_RIGHTS = ["espaco360.visualizar", "like.visualizar", "like.comentar"];
const ROLE_LABEL: Record<string, string> = { client: "Cliente", viewer: "Visualizador", agency: "Agência" };

function BrandSettings() {
  const { brandSlug } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isTeam } = useAccess();
  const [ready, setReady] = useState(false);
  const [viewAs, setViewAs] = useState(false);
  useEffect(() => { setReady(true); setViewAs(isViewingAsClient()); }, []);
  const tab: Tab = TABS.some((t) => t.value === search.tab) ? (search.tab as Tab) : "informacoes";
  const setTab = (t: Tab) => navigate({ to: "/b/$brandSlug/configuracoes", params: { brandSlug }, search: { tab: t }, replace: true });
  const info = useQuery({ queryKey: ["brand-info", brandSlug], queryFn: () => loadBrandInfo(brandSlug), enabled: ready });
  const canEdit = !!isTeam && !viewAs;
  const refreshInfo = () => qc.invalidateQueries({ queryKey: ["brand-info", brandSlug] });
  const b = info.data;

  return (
    <BrandShell basePath={`/b/${brandSlug}`} brandName={b?.name} brandLogoUrl={b?.logo_url} primaryColor={b?.primary_color} accentColor={b?.accent_color}>
      {!ready || info.isLoading ? <Skeleton h={420} r={24} /> : !b ? (
        <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState kind="search" title="Cliente não encontrado" actions={<Link to="/clientes" className="e-btn secondary">Ver clientes</Link>} /></div>
      ) : (
        <div className="stack-lg">
          <LineTabs<Tab> value={tab} onChange={setTab} items={TABS} />
          {tab === "informacoes" && <InfoTab info={b} canEdit={canEdit} onSaved={refreshInfo} />}
          {tab === "identidade" && <><SpaceCustomizer info={b} canEdit={canEdit} onSaved={refreshInfo} /><IdentityEditor info={b} canEdit={canEdit} onBrandChanged={refreshInfo} /></>}
          {tab === "acessos" && <AccessTab info={b} canEdit={canEdit} />}
          {tab === "historico" && <HistoryTab info={b} />}
          {tab === "integracoes" && <IntegrationsTab info={b} />}
          {tab === "preferencias" && <PreferencesTab />}
        </div>
      )}
    </BrandShell>
  );
}

function Section({ title, desc, aside, children }: { title: string; desc?: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="settings-section e-glass">
      <header className="e-row between wrap" style={{ gap: 12, alignItems: "flex-start" }}>
        <div><h2 className="e-h3" style={{ margin: 0 }}>{title}</h2>{desc && <p className="e-small" style={{ margin: "4px 0 0" }}>{desc}</p>}</div>
        {aside}
      </header>
      {children}
    </section>
  );
}

// ----- Informações -------------------------------------------------------------------

function InfoTab({ info, canEdit, onSaved }: { info: BrandInfo; canEdit: boolean; onSaved: () => void }) {
  const pick = (i: BrandInfo) => ({ name: i.name, segment: i.segment, contact_name: i.contact_name, contact_email: i.contact_email, description: i.description, notes: i.notes });
  const [d, setD] = useState(pick(info));
  const [saving, setSaving] = useState(false);
  useEffect(() => setD(pick(info)), [info]);
  const dirty = JSON.stringify(d) !== JSON.stringify(pick(info));
  const emailOk = !d.contact_email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.contact_email);
  return (
    <Section title="Informações do cliente" desc="Dados cadastrais usados em todos os ambientes. Módulos e contrato ficam no hub do cliente."
      aside={<Link to={`/clientes/${info.slug}` as never} className="e-btn ghost sm"><Icon name="briefcase" size="sm" /> Hub do cliente</Link>}>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Nome" value={d.name} disabled={!canEdit} onChange={(e) => setD({ ...d, name: e.target.value })} />
        <Field label="Segmento" optional value={d.segment} disabled={!canEdit} onChange={(e) => setD({ ...d, segment: e.target.value })} />
        <Field label="Contato principal" optional icon="user" value={d.contact_name} disabled={!canEdit} onChange={(e) => setD({ ...d, contact_name: e.target.value })} />
        <Field label="E-mail do contato" type="email" optional value={d.contact_email} error={emailOk ? undefined : "Confira o e-mail."} disabled={!canEdit} onChange={(e) => setD({ ...d, contact_email: e.target.value })} />
      </div>
      <TextArea label="Descrição" optional rows={3} value={d.description} disabled={!canEdit} onChange={(e) => setD({ ...d, description: e.target.value })} />
      {canEdit && <TextArea label="Observações internas" optional rows={3} help="Só a equipe vê." value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} />}
      {canEdit && <div className="e-row" style={{ gap: 8, justifyContent: "flex-end" }}>
        <Button variant="ghost" disabled={!dirty} onClick={() => setD(pick(info))}>Desfazer</Button>
        <Button icon="check" loading={saving} disabled={!dirty || !d.name.trim() || !emailOk} onClick={async () => { setSaving(true); try { await saveBrandPatch(info.slug, info.id, d); toast.success("Informações salvas"); onSaved(); } catch { toast.error("Não foi possível salvar."); } finally { setSaving(false); } }}>Salvar</Button>
      </div>}
    </Section>
  );
}

// ----- Acessos ---------------------------------------------------------------------

function RightsEditor({ value, onChange, disabled }: { value: string[]; onChange: (v: string[]) => void; disabled?: boolean }) {
  const toggle = (k: string, on: boolean, needs?: string) => {
    let next = on ? [...new Set([...value, k, ...(needs ? [needs] : [])])] : value.filter((x) => x !== k);
    if (!on) for (const r of CLIENT_RIGHTS) if (r.needs === k) next = next.filter((x) => x !== r.key);
    onChange(next);
  };
  return <div className="rights-grid">{CLIENT_RIGHTS.map((r) => <Checkbox key={r.key} checked={value.includes(r.key)} disabled={disabled} desc={r.desc} onChange={(v) => toggle(r.key, v, r.needs)} label={r.label} />)}</div>;
}

function AccessTab({ info, canEdit }: { info: BrandInfo; canEdit: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["brand-access", info.slug], queryFn: () => loadAccess(info.slug, info.id, canEdit) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["brand-access", info.slug] });
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [removing, setRemoving] = useState<Member | null>(null);
  const [linkId, setLinkId] = useState("");
  if (q.isLoading) return <Skeleton h={300} r={24} />;
  if (!q.data) return <EmptyState kind="error" title="Não foi possível carregar os acessos" />;
  const { members, invites, linkable } = q.data;
  return (
    <div className="stack-lg">
      <Section title={`Pessoas com acesso a ${info.name}`} desc="Cada pessoa vê só o que foi liberado. Administradores do cliente também mudam capa e cores do espaço."
        aside={canEdit ? <Button icon="send" onClick={() => setInviting(true)}>Convidar pessoa</Button> : undefined}>
        <div className="e-stack" style={{ gap: 6 }}>
          {members.map((m) => (
            <div key={m.user_id} className="member-row">
              <Avatar name={m.name ?? m.email ?? "?"} size="sm" />
              <span className="e-grow" style={{ minWidth: 0 }}>
                <span className="e-row" style={{ gap: 6 }}><b className="e-ellipsis">{m.name ?? m.email}</b>{m.is_admin && <Badge tone="glass">Admin</Badge>}<Badge tone="glass">{ROLE_LABEL[m.member_role] ?? m.member_role}</Badge></span>
                <span className="e-caption e-ellipsis" style={{ display: "block" }}>{m.email ?? "—"} · {m.permissions.filter((p) => CLIENT_RIGHTS.some((r) => r.key === p)).length} permissões</span>
              </span>
              <span className="e-caption hide-sm">{m.last_access ? `acessou ${relDay(m.last_access.slice(0, 10)).toLowerCase()}` : "nunca acessou"}</span>
              {canEdit && <>
                <Button size="sm" variant="ghost" onClick={() => setEditing(m)}>Permissões</Button>
                <Button size="sm" variant="ghost" icon="x" aria-label={`Remover ${m.name ?? m.email}`} onClick={() => setRemoving(m)} />
              </>}
            </div>
          ))}
          {invites.map((i) => (
            <div key={i.id} className="member-row pending">
              <Avatar name={i.name || i.email} size="sm" />
              <span className="e-grow" style={{ minWidth: 0 }}><b className="e-ellipsis" style={{ display: "block" }}>{i.name || i.email}</b><span className="e-caption">{i.email} · convite enviado {relDay(i.created_at.slice(0, 10)).toLowerCase()}</span></span>
              <Badge tone="review" dot>Convite pendente</Badge>
              {canEdit && <Button size="sm" variant="ghost" icon="x" aria-label="Cancelar convite" onClick={async () => { await cancelInvite(info.slug, i.id); toast.success("Convite cancelado"); refresh(); }} />}
            </div>
          ))}
          {members.length === 0 && invites.length === 0 && <EmptyState compact icon="users" title="Ninguém do cliente ainda" text="Convide a pessoa responsável para aprovar materiais no Like e acompanhar o 360." />}
        </div>
        {canEdit && linkable.length > 0 && (
          <div className="e-row" style={{ gap: 8, marginTop: 4 }}>
            <div className="e-grow"><Select value={linkId} placeholder="Vincular pessoa que já tem conta…" onChange={setLinkId} options={linkable.map((l) => ({ value: l.id, label: l.name }))} icon="user" /></div>
            <Button variant="secondary" disabled={!linkId} onClick={async () => { await linkExisting(info.slug, info.id, linkId); setLinkId(""); toast.success("Pessoa vinculada"); refresh(); }}>Vincular</Button>
          </div>
        )}
      </Section>
      <InviteDrawer open={inviting} info={info} onClose={() => setInviting(false)} onDone={refresh} />
      <MemberDrawer member={editing} info={info} onClose={() => setEditing(null)} onDone={refresh} />
      <Modal open={!!removing} onClose={() => setRemoving(null)} icon="x" tone="danger" title="Remover o acesso?" sub={removing?.name ?? removing?.email ?? ""}
        footer={<><Button variant="secondary" onClick={() => setRemoving(null)}>Cancelar</Button><Button variant="danger" onClick={async () => { if (!removing) return; await removeMember(info.slug, info.id, removing.user_id); toast.success("Acesso removido"); setRemoving(null); refresh(); }}>Remover acesso</Button></>}>
        <p className="e-small" style={{ margin: 0 }}>A pessoa deixa de ver {info.name}. Comentários e decisões que ela já registrou continuam no histórico.</p>
      </Modal>
    </div>
  );
}

function InviteDrawer({ open, info, onClose, onDone }: { open: boolean; info: BrandInfo; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: "", email: "", role: "client" as "client" | "viewer", isAdmin: false, rights: DEFAULT_RIGHTS });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setF({ name: "", email: "", role: "client", isAdmin: false, rights: DEFAULT_RIGHTS }); setErr(null); } }, [open]);
  return (
    <Drawer open={open} onClose={onClose} eyebrow={info.name} title="Convidar pessoa do cliente"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="send" loading={busy} onClick={async () => {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) { setErr("Informe um e-mail válido."); return; }
        setBusy(true);
        try { const r = await inviteClientUser(info.slug, info.id, { name: f.name, email: f.email, role: f.role, permissions: f.role === "viewer" ? f.rights.filter((x) => x.endsWith(".visualizar")) : f.rights, isAdmin: f.isAdmin }); if (r.linked) toast.success("Acesso liberado", { description: "A pessoa já tinha conta no Echo." }); else if (r.sent) toast.success("Convite enviado", { description: f.email }); else toast.warning("Convite registrado, mas o e-mail não saiu", { description: r.warning }); onDone(); onClose(); }
        catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível convidar."); } finally { setBusy(false); }
      }}>Enviar convite</Button></>}>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Nome" optional autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Field label="E-mail" type="email" value={f.email} error={err ?? undefined} onChange={(e) => { setF({ ...f, email: e.target.value }); setErr(null); }} />
      </div>
      <div className="e-field"><span className="e-field-label">Perfil</span><Segmented value={f.role} onChange={(v) => setF({ ...f, role: v })} label="Perfil" items={[{ value: "client", label: "Cliente" }, { value: "viewer", label: "Só visualiza" }]} /></div>
      {f.role === "viewer" && <Alert kind="info" title="Só visualiza">Comentar, decidir e sugerir ficam desligados para este perfil.</Alert>}
      <Switch checked={f.isAdmin} onChange={(v) => setF({ ...f, isAdmin: v })} label={<span><b>Administrador do cliente</b><br /><span className="e-caption">Muda capa, logo e cores do espaço e vê todos os módulos contratados.</span></span>} />
      <div className="e-stack" style={{ gap: 8 }}><span className="e-label">O que a pessoa pode fazer</span><RightsEditor value={f.rights} onChange={(rights) => setF({ ...f, rights })} /></div>
    </Drawer>
  );
}

function MemberDrawer({ member, info, onClose, onDone }: { member: Member | null; info: BrandInfo; onClose: () => void; onDone: () => void }) {
  const [rights, setRights] = useState<string[]>([]);
  const [admin, setAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (member) { setRights(member.permissions); setAdmin(member.is_admin); } }, [member?.user_id]);
  return (
    <Drawer open={!!member} onClose={onClose} eyebrow="Acesso" title={member?.name ?? member?.email ?? ""}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="check" loading={busy} onClick={async () => { if (!member) return; setBusy(true); try { await setMemberAccess(info.slug, info.id, member.user_id, { permissions: rights, is_admin: admin }); toast.success("Acesso atualizado"); onDone(); onClose(); } catch { toast.error("Não foi possível salvar."); } finally { setBusy(false); } }}>Salvar</Button></>}>
      <Switch checked={admin} onChange={setAdmin} label={<span><b>Administrador do cliente</b><br /><span className="e-caption">Muda capa, logo e cores do espaço.</span></span>} />
      <RightsEditor value={rights} onChange={setRights} />
      <p className="e-caption" style={{ margin: 0 }}>Uma permissão removida some da interface da pessoa e o banco passa a negar a ação.</p>
    </Drawer>
  );
}

// ----- Histórico ---------------------------------------------------------------------

function HistoryTab({ info }: { info: BrandInfo }) {
  const q = useQuery({ queryKey: ["brand-access", info.slug], queryFn: () => loadAccess(info.slug, info.id, true) });
  const [filter, setFilter] = useState("");
  if (q.isLoading) return <Skeleton h={300} r={24} />;
  const logs = (q.data?.logs ?? []).filter((l) => !filter || l.event === filter);
  const events = [...new Set((q.data?.logs ?? []).map((l) => l.event))];
  return (
    <Section title="Histórico de acessos" desc="Entradas e ações registradas no ambiente deste cliente." aside={events.length > 1 ? <div style={{ width: 200 }}><Select value={filter} onChange={setFilter} options={[{ value: "", label: "Todos os eventos" }, ...events.map((e) => ({ value: e, label: e[0].toUpperCase() + e.slice(1) }))]} /></div> : undefined}>
      {logs.length === 0 ? <EmptyState compact icon="history" title="Nenhum acesso registrado" /> : (
        <ol className="hub-activity">
          {logs.map((l) => (
            <li key={l.id}>
              <span className="node" style={{ ["--c" as string]: l.event === "acesso" ? "var(--env-360)" : "var(--env-like)" }}><Icon name={l.event === "acesso" ? "user" : "heart"} size="sm" /></span>
              <div><b>{l.user_email ?? "Pessoa"}</b> <span>{l.event}{l.context ? ` · ${l.context}` : ""}</span><div className="e-caption tnum">{new Date(l.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</div></div>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

// ----- Integrações e preferências -------------------------------------------------

function IntegrationsTab({ info }: { info: BrandInfo }) {
  const q = useQuery({ queryKey: ["integrations"], queryFn: loadIntegrations });
  const conn = q.data?.connections.find((c) => c.slug === info.slug);
  const soon = ["Meta (Instagram e Facebook)", "Google Drive", "Calendário", "WhatsApp", "E-mail", "Webhooks"];
  return (
    <div className="stack-lg">
      <Section title="Workspace externo" desc="Criações e solicitações deste cliente também são entregues ao Workspace anterior." aside={<Link to="/agencia/configuracoes" search={{ tab: "integracoes" } as never} className="e-btn ghost sm">Configurar</Link>}>
        {q.isLoading ? <Skeleton h={48} r={14} /> : <div className="conn-row"><span className={`conn-dot${conn?.connected ? " on" : ""}`} /><span className="e-grow"><b>{conn?.connected ? "Conectado" : "Não conectado"}</b><span className="e-caption" style={{ display: "block" }}>{conn?.url ?? "Sem webhook configurado"}</span></span>{conn?.clientId && <Badge tone="glass">{conn.clientId}</Badge>}</div>}
      </Section>
      <Section title="Próximas integrações" desc="Serão configuradas por cliente quando chegarem.">
        <div className="e-row wrap" style={{ gap: 6 }}>{soon.map((s) => <span key={s} className="member-tag">{s}</span>)}</div>
      </Section>
    </div>
  );
}

function PreferencesTab() {
  const [a, set] = useAppearance();
  const [email, setEmail] = useState("");
  const navigate = useNavigate();
  useEffect(() => { if (!isDemoMode()) supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? "")).catch(() => undefined); else setEmail("helena@reach.com.br"); }, []);
  return (
    <div className="grid-2" style={{ gap: 16, alignItems: "start" }}>
      <Section title="Sua aparência" desc="Vale para você em todo o Echo, em qualquer dispositivo.">
        <Segmented<Base> label="Base" value={a.base} onChange={(v) => set({ base: v })} items={[{ value: "light", label: "Clara", icon: "sun" }, { value: "dark", label: "Escura", icon: "moon" }, { value: "system", label: "Automática" }]} />
        <div className="path-pick" role="radiogroup" aria-label="Caminho de cor">
          {(Object.keys(PATHS) as PathKey[]).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={a.path === k} className="path-opt" onClick={() => set({ path: k })}>
              <i style={{ background: `linear-gradient(135deg, ${PATHS[k].p1}, ${PATHS[k].p2} 60%, ${PATHS[k].mix})` }} /><b>{PATHS[k].name}</b>
            </button>
          ))}
        </div>
      </Section>
      <Section title="Sua conta">
        <div className="conn-row"><Icon name="user" /><span className="e-grow">{email || "—"}</span></div>
        <div className="e-row" style={{ gap: 8 }}>
          <Link to="/meu-acesso" className="e-btn secondary sm">Meu acesso</Link>
          <Button size="sm" variant="ghost" icon="logout" onClick={async () => { if (!isDemoMode()) await supabase.auth.signOut(); navigate({ to: "/auth" }); }}>Sair</Button>
        </div>
      </Section>
    </div>
  );
}

