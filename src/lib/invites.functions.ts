import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inviteSchema = z.object({
  brandId: z.string().uuid(),
  email: z.string().email(),
  name: z.string().trim().max(120).optional(),
  role: z.enum(["agency", "client", "viewer"]).default("client"),
  isAdmin: z.boolean().optional(),
  permissions: z.array(z.string()).optional(),
  redirectTo: z.string().url(),
});

/** Assunto/mensagem personalizados (Configurações → Convites) da organização
 * do convite, já com as variáveis substituídas — usados como metadata do
 * convite e preparados para uso futuro por um provedor de e-mail próprio. */
async function buildInviteEmailData(
  supabaseAdmin: any,
  organizationId: string | null,
  kind: "colaborador" | "cliente",
  vars: Record<string, string>,
) {
  const { renderInviteTemplate, DEFAULT_INVITE_COLABORADOR_SUBJECT, DEFAULT_INVITE_COLABORADOR_BODY, DEFAULT_INVITE_CLIENTE_SUBJECT, DEFAULT_INVITE_CLIENTE_BODY } = await import(
    "@/lib/branding"
  );
  let subjectTemplate = kind === "colaborador" ? DEFAULT_INVITE_COLABORADOR_SUBJECT : DEFAULT_INVITE_CLIENTE_SUBJECT;
  let bodyTemplate = kind === "colaborador" ? DEFAULT_INVITE_COLABORADOR_BODY : DEFAULT_INVITE_CLIENTE_BODY;
  if (organizationId) {
    const { data: settings } = await supabaseAdmin.from("app_settings").select("*").eq("organization_id", organizationId).maybeSingle();
    if (settings) {
      const subjectKey = kind === "colaborador" ? "invite_colaborador_subject" : "invite_cliente_subject";
      const bodyKey = kind === "colaborador" ? "invite_colaborador_body" : "invite_cliente_body";
      subjectTemplate = (settings as any)[subjectKey] || subjectTemplate;
      bodyTemplate = (settings as any)[bodyKey] || bodyTemplate;
    }
  }
  return {
    invite_subject: renderInviteTemplate(subjectTemplate, vars),
    invite_body: renderInviteTemplate(bodyTemplate, vars),
    display_name: vars.nome || vars.email,
  };
}

/**
 * Convida uma pessoa para o ambiente do cliente. Reutiliza a autenticação
 * existente do sistema: o e-mail leva a pessoa para o fluxo de login/definição
 * de senha e, ao criar a conta, ela é vinculada automaticamente à marca.
 */
export const inviteBrandUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inviteSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: profile } = await (context.supabase as any)
      .from("profiles")
      .select("role, organization_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (profile?.role !== "agency") {
      throw new Error("Apenas a agência pode convidar usuários.");
    }

    // Isolamento entre agências: nunca confiar apenas no papel "agency" —
    // é preciso confirmar que o cliente (brandId) pertence à MESMA
    // organização de quem está convidando, senão uma agência poderia
    // convidar gente para o cliente de outra agência.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: targetBrand } = await (supabaseAdmin as any)
      .from("brands")
      .select("id, name, organization_id")
      .eq("id", data.brandId)
      .maybeSingle();
    if (!targetBrand || !profile.organization_id || targetBrand.organization_id !== profile.organization_id) {
      throw new Error("Cliente não encontrado na sua organização.");
    }

    const { error: inviteError } = await (context.supabase as any).from("brand_invites").upsert(
      {
        brand_id: data.brandId,
        email: data.email.toLowerCase(),
        name: data.name ?? null,
        member_role: data.role,
        status: "pendente",
        invited_by: context.userId,
        organization_id: profile.organization_id,
        is_admin: data.isAdmin ?? false,
        permissions: data.permissions ?? [],
      },
      { onConflict: "brand_id,email" },
    );
    if (inviteError) throw new Error(inviteError.message);

    // Se a pessoa já tem conta, basta vincular ao cliente.
    const { data: existing } = await (supabaseAdmin as any)
      .from("profiles")
      .select("id")
      .eq("email", data.email.toLowerCase())
      .maybeSingle();

    if (existing?.id) {
      await (supabaseAdmin as any)
        .from("brand_members")
        .upsert(
          {
            brand_id: data.brandId,
            user_id: existing.id,
            member_role: data.role,
            is_admin: data.isAdmin ?? false,
            permissions: data.permissions ?? [],
          },
          { onConflict: "brand_id,user_id" },
        );
      await (supabaseAdmin as any)
        .from("brand_invites")
        .update({ status: "aceito", accepted_at: new Date().toISOString() })
        .eq("brand_id", data.brandId)
        .eq("email", data.email.toLowerCase());
      return { sent: false, linked: true as const };
    }

    const { data: orgRowForBrandInvite } = await (supabaseAdmin as any).from("organizations").select("name").eq("id", profile.organization_id).maybeSingle();
    const emailData = await buildInviteEmailData(supabaseAdmin, profile.organization_id, "cliente", {
      nome: data.name ?? data.email,
      agencia: orgRowForBrandInvite?.name ?? "",
      email: data.email,
      link_convite: data.redirectTo,
      cliente: targetBrand ? String((targetBrand as any).name ?? "") : "",
      cargo: "",
      ano: String(new Date().getFullYear()),
    });
    const { error: mailError } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      redirectTo: data.redirectTo,
      data: emailData,
    });
    if (mailError) {
      return { sent: false, linked: false as const, warning: mailError.message };
    }
    return { sent: true, linked: false as const };
  });

const agencyInviteSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().max(120).optional(),
  role: z.enum(["agency_admin", "agency_member"]).default("agency_member"),
  jobTitle: z.string().trim().max(120).optional(),
  permissions: z.array(z.string()).optional(),
  redirectTo: z.string().url(),
});

/**
 * Convida um colaborador para a equipe da agência. Antes deste fluxo, o
 * convite de colaborador só criava a linha em agency_invites — nenhum
 * e-mail real era disparado, diferente do convite de cliente. Agora os
 * dois caminhos passam pelo mesmo mecanismo real de envio.
 */
export const inviteAgencyUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => agencyInviteSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: profile } = await (context.supabase as any)
      .from("profiles")
      .select("role, organization_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (profile?.role !== "agency" || !profile.organization_id) {
      throw new Error("Apenas a agência pode convidar colaboradores.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inviterRoles } = await (supabaseAdmin as any)
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("organization_id", profile.organization_id);
    if (!(inviterRoles ?? []).some((entry: { role: string }) => entry.role === "agency_admin")) {
      throw new Error("Apenas administradores da agência podem adicionar uma conta existente à equipe.");
    }

    // Convites duplicados: em vez de acumular várias linhas "pendente" para o
    // mesmo e-mail (ou estourar erro para o admin), o convite anterior ainda
    // pendente é substituído pelos dados novos.
    await (context.supabase as any)
      .from("agency_invites")
      .delete()
      .eq("organization_id", profile.organization_id)
      .eq("email", data.email.toLowerCase())
      .eq("status", "pendente");

    const { data: insertedInvite, error: inviteError } = await (context.supabase as any)
      .from("agency_invites")
      .insert({
        email: data.email.toLowerCase(),
        name: data.name ?? null,
        role: data.role,
        job_title: data.jobTitle ?? null,
        permissions: data.permissions ?? [],
        status: "pendente",
        invited_by: context.userId,
        organization_id: profile.organization_id,
      })
      .select("id")
      .maybeSingle();
    if (inviteError) throw new Error(inviteError.message);
    if (!insertedInvite) throw new Error("Não foi possível registrar o convite (permissão negada).");


    const { data: existing } = await (supabaseAdmin as any)
      .from("profiles")
      .select("id, organization_id")
      .eq("email", data.email.toLowerCase())
      .maybeSingle();
    if (existing?.id) {
      // Uma pessoa pode ter criado uma conta antes do convite. Nesse caso,
      // move-se somente o VÍNCULO de acesso para a agência que a convidou;
      // não se remove a conta auth nem registros da organização anterior.
      if (existing.organization_id !== profile.organization_id) {
        const { error: moveProfileError } = await (supabaseAdmin as any)
          .from("profiles")
          .update({ organization_id: profile.organization_id, role: "agency" })
          .eq("id", existing.id);
        if (moveProfileError) throw new Error(`Não foi possível integrar esta conta à agência: ${moveProfileError.message}`);

        // O perfil possui uma única organização ativa. Substituir apenas os
        // papéis garante que o acesso não fique preso à agência vazia criada
        // automaticamente no cadastro, sem apagar essa organização ou dados.
        const { error: deleteRolesError } = await (supabaseAdmin as any)
          .from("user_roles")
          .delete()
          .eq("user_id", existing.id);
        if (deleteRolesError) throw new Error(`Não foi possível atualizar as permissões: ${deleteRolesError.message}`);
      }

      const { error: ensureProfileError } = await (supabaseAdmin as any)
        .from("profiles")
        .update({ organization_id: profile.organization_id, role: "agency" })
        .eq("id", existing.id);
      if (ensureProfileError) throw new Error(`Não foi possível conceder acesso de equipe: ${ensureProfileError.message}`);
      await (supabaseAdmin as any)
        .from("user_roles")
        .upsert({ user_id: existing.id, role: data.role, organization_id: profile.organization_id }, { onConflict: "user_id,role" });
      if (data.role !== "agency_admin" && data.permissions?.length) {
        await (supabaseAdmin as any)
          .from("user_permissions")
          .upsert(
            data.permissions.map((permission) => ({ user_id: existing.id, permission, organization_id: profile.organization_id })),
            { onConflict: "user_id,permission" },
          );
      }
      await (context.supabase as any).from("agency_invites").update({ status: "aceito", accepted_at: new Date().toISOString() }).eq("email", data.email.toLowerCase()).eq("status", "pendente");
      return { sent: false, linked: true as const, moved: existing.organization_id !== profile.organization_id };
    }

    const { data: orgRow } = await (supabaseAdmin as any).from("organizations").select("name").eq("id", profile.organization_id).maybeSingle();
    const emailData = await buildInviteEmailData(supabaseAdmin, profile.organization_id, "colaborador", {
      nome: data.name ?? data.email,
      agencia: orgRow?.name ?? "",
      email: data.email,
      link_convite: data.redirectTo,
      cliente: "",
      cargo: data.jobTitle ?? "",
      ano: String(new Date().getFullYear()),
    });
    const { error: mailError } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      redirectTo: data.redirectTo,
      data: emailData,
    });
    if (mailError) {
      return { sent: false, linked: false as const, warning: mailError.message };
    }
    return { sent: true, linked: false as const };
  });

