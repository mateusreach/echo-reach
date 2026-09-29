import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/reach/ui";
import { EmptyState } from "@/components/reach/workspace-ui";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/workspace/equipe")({
  head: () => ({
    meta: [
      { title: "Equipe — Reach Workspace" },
      { name: "description", content: "Equipe única da Reach vista pela operação, com função e liderança." },
      { property: "og:title", content: "Equipe — Reach Workspace" },
      { property: "og:description", content: "Quem faz parte do time e o que cada pessoa conduz." },
    ],
  }),
  component: WorkspaceTeam,
});

async function listTeam() {
  const { data, error } = await supabase
    .from("team_members")
    .select("id, name, email, job_title, avatar_url, palette, is_leader, active")
    .eq("kind", "agency")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

/** EQUIPE — leitura do cadastro único (team_members). Edição continua na agência. */
function WorkspaceTeam() {
  const team = useQuery({ queryKey: ["ws-team"], queryFn: listTeam });
  const list = (team.data ?? []).filter((m) => m.active !== false);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="Equipe"
        description="A mesma equipe cadastrada na agência. Aqui você vê quem conduz a operação."
        actions={
          <Link
            to="/agencia/equipe"
            className="inline-flex h-9 items-center rounded-full border border-border px-4 text-sm font-medium"
          >
            Gerenciar equipe
          </Link>
        }
      />

      {team.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando equipe…</p>
      ) : list.length === 0 ? (
        <EmptyState title="Nenhuma pessoa cadastrada." description="Cadastre o time uma única vez na área da agência." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((m) => (
            <div key={m.id} className="surface grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-2xl p-4">
              {m.avatar_url ? (
                <img src={m.avatar_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
              ) : (
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-semibold text-primary-foreground"
                  style={{ background: m.palette || "var(--primary)" }}
                >
                  {m.name.slice(0, 2).toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold tracking-tight">
                  {m.name}
                  {m.is_leader && (
                    <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary">
                      Liderança
                    </span>
                  )}
                </p>
                <p className="truncate text-[12.5px] text-muted-foreground">{m.job_title || m.email || "—"}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
