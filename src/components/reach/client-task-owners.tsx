import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserRound } from "lucide-react";
import { SelectInput, TextInput } from "@/components/ui-reach/primitives";
import {
  listAssignableMembers,
  listClientTaskOwners,
  saveClientTaskOwner,
  templateTasks,
  type WorkTemplate,
} from "@/lib/workspace-data";

/**
 * Responsável e antecedência de cada tarefa do modelo, definidos POR CLIENTE.
 * Ao aplicar o modelo numa entrega, cada tarefa já nasce com o responsável
 * configurado aqui — e aparece na agenda dessa pessoa.
 */
export function ClientTaskOwners({ brandId, templates }: { brandId: string; templates: WorkTemplate[] }) {
  const qc = useQueryClient();
  const owners = useQuery({ queryKey: ["ws-client-owners", brandId], queryFn: () => listClientTaskOwners(brandId) });
  const members = useQuery({ queryKey: ["ws-assignable"], queryFn: listAssignableMembers });

  // Tarefas de todos os modelos, sem repetir o título.
  const titles: { title: string; sector: string | null; model: string; daysBefore: number | null }[] = [];
  for (const t of templates) {
    for (const item of templateTasks(t)) {
      if (!titles.some((x) => x.title.toLowerCase() === item.title.toLowerCase()))
        titles.push({ title: item.title, sector: item.sector ?? null, model: t.name, daysBefore: item.days_before ?? null });
    }
  }
  if (titles.length === 0) return null;

  async function save(title: string, patch: { ownerName?: string | null; daysBefore?: number | null }) {
    const current = owners.data?.find((o) => o.task_title.toLowerCase() === title.toLowerCase());
    const ownerName = patch.ownerName !== undefined ? patch.ownerName : (current?.owner_name ?? null);
    const member = members.data?.find((m) => m.name === ownerName);
    try {
      await saveClientTaskOwner({
        brandId,
        taskTitle: title,
        ownerName,
        ownerId: member?.user_id ?? null,
        daysBefore: patch.daysBefore !== undefined ? patch.daysBefore : (current?.days_before ?? null),
      });
      await qc.invalidateQueries({ queryKey: ["ws-client-owners", brandId] });
      toast.success("Configuração do cliente salva.");
    } catch (e) {
      toast.error(`Não foi possível salvar: ${(e as Error).message}`);
    }
  }

  return (
    <section className="surface space-y-3 rounded-2xl p-4 sm:p-5">
      <header>
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <UserRound className="h-4 w-4" aria-hidden /> Responsáveis por tarefa deste cliente
        </h2>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          Cada cliente tem a sua configuração. Ao aplicar o modelo numa entrega, cada tarefa nasce com o responsável abaixo e aparece na agenda dele.
        </p>
      </header>
      <ul className="space-y-2">
        {titles.map((item) => {
          const cfg = owners.data?.find((o) => o.task_title.toLowerCase() === item.title.toLowerCase());
          const member = members.data?.find((m) => m.name === cfg?.owner_name);
          return (
            <li key={item.title} className="grid gap-2 rounded-xl border border-border/70 bg-card p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)_5.5rem] sm:items-center">
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-medium">{item.title}</p>
                <p className="truncate text-[11.5px] text-muted-foreground">
                  {item.sector ? `${item.sector} · ` : ""}modelo {item.model}
                </p>
              </div>
              <div>
                <SelectInput
                  aria-label={`Responsável por ${item.title}`}
                  value={cfg?.owner_name ?? ""}
                  onChange={(e) => save(item.title, { ownerName: e.target.value || null })}
                >
                  <option value="">Sem responsável</option>
                  {(members.data ?? []).map((m) => (
                    <option key={m.name} value={m.name}>
                      {m.name}
                      {m.user_id ? "" : " (sem acesso)"}
                    </option>
                  ))}
                </SelectInput>
                {cfg?.owner_name && member && !member.user_id && (
                  <p className="mt-1 text-[11px] text-warning">Sem conta: convide esta pessoa para ela ver a tarefa na agenda.</p>
                )}
              </div>
              <TextInput
                type="number"
                min={0}
                aria-label={`Dias de antecedência de ${item.title}`}
                title="Dias de antecedência em relação ao prazo da entrega"
                placeholder={`${item.daysBefore ?? 0} d`}
                defaultValue={cfg?.days_before ?? ""}
                onBlur={(e) => {
                  const v = e.target.value === "" ? null : Number(e.target.value);
                  if (v !== (cfg?.days_before ?? null)) save(item.title, { daysBefore: v });
                }}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
