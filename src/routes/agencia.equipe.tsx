import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { listBrands, type Brand } from "@/lib/reach-data";
import { ColaboradorDrawer } from "@/components/reach/colaborador-drawer";
import { AgencyInviteModal } from "@/components/reach/agency-invite-modal";
import { resendInviteEmail } from "@/lib/invites.functions";
import { toast } from "sonner";
import { PillButton } from "@/components/reach/ui";
import {
  ROLE_LABELS,
  cancelAgencyInvite,
  getFullAccess,
  isLate,
  listAgencyInvites,
  listProfiles,
  listUserRoles,
  listWorkItems,
  type AgencyInvite,
  type AppRole,
  type ProfileRow,
  type UserRole,
  type WorkItem,
} from "@/lib/agency-data";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/agencia/equipe")({
  head: () => ({
    meta: [
      { title: "Equipe da Reach — Reach Brand OS" },
      { name: "description", content: "Quem está fazendo o quê: demandas, tarefas e carga de trabalho da equipe da Reach." },
      { property: "og:title", content: "Equipe da Reach" },
      { property: "og:description", content: "Visão de carga de trabalho e responsabilidades da equipe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EquipePage,
});

function EquipePage() {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [items, setItems] = useState<WorkItem[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [invites, setInvites] = useState<AgencyInvite[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProfileRow | null>(null);
  const [inviting, setInviting] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  async function load() {
    const [p, r, w, b, inv] = await Promise.all([
      listProfiles(),
      listUserRoles(),
      listWorkItems(),
      listBrands(),
      listAgencyInvites().catch(() => []),
    ]);
    setProfiles(p);
    setRoles(r);
    setItems(w);
    setBrands(b);
    setInvites(inv);
  }

  useEffect(() => {
    getFullAccess().then((a) => setCanManage(a.can("equipe.gerenciar") || a.can("equipe.administrar"))).catch(() => undefined);
    load().catch(() => undefined);
  }, []);

  const pendingInvites = invites.filter((i) => i.status === "pendente");


  const brandName = useMemo(() => new Map(brands.map((b) => [b.id, b.name])), [brands]);
  const roleOf = (id: string): AppRole => (roles.find((r) => r.user_id === id)?.role ?? "client");
  const allTeam = profiles.filter((p) => roleOf(p.id) !== "client");
  const team = allTeam.filter((p) => showInactive || (p as any).active !== false);

  const byPerson = useMemo(() => {
    const map = new Map<string, WorkItem[]>();
    for (const p of team) {
      const name = (p.display_name ?? "").trim();
      map.set(
        p.id,
        items.filter((i) => i.responsible && name && i.responsible.toLowerCase() === name.toLowerCase()),
      );
    }
    return map;
  }, [team, items]);

  const unassigned = items.filter((i) => !i.responsible && !["concluida", "concluido", "cancelada"].includes(i.status));
  const detail = selected ? byPerson.get(selected) ?? [] : [];

  return (
    <div className="space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">Equipe da Reach</h1>
          <p className="text-sm text-muted-foreground">Colaboradores, carga de trabalho, cargo e permissões.</p>
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
      </header>

      {pendingInvites.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Convites pendentes</h2>
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
                      <button
                        onClick={async () => { const r = await resendInviteEmail({ data: { kind: "agency", inviteId: inv.id, redirectTo: `${window.location.origin}/auth` } }); if (r.sent) toast.success(`Convite reenviado para ${inv.email}.`); else toast.error(`Não foi possível reenviar: ${"warning" in r ? r.warning : "erro no envio de e-mail"}`); await load(); }}
                        aria-label="Reenviar convite"
                        title="Reenviar convite"
                        className="rounded-full border border-border px-2.5 py-1 text-[10.5px] text-muted-foreground transition-colors hover:bg-muted"
                      >
                        Reenviar
                      </button>
                      <button
                        onClick={async () => { await cancelAgencyInvite(inv.id); await load(); }}
                        aria-label="Cancelar convite"
                        title="Cancelar convite"
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {team.map((p) => {
          const own = byPerson.get(p.id) ?? [];
          const atrasados = own.filter(isLate).length;
          const abertos = own.filter((i) => !["concluida", "concluido", "cancelada", "entregue"].includes(i.status)).length;
          const inactive = (p as any).active === false;
          return (
            <article
              key={p.id}
              className={cn(
                "surface rounded-2xl p-4 text-left",
                selected === p.id && "ring-1 ring-primary",
                inactive && "opacity-60",
              )}
            >
              <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-muted text-xs font-semibold">
                  {p.avatar_url ? <img src={p.avatar_url} alt={p.display_name ?? ""} className="h-full w-full object-cover" /> : initials(p.display_name ?? p.email ?? "?")}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.display_name || p.email}</p>
                  <p className="truncate text-xs text-muted-foreground">{p.job_title || ROLE_LABELS[roleOf(p.id)]}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5 text-[10.5px]">
                <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">{abertos} em aberto</span>
                {atrasados > 0 && <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-destructive">{atrasados} atrasado(s)</span>}
                {inactive && <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">Inativo</span>}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => setSelected(selected === p.id ? null : p.id)}
                  className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground"
                >
                  {selected === p.id ? "Ocultar demandas" : "Ver demandas"}
                </button>
                <button onClick={() => setEditing(p)} className="rounded-full border border-border px-3 py-1.5 text-xs">
                  {canManage ? "Abrir perfil" : "Ver perfil"}
                </button>
              </div>
            </article>
          );
        })}
        {team.length === 0 && <p className="text-sm text-muted-foreground">Nenhum membro da agência cadastrado.</p>}
      </div>

      {selected && (
        <section className="surface space-y-2 rounded-2xl p-5">
          <h2 className="text-sm font-semibold">Demandas de {profiles.find((p) => p.id === selected)?.display_name}</h2>
          {detail.length === 0 && <p className="text-sm text-muted-foreground">Sem itens atribuídos.</p>}
          {detail.map((i) => (
            <Row key={`${i.kind}-${i.id}`} item={i} brandName={brandName} />
          ))}
        </section>
      )}

      {editing && (
        <ColaboradorDrawer
          profile={editing as ProfileRow & { active?: boolean }}
          role={roleOf(editing.id)}
          canManage={canManage}
          onClose={() => setEditing(null)}
          onSaved={() => load().catch(() => undefined)}
        />
      )}

      {inviting && (
        <AgencyInviteModal
          onClose={() => setInviting(false)}
          onInvited={() => { load().catch(() => undefined); }}
        />
      )}

      <section className="surface space-y-2 rounded-2xl p-5">
        <h2 className="text-sm font-semibold">Sem responsável definido</h2>
        {unassigned.length === 0 && <p className="text-sm text-muted-foreground">Tudo atribuído.</p>}
        {unassigned.slice(0, 12).map((i) => (
          <Row key={`${i.kind}-${i.id}`} item={i} brandName={brandName} />
        ))}
      </section>
    </div>
  );
}

function Row({ item, brandName }: { item: WorkItem; brandName: Map<string, string> }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm">{item.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {item.kind} · {item.brandId ? brandName.get(item.brandId) ?? "Cliente" : "Reach"} · {item.status}
        </p>
      </div>
      {item.dueDate && (
        <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[10.5px]", isLate(item) ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")}>
          {item.dueDate.split("-").reverse().slice(0, 2).join("/")}
        </span>
      )}
    </div>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

