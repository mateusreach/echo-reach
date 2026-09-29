import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/reach/ui";
import { supabase } from "@/integrations/supabase/client";
import { getAccess } from "@/lib/agency-data";

export const Route = createFileRoute("/workspace/meu-acesso")({
  head: () => ({
    meta: [
      { title: "Meu acesso — Reach Workspace" },
      { name: "description", content: "Seu perfil, papel e permissões dentro do ecossistema Reach." },
      { property: "og:title", content: "Meu acesso — Reach Workspace" },
      { property: "og:description", content: "O que você pode ver e fazer no Brand e no Workspace." },
    ],
  }),
  component: MyAccess,
});

const ROLE_LABEL: Record<string, string> = {
  agency_admin: "Administrador",
  agency_member: "Colaborador",
  client: "Externo / cliente",
};

/** MEU ACESSO — leitura do sistema único de permissões (papéis + permissões). */
function MyAccess() {
  const me = useQuery({
    queryKey: ["ws-my-access"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return null;
      const [{ data: profile }, { data: roles }, { data: perms }, access] = await Promise.all([
        supabase.from("profiles").select("display_name, email, job_title").eq("id", uid).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid),
        supabase.from("user_permissions").select("permission").eq("user_id", uid),
        getAccess(),
      ]);
      return { profile, roles: roles ?? [], perms: perms ?? [], access };
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="Meu acesso"
        description="Seu perfil vale para todo o ecossistema: o mesmo login serve para o Brand e para o Workspace."
      />

      {me.isLoading || !me.data ? (
        <p className="text-sm text-muted-foreground">Carregando seus dados…</p>
      ) : (
        <>
          <section className="surface rounded-2xl p-5 sm:p-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Perfil</h2>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <Row label="Nome" value={me.data.profile?.display_name ?? "—"} />
              <Row label="E-mail" value={me.data.profile?.email ?? "—"} />
              <Row label="Função" value={me.data.profile?.job_title ?? "—"} />
              <Row
                label="Papel"
                value={me.data.roles.map((r: any) => ROLE_LABEL[r.role] ?? r.role).join(", ") || "—"}
              />
            </dl>
          </section>

          <section className="surface rounded-2xl p-5 sm:p-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Permissões
            </h2>
            {me.data.access?.isAdmin ? (
              <p className="text-sm text-muted-foreground">
                Como administrador, você tem acesso completo a todas as áreas da agência.
              </p>
            ) : me.data.perms.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma permissão adicional atribuída.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {me.data.perms.map((p: any) => (
                  <span
                    key={p.permission}
                    className="rounded-full bg-muted px-3 py-1.5 text-[12px] font-medium text-muted-foreground"
                  >
                    {p.permission}
                  </span>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</dt>
      <dd className="truncate">{value}</dd>
    </div>
  );
}
