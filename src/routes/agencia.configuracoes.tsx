import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Building2, Check, Eye, Plus, RotateCcw, Search, Settings2, Trash2, X } from "lucide-react";
import { ReachIconAnimation } from "@/components/reach/reach-icon-animation";
import { PillButton, ReachMark, Chip } from "@/components/reach/ui";
import { FramedImage } from "@/components/reach/framed-image";
import { supabase } from "@/integrations/supabase/client";
import {
  CLIENT_STATUSES,
  CONTRACT_TYPES,
  DEFAULT_MODULES,
  MODULE_DEFS,
  brandModules,
  listWorkspaceDispatches,
  updateBrand,
  workspaceConnection,
  type BrandModules,
  type WorkspaceDispatch,
  createBrand,
  createTeamMember,
  deleteTeamMember,
  getProfile,
  listBrands,
  listBrandInvites,
  listBrandMembersFull,
  listTeamMembers,
  newFieldKey,
  cancelBrandInvite,
  removeBrandMember,
  setProfileActive,
  updateBrandMemberAccess,
  type Brand,
  type BrandInvite,
  type BrandMemberRow,
  type Profile,
  type TeamMember,
} from "@/lib/reach-data";
import { cn } from "@/lib/utils";
import { startViewAsClient } from "@/lib/view-as";
import { ImageField } from "@/components/reach/uploader";
import {
  saveAppSettings,
  useAccent,
  useAppSettings,
  useTheme,
  DEFAULT_ACCENT,
  DEFAULT_INVITE_CLIENTE_BODY,
  DEFAULT_INVITE_CLIENTE_SUBJECT,
  DEFAULT_INVITE_COLABORADOR_BODY,
  DEFAULT_INVITE_COLABORADOR_SUBJECT,
  INVITE_TEMPLATE_VARIABLES,
  REACH_THEMES,
  renderInviteTemplate,
  type ThemeMode,
} from "@/lib/branding";
import { inviteBrandUser, resendInviteEmail } from "@/lib/invites.functions";
import { toast } from "sonner";
import {
  CLIENT_PERMISSION_MODULES,
  PERMISSION_ACTIONS,
  ROLE_LABELS,
  cancelAgencyInvite,
  getFullAccess,
  listAgencyInvites,
  listProfiles,
  listUserRoles,
  modulePermissionKey,
  setUserRole,
  type AgencyInvite,
  type AppRole,
  type PermissionAction,
  type ProfileRow,
  type UserRole,
} from "@/lib/agency-data";
import { ColaboradorDrawer } from "@/components/reach/colaborador-drawer";
import { AgencyInviteModal } from "@/components/reach/agency-invite-modal";

export const Route = createFileRoute("/agencia/configuracoes")({
  head: () => ({
    meta: [
      { title: "Painel da Agência — Reach Brand OS" },
      { name: "description", content: "Gerencie todas as marcas atendidas pela Reach em um único painel." },
    ],
  }),
  component: AgenciaPage,
});

