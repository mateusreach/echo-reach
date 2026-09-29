import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar, Badge, Button, EmptyState, Skeleton } from "@/components/echo/primitives";
import { Alert, Chip, Field, LineTabs, Segmented, Switch } from "@/components/echo/controls";
import { Drawer, Modal } from "@/components/echo/overlays";
import { Icon } from "@/components/echo/icon";
import { Panel, WORK_TONE } from "@/components/echo/blocks";
import { stagger } from "@/components/echo/motion";
import { useAccess } from "@/components/echo/session";
import { PATHS, type PathKey } from "@/components/echo/appearance";
import { MemberCard, PermissionMatrix, personGradient } from "@/components/echo/people";
import { ROLE_LABELS, type AppRole } from "@/lib/agency-data";
import { relDay } from "@/lib/home-data";
import { cancelInvite, invitePerson, loadPermissions, loadTeam, resendInvite, savePerson, setPersonActive, type TeamItem, type TeamPerson } from "@/lib/team-data";

export const Route = createFileRoute("/agencia/equipe")({
  head: () => ({ meta: [{ title: "Equipe · Echo" }, { name: "description", content: "Pessoas da Reach, carga de trabalho, papéis e permissões." }] }),
  component: TeamPage,
});

const KIND_LABEL: Record<TeamItem["kind"], string> = { tarefa: "Tarefa", solicitacao: "Solicitação", campanha: "Campanha", entrega: "Entrega" };
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

