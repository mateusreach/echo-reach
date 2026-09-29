import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, LogOut, Mail, Plus, Send, X } from "lucide-react";
import { ReachIconAnimation } from "@/components/reach/reach-icon-animation";
import { BrandShell } from "@/components/reach/brand-shell";
import { PageHeader } from "@/components/reach/page-header";
import { GlassCard } from "@/components/reach/glass-card";
import { Btn } from "@/components/ui-reach/primitives";
import { isViewingAsClient } from "@/lib/view-as";
import { supabase } from "@/integrations/supabase/client";
import {
  ACCESS_ROLES,
  addBrandMember,
  cancelBrandInvite,
  getBrandBySlug,
  getProfile,
  listBrandAccessLogs,
  listBrandInvites,
  listClientProfiles,
  removeBrandMember,
  updateBrandMemberAccess,
  updateBrand,
  type Brand,
  type BrandAccessLog,
  type BrandInvite,
  type Profile,
} from "@/lib/reach-data";
import { inviteBrandUser } from "@/lib/invites.functions";
import { ImageField, UploadButton } from "@/components/reach/uploader";
import { FormModal } from "@/components/reach/form-modal";
import { CLIENT_PERMISSION_MODULES, modulePermissionKey } from "@/lib/agency-data";
import { FramedImage } from "@/components/reach/framed-image";
import { FrameConfigButton } from "@/components/reach/image-crop-editor";
import { ColorPaletteEditor } from "@/components/reach/identidade-visual-section";
import { applySuggestedPalette, listMasterColors, saveSuggestedPalettes, type BrandIdentityColor } from "@/lib/identity-data";
import { generatePaletteSuggestions, type PaletteSuggestion } from "@/lib/color-extraction";
import { applyBrandColors, useTheme, type ThemeMode } from "@/lib/branding";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/b/$brandSlug/configuracoes")({
  component: ConfiguracoesPage,
  validateSearch: (search: Record<string, unknown>) => ({
    tab: typeof search.tab === "string" ? search.tab : undefined,
  }),
});

const PROFILES = ["Agência (owner)", "Estrategista", "Atendimento", "Designer", "Social Media", "Cliente"];
const INTEGRATIONS = ["Meta", "Google", "WhatsApp", "OpenAI", "Claude", "Google Drive", "Calendário", "E-mail", "Webhooks"];
const CLIENT_ACCESS_MODULES = CLIENT_PERMISSION_MODULES.filter((module) => ["plano", "biblioteca", "espaco360", "calendario", "referencias"].includes(module.key));
const DEFAULT_CLIENT_PERMISSIONS = [modulePermissionKey("espaco360", "visualizar")];

type Member = { user_id: string; member_role: string; name: string | null; email: string | null; created_at: string | null; permissions: string[]; is_admin: boolean };

function fmtDateTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function ConfiguracoesPage() {
  const { brandSlug } = Route.useParams();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const tab = search.tab ?? "informacoes";
  const [loading, setLoading] = useState(true);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [displayName, setDisplayName] = useState("Você");
  const [accountEmail, setAccountEmail] = useState("");
  const [isAgency, setIsAgency] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<BrandInvite[]>([]);
  const [logs, setLogs] = useState<BrandAccessLog[]>([]);
  const [clientProfiles, setClientProfiles] = useState<Profile[]>([]);
  const [adding, setAdding] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [editingAccess, setEditingAccess] = useState<Member | null>(null);

  async function refresh() {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) {
      navigate({ to: "/auth" });
      return;
    }
    setAccountEmail(session.user.email ?? "");
    const b = await getBrandBySlug(brandSlug);
    if (!b) {
      setLoading(false);
      return;
    }
    setBrand(b);
    const profile = await getProfile(session.user.id);
    const agency = profile?.role === "agency" && !isViewingAsClient();
    setIsAgency(agency);
    if (profile?.display_name) setDisplayName(profile.display_name);

    const { data, error: membersError } = await supabase
      .from("brand_members")
      .select("user_id, member_role, is_admin, permissions, created_at, profiles!brand_members_user_id_profiles_fkey(display_name, email)")
      .eq("brand_id", b.id);
    if (membersError) console.error("Falha ao carregar membros da marca:", membersError);
    setMembers(
      (data ?? []).map((m: any) => ({
        user_id: m.user_id,
        member_role: m.member_role,
        created_at: m.created_at ?? null,
        name: m.profiles?.display_name ?? null,
        email: m.profiles?.email ?? null,
        permissions: m.permissions ?? [],
        is_admin: !!m.is_admin,
      })),
    );

    const [inv, lg] = await Promise.all([
      listBrandInvites(b.id).catch(() => [] as BrandInvite[]),
      listBrandAccessLogs(b.id).catch(() => [] as BrandAccessLog[]),
    ]);
    setInvites(inv);
    setLogs(lg);

    if (agency) setClientProfiles(await listClientProfiles());
    setLoading(false);
  }

  useEffect(() => {
    setLoading(true);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandSlug]);

  const lastAccessByUser = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of logs) if (l.user_id && !map.has(l.user_id)) map.set(l.user_id, l.created_at);
    return map;
  }, [logs]);

  async function handleAddMember() {
    if (!brand || !selectedProfileId) return;
    await addBrandMember(brand.id, selectedProfileId, "client");
    setSelectedProfileId("");
    setAdding(false);
    refresh();
  }

  async function handleRemoveMember(userId: string) {
    if (!brand) return;
    await removeBrandMember(brand.id, userId);
    refresh();
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  const availableProfiles = clientProfiles.filter((p) => !members.some((m) => m.user_id === p.id));

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <ReachIconAnimation size={48} context="page-loading" />
        <p className="text-sm text-muted-foreground">Carregando Configurações…</p>
      </div>
    );
  }
  if (!brand) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <p className="text-lg font-semibold">Marca não encontrada</p>
      </div>
    );
  }

  const MOBILE_TABS = [
    ["informacoes", "Informações"],
    ["identidade", "Identidade"],
    ["acessos", "Acessos"],
    ["historico", "Histórico"],
    ["integracoes", "Integrações"],
    ["preferencias", "Preferências"],
  ] as const;

  return (
    <BrandShell basePath={`/b/${brandSlug}`} displayName={displayName} primaryColor={(brand as any)?.primary_color} accentColor={(brand as any)?.accent_color}>
      <PageHeader eyebrow="Administração" title="Configurações" description={`Cadastro, identidade, usuários, acessos e integrações de ${brand.name}.`} />

      <GlassCard level={1} className="mb-6 flex flex-wrap gap-1 p-1 lg:hidden">
        {MOBILE_TABS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => navigate({ to: "/b/$brandSlug/configuracoes", params: { brandSlug }, search: { tab: key } })}
            className={tab === key ? "rounded-xl bg-reach-coral px-3 py-1.5 text-[12.5px] font-medium text-primary-foreground" : "rounded-xl px-3 py-1.5 text-[12.5px] text-muted-foreground hover:bg-muted"}
          >
            {label}
          </button>
        ))}
      </GlassCard>

      {tab === "informacoes" && <BrandInfoCard brand={brand} canEdit={isAgency} onSaved={refresh} />}

      {tab === "identidade" && <BrandIdentityCard brand={brand} canEdit={isAgency} onSaved={refresh} />}

      {tab === "acessos" && (
        <div className="space-y-6">
          <GlassCard level={2} className="p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-title">Usuários com acesso a {brand.name}</h2>
                <p className="text-[12.5px] text-muted-foreground">Perfil, status e último acesso de cada pessoa.</p>
              </div>
              {isAgency && !adding && availableProfiles.length > 0 && (
                <Btn variant="outline" size="sm" onClick={() => setAdding(true)}>
                  <Plus className="h-3.5 w-3.5" /> Vincular pessoa existente
                </Btn>
              )}
            </div>

            {adding && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <select value={selectedProfileId} onChange={(e) => setSelectedProfileId(e.target.value)} className="input-reach min-w-0 flex-1">
                  <option value="">Selecione um usuário-cliente</option>
                  {availableProfiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.display_name ?? p.id}</option>
                  ))}
                </select>
                <Btn size="sm" onClick={handleAddMember} disabled={!selectedProfileId}>Vincular</Btn>
                <Btn size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancelar</Btn>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[12.5px]">
                <thead>
                  <tr className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Nome</th>
                    <th className="py-2 pr-4 font-medium">E-mail</th>
                    <th className="py-2 pr-4 font-medium">Perfil</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Último acesso</th>
                    <th className="py-2 pr-4 font-medium">Criado em</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {members.map((m) => (
                    <tr key={m.user_id}>
                      <td className="py-2.5 pr-4">{m.name ?? "—"}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{m.email ?? "—"}</td>
                      <td className="py-2.5 pr-4">{m.member_role === "agency" ? "Agência" : m.member_role === "viewer" ? "Visualizador" : "Cliente"}</td>
                      <td className="py-2.5 pr-4">
                        <span className="rounded-full bg-reach-mint-soft px-2.5 py-0.5 text-[11px] text-reach-mint">Ativo</span>
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{fmtDateTime(lastAccessByUser.get(m.user_id))}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{fmtDateTime(m.created_at)}</td>
                      <td className="py-2.5 text-right">
                        {isAgency && (
                          <div className="flex items-center justify-end gap-3">
                            <button type="button" onClick={() => setEditingAccess(m)} className="text-xs text-primary hover:underline">Permissões</button>
                            <button onClick={() => handleRemoveMember(m.user_id)} aria-label="Remover acesso" className="text-muted-foreground hover:text-reach-rose">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {invites.filter((i) => i.status === "pendente").map((i) => (
                    <tr key={i.id} className="opacity-80">
                      <td className="py-2.5 pr-4">{i.name ?? "—"}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{i.email}</td>
                      <td className="py-2.5 pr-4">{ACCESS_ROLES.find((r) => r.key === i.member_role)?.label ?? i.member_role}</td>
                      <td className="py-2.5 pr-4">
                        <span className="rounded-full bg-reach-amber-soft px-2.5 py-0.5 text-[11px] text-reach-amber">Convite pendente</span>
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">—</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{fmtDateTime(i.created_at)}</td>
                      <td className="py-2.5 text-right">
                        {isAgency && (
                          <button
                            onClick={async () => {
                              await cancelBrandInvite(i.id);
                              refresh();
                            }}
                            aria-label="Cancelar convite"
                            className="text-muted-foreground hover:text-reach-rose"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {members.length === 0 && invites.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-4 text-muted-foreground">Nenhum usuário vinculado a este cliente ainda.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>

          {isAgency && <InviteCard brandId={brand.id} onInvited={refresh} />}
          {isAgency && editingAccess && <MemberAccessEditor member={editingAccess} brandId={brand.id} onClose={() => setEditingAccess(null)} onSaved={() => { setEditingAccess(null); void refresh(); }} />}

          <GlassCard level={2} className="p-6">
            <h2 className="text-title mb-3">Perfis de permissão</h2>
            <div className="flex flex-wrap gap-2">
              {PROFILES.map((p) => (
                <span key={p} className="rounded-full border border-border bg-card px-3 py-1 text-[12px]">{p}</span>
              ))}
            </div>
          </GlassCard>
        </div>
      )}

      {tab === "historico" && (
        <GlassCard level={2} className="p-6">
          <h2 className="text-title mb-1">Histórico de acessos</h2>
          <p className="mb-4 text-[12.5px] text-muted-foreground">Registros de entrada no ambiente deste cliente.</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-[12.5px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Usuário</th>
                  <th className="py-2 pr-4 font-medium">Data e hora</th>
                  <th className="py-2 pr-4 font-medium">Evento</th>
                  <th className="py-2 pr-4 font-medium">Contexto</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td className="py-2.5 pr-4">{l.user_email ?? l.user_id ?? "—"}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{fmtDateTime(l.created_at)}</td>
                    <td className="py-2.5 pr-4 capitalize">{l.event}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{l.context ?? "—"}</td>
                    <td className="py-2.5">
                      <span className="rounded-full bg-reach-mint-soft px-2.5 py-0.5 text-[11px] capitalize text-reach-mint">{l.status}</span>
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-muted-foreground">Nenhum acesso registrado ainda.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {tab === "integracoes" && (
        <GlassCard level={2} className="p-6">
          <h2 className="text-title mb-1">Integrações</h2>
          <p className="mb-4 text-[12.5px] text-muted-foreground">Serviços conectados ao ambiente deste cliente.</p>
          <div className="flex flex-wrap gap-2">
            {INTEGRATIONS.map((i) => (
              <span key={i} className="rounded-full bg-reach-blue-soft px-3 py-1 text-[12px] text-reach-blue">{i}</span>
            ))}
          </div>
        </GlassCard>
      )}

      {tab === "preferencias" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <GlassCard level={2} className="p-6">
            <h2 className="text-title mb-3">Aparência</h2>
            <p className="mb-3 text-[12.5px] text-muted-foreground">Escolha como a plataforma é exibida para você neste dispositivo.</p>
            <ThemePicker />
          </GlassCard>
          <GlassCard level={2} className="p-6">
            <h2 className="text-title mb-3">Sua conta</h2>
            <p className="text-[13px]">{accountEmail}</p>
            <p className="mt-1 text-[11.5px] capitalize text-muted-foreground">{isAgency ? "Agência" : "Cliente"}</p>
            <Btn variant="outline" size="sm" className="mt-4" onClick={handleSignOut}>
              <LogOut className="h-3.5 w-3.5" /> Sair
            </Btn>
          </GlassCard>
        </div>
      )}
    </BrandShell>
  );
}

function MemberAccessEditor({ member, brandId, onClose, onSaved }: {
  member: Member;
  brandId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [permissions, setPermissions] = useState<string[]>(member.permissions);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await updateBrandMemberAccess(brandId, member.user_id, { permissions });
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar as permissões.");
    } finally {
      setSaving(false);
    }
  }

  return <FormModal title={`Acesso de ${member.name ?? member.email ?? "cliente"}`} description="Defina o que esta pessoa pode visualizar neste cliente." onClose={onClose} size="md" footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar acesso"}</Btn></>}>
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    <div className="space-y-2">
      {CLIENT_ACCESS_MODULES.map((module) => {
        const key = modulePermissionKey(module.key, "visualizar");
        return <label key={module.key} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm">
          <span>{module.label}</span>
          <input type="checkbox" checked={permissions.includes(key)} onChange={(event) => setPermissions((current) => event.target.checked ? [...new Set([...current, key])] : current.filter((permission) => permission !== key && !permission.startsWith(`${module.key}.`)))} className="h-4 w-4 accent-[var(--primary)]" />
        </label>;
      })}
    </div>
    <label className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm">
      <input type="checkbox" checked={permissions.includes("biblioteca.criar")} onChange={(event) => setPermissions((current) => event.target.checked ? [...new Set([...current, "biblioteca.visualizar", "biblioteca.criar"])] : current.filter((permission) => permission !== "biblioteca.criar"))} className="h-4 w-4 accent-[var(--primary)]" />
      Pode sugerir ideias no Banco de Ideias
    </label>
  </FormModal>;
}

/** Convite de acesso ao ambiente do cliente, usando a autenticação do sistema. */
function InviteCard({ brandId, onInvited }: { brandId: string; onInvited: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"agency" | "client" | "viewer">("client");
  const [permissions, setPermissions] = useState<string[]>(DEFAULT_CLIENT_PERMISSIONS);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setSending(true);
    setError(null);
    setMessage(null);
    try {
      const result = await inviteBrandUser({
        data: { brandId, email: email.trim(), name: name.trim() || undefined, role, permissions, redirectTo: `${window.location.origin}/auth` },
      });
      if (result.linked) setMessage("Essa pessoa já tinha conta — o acesso foi liberado imediatamente.");
      else if (result.sent) setMessage("Convite enviado por e-mail.");
      else setMessage(`Convite registrado, mas o e-mail não pôde ser enviado: ${(result as any).warning ?? "verifique o envio de e-mails."}`);
      setName("");
      setEmail("");
      onInvited();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar o convite.");
    } finally {
      setSending(false);
    }
  }

  return (
    <GlassCard level={2} className="p-6">
      <h2 className="text-title mb-1 inline-flex items-center gap-2">
        <Mail className="h-4 w-4 text-reach-coral" /> Convidar usuário
      </h2>
      <p className="mb-4 text-[12.5px] text-muted-foreground">
        A pessoa recebe um e-mail e entra pelo mesmo fluxo de autenticação do Reach Brand.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <input className="input-reach" placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input-reach" placeholder="e-mail@cliente.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <select className="input-reach" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
          {ACCESS_ROLES.map((r) => (
            <option key={r.key} value={r.key}>{r.label}</option>
          ))}
        </select>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        {CLIENT_ACCESS_MODULES.map((module) => {
          const key = modulePermissionKey(module.key, "visualizar");
          return <label key={module.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" checked={permissions.includes(key)} onChange={(event) => setPermissions((current) => event.target.checked ? [...new Set([...current, key])] : current.filter((permission) => permission !== key && !permission.startsWith(`${module.key}.`)))} className="h-4 w-4 accent-[var(--primary)]" /> {module.label}
          </label>;
        })}
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={permissions.includes("biblioteca.criar")} onChange={(event) => setPermissions((current) => event.target.checked ? [...new Set([...current, "biblioteca.visualizar", "biblioteca.criar"])] : current.filter((permission) => permission !== "biblioteca.criar"))} className="h-4 w-4 accent-[var(--primary)]" /> Sugerir ideias
        </label>
      </div>
      {error && <p className="mt-3 text-[12px] text-destructive">{error}</p>}
      {message && <p className="mt-3 text-[12px] text-reach-mint">{message}</p>}
      <Btn size="sm" className="mt-4" onClick={send} disabled={sending || !email.trim()}>
        <Send className="h-3.5 w-3.5" /> {sending ? "Enviando…" : "Enviar convite"}
      </Btn>
    </GlassCard>
  );
}

/** Dados cadastrais do cliente. */
function BrandInfoCard({ brand, canEdit, onSaved }: { brand: Brand; canEdit: boolean; onSaved: () => void }) {
  const extra = brand as Brand & { contact_name?: string | null; contact_email?: string | null; notes?: string | null };
  const [name, setName] = useState(brand.name);
  const [segment, setSegment] = useState(brand.segment ?? "");
  const [contactName, setContactName] = useState(extra.contact_name ?? "");
  const [contactEmail, setContactEmail] = useState(extra.contact_email ?? "");
  const [description, setDescription] = useState(brand.description ?? "");
  const [notes, setNotes] = useState(extra.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await updateBrand(brand.id, {
        name,
        segment: segment || null,
        contact_name: contactName || null,
        contact_email: contactEmail || null,
        description: description || null,
        notes: notes || null,
      } as any);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar os dados do cliente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <GlassCard level={2} className="p-6">
      <h2 className="text-title mb-1">Informações do cliente</h2>
      <p className="mb-4 text-[12.5px] text-muted-foreground">Dados cadastrais usados em todo o ambiente deste cliente.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-label mb-1.5 block">Nome</span>
          <input className="input-reach w-full" disabled={!canEdit} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-label mb-1.5 block">Segmento</span>
          <input className="input-reach w-full" disabled={!canEdit} value={segment} onChange={(e) => setSegment(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-label mb-1.5 block">Contato principal</span>
          <input className="input-reach w-full" disabled={!canEdit} value={contactName} onChange={(e) => setContactName(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-label mb-1.5 block">E-mail de contato</span>
          <input className="input-reach w-full" disabled={!canEdit} value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
        </label>
      </div>
      <label className="mt-4 block">
        <span className="text-label mb-1.5 block">Descrição</span>
        <textarea className="input-reach min-h-20 w-full" disabled={!canEdit} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <label className="mt-4 block">
        <span className="text-label mb-1.5 block">Observações internas</span>
        <textarea className="input-reach min-h-20 w-full" disabled={!canEdit} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      {error && <p className="mt-3 text-[12px] text-destructive">{error}</p>}
      {canEdit && (
        <Btn size="sm" className="mt-4" onClick={save} disabled={saving}>
          {saving ? "Salvando…" : "Salvar informações"}
        </Btn>
      )}
    </GlassCard>
  );
}

function ThemePicker() {
  const theme = useTheme();
  return (
    <div className="inline-flex gap-1 rounded-full border border-border bg-card p-1">
      {([["dark", "Escuro"], ["light", "Claro"], ["auto", "Automático"]] as const).map(([k, label]) => (
        <button
          key={k}
          onClick={() => theme.change(k as ThemeMode)}
          className={theme.mode === k ? "rounded-full bg-reach-coral px-3.5 py-1.5 text-[12px] font-medium text-primary-foreground" : "rounded-full px-3.5 py-1.5 text-[12px] text-muted-foreground hover:text-foreground"}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Identidade visual do cliente — uma marca, uma logo, várias aplicações.
 * O avatar circular NÃO é um segundo arquivo: é uma configuração de
 * enquadramento (logo_frame) sobre a própria logo. A capa é o único outro
 * ativo central, com seu próprio enquadramento (cover_frame). Cores ficam
 * numa seção própria, reaproveitando a mesma paleta estruturada usada em
 * Acabamento da Marca → Identidade Visual (brand_identity_colors) — não é
 * um componente novo. */
export function BrandIdentityCard({ brand, canEdit, onSaved }: { brand: Brand; canEdit: boolean; onSaved: () => void }) {
  const extra = brand as Brand & {
    primary_color?: string | null;
    accent_color?: string | null;
    cover_url?: string | null;
    logo_frame?: unknown;
    cover_frame?: unknown;
  };
  const [logo, setLogo] = useState<string | null>(brand.logo_url ?? null);
  const [logoFrame, setLogoFrame] = useState<unknown>(extra.logo_frame ?? null);
  const [cover, setCover] = useState<string | null>(extra.cover_url ?? null);
  const [coverFrame, setCoverFrame] = useState<unknown>(extra.cover_frame ?? null);
  const [primary, setPrimary] = useState(extra.primary_color ?? "");
  const [accent, setAccent] = useState(extra.accent_color ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function persist(patch: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      await updateBrand(brand.id, patch as any);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function saveMedia() {
    await persist({ logo_url: logo, logo_frame: logoFrame, cover_url: cover, cover_frame: coverFrame });
  }

  async function saveColors() {
    await persist({ primary_color: primary || null, accent_color: accent || null });
    applyBrandColors(primary || null, accent || null);
  }

  return (
    <div className="space-y-5">
      <GlassCard level={2} className="p-6">
        <h2 className="text-title mb-1">Mídia da marca</h2>
        <p className="mb-4 text-[12.5px] text-muted-foreground">A logo oficial é a única fonte — o avatar circular é apenas uma aplicação dela.</p>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <span className="text-label mb-1.5 block">Logo</span>
            <p className="mb-2 text-[11px] text-muted-foreground">Proporção original preservada, sem recorte automático.</p>
            <div className="flex items-start gap-4">
              <ImageField value={logo} folder={`marcas/${brand.slug}`} canEdit={canEdit} onChange={(url) => { setLogo(url); setLogoFrame(null); }} previewClassName="h-20 w-20 rounded-2xl object-contain" />
              {logo && (
                <div className="space-y-1.5 pt-1 text-center">
                  <FramedImage src={logo} frame={logoFrame} shape="circle" className="h-16 w-16 border border-border" alt="Prévia do avatar" />
                  <p className="text-[10px] text-muted-foreground">como avatar</p>
                </div>
              )}
            </div>
            {logo && <LogoBackgroundPreview src={logo} />}
            {canEdit && logo && (
              <div className="mt-2">
                <FrameConfigButton
                  src={logo}
                  shape="circle"
                  aspect={1}
                  frame={logoFrame}
                  label="Ajustar aplicação"
                  recommendedLabel="Como esta logo aparece em avatares e ícones circulares pelo sistema."
                  onSave={(f) => { setLogoFrame(f); persist({ logo_frame: f }); }}
                />
              </div>
            )}
          </div>

          <div>
            <span className="text-label mb-1.5 block">Capa</span>
            <p className="mb-2 text-[11px] text-muted-foreground">Tamanho recomendado: 1600 × 400px · Proporção 4:1 — usada no topo da página do cliente e do Espaço 360.</p>
            {cover ? (
              <FramedImage src={cover} frame={coverFrame} shape="rect" className="mb-2 h-20 w-full rounded-xl border border-border" />
            ) : (
              <div className="mb-2 grid h-20 w-full place-items-center rounded-xl border border-dashed border-border text-muted-foreground">
                <ImagePlus className="h-5 w-5" />
              </div>
            )}
            {canEdit && (
              <div className="flex flex-wrap items-center gap-2">
                <UploadButton
                  folder={`marcas/${brand.slug}`}
                  multiple={false}
                  accept="image/*"
                  label={cover ? "Trocar capa" : "Enviar capa"}
                  onUploaded={(files) => { if (files[0]) { setCover(files[0].url); setCoverFrame(null); } }}
                />
                {cover && (
                  <FrameConfigButton
                    src={cover}
                    shape="rect"
                    aspect={4}
                    frame={coverFrame}
                    label="Ajustar enquadramento"
                    recommendedLabel="Tamanho recomendado: 1600 × 400px · Proporção 4:1"
                    onSave={(f) => { setCoverFrame(f); persist({ cover_frame: f }); }}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {error && <p className="mt-3 text-[12px] text-destructive">{error}</p>}
        {canEdit && (logo !== (brand.logo_url ?? null) || cover !== (extra.cover_url ?? null)) && (
          <Btn size="sm" className="mt-4" onClick={saveMedia} disabled={saving}>
            {saving ? "Salvando…" : "Salvar mídia"}
          </Btn>
        )}
      </GlassCard>

      <GlassCard level={2} className="p-6">
        <h2 className="text-title mb-1">Paleta da marca</h2>
        <p className="mb-4 text-[12.5px] text-muted-foreground">Identidade cromática do cliente — extraída automaticamente da logo e da capa, não confundir com os temas oficiais da Reach.</p>

        <SuggestedPaletteSection brand={brand} logo={logo} cover={cover} canEdit={canEdit} onApplied={onSaved} />

        <div className="mt-5 border-t border-border pt-4">
          <p className="text-label mb-2">Paleta ativa</p>
          <BrandColorPalette brandId={brand.id} canEdit={canEdit} />
        </div>

        <div className="mt-5 border-t border-border pt-4">
          <p className="text-label mb-2">Cor da interface neste ambiente</p>
          <p className="mb-2 text-[11px] text-muted-foreground">Controla a cor de destaque do sistema quando alguém está neste cliente — diferente da paleta da marca acima.</p>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2">
              <input type="color" disabled={!canEdit} value={primary || "#2f6be0"} onChange={(e) => setPrimary(e.target.value)} className="h-8 w-8 cursor-pointer rounded-lg border border-border" />
              <span className="text-[12px] text-muted-foreground">Principal</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="color" disabled={!canEdit} value={accent || "#a855f7"} onChange={(e) => setAccent(e.target.value)} className="h-8 w-8 cursor-pointer rounded-lg border border-border" />
              <span className="text-[12px] text-muted-foreground">Destaque</span>
            </label>
            {canEdit && (primary !== (extra.primary_color ?? "") || accent !== (extra.accent_color ?? "")) && (
              <Btn size="sm" onClick={saveColors} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Btn>
            )}
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

/** Sugestões de paleta geradas a partir da logo/capa — nunca sobrescreve
 * uma escolha manual sem confirmação (item 21 do pedido): se os ativos
 * mudarem depois de já existir uma paleta ativa, avisa em vez de recalcular
 * sozinho. */
function SuggestedPaletteSection({
  brand,
  logo,
  cover,
  canEdit,
  onApplied,
}: {
  brand: Brand;
  logo: string | null;
  cover: string | null;
  canEdit: boolean;
  onApplied: () => void;
}) {
  const cached = (brand as any).suggested_palettes as PaletteSuggestion[] | null;
  const [palettes, setPalettes] = useState<PaletteSuggestion[]>(cached ?? []);
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [staleAssets, setStaleAssets] = useState(false);
  const generatedFor = useRef({ logo, cover });

  useEffect(() => {
    if (palettes.length > 0 && (generatedFor.current.logo !== logo || generatedFor.current.cover !== cover)) {
      setStaleAssets(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logo, cover]);

  async function generate() {
    if (!logo && !cover) return;
    setGenerating(true);
    setError(null);
    try {
      const suggestions = await generatePaletteSuggestions({ logoUrl: logo, coverUrl: cover });
      setPalettes(suggestions);
      setStaleAssets(false);
      generatedFor.current = { logo, cover };
      await saveSuggestedPalettes(brand.id, suggestions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível analisar as imagens.");
    } finally {
      setGenerating(false);
    }
  }

  async function apply(index: number) {
    setApplying(index);
    setError(null);
    try {
      await applySuggestedPalette(brand.id, palettes[index].colors);
      onApplied();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível aplicar a paleta.");
    } finally {
      setApplying(null);
    }
  }

  if (!logo && !cover) {
    return <p className="text-xs text-muted-foreground">Envie a logo ou a capa para o sistema sugerir uma paleta automaticamente.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {canEdit && (
          <Btn size="sm" onClick={generate} disabled={generating}>
            {generating ? "Analisando imagens…" : palettes.length > 0 ? "Recalcular sugestões" : "Gerar sugestões"}
          </Btn>
        )}
        {staleAssets && (
          <span className="rounded-full bg-warning/12 px-2.5 py-1 text-[11px] text-warning">Novas cores identificadas nos ativos — atualize as sugestões.</span>
        )}
      </div>
      {error && <p className="text-[11px] text-destructive">{error}</p>}
      {palettes.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {palettes.map((p, i) => (
            <div key={p.name} className="rounded-2xl border border-border p-3">
              <p className="text-[12.5px] font-medium">{p.name}</p>
              <p className="mb-2 text-[10.5px] text-muted-foreground">{p.description}</p>
              <div className="mb-2 flex gap-1">
                {p.colors.map((c) => (
                  <span key={c.hex} className="h-6 flex-1 rounded-md border border-border" style={{ backgroundColor: c.hex }} title={c.hex} />
                ))}
              </div>
              {canEdit && (
                <button
                  onClick={() => apply(i)}
                  disabled={applying !== null}
                  className="w-full rounded-full border border-border px-2.5 py-1 text-[11px] transition-colors hover:bg-muted"
                >
                  {applying === i ? "Aplicando…" : "Usar esta paleta"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Confere se a logo (especialmente com fundo transparente) permanece
 * legível sobre diferentes fundos — claro, escuro e a cor da própria marca. */
function LogoBackgroundPreview({ src }: { src: string }) {
  const [bg, setBg] = useState<"claro" | "escuro" | "marca">("claro");
  const bgStyle = bg === "claro" ? "#ffffff" : bg === "escuro" ? "#1a1a1a" : "var(--primary)";
  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="grid h-12 w-16 shrink-0 place-items-center rounded-lg border border-border p-1.5" style={{ backgroundColor: bgStyle }}>
        <img src={src} alt="" className="max-h-full max-w-full object-contain" />
      </div>
      <div className="flex gap-1">
        {(["claro", "escuro", "marca"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setBg(k)}
            className={cn(
              "rounded-full border px-2 py-1 text-[10px] transition-colors",
              bg === k ? "border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}

function BrandColorPalette({ brandId, canEdit }: { brandId: string; canEdit: boolean }) {
  const [colors, setColors] = useState<BrandIdentityColor[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setColors(await listMasterColors(brandId));
    setLoading(false);
  }

  useEffect(() => {
    refresh().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

  if (loading) return <p className="text-xs text-muted-foreground">Carregando paleta…</p>;
  return <ColorPaletteEditor brandId={brandId} channelId={null} colors={colors} canEdit={canEdit} onChanged={refresh} />;
}