function AgenciaPage() {
  const routeSearch = useRouterState({ select: (state) => state.location.search as Record<string, unknown> });
  const navigate = useNavigate();
  const agencyName = useAppSettings()?.agency_name ?? null;
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(routeSearch.novo === "1");
  const [tab, setTab] = useState<"agencia" | "marcas" | "equipe" | "integracoes" | "identidade" | "permissoes" | "convites">(routeSearch.tab === "marcas" ? "marcas" : "agencia");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [contractFilter, setContractFilter] = useState("todos");
  const [editing, setEditing] = useState<Brand | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        navigate({ to: "/auth" });
        return;
      }
      const [p, b] = await Promise.all([getProfile(session.user.id), listBrands()]);
      setProfile(p);
      setBrands(b);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar marcas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <ReachIconAnimation size={48} context="page-loading" />
        <p className="text-sm text-muted-foreground">Carregando painel da agência…</p>
      </div>
    );
  }

  const isAgency = profile?.role === "agency";
  const visibleBrands = brands.filter((b) => {
    const q = query.trim().toLowerCase();
    const matchesQuery = !q || `${b.name} ${b.segment ?? ""}`.toLowerCase().includes(q);
    const status = ((b as any).status ?? "ativo") as string;
    const matchesStatus = statusFilter === "todos" || status === statusFilter;
    const matchesContract = contractFilter === "todos" || (b as any).contract_type === contractFilter;
    return matchesQuery && matchesStatus && matchesContract;
  });

  return (
    <div className="space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight">Configurações da Agência</h1>
          <p className="truncate text-sm text-muted-foreground">
            {agencyName ? `${agencyName} · agência, equipe, clientes e sistema` : "Agência, equipe, clientes e sistema"}
          </p>
        </div>
        {isAgency && tab === "marcas" && (
          <PillButton onClick={() => setShowNew((v) => !v)} className="shrink-0">
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Novo cliente</span>
          </PillButton>
        )}
      </header>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {isAgency && (
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          {([
            ["agencia", "Agência"],
            ["marcas", "Clientes"],
            ["equipe", "Equipe"],
            ["identidade", "Identidade"],
            ["convites", "Convites"],
            ["integracoes", "Sistema"],
            ["permissoes", "Permissões"],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                "shrink-0 rounded-full px-4 py-2 text-[12.5px] font-medium transition-colors",
                tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {tab === "agencia" && isAgency && <AgencyProfileSection />}
      {tab === "permissoes" && isAgency && <PermissionsSection />}
      {tab === "equipe" && isAgency && <TeamSection brands={brands} />}
      {tab === "integracoes" && isAgency && <IntegrationsSection brands={brands} onChanged={refresh} />}
      {tab === "identidade" && isAgency && <IdentitySection />}
      {tab === "convites" && isAgency && <InvitesSection />}

      {showNew && isAgency && tab === "marcas" && <NewBrandForm onCreated={refresh} onClose={() => setShowNew(false)} />}


        {tab === "marcas" && (
          <div className="flex flex-wrap items-center gap-3">
            <label className="surface flex min-w-[220px] flex-1 items-center gap-2 rounded-full px-4 py-2">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar cliente por nome ou segmento…"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-full border border-border bg-background/50 px-4 py-2 text-sm outline-none">
              <option value="todos">Todos os status</option>
              {CLIENT_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <select value={contractFilter} onChange={(e) => setContractFilter(e.target.value)} className="rounded-full border border-border bg-background/50 px-4 py-2 text-sm outline-none">
              <option value="todos">Toda contratação</option>
              {CONTRACT_TYPES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
        )}

        <div className={tab === "marcas" ? "grid gap-5 sm:grid-cols-2 lg:grid-cols-3" : "hidden"}>
          {visibleBrands.map((b) => (
            <div key={b.id} className="surface group flex flex-col gap-3 overflow-hidden rounded-2xl transition-transform hover:-translate-y-0.5">
              {b.cover_url && (
                <FramedImage src={b.cover_url} frame={(b as any).cover_frame} shape="rect" className="h-20 w-full" />
              )}
              <div className="flex flex-1 flex-col gap-3 px-5 pb-5" style={!b.cover_url ? { paddingTop: "1.25rem" } : undefined}>
              <Link to="/b/$brandSlug" params={{ brandSlug: b.slug }} className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  {b.logo_url ? (
                    <FramedImage src={b.logo_url} frame={(b as any).logo_frame} shape="circle" className="h-11 w-11 shrink-0 border border-border" />
                  ) : (
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl gradient-brand text-primary-foreground">
                      <Building2 className="h-5 w-5" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{b.name}</p>
                    {b.segment && <p className="truncate text-xs text-muted-foreground">{b.segment}</p>}
                  </div>
                </div>
                {b.description && <p className="line-clamp-2 text-xs text-muted-foreground">{b.description}</p>}
                <span className="inline-flex items-center gap-1 text-sm text-brand">
                  Acessar Brand Home <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>

              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full bg-muted/60 px-2.5 py-1 text-[10.5px] text-muted-foreground">
                  {CLIENT_STATUSES.find((s) => s.key === ((b as any).status ?? "ativo"))?.label ?? "Ativo"}
                </span>
                {(b as any).contract_type && (
                  <span className="rounded-full bg-muted/60 px-2.5 py-1 text-[10.5px] text-muted-foreground">
                    {CONTRACT_TYPES.find((c) => c.key === (b as any).contract_type)?.label ?? (b as any).contract_type}
                  </span>
                )}
                {MODULE_DEFS.filter((m) => brandModules(b)[m.key]).map((m) => (
                  <span key={m.key} className="rounded-full bg-reach-blue-soft px-2.5 py-1 text-[10.5px] text-reach-blue">{m.label}</span>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 text-[11.5px]">
                {brandModules(b).espaco360 && <Link to="/e360/$brandSlug/plano" search={{ tab: undefined, filtro: undefined }} params={{ brandSlug: b.slug }} className="rounded-full border border-border px-2.5 py-1 text-muted-foreground hover:text-foreground">Plano</Link>}
                {brandModules(b).biblioteca && (
                  <Link to="/b/$brandSlug/biblioteca" search={{ tab: undefined }} params={{ brandSlug: b.slug }} className="rounded-full border border-border px-2.5 py-1 text-muted-foreground hover:text-foreground">Biblioteca</Link>
                )}
                {brandModules(b).espaco360 && (
                  <Link to="/e360/$brandSlug" params={{ brandSlug: b.slug }} search={{ tab: undefined, filtro: undefined }} className="rounded-full border border-border px-2.5 py-1 text-muted-foreground hover:text-foreground">Espaço 360</Link>
                )}
                <button onClick={() => setEditing(b)} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-muted-foreground hover:text-foreground">
                  <Settings2 className="h-3 w-3" /> Configurar
                </button>
              </div>
              {isAgency && (
                <button
                  onClick={() => {
                    startViewAsClient(b.name);
                    navigate({ to: "/b/$brandSlug", params: { brandSlug: b.slug } });
                  }}
                  className="mt-auto inline-flex items-center gap-1.5 self-start text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Eye className="h-3.5 w-3.5" /> Ver como cliente
                </button>
              )}
              </div>
            </div>
          ))}

          {visibleBrands.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum cliente encontrado com os filtros atuais.</p>
          )}
        </div>

      {editing && <ClientSettingsDrawer brand={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
    </div>
  );
}



function NewBrandForm({ onCreated, onClose }: { onCreated: () => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [segment, setSegment] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("ativo");
  const [contract, setContract] = useState("recorrente");
  const [modules, setModules] = useState<BrandModules>({ ...DEFAULT_MODULES });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const slug = newFieldKey(name).replace(/_/g, "-");
      await createBrand({
        name,
        slug,
        segment: segment || undefined,
        description: description || undefined,
        status,
        contract_type: contract,
        modules: modules as unknown as Record<string, boolean>,
      } as any);
      setName("");
      setSegment("");
      setDescription("");
      onClose();
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar a marca.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="surface space-y-4 rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Nova marca</h2>
        <Chip>Agência</Chip>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs text-muted-foreground">Nome da empresa</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-2xl border border-border bg-background/50 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Segmento</label>
          <input
            value={segment}
            onChange={(e) => setSegment(e.target.value)}
            className="mt-1 w-full rounded-2xl border border-border bg-background/50 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Descrição institucional</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-2xl border border-border bg-background/50 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs text-muted-foreground">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-1 w-full rounded-2xl border border-border bg-background/50 px-4 py-2 text-sm outline-none">
            {CLIENT_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Contratação</label>
          <select value={contract} onChange={(e) => setContract(e.target.value)} className="mt-1 w-full rounded-2xl border border-border bg-background/50 px-4 py-2 text-sm outline-none">
            {CONTRACT_TYPES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
      </div>
      <ModulesPicker value={modules} onChange={setModules} />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <PillButton type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </PillButton>
        <PillButton type="submit" disabled={saving}>
          {saving ? "Criando…" : "Criar marca"}
        </PillButton>
      </div>
    </form>
  );
}


// ---------------------------------------------------------------------------
// Cadastro de equipe e pessoas do cliente
// ---------------------------------------------------------------------------

/** Gestão administrativa de acesso da equipe da agência — mesma fonte de
 * dados de Agência → Equipe (profiles + user_roles + agency_invites), só
 * que com foco em cadastro/convite/status em vez de carga de trabalho.
 * Antes esta tela criava apenas um cartão em `team_members`, sem nenhum
 * vínculo com login/permissões — por isso um colaborador cadastrado aqui
 * nunca aparecia em Agência → Equipe. */
function TeamSection({ brands }: { brands: Brand[] }) {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [invites, setInvites] = useState<AgencyInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [editing, setEditing] = useState<ProfileRow | null>(null);
  const [inviting, setInviting] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [p, r, inv] = await Promise.all([listProfiles(), listUserRoles(), listAgencyInvites().catch(() => [])]);
      setProfiles(p);
      setRoles(r);
      setInvites(inv);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar equipe.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    getFullAccess().then((a) => setCanManage(a.can("equipe.gerenciar") || a.can("equipe.administrar"))).catch(() => undefined);
    load();
  }, []);

  const roleOf = (id: string): AppRole => (roles.find((r) => r.user_id === id)?.role ?? "client");
  const team = profiles.filter((p) => roleOf(p.id) !== "client");
  const visibleTeam = team.filter((p) => showInactive || (p as any).active !== false);
  const pendingInvites = invites.filter((i) => i.status === "pendente");

  return (
    <section className="space-y-5">
      <div className="surface space-y-3 rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Equipe da agência</h2>
            <p className="text-xs text-muted-foreground">Usuários com acesso à agência — a mesma lista de Agência → Equipe.</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
              Mostrar inativos
            </label>
            {canManage && (
              <PillButton size="sm" onClick={() => setInviting(true)}>
                <Plus className="h-3.5 w-3.5" /> Convidar colaborador
              </PillButton>
            )}
          </div>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      {pendingInvites.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Convites pendentes</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pendingInvites.map((inv) => (
              <div key={inv.id} className="surface flex items-center justify-between gap-2 rounded-2xl p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{inv.name || inv.email}</p>
                  <p className="truncate text-xs text-muted-foreground">{inv.email} · {ROLE_LABELS[inv.role]}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="rounded-full bg-warning/12 px-2.5 py-1 text-[10.5px] text-warning">Convite pendente</span>
                  {canManage && (
                    <>
                      <button onClick={async () => { const r = await resendInviteEmail({ data: { kind: "agency", inviteId: inv.id, redirectTo: `${window.location.origin}/auth` } }); if (r.sent) toast.success(`Convite reenviado para ${inv.email}.`); else toast.error(`Não foi possível reenviar: ${"warning" in r ? r.warning : "erro no envio de e-mail"}`); await load(); }} title="Reenviar convite" className="rounded-full border border-border px-2.5 py-1 text-[10.5px] text-muted-foreground transition-colors hover:bg-muted">Reenviar</button>
                      <button onClick={async () => { await cancelAgencyInvite(inv.id); await load(); }} aria-label="Cancelar convite" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando equipe…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleTeam.map((p) => {
            const inactive = (p as any).active === false;
            return (
              <div key={p.id} className={cn("surface flex items-center gap-3 rounded-2xl p-4", inactive && "opacity-60")}>
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt={p.display_name ?? ""} loading="lazy" className="h-11 w-11 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full gradient-brand text-sm font-semibold text-primary-foreground">
                    {(p.display_name || p.email || "?").slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.display_name || p.email}</p>
                  <p className="truncate text-xs text-muted-foreground">{[p.job_title, ROLE_LABELS[roleOf(p.id)]].filter(Boolean).join(" · ")}</p>
                  {p.email && <p className="truncate text-[11px] text-muted-foreground">{p.email}</p>}
                </div>
                <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[10.5px]", inactive ? "bg-muted text-muted-foreground" : "bg-success/12 text-success")}>
                  {inactive ? "Inativo" : "Ativo"}
                </span>
                <button onClick={() => setEditing(p)} className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs">
                  {canManage ? "Abrir perfil" : "Ver perfil"}
                </button>
              </div>
            );
          })}
          {visibleTeam.length === 0 && <p className="text-sm text-muted-foreground">Nenhum colaborador cadastrado ainda.</p>}
        </div>
      )}

      {editing && (
        <ColaboradorDrawer
          profile={editing as ProfileRow & { active?: boolean }}
          role={roleOf(editing.id)}
          canManage={canManage}
          onClose={() => setEditing(null)}
          onSaved={() => load()}
        />
      )}

      {inviting && (
        <AgencyInviteModal onClose={() => setInviting(false)} onInvited={() => { load(); }} />
      )}

      <p className="text-[11px] text-muted-foreground">
        Para gerenciar usuários de um cliente específico (não da agência), use a aba Clientes.
      </p>

      <ContactsRosterSection brands={brands} />
    </section>
  );
}

/** Contatos sem login (freelancers, terceiros) usados só para atribuição de
 * tarefas no Espaço 360 — conceito diferente de usuário da plataforma, por
 * isso continua em team_members em vez de profiles/auth. */
function ContactsRosterSection({ brands }: { brands: Brand[] }) {
  const [people, setPeople] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [brandId, setBrandId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setPeople((await listTeamMembers()).filter((p) => p.kind !== "equipe"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar contatos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function add() {
    if (!name.trim()) return;
    try {
      await createTeamMember({ name: name.trim(), job_title: jobTitle.trim() || null, kind: "convidado", brand_id: brandId || null });
      setName("");
      setJobTitle("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível cadastrar.");
    }
  }

  const input = "mt-1 w-full rounded-2xl border border-border bg-background/50 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="surface space-y-3 rounded-2xl p-5">
      <div>
        <h3 className="text-sm font-semibold">Contatos para atribuição de tarefas</h3>
        <p className="text-xs text-muted-foreground">Pessoas sem login no sistema (freelancers, terceiros) que podem ser responsáveis por tarefas no Espaço 360. Não têm acesso à plataforma.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" className={input} />
        <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Cargo / função" className={input} />
        <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className={input}>
          <option value="">Sem vínculo com cliente</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <PillButton size="sm" onClick={add}><Plus className="h-3.5 w-3.5" /> Adicionar contato</PillButton>
      {!loading && (
        <div className="flex flex-wrap gap-2 pt-2">
          {people.map((p) => (
            <span key={p.id} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs">
              {p.name}
              <button onClick={() => deleteTeamMember(p.id).then(load)} aria-label={`Remover ${p.name}`} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
            </span>
          ))}
          {people.length === 0 && <p className="text-xs text-muted-foreground">Nenhum contato cadastrado.</p>}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Identidade visual da plataforma
// ---------------------------------------------------------------------------

function IdentitySection() {
  const settings = useAppSettings();
  const theme = useTheme();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    agency_name: "",
    logo_url: null as string | null,
    logo_scale: 1,
    logo_offset_x: 0,
    logo_offset_y: 0,
    primary_color: "",
    accent_color: "",
  });

  useEffect(() => {
    if (!settings) return;
    setDraft({
      agency_name: settings.agency_name ?? "",
      logo_url: settings.logo_url,
      logo_scale: settings.logo_scale ?? 1,
      logo_offset_x: settings.logo_offset_x ?? 0,
      logo_offset_y: settings.logo_offset_y ?? 0,
      primary_color: settings.primary_color ?? "",
      accent_color: settings.accent_color ?? "",
    });
  }, [settings]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await saveAppSettings({
        agency_name: draft.agency_name || null,
        logo_url: draft.logo_url,
        logo_scale: Number(draft.logo_scale),
        logo_offset_x: Number(draft.logo_offset_x),
        logo_offset_y: Number(draft.logo_offset_y),
        primary_color: draft.primary_color || null,
        accent_color: draft.accent_color || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  const input = "mt-1 w-full rounded-2xl border border-border bg-background/50 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <section className="surface space-y-5 rounded-2xl p-5">
      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Identidade da plataforma</h2>

      <ReachThemePicker />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs text-muted-foreground">Nome exibido</label>
          <input value={draft.agency_name} onChange={(e) => setDraft((d) => ({ ...d, agency_name: e.target.value }))} className={input} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Logo</label>
          <ImageField value={draft.logo_url} folder="marca-plataforma" onChange={(url) => setDraft((d) => ({ ...d, logo_url: url }))} hint="PNG com fundo transparente funciona melhor." />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="text-xs text-muted-foreground">Escala do logo ({draft.logo_scale.toFixed(2)}x)</label>
          <input type="range" min={0.5} max={2} step={0.05} value={draft.logo_scale} onChange={(e) => setDraft((d) => ({ ...d, logo_scale: Number(e.target.value) }))} className="mt-2 w-full" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Deslocamento X ({draft.logo_offset_x}px)</label>
          <input type="range" min={-20} max={20} step={1} value={draft.logo_offset_x} onChange={(e) => setDraft((d) => ({ ...d, logo_offset_x: Number(e.target.value) }))} className="mt-2 w-full" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Deslocamento Y ({draft.logo_offset_y}px)</label>
          <input type="range" min={-20} max={20} step={1} value={draft.logo_offset_y} onChange={(e) => setDraft((d) => ({ ...d, logo_offset_y: Number(e.target.value) }))} className="mt-2 w-full" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="text-xs text-muted-foreground">Cor principal</label>
          <input type="color" value={draft.primary_color || "#ff6b4a"} onChange={(e) => setDraft((d) => ({ ...d, primary_color: e.target.value }))} className="mt-1 h-10 w-full rounded-2xl border border-border bg-background/50" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Cor de destaque</label>
          <input type="color" value={draft.accent_color || "#a855f7"} onChange={(e) => setDraft((d) => ({ ...d, accent_color: e.target.value }))} className="mt-1 h-10 w-full rounded-2xl border border-border bg-background/50" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Tema padrão</label>
          <select value={theme.mode} onChange={(e) => theme.change(e.target.value as ThemeMode)} className={input}>
            <option value="dark">Escuro</option>
            <option value="light">Claro</option>
            <option value="auto">Automático</option>
          </select>
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
      <PillButton onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar identidade"}</PillButton>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Convites — assunto, mensagem e identidade do e-mail, por tipo de convite
// ---------------------------------------------------------------------------

type InviteKind = "colaborador" | "cliente";

function InvitesSection() {
  const settings = useAppSettings();
  const [kind, setKind] = useState<InviteKind>("colaborador");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const subjectKey = kind === "colaborador" ? "invite_colaborador_subject" : "invite_cliente_subject";
  const bodyKey = kind === "colaborador" ? "invite_colaborador_body" : "invite_cliente_body";
  const defaultSubject = kind === "colaborador" ? DEFAULT_INVITE_COLABORADOR_SUBJECT : DEFAULT_INVITE_CLIENTE_SUBJECT;
  const defaultBody = kind === "colaborador" ? DEFAULT_INVITE_COLABORADOR_BODY : DEFAULT_INVITE_CLIENTE_BODY;

  useEffect(() => {
    if (!settings) return;
    setSubject((settings as any)[subjectKey] || defaultSubject);
    setBody((settings as any)[bodyKey] || defaultBody);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, kind]);

  async function save() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await saveAppSettings({ [subjectKey]: subject, [bodyKey]: body } as any);
      setNotice("Modelo salvo.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar o modelo de convite.");
    } finally {
      setSaving(false);
    }
  }

  const sampleVars = {
    nome: "Guilherme",
    agencia: (settings as any)?.agency_name || "Sua agência",
    email: "guilherme@exemplo.com",
    link_convite: "https://reach-brand.lovable.app/auth",
    cliente: "Aurora Cosméticos",
    cargo: "Analista de Conteúdo",
    ano: String(new Date().getFullYear()),
  };
  const previewSubject = renderInviteTemplate(subject, sampleVars);
  const previewBody = renderInviteTemplate(body, sampleVars);
  const logoUrl = (settings as any)?.logo_url as string | null;

  const input = "mt-1 w-full rounded-2xl border border-border bg-background/50 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="space-y-5">
      <div className="surface space-y-4 rounded-2xl p-5">
        <div>
          <h2 className="text-sm font-semibold">Convites por e-mail</h2>
          <p className="text-xs text-muted-foreground">Personalize o assunto e a mensagem de cada tipo de convite. A identidade (logo e nome) é a mesma configurada em Identidade.</p>
        </div>

        <div className="flex gap-1.5">
          {([["colaborador", "Convite de colaborador"], ["cliente", "Convite de cliente"]] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={cn(
                "rounded-full px-4 py-2 text-[12.5px] font-medium transition-colors",
                kind === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Assunto</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className={input} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Mensagem</label>
              <textarea rows={9} value={body} onChange={(e) => setBody(e.target.value)} className={cn(input, "font-mono text-[12.5px] leading-relaxed")} />
            </div>
            <div className="rounded-2xl border border-border p-3">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Variáveis disponíveis</p>
              <div className="flex flex-wrap gap-1.5">
                {INVITE_TEMPLATE_VARIABLES.map((v) => (
                  <code key={v.key} title={v.label} className="rounded-full bg-muted px-2.5 py-1 text-[11px]">{`{{${v.key}}}`}</code>
                ))}
              </div>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            {notice && <p className="text-xs text-success">{notice}</p>}
            <PillButton onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar modelo"}</PillButton>
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Prévia</p>
            <div className="overflow-hidden rounded-2xl border border-border bg-background">
              <div className="border-b border-border px-5 py-4">
                {logoUrl ? <img src={logoUrl} alt={sampleVars.agencia} className="h-8 w-auto max-w-[140px] object-contain" /> : <ReachMark className="h-8 w-8" />}
              </div>
              <div className="space-y-3 px-5 py-4">
                <p className="text-xs text-muted-foreground">Assunto: <span className="text-foreground">{previewSubject}</span></p>
                <div className="whitespace-pre-wrap text-[13.5px] leading-relaxed">{previewBody}</div>
              </div>
              <div className="border-t border-border px-5 py-3 text-[11px] text-muted-foreground">{sampleVars.agencia}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="surface space-y-2 rounded-2xl p-5">
        <h3 className="text-sm font-semibold">Sobre o envio real</h3>
        <p className="text-xs text-muted-foreground">
          Hoje o convite é enviado pelo serviço de autenticação (Supabase Auth), que usa um modelo de e-mail único e genérico configurado no projeto — fora do alcance desta tela. O assunto e a mensagem personalizados aqui já ficam salvos e prontos, mas para o e-mail
          realmente recebido usar esta identidade é necessário conectar um provedor de envio próprio (ex.: Resend), o que ainda não está configurado neste projeto.
        </p>
      </div>
    </div>
  );
}

/** Seletor das quatro paletas oficiais Reach — mesma linguagem do Workspace. */
function ReachThemePicker() {
  const { accent, change } = useAccent();
  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold tracking-tight">Temas Oficiais Reach</h3>
          <p className="mt-1 max-w-xl text-[13px] text-muted-foreground">
            Quatro paletas inspiradas na identidade visual da agência. Escolha uma — todos os componentes se ajustam em tempo real.
          </p>
        </div>
        <button
          onClick={() => change(DEFAULT_ACCENT)}
          className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Restaurar Reach Orange
        </button>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {REACH_THEMES.map((t) => {
          const active = accent === t.key;
          return (
            <button
              key={t.key}
              onClick={() => change(t.key)}
              className={cn(
                "rounded-2xl border p-3 text-left transition-colors",
                active ? "border-primary/40 bg-primary/[0.08]" : "border-transparent hover:bg-muted/60",
              )}
            >
              <span className="flex h-[86px] overflow-hidden rounded-2xl">
                {t.colors.map((c) => (
                  <span key={c} className="flex-1" style={{ backgroundColor: c }} />
                ))}
              </span>
              <span className="mt-3 flex items-center justify-between gap-2">
                <span className="text-[15px] font-semibold tracking-tight">{t.name}</span>
                {active && (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                )}
              </span>
              <span className="mt-0.5 block text-[13px] text-muted-foreground">{t.description}</span>
              <span className="mt-1.5 block text-[11.5px] uppercase tracking-[0.12em] text-muted-foreground/80">
                Tema · {t.key}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Módulos contratados por cliente
// ---------------------------------------------------------------------------

function ModulesPicker({ value, onChange }: { value: BrandModules; onChange: (next: BrandModules) => void }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs text-muted-foreground">Módulos contratados</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {MODULE_DEFS.map((m) => (
          <label key={m.key} className="flex cursor-pointer items-start gap-2 rounded-2xl border border-border bg-card p-3">
            <input
              type="checkbox"
              checked={value[m.key]}
              onChange={(e) => onChange({ ...value, [m.key]: e.target.checked })}
              className="mt-0.5 h-4 w-4 accent-[var(--reach-coral)]"
            />
            <span className="min-w-0">
              <span className="block text-[12.5px] font-medium">{m.label}</span>
              <span className="block text-[11px] leading-snug text-muted-foreground">{m.description}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Configuração do cliente (identidade + módulos + Workspace)
// ---------------------------------------------------------------------------

function ClientSettingsDrawer({ brand, onClose, onSaved }: { brand: Brand; onClose: () => void; onSaved: () => void }) {
  const conn = workspaceConnection(brand);
  const [modules, setModules] = useState<BrandModules>(brandModules(brand));
  const [status, setStatus] = useState<string>(((brand as any).status as string) ?? "ativo");
  const [contract, setContract] = useState<string>(((brand as any).contract_type as string) ?? "recorrente");
  const [wsUrl, setWsUrl] = useState(conn.url ?? "");
  const [wsClientId, setWsClientId] = useState(conn.clientId ?? "");
  const [connected, setConnected] = useState(conn.connected);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await updateBrand(brand.id, {
        status,
        contract_type: contract,
        modules: modules as unknown as Record<string, boolean>,
        workspace_url: wsUrl.trim() || null,
        workspace_client_id: wsClientId.trim() || null,
        workspace_connected: connected,
      } as any);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end overlay-scrim">
      <div className="h-full w-full max-w-lg overflow-y-auto border-l border-border bg-card/95 p-6">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-label">Configuração do cliente</div>
            <h2 className="truncate text-lg font-semibold">{brand.name}</h2>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-1 w-full rounded-2xl border border-border bg-background/50 px-4 py-2 text-sm outline-none">
                {CLIENT_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Contratação</label>
              <select value={contract} onChange={(e) => setContract(e.target.value)} className="mt-1 w-full rounded-2xl border border-border bg-background/50 px-4 py-2 text-sm outline-none">
                {CONTRACT_TYPES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <ModulesPicker value={modules} onChange={setModules} />

          <ClientUsersSection brand={brand} />

          <div className="space-y-3 rounded-2xl border border-border p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[12.5px] font-semibold">Conexão com o Reach Workspace</h3>
              <Chip>{connected ? "Conectado" : "Desconectado"}</Chip>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">URL de integração (webhook)</label>
              <input value={wsUrl} onChange={(e) => setWsUrl(e.target.value)} placeholder="https://workspace.reach.../api/intake" className="mt-1 w-full rounded-2xl border border-border bg-background/50 px-4 py-2 text-sm outline-none" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">ID do cliente no Workspace</label>
              <input value={wsClientId} onChange={(e) => setWsClientId(e.target.value)} className="mt-1 w-full rounded-2xl border border-border bg-background/50 px-4 py-2 text-sm outline-none" />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-[12.5px]">
              <input type="checkbox" checked={connected} onChange={(e) => setConnected(e.target.checked)} className="h-4 w-4 accent-[var(--reach-coral)]" />
              Marcar cliente como conectado ao Workspace
            </label>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <PillButton variant="secondary" onClick={onClose}>Cancelar</PillButton>
            <PillButton onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar configuração"}</PillButton>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Usuários do cliente — administrador/colaborador, matriz de permissões
// ---------------------------------------------------------------------------

function ClientUsersSection({ brand }: { brand: Brand }) {
  const [members, setMembers] = useState<BrandMemberRow[]>([]);
  const [invites, setInvites] = useState<BrandInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [m, i] = await Promise.all([listBrandMembersFull(brand.id), listBrandInvites(brand.id)]);
      setMembers(m);
      setInvites(i);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar usuários do cliente.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand.id]);

  const pendingInvites = invites.filter((i) => i.status === "pendente");

  async function toggleActive(userId: string, active: boolean) {
    setError(null);
    setNotice(null);
    try {
      await setProfileActive(userId, active);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível alterar o status do usuário.");
    }
  }

  async function remove(userId: string) {
    setError(null);
    try {
      await removeBrandMember(brand.id, userId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível remover o usuário.");
    }
  }

  const editingMember = members.find((m) => m.user_id === editingUserId) ?? null;

  return (
    <div className="space-y-3 rounded-2xl border border-border p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[12.5px] font-semibold">Usuários do cliente</h3>
        <PillButton size="sm" onClick={() => setInviting(true)}>
          <Plus className="h-3.5 w-3.5" /> Convidar usuário
        </PillButton>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {notice && <p className="text-xs text-success">{notice}</p>}

      {loading ? (
        <p className="text-xs text-muted-foreground">Carregando…</p>
      ) : (
        <div className="space-y-1.5">
          {members.length === 0 && <p className="text-xs text-muted-foreground">Nenhum usuário vinculado a este cliente ainda.</p>}
          {members.map((m) => {
            const active = m.profile?.active !== false;
            return (
              <div key={m.user_id} className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-medium">{m.profile?.display_name || m.profile?.email || "Usuário"}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {m.profile?.email ?? "—"} · {m.is_admin ? "Administrador do cliente" : "Colaborador"} {!active && "· Inativo"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button onClick={() => setEditingUserId(m.user_id)} className="rounded-full border border-border px-2.5 py-1 text-[10.5px]">Permissões</button>
                  <button onClick={() => toggleActive(m.user_id, !active)} className="rounded-full border border-border px-2.5 py-1 text-[10.5px]">
                    {active ? "Desativar" : "Ativar"}
                  </button>
                  <button onClick={() => remove(m.user_id)} aria-label="Remover" title="Remover" className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pendingInvites.length > 0 && (
        <div className="space-y-1.5 border-t border-border pt-3">
          <p className="text-[11px] font-medium text-muted-foreground">Convites pendentes</p>
          {pendingInvites.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-[12.5px]">{inv.name || inv.email}</p>
                <p className="truncate text-[11px] text-muted-foreground">{inv.email} · {inv.is_admin ? "Administrador" : "Colaborador"}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button onClick={async () => { const r = await resendInviteEmail({ data: { kind: "brand", inviteId: inv.id, redirectTo: `${window.location.origin}/auth` } }); if (r.sent) toast.success(`Convite reenviado para ${inv.email}.`); else toast.error(`Não foi possível reenviar: ${"warning" in r ? r.warning : "erro no envio de e-mail"}`); await load(); }} className="rounded-full border border-border px-2.5 py-1 text-[10.5px]">Reenviar</button>
                <button onClick={async () => { await cancelBrandInvite(inv.id); await load(); }} aria-label="Cancelar convite" className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingMember && (
        <ClientMemberPermissionsModal
          brandId={brand.id}
          member={editingMember}
          onClose={() => setEditingUserId(null)}
          onSaved={() => { setEditingUserId(null); load(); }}
        />
      )}

      {inviting && (
        <ClientInviteModal
          brandId={brand.id}
          onClose={() => setInviting(false)}
          onInvited={() => { load(); }}
        />
      )}
    </div>
  );
}

function PermissionMatrix({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] border-collapse text-xs">
        <thead>
          <tr>
            <th className="p-1.5 text-left font-medium text-muted-foreground">Módulo</th>
            {PERMISSION_ACTIONS.map((a) => (
              <th key={a.key} className="p-1.5 text-center font-medium text-muted-foreground">{a.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CLIENT_PERMISSION_MODULES.map((m) => (
            <tr key={m.key} className="border-t border-border">
              <td className="p-1.5 font-medium">{m.label}</td>
              {PERMISSION_ACTIONS.map((a) => {
                const applicable = m.actions.includes(a.key as PermissionAction);
                if (!applicable) return <td key={a.key} className="p-1.5 text-center text-muted-foreground/30">—</td>;
                const key = modulePermissionKey(m.key, a.key as PermissionAction);
                return (
                  <td key={a.key} className="p-1.5 text-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--primary)]"
                      checked={value.includes(key)}
                      disabled={disabled}
                      onChange={(e) => onChange(e.target.checked ? [...value, key] : value.filter((k) => k !== key))}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClientMemberPermissionsModal({
  brandId,
  member,
  onClose,
  onSaved,
}: {
  brandId: string;
  member: BrandMemberRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [isAdmin, setIsAdmin] = useState(member.is_admin);
  const [perms, setPerms] = useState<string[]>(member.permissions);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await updateBrandMemberAccess(brandId, member.user_id, { is_admin: isAdmin, permissions: isAdmin ? [] : perms });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar as permissões.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overlay-scrim p-0 sm:items-center sm:p-6">
      <div className="surface max-h-[92vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-t-3xl p-5 sm:rounded-3xl">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">{member.profile?.display_name || member.profile?.email}</h2>
          <button onClick={onClose} aria-label="Fechar" className="grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <label className="flex items-center gap-2 text-[12.5px]">
          <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
          Administrador do cliente (acesso total ao próprio ambiente e gestão dos usuários dele)
        </label>
        {!isAdmin && (
          <div>
            <p className="mb-1.5 text-[11px] text-muted-foreground">O que este colaborador pode acessar dentro do ambiente do cliente.</p>
            <PermissionMatrix value={perms} onChange={setPerms} />
          </div>
        )}
        <div className="flex justify-end gap-2">
          <PillButton variant="secondary" onClick={onClose}>Cancelar</PillButton>
          <PillButton onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</PillButton>
        </div>
      </div>
    </div>
  );
}

function ClientInviteModal({ brandId, onClose, onInvited }: { brandId: string; onClose: () => void; onInvited: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [perms, setPerms] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function invite() {
    if (!email.trim() || !email.includes("@")) {
      setError("Informe um e-mail válido.");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await inviteBrandUser({
        data: {
          brandId,
          email: email.trim(),
          name: name.trim() || undefined,
          role: "client",
          isAdmin,
          permissions: isAdmin ? [] : perms,
          redirectTo: `${window.location.origin}/auth`,
        },
      });
      if (result.linked) setNotice(`${email} já tinha conta e foi vinculado ao cliente.`);
      else if (result.sent) setNotice(`Convite enviado com sucesso para ${email}.`);
      else setError(`O convite foi registrado, mas o e-mail NÃO pôde ser enviado${"warning" in result && result.warning ? `: ${result.warning}` : "."} Use "Reenviar" na lista de convites pendentes.`);
      setDone(true);
      onInvited();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível convidar o usuário.");
    } finally {
      setSaving(false);
    }
  }

  const input = "w-full rounded-2xl border border-border bg-background/50 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overlay-scrim p-0 sm:items-center sm:p-6">
      <div className="surface max-h-[92vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-t-3xl p-5 sm:rounded-3xl">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Convidar usuário do cliente</h2>
          <button onClick={onClose} aria-label="Fechar" className="grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        {error && <p className="rounded-2xl bg-destructive/10 p-3 text-xs text-destructive">{error}</p>}
        {notice && <p className="rounded-2xl bg-success/10 p-3 text-xs text-success">{notice}</p>}
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">E-mail *</span>
          <input autoFocus type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Nome</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={input} />
        </label>
        <label className="flex items-center gap-2 text-[12.5px]">
          <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
          Administrador do cliente
        </label>
        {!isAdmin && <PermissionMatrix value={perms} onChange={setPerms} />}
        {done ? (
          <PillButton onClick={onClose}>Fechar</PillButton>
        ) : (
          <PillButton onClick={invite} disabled={saving}>{saving ? "Convidando…" : "Enviar convite"}</PillButton>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Integrações com o Reach Workspace
// ---------------------------------------------------------------------------

function IntegrationsSection({ brands, onChanged }: { brands: Brand[]; onChanged: () => void }) {
  const [dispatches, setDispatches] = useState<WorkspaceDispatch[]>([]);
  const [editing, setEditing] = useState<Brand | null>(null);

  useEffect(() => {
    listWorkspaceDispatches().then(setDispatches).catch(() => setDispatches([]));
  }, [brands]);

  return (
    <div className="space-y-5">
      <div className="surface space-y-3 rounded-2xl p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Clientes conectados</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {brands.map((b) => {
            const conn = workspaceConnection(b);
            return (
              <div key={b.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border p-3">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium">{b.name}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{conn.url ?? "Sem URL de integração"}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-[10.5px] ${conn.connected ? "bg-reach-blue-soft text-reach-blue" : "bg-muted/60 text-muted-foreground"}`}>
                    {conn.connected ? "Conectado" : "Desconectado"}
                  </span>
                  <button onClick={() => setEditing(b)} className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground">Configurar</button>
                </div>
              </div>
            );
          })}
          {brands.length === 0 && <p className="text-sm text-muted-foreground">Nenhum cliente cadastrado.</p>}
        </div>
      </div>

      <div className="surface space-y-3 rounded-2xl p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Envios recentes ao Workspace</h2>
        {dispatches.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum envio registrado até agora.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead className="text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">Título</th>
                  <th className="py-2 pr-3">Origem</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2">Data</th>
                </tr>
              </thead>
              <tbody>
                {dispatches.map((d) => (
                  <tr key={d.id} className="border-t border-border">
                    <td className="py-2 pr-3">{d.title}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{d.origin === "solicitacao" ? "Solicitação" : "Criação"}</td>
                    <td className="py-2 pr-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10.5px] ${d.status === "erro" ? "bg-destructive/15 text-destructive" : d.status === "enviado" ? "bg-reach-blue-soft text-reach-blue" : "bg-muted/60 text-muted-foreground"}`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="py-2 text-muted-foreground">{new Date(d.created_at).toLocaleString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && <ClientSettingsDrawer brand={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onChanged(); }} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dados institucionais da agência
// ---------------------------------------------------------------------------

function AgencyProfileSection() {
  const settings = useAppSettings();
  const [form, setForm] = useState({
    agency_name: "",
    agency_description: "",
    agency_email: "",
    agency_phone: "",
    agency_site: "",
    agency_address: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!settings) return;
    const s = settings as any;
    setForm({
      agency_name: s.agency_name ?? "",
      agency_description: s.agency_description ?? "",
      agency_email: s.agency_email ?? "",
      agency_phone: s.agency_phone ?? "",
      agency_site: s.agency_site ?? "",
      agency_address: s.agency_address ?? "",
    });
  }, [settings]);

  async function save() {
    setSaving(true);
    try {
      await saveAppSettings(form as any);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  const fields: { key: keyof typeof form; label: string; area?: boolean }[] = [
    { key: "agency_name", label: "Nome da agência" },
    { key: "agency_email", label: "E-mail institucional" },
    { key: "agency_phone", label: "Telefone" },
    { key: "agency_site", label: "Site" },
    { key: "agency_address", label: "Endereço" },
    { key: "agency_description", label: "Descrição institucional", area: true },
  ];

  return (
    <section className="surface space-y-4 rounded-2xl p-5">
      <div>
        <h2 className="text-sm font-semibold">Dados institucionais</h2>
        <p className="text-xs text-muted-foreground">Informações da Reach usadas em convites, relatórios e cabeçalhos.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <label key={f.key} className={cn("space-y-1", f.area && "sm:col-span-2")}>
            <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{f.label}</span>
            {f.area ? (
              <textarea
                rows={3}
                value={form[f.key]}
                onChange={(e) => setForm((v) => ({ ...v, [f.key]: e.target.value }))}
                className="w-full rounded-2xl border border-border bg-background/50 px-4 py-2.5 text-sm outline-none focus:border-primary"
              />
            ) : (
              <input
                value={form[f.key]}
                onChange={(e) => setForm((v) => ({ ...v, [f.key]: e.target.value }))}
                className="w-full rounded-full border border-border bg-background/50 px-4 py-2.5 text-sm outline-none focus:border-primary"
              />
            )}
          </label>
        ))}
      </div>
      <PillButton onClick={save} disabled={saving}>
        <Check className="h-4 w-4" /> {saved ? "Salvo" : saving ? "Salvando…" : "Salvar dados"}
      </PillButton>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Perfis e permissões
// ---------------------------------------------------------------------------

function PermissionsSection() {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [editing, setEditing] = useState<ProfileRow | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      const [p, r] = await Promise.all([listProfiles(), listUserRoles()]);
      setProfiles(p);
      setRoles(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao carregar permissões");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const roleOf = (id: string): AppRole => (roles.find((r) => r.user_id === id)?.role ?? "client");

  async function change(userId: string, role: AppRole) {
    setBusy(userId);
    setErr(null);
    try {
      await setUserRole(userId, role);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao atualizar papel");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="surface space-y-4 rounded-2xl p-5">
      <div>
        <h2 className="text-sm font-semibold">Perfis e permissões</h2>
        <p className="text-xs text-muted-foreground">
          Usuário → Organização (Reach) → Papel → Permissões. Abra o colaborador para configurar permissões detalhadas.
        </p>
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      <div className="space-y-2">
        {profiles.map((p) => (
          <div key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{p.display_name || p.email || "Sem nome"}</p>
              <p className="truncate text-xs text-muted-foreground">{p.email ?? "—"}{p.job_title ? ` · ${p.job_title}` : ""}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <select
                value={roleOf(p.id)}
                disabled={busy === p.id}
                onChange={(e) => change(p.id, e.target.value as AppRole)}
                className="rounded-full border border-border bg-background/50 px-3 py-1.5 text-xs outline-none"
              >
                {(Object.keys(ROLE_LABELS) as AppRole[]).map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
              <button onClick={() => setEditing(p)} className="rounded-full border border-border px-3 py-1.5 text-xs">
                Permissões
              </button>
            </div>
          </div>
        ))}
        {profiles.length === 0 && <p className="text-sm text-muted-foreground">Nenhum perfil encontrado.</p>}
      </div>

      {editing && (
        <ColaboradorDrawer
          profile={editing as ProfileRow & { active?: boolean }}
          role={roleOf(editing.id)}
          canManage
          onClose={() => setEditing(null)}
          onSaved={() => load()}
        />
      )}
    </section>
  );
}
