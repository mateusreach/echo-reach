import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EchoLayout } from "@/components/echo/layout";
import { useAccess } from "@/components/echo/session";
import { Avatar, Badge, ClientLogo, EmptyState, Skeleton } from "@/components/echo/primitives";
import { Icon } from "@/components/echo/icon";
import { PERMISSION_ACTIONS, PERMISSION_MODULES, CLIENT_PERMISSION_MODULES, ROLE_LABELS, modulePermissionKey } from "@/lib/agency-data";

export const Route = createFileRoute("/meu-acesso")({
  head: () => ({ meta: [{ title: "Meu acesso · Echo" }] }),
  component: MyAccess,
});

const ACTION_HELP: Record<string, string> = {
  visualizar: "Ver a área e o que existe nela.",
  criar: "Cadastrar itens novos.",
  editar: "Alterar itens existentes.",
  excluir: "Remover itens.",
  administrar: "Configurar a área e as regras dela.",
  comentar: "Comentar materiais no Like.",
  aprovar: "Aprovar materiais ou pedir ajustes no Like.",
};

type Profile = { display_name: string | null; email: string | null; job_title: string | null };
type Link_ = { name: string; slug: string; logo_url: string | null; is_admin: boolean; permissions: string[] };

async function loadMine(userId: string | undefined, demo: boolean, role: "team" | "client") {
  if (demo || !userId) {
    return role === "team"
      ? { profile: { display_name: "Helena Duarte", email: "helena@reach.ag", job_title: "Diretora de Atendimento" }, roles: ["agency_admin"], links: [] as Link_[] }
      : { profile: { display_name: "Carla Mendes", email: "carla@finafragrancia.com.br", job_title: "Marketing" }, roles: ["client"], links: [{ name: "Fina Fragrância", slug: "fina-fragrancia", logo_url: null, is_admin: true, permissions: ["espaco360.visualizar", "espaco360.criar", "like.visualizar", "like.comentar", "like.aprovar", "plano.visualizar"] }] };
  }
  const [p, r, m] = await Promise.all([
    supabase.from("profiles").select("display_name, email, job_title").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase.from("brand_members").select("is_admin, permissions, brands(name, slug, logo_url)").eq("user_id", userId),
  ]);
  return {
    profile: (p.data ?? { display_name: null, email: null, job_title: null }) as Profile,
    roles: ((r.data ?? []) as { role: string }[]).map((x) => x.role),
    links: ((m.data ?? []) as any[]).filter((x) => x.brands).map((x) => ({ ...x.brands, is_admin: x.is_admin, permissions: x.permissions ?? [] })) as Link_[],
  };
}

function MyAccess() {
  const { session, can, isLoading } = useAccess();
  const q = useQuery({
    queryKey: ["echo-my-access", session?.userId, session?.mode, session?.role],
    enabled: !!session,
    queryFn: () => loadMine(session!.userId, session!.mode === "demo", session!.role),
  });
  const d = q.data;
  const isTeam = session?.role === "team";
  const modules = isTeam ? PERMISSION_MODULES : CLIENT_PERMISSION_MODULES;
  const clientPerms = new Set(d?.links.flatMap((l) => (l.is_admin ? modules.flatMap((m) => m.actions.map((a) => modulePermissionKey(m.key, a))) : l.permissions)) ?? []);
  const has = (k: string) => (isTeam ? can(k) : clientPerms.has(k));

  return (
    <EchoLayout eyebrow="Sua conta" title="Meu acesso">
      {isLoading || q.isLoading || !d ? (
        <div className="e-glass" style={{ borderRadius: "var(--r-2xl)", padding: 24, display: "grid", gap: 14 }}>
          <Skeleton w={220} h={18} /><Skeleton w="60%" h={12} /><Skeleton h={180} r={16} />
        </div>
      ) : (
        <div className="access-grid">
          <section className="e-glass access-card">
            <div className="e-row" style={{ gap: 14 }}>
              <Avatar name={d.profile.display_name || d.profile.email || "?"} size="xl" />
              <div style={{ minWidth: 0 }}>
                <h2 className="e-h3" style={{ margin: 0 }}>{d.profile.display_name || "Sem nome"}</h2>
                <div className="e-small e-ellipsis">{d.profile.email}</div>
                {d.profile.job_title && <div className="e-caption">{d.profile.job_title}</div>}
              </div>
            </div>
            <div className="e-row wrap" style={{ gap: 6 }}>
              {d.roles.map((r) => <Badge key={r} tone="glass" icon={r === "client" ? "user" : "users"}>{ROLE_LABELS[r as keyof typeof ROLE_LABELS] ?? r}</Badge>)}
              {session?.isAdmin && <Badge tone="grad" icon="sparkle">Administração completa</Badge>}
            </div>
            <div className="e-stack" style={{ gap: 8 }}>
              <span className="e-label">{isTeam ? "Clientes" : "Suas marcas"}</span>
              {isTeam ? (
                <p className="e-small" style={{ margin: 0 }}>A equipe da agência vê os clientes da organização conforme as permissões abaixo.</p>
              ) : d.links.length === 0 ? (
                <EmptyState compact kind="lock" title="Nenhuma marca vinculada" text="Peça ao administrador da sua empresa ou à Reach para vincular seu acesso." />
              ) : (
                d.links.map((l) => (
                  <Link key={l.slug} to={`/e360/${l.slug}` as never} className="now-row" style={{ background: "var(--hover)" }}>
                    <ClientLogo name={l.name} logoUrl={l.logo_url} size="sm" />
                    <span className="now-main"><b>{l.name}</b><span>{l.is_admin ? "Administrador da marca" : `${l.permissions.length} permissões`}</span></span>
                    <Icon name="chevRight" size="sm" />
                  </Link>
                ))
              )}
            </div>
          </section>

          <section className="e-glass access-card">
            <div>
              <h2 className="e-h4" style={{ margin: 0 }}>O que você pode fazer</h2>
              <p className="e-caption" style={{ margin: "4px 0 0" }}>Somente leitura. Para mudar, fale com um administrador{isTeam ? " da Reach" : " da sua empresa ou com a Reach"}.</p>
            </div>
            <div className="access-table-wrap">
              <table className="access-table">
                <thead>
                  <tr><th scope="col">Área</th>{PERMISSION_ACTIONS.map((a) => <th key={a.key} scope="col" title={ACTION_HELP[a.key]}>{a.label}</th>)}</tr>
                </thead>
                <tbody>
                  {modules.map((m) => (
                    <tr key={m.key}>
                      <th scope="row">{m.label}</th>
                      {PERMISSION_ACTIONS.map((a) => {
                        if (!m.actions.includes(a.key)) return <td key={a.key} className="na" aria-label="Não se aplica">·</td>;
                        const ok = has(modulePermissionKey(m.key, a.key));
                        return <td key={a.key} className={ok ? "yes" : "no"} aria-label={ok ? "Permitido" : "Sem permissão"}>{ok ? <Icon name="check" size="sm" /> : <Icon name="minus" size="sm" />}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="access-help">
              {PERMISSION_ACTIONS.map((a) => (<div key={a.key}><dt>{a.label}</dt><dd>{ACTION_HELP[a.key]}</dd></div>))}
            </dl>
          </section>
        </div>
      )}
    </EchoLayout>
  );
}