const resendSchema = z.object({
  kind: z.enum(["agency", "brand"]),
  inviteId: z.string().uuid(),
  redirectTo: z.string().url(),
});

/** Reenvia o e-mail de um convite pendente já existente (equipe da agência
 * ou cliente), reaproveitando os dados já salvos no convite — sem pedir de
 * novo nome/cargo/papel, e sem deixar "reenviar" ser só um botão decorativo
 * que muda status sem nenhum e-mail sair de verdade. */
export const resendInviteEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => resendSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: profile } = await (context.supabase as any)
      .from("profiles")
      .select("role, organization_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (profile?.role !== "agency" || !profile.organization_id) {
      throw new Error("Apenas a agência pode reenviar convites.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.kind === "agency") {
      const { data: invite } = await (supabaseAdmin as any)
        .from("agency_invites")
        .select("*")
        .eq("id", data.inviteId)
        .eq("organization_id", profile.organization_id)
        .maybeSingle();
      if (!invite) throw new Error("Convite não encontrado.");
      await (context.supabase as any).from("agency_invites").update({ status: "pendente" }).eq("id", data.inviteId);
      const { data: orgRow } = await (supabaseAdmin as any).from("organizations").select("name").eq("id", profile.organization_id).maybeSingle();
      const emailData = await buildInviteEmailData(supabaseAdmin, profile.organization_id, "colaborador", {
        nome: invite.name ?? invite.email,
        agencia: orgRow?.name ?? "",
        email: invite.email,
        link_convite: data.redirectTo,
        cliente: "",
        cargo: invite.job_title ?? "",
        ano: String(new Date().getFullYear()),
      });
      const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(invite.email, { redirectTo: data.redirectTo, data: emailData });
      if (error) return { sent: false as const, warning: error.message };
      return { sent: true as const };
    }

    const { data: invite } = await (supabaseAdmin as any)
      .from("brand_invites")
      .select("*, brands(name)")
      .eq("id", data.inviteId)
      .eq("organization_id", profile.organization_id)
      .maybeSingle();
    if (!invite) throw new Error("Convite não encontrado.");
    await (context.supabase as any).from("brand_invites").update({ status: "pendente" }).eq("id", data.inviteId);
    const emailData = await buildInviteEmailData(supabaseAdmin, profile.organization_id, "cliente", {
      nome: invite.name ?? invite.email,
      agencia: "",
      email: invite.email,
      link_convite: data.redirectTo,
      cliente: invite.brands?.name ?? "",
      cargo: "",
      ano: String(new Date().getFullYear()),
    });
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(invite.email, { redirectTo: data.redirectTo, data: emailData });
    if (error) return { sent: false as const, warning: error.message };
    return { sent: true as const };
  });
