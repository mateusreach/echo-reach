import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Rocket } from "lucide-react";
import { FormModal } from "@/components/reach/form-modal";
import { Btn, Field, SelectInput, TextArea, TextInput } from "@/components/ui-reach/primitives";
import { getFullAccess } from "@/lib/agency-data";
import { listTeamMembers } from "@/lib/reach-data";
import { listSectors, listTemplates } from "@/lib/workspace-data";
import { isViewingAsClient } from "@/lib/view-as";
import {
  applyTemplateToWorkOrder,
  dispatchBrandItemToWorkOrder,
  findWorkOrderForSource,
  submitClientRequestToWorkspace,
} from "@/lib/work-orders";

export type ExecutionSource = {
  brandId: string;
  brandSlug: string;
  sourceModule: "espaco360" | "brand" | "biblioteca";
  /** solicitacao | tarefa | reuniao | campanha | ideia | entrega */
  sourceType: string;
  sourceId: string;
  sourceUrl: string;
  title: string;
  description?: string | null;
  kind?: string;
  requestedDueDate?: string | null;
};

/**
 * 🚀 Enviar para execução — botão contextual reutilizável em qualquer item do
 * Brand/360 que possa gerar trabalho da Reach.
 *
 * Idempotente: se o item já virou entrega, o botão passa a "Abrir no Workspace".
 * Cliente não vê setor, equipe nem prioridade interna: sua solicitação entra
 * direto na triagem, sem responsável.
 */
