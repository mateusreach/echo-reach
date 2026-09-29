// Convite de um novo colaborador da agência — fonte única de verdade para
// esse fluxo (usado por Agência → Equipe e por Configurações → Equipe, que
// antes tinham dois caminhos diferentes: um convidava de verdade, o outro só
// criava um cartão de contato sem login).
import { useState } from "react";
import { PillButton } from "@/components/reach/ui";
import { FormModal } from "@/components/reach/form-modal";
import { Btn, Field, SelectInput, TextInput } from "@/components/ui-reach/primitives";
import {
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
  ROLE_LABELS,
  WORKSPACE_DENY_PERMISSION,
  modulePermissionKey,
  type AppRole,
  type PermissionAction,
  type PermissionKey,
} from "@/lib/agency-data";
import { inviteAgencyUser } from "@/lib/invites.functions";

export function AgencyInviteModal({ onClose, onInvited }: { onClose: () => void; onInvited: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<AppRole>("agency_member");
  const [jobTitle, setJobTitle] = useState("");
  const [perms, setPerms] = useState<PermissionKey[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const adminAll = role === "agency_admin";

  async function invite() {
    if (!email.trim() || !email.includes("@")) {
      setErr("Informe um e-mail válido.");
      return;
    }
    setSaving(true);
    setErr(null);
    setNotice(null);
    try {
      const result = await inviteAgencyUser({
        data: {
          email: email.trim(),
          name: name.trim() || undefined,
          role,
          jobTitle: jobTitle.trim() || undefined,
          permissions: adminAll ? [] : perms,
          redirectTo: `${window.location.origin}/auth`,
        },
      });
      if (result.linked) {
        setNotice(`${email} já tinha conta e foi vinculado à agência (nenhum e-mail de convite é necessário).`);
        onInvited();
      } else if (result.sent) {
        setNotice(`Convite enviado com sucesso para ${email}.`);
        onInvited();
      } else {
        // Falha real no envio: o convite fica pendente (pode ser reenviado),
        // mas nunca mostramos isso como sucesso.
        setErr(
          `O convite foi registrado, mas o e-mail NÃO pôde ser enviado${
            "warning" in result && result.warning ? `: ${result.warning}` : "."
          } Use "Reenviar" na lista de convites pendentes.`,
        );
        onInvited();
      }
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao convidar colaborador. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormModal
      title="Convidar colaborador"
      description="Ele recebe acesso à agência só depois de criar a conta com este e-mail."
      onClose={onClose}
      footer={
        done ? (
          <PillButton onClick={onClose}>Fechar</PillButton>
        ) : (
          <>
            <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
            <PillButton onClick={invite} disabled={saving}>{saving ? "Convidando…" : "Enviar convite"}</PillButton>
          </>
        )
      }
    >
      {err && <p className="rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">{err}</p>}
      {notice && <p className="rounded-2xl bg-success/10 p-3 text-sm text-success">{notice}</p>}

      <Field label="E-mail *">
        <TextInput autoFocus type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pessoa@agencia.com" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome"><TextInput value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Cargo / função"><TextInput value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} /></Field>
      </div>
      <Field label="Papel">
        <SelectInput value={role} onChange={(e) => setRole(e.target.value as AppRole)}>
          <option value="agency_admin">{ROLE_LABELS.agency_admin}</option>
          <option value="agency_member">{ROLE_LABELS.agency_member}</option>
        </SelectInput>
      </Field>

      {role === "agency_member" && <label className="flex items-center justify-between gap-3 rounded-md border border-border px-4 py-3 text-sm">
        <span>Permitir acesso ao Reach Workspace</span>
        <input type="checkbox" checked={!perms.includes(WORKSPACE_DENY_PERMISSION)} onChange={(event) => setPerms((current) => event.target.checked ? current.filter((permission) => permission !== WORKSPACE_DENY_PERMISSION) : [...new Set([...current, WORKSPACE_DENY_PERMISSION])])} className="h-4 w-4 accent-[var(--primary)]" />
      </label>}

      <section className="space-y-2 rounded-2xl border border-border p-4">
        <div>
          <h3 className="text-sm font-semibold">Permissões</h3>
          <p className="text-xs text-muted-foreground">
            {adminAll ? "Administrador da Agência possui todas as permissões automaticamente." : "O que este colaborador poderá gerenciar."}
          </p>
        </div>
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
                          disabled={adminAll}
                          onChange={(e) => setPerms((prev) => (e.target.checked ? [...prev, key] : prev.filter((k) => k !== key)))}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </FormModal>
  );
}
