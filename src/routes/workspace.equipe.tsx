import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Button, EmptyState, Skeleton } from "@/components/echo/primitives";
import { Chip } from "@/components/echo/controls";
import { Icon } from "@/components/echo/icon";
import { stagger } from "@/components/echo/motion";
import { MemberCard } from "@/components/echo/people";
import { loadTeam } from "@/lib/team-data";

export const Route = createFileRoute("/workspace/equipe")({
  head: () => ({ meta: [{ title: "Equipe · Workspace · Echo" }, { name: "description", content: "Quem conduz a operação, com setor e carga da semana." }] }),
  component: WorkspaceTeam,
});

/** Leitura da mesma equipe da agência, focada em carga. A edição fica em Agência › Equipe. */
function WorkspaceTeam() {
  const [ready, setReady] = useState(false);
  const [sector, setSector] = useState<string | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  useEffect(() => setReady(true), []);
  const team = useQuery({ queryKey: ["team"], queryFn: loadTeam, enabled: ready });
  const people = (team.data?.people ?? []).filter((p) => p.active && (!sector || p.sectors.includes(sector)));
  const max = Math.max(6, ...people.map((p) => p.open));
  useEffect(() => { if (grid.current && team.data) stagger(grid.current.querySelectorAll(".member-card"), { y: 10, dur: 420 }, 35); }, [!!team.data, sector]);

  if (!ready || team.isLoading) return <div className="member-grid" aria-busy="true">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} h={190} r={22} />)}</div>;
  if (team.isError) return <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState kind="error" title="Não foi possível carregar a equipe" actions={<Button variant="secondary" icon="refresh" onClick={() => team.refetch()}>Tentar novamente</Button>} /></div>;

  return (
    <div className="stack-lg">
      <div className="e-row between wrap" style={{ gap: 10 }}>
        <div className="e-row wrap" style={{ gap: 6 }}>
          <Chip pressed={!sector} onClick={() => setSector(null)}>Todos</Chip>
          {(team.data?.sectors ?? []).map((s) => <Chip key={s} pressed={sector === s} onClick={() => setSector(sector === s ? null : s)}>{s}</Chip>)}
        </div>
        <Link to="/agencia/equipe" className="e-btn secondary sm"><Icon name="users" size="sm" /> Gerenciar equipe</Link>
      </div>
      {people.length === 0 ? (
        <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState icon="users" title="Ninguém neste setor" text="Cadastre e organize a equipe em Agência › Equipe." /></div>
      ) : (
        <div className="member-grid" ref={grid}>{people.map((p) => <MemberCard key={p.id} person={p} max={max} />)}</div>
      )}
    </div>
  );
}