function TeamPage() {
  const qc = useQueryClient();
  const { session, can } = useAccess();
  const [ready, setReady] = useState(false);
  const [q, setQ] = useState("");
  const [sector, setSector] = useState<string | null>(null);
  const [leaders, setLeaders] = useState(false);
  const [inactive, setInactive] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [cancelling, setCancelling] = useState<{ id: string; email: string } | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  useEffect(() => setReady(true), []);
  const team = useQuery({ queryKey: ["team"], queryFn: loadTeam, enabled: ready });

  const isAdmin = !!session?.isAdmin;
  const canEdit = isAdmin || can("equipe.editar") || can("equipe.gerenciar") || can("equipe.administrar");
  const canInvite = isAdmin || can("equipe.criar") || can("equipe.gerenciar") || can("equipe.administrar");

  const data = team.data;
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const shown = useMemo(() => (data?.people ?? []).filter((p) =>
    (inactive || p.active) && (!leaders || p.leader) && (!sector || p.sectors.includes(sector)) && (!q || norm(`${p.name} ${p.jobTitle ?? ""} ${p.email ?? ""}`).includes(norm(q)))), [data, inactive, leaders, sector, q]);
  const max = Math.max(6, ...(data?.people ?? []).map((p) => p.open));
  const person = data?.people.find((p) => p.id === open) ?? null;
  const active = (data?.people ?? []).filter((p) => p.active);
  useEffect(() => { if (grid.current && data) stagger(grid.current.querySelectorAll(".member-card"), { y: 10, dur: 420 }, 35); }, [!!data, sector, leaders, inactive]);

  const refresh = () => { qc.removeQueries({ queryKey: ["team-perms"] }); qc.invalidateQueries({ queryKey: ["team"] }); qc.invalidateQueries({ queryKey: ["people-pickable"] }); };

  if (!ready || team.isLoading)
    return <div className="stack-lg" aria-busy="true"><Skeleton h={54} r={18} /><div className="member-grid">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} h={190} r={22} />)}</div></div>;
  if (team.isError || !data)
    return <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState kind="error" title="Não foi possível carregar a equipe" text="Tente de novo em instantes." actions={<Button variant="secondary" icon="refresh" onClick={() => team.refetch()}>Tentar novamente</Button>} /></div>;

  return (
    <div className="stack-lg">
      <div className="team-strip">
        <div className="team-stat"><b className="tnum">{active.length}</b><span>pessoas ativas</span></div>
        <div className="team-stat"><b className="tnum">{active.filter((p) => p.leader).length}</b><span>na liderança</span></div>
        <div className="team-stat"><b className="tnum">{active.reduce((a, p) => a + p.open, 0)}</b><span>itens em aberto</span></div>
        <div className="team-stat"><b className="tnum" style={{ color: active.some((p) => p.late) ? "var(--danger)" : undefined }}>{active.reduce((a, p) => a + p.late, 0)}</b><span>atrasados</span></div>
        <span style={{ flex: 1 }} />
        {canInvite && <Button icon="plus" onClick={() => setInviting(true)}>Convidar pessoa</Button>}
      </div>

      <div className="e-glass team-filters">
        <Field icon="search" placeholder="Buscar por nome, função ou e-mail" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar pessoa" />
        <div className="e-row wrap" style={{ gap: 6 }}>
          <Chip pressed={!sector} onClick={() => setSector(null)}>Todos os setores</Chip>
          {data.sectors.map((s) => <Chip key={s} pressed={sector === s} onClick={() => setSector(sector === s ? null : s)}>{s}</Chip>)}
          <span className="team-sep" aria-hidden="true" />
          <Chip icon="star" pressed={leaders} onClick={() => setLeaders(!leaders)}>Liderança</Chip>
          <Switch checked={inactive} onChange={setInactive} label="Mostrar inativos" />
        </div>
      </div>

      {data.invites.length > 0 && (
        <Panel title="Convites pendentes" icon="send" count={data.invites.length} tone="var(--warn)">
          <div className="now-list">
            {data.invites.map((i) => (
              <div key={i.id} className="invite-row">
                <Avatar name={i.name || i.email} size="sm" />
                <span className="e-grow" style={{ minWidth: 0 }}>
                  <b className="e-ellipsis" style={{ display: "block" }}>{i.name || i.email}</b>
                  <span className="e-caption e-ellipsis" style={{ display: "block" }}>{i.email} · {i.job_title ? `${i.job_title} · ` : ""}{ROLE_LABELS[i.role]} · enviado {relDay(i.created_at.slice(0, 10)).toLowerCase()}</span>
                </span>
                {canInvite && (
                  <span className="e-row" style={{ gap: 6 }}>
                    <Button size="sm" variant="secondary" icon="send" onClick={async () => {
                      try { const r = await resendInvite(i.id); if (r.sent) toast.success("Convite reenviado", { description: i.email }); else toast.error("O e-mail não pôde ser enviado", { description: r.warning }); }
                      catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível reenviar."); }
                    }}>Reenviar</Button>
                    <Button size="sm" variant="ghost" icon="x" aria-label={`Cancelar convite de ${i.email}`} onClick={() => setCancelling({ id: i.id, email: i.email })} />
                  </span>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}

      {shown.length === 0 ? (
        <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}>
          <EmptyState kind="search" title="Ninguém com esses filtros" text="Ajuste a busca ou os filtros para ver mais pessoas." actions={<Button variant="secondary" onClick={() => { setQ(""); setSector(null); setLeaders(false); }}>Limpar filtros</Button>} />
        </div>
      ) : (
        <div className="member-grid" ref={grid}>
          {shown.map((p) => <MemberCard key={p.id} person={p} max={max} onOpen={() => setOpen(p.id)} />)}
        </div>
      )}

      <Panel title="Sem responsável" icon="user" count={data.unassigned.length} tone="var(--env-workspace)" action={<Link to="/workspace/demandas" className="e-link" style={{ fontSize: 13 }}>Demandas <Icon name="arrowRight" size="sm" /></Link>}>
        {data.unassigned.length === 0 ? <EmptyState compact icon="checkCircle" title="Tudo tem responsável" text="Nenhuma demanda aberta sem dono." /> : (
          <div className="now-list">{data.unassigned.slice(0, 10).map((i) => <ItemRow key={i.id} item={i} />)}</div>
        )}
      </Panel>

      <PersonDrawer person={person} adminCount={data.adminCount} isAdmin={isAdmin} canEdit={canEdit} onClose={() => setOpen(null)} onSaved={refresh} />
      <InviteDrawer open={inviting} isAdmin={isAdmin} onClose={() => setInviting(false)} onDone={refresh} />
      <Modal open={!!cancelling} onClose={() => setCancelling(null)} icon="x" tone="soft" title="Cancelar este convite?" sub={cancelling?.email}
        footer={<><Button variant="secondary" onClick={() => setCancelling(null)}>Manter</Button><Button variant="danger" onClick={async () => {
          if (!cancelling) return;
          try { await cancelInvite(cancelling.id); toast.success("Convite cancelado"); setCancelling(null); refresh(); } catch { toast.error("Não foi possível cancelar."); }
        }}>Cancelar convite</Button></>}>
        <p className="e-small" style={{ margin: 0 }}>O link enviado deixa de funcionar. Você pode convidar a mesma pessoa de novo quando quiser.</p>
      </Modal>
    </div>
  );
}

function ItemRow({ item: i }: { item: TeamItem }) {
  return (
    <div className="team-item">
      <span className="e-grow" style={{ minWidth: 0 }}>
        <b className="e-ellipsis" style={{ display: "block", fontWeight: 500 }}>{i.title}</b>
        <span className="e-caption">{KIND_LABEL[i.kind]} · {i.brandName}{i.sector ? ` · ${i.sector}` : ""}</span>
      </span>
      <Badge tone={WORK_TONE[i.status] ?? "todo"}>{i.status}</Badge>
      {i.dueDate && <span className={`team-due tnum${i.late ? " late" : ""}`}>{ddmm(i.dueDate)}</span>}
    </div>
  );
}

// ----- Colaborador ----------------------------------------------------------------

type Tab = "perfil" | "trabalho" | "permissoes" | "historico";

function PersonDrawer({ person, adminCount, isAdmin, canEdit, onClose, onSaved }: { person: TeamPerson | null; adminCount: number; isAdmin: boolean; canEdit: boolean; onClose: () => void; onSaved: () => void }) {
  const [tab, setTab] = useState<Tab>("perfil");
  const [d, setD] = useState<{ name: string; jobTitle: string; palette: PathKey; leader: boolean; active: boolean; role: AppRole } | null>(null);
  const [perms, setPerms] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [last, setLast] = useState<TeamPerson | null>(null);
  if (person && person !== last) setLast(person);
  const p = person ?? last;
  const permsQ = useQuery({ queryKey: ["team-perms", p?.id], queryFn: () => loadPermissions(p!.id), enabled: !!p });

  useEffect(() => {
    if (!person) return;
    setTab("perfil");
    setD({ name: person.name, jobTitle: person.jobTitle ?? "", palette: person.palette, leader: person.leader, active: person.active, role: person.role });
    setPerms(null);
  }, [person?.id]);
  useEffect(() => { if (permsQ.data && perms === null) setPerms(permsQ.data); }, [permsQ.data, perms]);

  if (!p || !d) return <Drawer open={false} onClose={onClose} title="" />;
  const lastAdmin = p.role === "agency_admin" && p.active && adminCount <= 1;
  const byClient = new Map<string, TeamItem[]>();
  for (const i of p.items) byClient.set(i.brandName, [...(byClient.get(i.brandName) ?? []), i]);

  const save = async () => {
    if (!d.name.trim()) { setTab("perfil"); toast.error("Informe o nome."); return; }
    if (p.active && !d.active && !confirmOff) { setConfirmOff(true); return; }
    setSaving(true);
    try {
      await savePerson({ id: p.id, memberId: p.memberId, name: d.name.trim(), jobTitle: d.jobTitle, palette: d.palette, leader: d.leader, active: d.active, role: d.role, permissions: perms ?? permsQ.data ?? [] }, p, adminCount);
      toast.success("Alterações salvas", { description: d.name });
      setConfirmOff(false);
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Drawer open={!!person} onClose={onClose} eyebrow={p.jobTitle ?? "Equipe"} title={p.name}
        footer={canEdit ? <><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="check" loading={saving} onClick={save}>Salvar</Button></> : undefined}>
        <div className="person-hero">
          <Avatar name={d.name || p.name} size="xl" gradient={personGradient(d.palette)} status={!d.active ? "off" : p.late ? "busy" : "on"} />
          <div style={{ minWidth: 0 }}>
            <div className="e-row wrap" style={{ gap: 6 }}>
              <Badge tone="glass">{ROLE_LABELS[d.role]}</Badge>
              {d.leader && <Badge tone="glass" icon="star">Liderança</Badge>}
              {!d.active && <Badge tone="blocked">Inativa</Badge>}
            </div>
            <span className="e-caption e-ellipsis" style={{ display: "block", marginTop: 6 }}>{p.email ?? "Sem e-mail"}{p.lastSeen ? ` · ativo ${relDay(p.lastSeen).toLowerCase()}` : ""}</span>
          </div>
        </div>
        <LineTabs<Tab> value={tab} onChange={setTab} items={[
          { value: "perfil", label: "Perfil" },
          { value: "trabalho", label: `Trabalho · ${p.open}` },
          { value: "permissoes", label: "Permissões" },
          { value: "historico", label: "Histórico" },
        ]} />

        {tab === "perfil" && (
          <div className="e-stack" style={{ gap: 14 }}>
            <Field label="Nome" value={d.name} disabled={!canEdit} onChange={(e) => setD({ ...d, name: e.target.value })} />
            <Field label="Função" value={d.jobTitle} disabled={!canEdit} optional placeholder="Ex.: Diretora de Arte" onChange={(e) => setD({ ...d, jobTitle: e.target.value })} />
            <div className="e-field">
              <span className="e-field-label">Papel</span>
              <Segmented<AppRole> label="Papel" value={d.role} onChange={(v) => isAdmin && !lastAdmin && setD({ ...d, role: v })} items={[{ value: "agency_member", label: "Colaborador" }, { value: "agency_admin", label: "Administrador" }]} />
              {!isAdmin && <span className="e-help">Só administradores mudam o papel.</span>}
              {isAdmin && lastAdmin && <span className="e-help">Esta é a única pessoa administradora ativa. Promova outra pessoa antes de mudar este papel.</span>}
            </div>
            <div className="e-field">
              <span className="e-field-label">Paleta pessoal</span>
              <div className="palette-pick" role="radiogroup" aria-label="Paleta pessoal">
                {(Object.keys(PATHS) as PathKey[]).map((k) => (
                  <button key={k} type="button" role="radio" aria-checked={d.palette === k} disabled={!canEdit} className="palette-opt" onClick={() => setD({ ...d, palette: k })}>
                    <i style={{ background: personGradient(k) }} />{PATHS[k].name}
                  </button>
                ))}
              </div>
              <span className="e-help">Cor do avatar e da pessoa nas agendas e quadros.</span>
            </div>
            <div className="module-row"><span className="e-grow"><b>Liderança</b><small>Aparece como referência do setor e recebe as avaliações internas.</small></span><Switch checked={d.leader} disabled={!canEdit} onChange={(v) => setD({ ...d, leader: v })} label={<span className="e-sr">Liderança</span>} /></div>
            <div className="module-row"><span className="e-grow"><b>Ativa</b><small>Pessoas inativas saem da escolha de responsáveis. O histórico continua visível.</small></span><Switch checked={d.active} disabled={!canEdit || (lastAdmin && d.active)} onChange={(v) => setD({ ...d, active: v })} label={<span className="e-sr">Ativa</span>} /></div>
          </div>
        )}

        {tab === "trabalho" && (
          <div className="e-stack" style={{ gap: 14 }}>
            <div className="e-stack" style={{ gap: 6 }}>
              <span className="e-label">Clientes em que atua</span>
              {p.clients.length ? <div className="e-row wrap" style={{ gap: 6 }}>{p.clients.map((c) => c.slug ? <Link key={c.id} to={`/clientes/${c.slug}` as never} className="e-chip">{c.name}</Link> : <span key={c.id} className="e-chip">{c.name}</span>)}</div> : <span className="e-caption">Nenhum cliente com itens em aberto.</span>}
            </div>
            {p.sectors.length > 0 && <div className="e-stack" style={{ gap: 6 }}><span className="e-label">Setores</span><div className="e-row wrap" style={{ gap: 6 }}>{p.sectors.map((s) => <span key={s} className="member-tag">{s}</span>)}</div></div>}
            {p.items.length === 0 ? <EmptyState compact icon="checkCircle" title="Sem itens atribuídos" text="Quando alguém atribuir uma demanda a esta pessoa, ela aparece aqui." /> : [...byClient.entries()].map(([client, list]) => (
              <div key={client} className="e-stack" style={{ gap: 6 }}>
                <span className="e-label">{client} · {list.length}</span>
                {list.map((i) => <ItemRow key={i.id} item={i} />)}
              </div>
            ))}
          </div>
        )}

        {tab === "permissoes" && (
          <div className="e-stack" style={{ gap: 12 }}>
            {!canEdit && <Alert kind="info" title="Somente leitura">Você pode ver, mas não alterar, as permissões.</Alert>}
            {permsQ.isLoading || perms === null ? <Skeleton h={320} r={16} /> : (
              <PermissionMatrix value={perms} onChange={setPerms} disabled={!canEdit} allowAll={d.role === "agency_admin"} />
            )}
            <p className="e-caption" style={{ margin: 0 }}>Ao salvar, o conjunto anterior é substituído. Uma permissão removida some da interface e o banco passa a negar a ação.</p>
          </div>
        )}

        {tab === "historico" && (
          p.history.length ? (
            <ol className="hub-activity">
              {p.history.map((h, i) => <li key={i}><span className="node" style={{ ["--c" as string]: PATHS[p.palette].p1 }}><Icon name="history" size="sm" /></span><div><span>{h.text}</span><div className="e-caption">{relDay(h.at)}</div></div></li>)}
            </ol>
          ) : <EmptyState compact icon="history" title="Sem histórico recente" text="As ações desta pessoa aparecem aqui conforme o trabalho acontece." />
        )}
      </Drawer>
      <Modal open={confirmOff} onClose={() => setConfirmOff(false)} icon="lock" tone="soft" title={`Desativar ${p.name}?`}
        footer={<><Button variant="secondary" onClick={() => setConfirmOff(false)}>Voltar</Button><Button loading={saving} onClick={save}>Desativar e salvar</Button></>}>
        <p className="e-small" style={{ margin: 0 }}>A pessoa perde o acesso e deixa de aparecer na escolha de responsáveis. {p.open ? `Ela tem ${p.open} ${p.open === 1 ? "item" : "itens"} em aberto: redistribua depois.` : ""} O histórico continua guardado.</p>
      </Modal>
    </>
  );
}

// ----- Convite ------------------------------------------------------------------

function InviteDrawer({ open, isAdmin, onClose, onDone }: { open: boolean; isAdmin: boolean; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: "", email: "", jobTitle: "", role: "agency_member" as AppRole });
  const [perms, setPerms] = useState<string[]>([]);
  const [err, setErr] = useState<{ email?: string }>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setF({ name: "", email: "", jobTitle: "", role: "agency_member" }); setPerms([]); setErr({}); } }, [open]);

  const send = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) { setErr({ email: "Informe um e-mail válido." }); return; }
    setSaving(true);
    try {
      const r = await invitePerson({ ...f, permissions: perms });
      if (r.linked) toast.success("Conta vinculada à equipe", { description: `${f.email} já tinha conta no Echo.` });
      else if (r.sent) toast.success("Convite enviado", { description: f.email });
      else toast.warning("Convite registrado, mas o e-mail não saiu", { description: r.warning ?? "Use “Reenviar” na lista de convites." });
      onDone();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível convidar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer open={open} onClose={onClose} eyebrow="Equipe" title="Convidar pessoa"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="send" loading={saving} onClick={send}>Enviar convite</Button></>}>
      <p className="e-small" style={{ margin: 0 }}>A pessoa recebe um e-mail e entra na equipe ao criar a conta com este endereço.</p>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Nome" value={f.name} optional autoFocus onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Field label="E-mail" type="email" value={f.email} error={err.email} onChange={(e) => { setF({ ...f, email: e.target.value }); setErr({}); }} />
      </div>
      <Field label="Função" value={f.jobTitle} optional placeholder="Ex.: Designer" onChange={(e) => setF({ ...f, jobTitle: e.target.value })} />
      <div className="e-field">
        <span className="e-field-label">Papel</span>
        <Segmented<AppRole> label="Papel" value={f.role} onChange={(v) => (isAdmin || v === "agency_member") && setF({ ...f, role: v })} items={[{ value: "agency_member", label: "Colaborador" }, { value: "agency_admin", label: "Administrador" }]} />
        {!isAdmin && <span className="e-help">Só administradores convidam outros administradores.</span>}
      </div>
      <div className="e-stack" style={{ gap: 8 }}>
        <span className="e-label">Permissões</span>
        <PermissionMatrix value={perms} onChange={setPerms} allowAll={f.role === "agency_admin"} />
      </div>
    </Drawer>
  );
}