export function SendToExecution({ source, size = "sm" }: { source: ExecutionSource; size?: "sm" | "md" }) {
  const access = useQuery({ queryKey: ["full-access"], queryFn: getFullAccess });
  const existing = useQuery({
    queryKey: ["wo-source", source.brandId, source.sourceType, source.sourceId],
    queryFn: () =>
      findWorkOrderForSource({
        brandId: source.brandId,
        sourceModule: source.sourceModule,
        sourceType: source.sourceType,
        sourceId: source.sourceId,
      }),
  });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const internal = !!access.data?.isAgency && !isViewingAsClient();
  const clientCanSubmit = source.sourceModule === "espaco360" &&
    (source.sourceType === "solicitacao" || source.sourceType === "tarefa");

  if (access.isPending || access.isError) return null;
  if (!internal && !clientCanSubmit) return null;

  if (existing.data || submitted) {
    if (!internal) {
      return <Btn variant="ghost" size={size} disabled><Rocket className="h-3.5 w-3.5" aria-hidden /> Em execução</Btn>;
    }
    return (
      <Link to="/workspace/cliente/$brandSlug" params={{ brandSlug: source.brandSlug }} search={{}}>
        <Btn variant="ghost" size={size}>
          <Rocket className="h-3.5 w-3.5" aria-hidden /> Abrir no Workspace
        </Btn>
      </Link>
    );
  }

  async function clientSubmit() {
    setBusy(true);
    try {
      await submitClientRequestToWorkspace({
        sourceType: source.sourceType as "solicitacao" | "tarefa",
        sourceId: source.sourceId,
        sourceUrl: source.sourceUrl,
      });
      toast.success("Enviado para a equipe da Reach. Você acompanha o andamento por aqui.");
      setSubmitted(true);
      existing.refetch();
    } catch (e) {
      toast.error(`Não foi possível enviar: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  if (!internal)
    return (
      <Btn variant="outline" size={size} disabled={busy} onClick={clientSubmit}>
        <Rocket className="h-3.5 w-3.5" aria-hidden /> {busy ? "Enviando…" : "Solicitar à Reach"}
      </Btn>
    );

  return (
    <>
      <Btn variant="outline" size={size} onClick={() => setOpen(true)}>
        <Rocket className="h-3.5 w-3.5" aria-hidden /> Enviar para execução
      </Btn>
      {open && <InternalDispatchModal source={source} onClose={() => setOpen(false)} onSent={() => existing.refetch()} />}
    </>
  );
}

/** Modal interno: só informações operacionais — o contexto já veio do Brand. */
function InternalDispatchModal({
  source,
  onClose,
  onSent,
}: {
  source: ExecutionSource;
  onClose: () => void;
  onSent: () => void;
}) {
  const sectors = useQuery({ queryKey: ["ws-sectors"], queryFn: listSectors });
  const team = useQuery({ queryKey: ["team-members"], queryFn: () => listTeamMembers() });
  const templates = useQuery({ queryKey: ["ws-templates"], queryFn: listTemplates });
  const [sector, setSector] = useState("");
  const [owner, setOwner] = useState("");
  const [due, setDue] = useState(source.requestedDueDate ?? "");
  const [priority, setPriority] = useState("999");
  const [templateId, setTemplateId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    try {
      const { workOrderId, created } = await dispatchBrandItemToWorkOrder({
        brandId: source.brandId,
        sourceModule: source.sourceModule,
        sourceType: source.sourceType,
        sourceId: source.sourceId,
        sourceUrl: source.sourceUrl,
        title: source.title,
        kind: source.kind ?? "brand_request",
        description: [source.description, note].filter(Boolean).join("\n\n") || null,
        requestedDueDate: source.requestedDueDate ?? null,
        internalDueDate: due || null,
        priority: Number(priority) || 999,
      });
      const template = templates.data?.find((t) => t.id === templateId);
      if (created && template) {
        await applyTemplateToWorkOrder(template, { brandId: source.brandId, workOrderId, dueDate: due || null });
      } else if (created) {
        const { supabase } = await import("@/integrations/supabase/client");
        await supabase.from("workspace_tasks").insert({
          brand_id: source.brandId,
          work_order_id: workOrderId,
          title: source.title,
          sector: sector || null,
          owner_id: owner || null,
          owner_name: team.data?.find((t) => t.user_id === owner)?.name ?? null,
          due_date: due || null,
          priority: Number(priority) || 999,
          status: "Parada",
        });
      }
      toast.success(created ? "Entrega criada no Workspace." : "Este item já estava em execução — nada foi duplicado.");
      onSent();
      onClose();
    } catch (e) {
      toast.error(`Não foi possível enviar: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormModal
      title="Enviar para execução"
      description={`"${source.title}" vira uma entrega no Workspace, com o contexto de origem preservado.`}
      onClose={onClose}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Btn>
          <Btn variant="primary" onClick={send} disabled={busy}>{busy ? "Enviando…" : "Enviar"}</Btn>
        </>
      }
    >
      <Field label="Modelo de execução" hint="Opcional: gera todas as etapas dentro da entrega.">
        <SelectInput value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
          <option value="">Criar apenas uma tarefa</option>
          {(templates.data ?? []).map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </SelectInput>
      </Field>
      <Field label="Setor">
        <SelectInput value={sector} onChange={(e) => setSector(e.target.value)}>
          <option value="">Definir na triagem</option>
          {(sectors.data ?? []).map((s) => (
            <option key={s.id} value={s.name}>{s.name}</option>
          ))}
        </SelectInput>
      </Field>
      <Field label="Responsável">
        <SelectInput value={owner} onChange={(e) => setOwner(e.target.value)}>
          <option value="">Distribuir depois</option>
          {(team.data ?? [])
            .filter((t) => t.user_id)
            .map((t) => (
              <option key={t.id} value={t.user_id!}>{t.name}</option>
            ))}
        </SelectInput>
      </Field>
      <Field label="Prazo interno">
        <TextInput type="date" value={due} onChange={(e) => setDue(e.target.value)} />
      </Field>
      <Field label="Prioridade" hint="1 é o mais prioritário. Prioridade não é status.">
        <TextInput type="number" min={1} value={priority} onChange={(e) => setPriority(e.target.value)} />
      </Field>
      <Field label="Observação operacional">
        <TextArea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </FormModal>
  );
}
