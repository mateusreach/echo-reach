// Perfil completo do colaborador: dados, cargo, papel, status e permissões.
// Agência → Equipe → Colaborador → Permissões.
import { useEffect, useState } from "react";
import { PillButton } from "@/components/reach/ui";
import { AvatarField } from "@/components/reach/uploader";
import { FormModal } from "@/components/reach/form-modal";
import { Btn, Field, SelectInput, TextInput } from "@/components/ui-reach/primitives";
import {
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
  ROLE_LABELS,
  WORKSPACE_DENY_PERMISSION,
  listUserPermissions,
  modulePermissionKey,
  setUserPermissions,
  setUserRole,
  updateProfileRow,
  type AppRole,
  type PermissionAction,
  type PermissionKey,
  type ProfileRow,
} from "@/lib/agency-data";

export function ColaboradorDrawer({
  profile,
  role,
  canManage,
  onClose,
  onSaved,
}: {
  profile: ProfileRow & { active?: boolean };
  role: AppRole;
  canManage: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(profile.display_name ?? "");
  const [jobTitle, setJobTitle] = useState(profile.job_title ?? "");
  const [avatar, setAvatar] = useState<string | null>(profile.avatar_url);
  const [active, setActive] = useState(profile.active !== false);
  const [nextRole, setNextRole] = useState<AppRole>(role);
  const [perms, setPerms] = useState<PermissionKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    listUserPermissions(profile.id)
      .then((rows) => setPerms(rows.map((r) => r.permission)))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [profile.id]);

  const adminAll = nextRole === "agency_admin";

  async function save() {
    setSaving(true);
    setErr(null);
    setNotice(null);
    try {
      await updateProfileRow(profile.id, {
        display_name: name.trim() || null,
        job_title: jobTitle.trim() || null,
        avatar_url: avatar,
        active,
      });
      if (canManage) {
        if (nextRole !== role) await setUserRole(profile.id, nextRole);
        await setUserPermissions(profile.id, adminAll ? [] : perms);
      }
      setNotice("Alterações salvas.");
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao salvar colaborador");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormModal
      title={profile.display_name || profile.email || "Colaborador"}
      description={profile.email ?? undefined}
      onClose={onClose}
      size="lg"
      footer={
        canManage ? (
          <>
            <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
            <PillButton onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar colaborador"}</PillButton>
          </>
        ) : undefined
      }
    >
      {err && <p className="text-sm text-destructive">{err}</p>}
      {notice && <p className="text-sm text-success">{notice}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome"><TextInput value={name} onChange={(e) => setName(e.target.value)} disabled={!canManage} /></Field>
        <Field label="Cargo / função"><TextInput value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} disabled={!canManage} /></Field>
        <Field label="Papel">
          <SelectInput value={nextRole} onChange={(e) => setNextRole(e.target.value as AppRole)} disabled={!canManage}>
            {(Object.keys(ROLE_LABELS) as AppRole[]).map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Situação">
          <SelectInput value={active ? "ativo" : "inativo"} onChange={(e) => setActive(e.target.value === "ativo")} disabled={!canManage}>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </SelectInput>
        </Field>
        <div className="sm:col-span-2">
          <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Foto</span>
          <AvatarField value={avatar} onChange={setAvatar} canEdit={canManage} />
        </div>
      </div>

      {nextRole !== "client" && <label className="flex items-center justify-between gap-3 rounded-md border border-border px-4 py-3 text-sm">
        <span>Permitir acesso ao Reach Workspace</span>
        <input type="checkbox" checked={adminAll || !perms.includes(WORKSPACE_DENY_PERMISSION)} disabled={adminAll || !canManage} onChange={(event) => setPerms((current) => event.target.checked ? current.filter((permission) => permission !== WORKSPACE_DENY_PERMISSION) : [...new Set([...current, WORKSPACE_DENY_PERMISSION])])} className="h-4 w-4 accent-[var(--primary)]" />
      </label>}

      <section className="space-y-2 rounded-2xl border border-border p-4">
        <div>
          <h3 className="text-sm font-semibold">Permissões</h3>
          <p className="text-xs text-muted-foreground">
            {adminAll
              ? "Administrador da Agência possui todas as permissões automaticamente."
              : "Defina o que este colaborador pode gerenciar dentro do sistema."}
          </p>
        </div>
        {loading ? (
          <p className="text-xs text-muted-foreground">Carregando permissões…</p>
        ) : (
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
                {PERMISSION_MODULES.map((m) => (
                  <tr key={m.key} className="border-t border-border">
                    <td className="p-1.5 font-medium">{m.label}</td>
                    {PERMISSION_ACTIONS.map((a) => {
                      const applicable = m.actions.includes(a.key as PermissionAction);
                      if (!applicable) return <td key={a.key} className="p-1.5 text-center text-muted-foreground/30">—</td>;
                      const key: PermissionKey = modulePermissionKey(m.key, a.key as PermissionAction);
                      return (
                        <td key={a.key} className="p-1.5 text-center">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-[var(--primary)]"
                            checked={adminAll || perms.includes(key)}
                            disabled={adminAll || !canManage || nextRole === "client"}
                            onChange={(e) =>
                              setPerms((prev) => (e.target.checked ? [...prev, key] : prev.filter((k) => k !== key)))
                            }
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </FormModal>
  );
}
