// ---------------------------------------------------------------------------
// Echo · Cadastro do cliente (um registro para todos os ambientes)
// ---------------------------------------------------------------------------
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "./primitives";
import { Field, Select, Switch } from "./controls";
import { Drawer, Modal } from "./overlays";
import { Icon } from "./icon";
import { CLIENT_STATUSES, CONTRACT_TYPES, DEFAULT_MODULES, type BrandModules } from "@/lib/reach-data";
import { saveClient, slugify, type ClientCard } from "@/lib/clients-data";

export const MODULE_ROWS: { key: keyof BrandModules; label: string; desc: string; color: string }[] = [
  { key: "biblioteca", label: "Brand · Biblioteca", desc: "Ideias, pilares, conteúdos e referências.", color: "var(--env-brand)" },
  { key: "plano", label: "Brand · Plano", desc: "Plano estratégico da marca.", color: "var(--env-brand)" },
  { key: "workspace", label: "Workspace", desc: "Frentes, entregas, tarefas e cobertura.", color: "var(--env-workspace)" },
  { key: "like", label: "Like", desc: "Aprovação de materiais pelo cliente.", color: "var(--env-like)" },
  { key: "espaco360", label: "Espaço 360", desc: "Plano, campanhas e solicitações com o cliente.", color: "var(--env-360)" },
];

type Draft = { name: string; slug: string; slugTouched: boolean; segment: string; status: string; contract_type: string; contact_name: string; contact_email: string; modules: BrandModules };

export function ClientForm({ open, client, onClose, onSaved }: { open: boolean; client?: ClientCard | null; onClose: () => void; onSaved: (slug: string) => void }) {
  const [d, setD] = useState<Draft | null>(null);
  const [err, setErr] = useState<{ name?: string; slug?: string; email?: string }>({});
  const [saving, setSaving] = useState(false);
  const [confirmOff, setConfirmOff] = useState<string[] | null>(null);

  useEffect(() => {
    if (!open) return;
    setErr({});
    setD(client
      ? { name: client.name, slug: client.slug, slugTouched: true, segment: client.segment ?? "", status: client.status, contract_type: client.contract ?? "recorrente", contact_name: client.contactName ?? "", contact_email: client.contactEmail ?? "", modules: { ...client.modules } }
      : { name: "", slug: "", slugTouched: false, segment: "", status: "ativo", contract_type: "recorrente", contact_name: "", contact_email: "", modules: { ...DEFAULT_MODULES } });
  }, [open, client]);

  const turnedOff = () => (client && d ? MODULE_ROWS.filter((m) => client.modules[m.key] && !d.modules[m.key]).map((m) => m.label) : []);

  const submit = async (confirmed = false) => {
    if (!d) return;
    const e: typeof err = {};
    if (!d.name.trim()) e.name = "Informe o nome do cliente.";
    if (!slugify(d.slug || d.name)) e.slug = "Use letras ou números no endereço.";
    if (d.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.contact_email)) e.email = "Confira o e-mail do contato.";
    setErr(e);
    if (Object.keys(e).length) return;
    const off = turnedOff();
    if (off.length && !confirmed) { setConfirmOff(off); return; }
    setSaving(true);
    try {
      const slug = await saveClient({ id: client?.id, name: d.name.trim(), slug: d.slug || d.name, segment: d.segment.trim(), status: d.status, contract_type: d.contract_type, contact_name: d.contact_name.trim(), contact_email: d.contact_email.trim(), modules: d.modules });
      toast.success(client ? "Cliente atualizado" : "Cliente cadastrado", { description: client ? undefined : "Ele já aparece em todos os ambientes ativos." });
      setConfirmOff(null);
      onSaved(slug);
    } catch (x) {
      const msg = x instanceof Error ? x.message : "Não foi possível salvar.";
      if (msg.includes("endereço")) setErr({ slug: msg });
      else toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        eyebrow={client ? "Editar cliente" : "Novo cliente"}
        title={client ? client.name : "Cadastrar cliente"}
        footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="check" loading={saving} onClick={() => submit()}>{client ? "Salvar" : "Cadastrar"}</Button></>}
      >
        {d && (
          <>
            <Field label="Nome" value={d.name} autoFocus error={err.name} placeholder="Ex.: Fina Fragrância"
              onChange={(e) => setD({ ...d, name: e.target.value, slug: d.slugTouched ? d.slug : slugify(e.target.value) })} />
            <Field label="Endereço no Echo" value={d.slug} error={err.slug} help={`echo/clientes/${slugify(d.slug || d.name) || "…"}`} icon="link"
              onChange={(e) => setD({ ...d, slug: e.target.value, slugTouched: true })} />
            <Field label="Segmento" value={d.segment} optional placeholder="Ex.: Perfumaria artesanal" onChange={(e) => setD({ ...d, segment: e.target.value })} />
            <div className="grid-2" style={{ gap: 12 }}>
              <Select label="Status" value={d.status} onChange={(v) => setD({ ...d, status: v })} options={CLIENT_STATUSES.map((s) => ({ value: s.key, label: s.label }))} />
              <Select label="Contratação" value={d.contract_type} onChange={(v) => setD({ ...d, contract_type: v })} options={CONTRACT_TYPES.map((s) => ({ value: s.key, label: s.label }))} />
            </div>
            <div className="grid-2" style={{ gap: 12 }}>
              <Field label="Contato principal" value={d.contact_name} optional icon="user" onChange={(e) => setD({ ...d, contact_name: e.target.value })} />
              <Field label="E-mail do contato" type="email" value={d.contact_email} optional error={err.email} onChange={(e) => setD({ ...d, contact_email: e.target.value })} />
            </div>
            <div className="e-stack" style={{ gap: 8 }}>
              <span className="e-label">Ambientes contratados</span>
              {MODULE_ROWS.map((m) => (
                <div key={m.key} className="module-row">
                  <span className="dot" style={{ background: m.color }} />
                  <span className="e-grow"><b>{m.label}</b><small>{m.desc}</small></span>
                  <Switch checked={d.modules[m.key]} onChange={(v) => setD({ ...d, modules: { ...d.modules, [m.key]: v } })} label={<span className="e-sr">{m.label}</span>} />
                </div>
              ))}
              <p className="e-caption" style={{ margin: 0 }}><Icon name="info" size="sm" /> Desligar um ambiente o esconde para este cliente. Nenhum dado é apagado.</p>
            </div>
          </>
        )}
      </Drawer>
      <Modal
        open={!!confirmOff}
        onClose={() => setConfirmOff(null)}
        icon="lock"
        tone="soft"
        title="Desligar ambientes deste cliente?"
        sub={confirmOff?.join(" · ")}
        footer={<><Button variant="secondary" onClick={() => setConfirmOff(null)}>Voltar</Button><Button loading={saving} onClick={() => submit(true)}>Desligar e salvar</Button></>}
      >
        <p className="e-small" style={{ margin: 0 }}>A equipe e o cliente deixam de ver esses ambientes. Tudo o que foi registrado continua guardado e volta a aparecer se você religar.</p>
      </Modal>
    </>
  );
}
