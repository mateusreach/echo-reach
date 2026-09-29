import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Alert, Chip, Field, TextArea } from "@/components/echo/controls";
import { Modal } from "@/components/echo/overlays";
import { Badge, Button, Skeleton } from "@/components/echo/primitives";
import { Icon } from "@/components/echo/icon";
import { EchoLogo } from "@/components/echo/logo";
import { MaterialFrame, ScriptView } from "@/components/echo/like-preview";
import { LIKE_STATUS_TONE } from "@/components/echo/like-cards";
import { KIND_LABEL, PENDING, STATUS_LABEL, guestComment, guestDecide, openLink, requestLinkCode, type Guest } from "@/lib/like-data";

// Link externo de aprovação: sem conta, sem dados pessoais na URL, sem indexação.
export const Route = createFileRoute("/l/$token")({
  head: () => ({ meta: [{ title: "Aprovação · Reach" }, { name: "robots", content: "noindex, nofollow" }, { name: "referrer", content: "no-referrer" }] }),
  component: GuestLink,
});

const PHRASES = ["Ajustar texto", "Ajustar informação", "Ajustar CTA", "Trocar imagem", "Rever formato"];
const GONE: Record<string, { title: string; text: string }> = {
  expirado: { title: "Este link expirou", text: "Peça um novo à Reach." },
  revogado: { title: "Este link foi desativado", text: "Peça um novo à Reach." },
  bloqueado: { title: "Este link foi bloqueado", text: "Houve tentativas demais com um código errado. Peça um novo à Reach." },
  invalido: { title: "Link não encontrado", text: "Confira se copiou o endereço inteiro ou peça um novo à Reach." },
};

function GuestLink() {
  const { token } = Route.useParams();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const view = useQuery({ queryKey: ["guest-link", token], queryFn: () => openLink(token), enabled: ready, staleTime: 0 });
  const [g, setG] = useState<Guest>({ name: "", email: "" });
  const [identified, setIdentified] = useState(false);
  const [codeSent, setCodeSent] = useState<{ demo?: string } | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [adjust, setAdjust] = useState<{ id: string; phrases: string[]; note: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!ready || view.isLoading) return <div className="gl-page"><Skeleton h={80} r={20} /><Skeleton h={420} r={24} /></div>;
  const v = view.data;
  if (!v || v.status !== "ok") {
    const m = GONE[v?.status ?? "invalido"] ?? GONE.invalido;
    return <div className="gl-page"><div className="gl-head"><EchoLogo size={24} /></div><div className="gl-state e-glass"><Icon name="lock" size="lg" /><h1 className="e-h2" style={{ margin: 0 }}>{m.title}</h1><p className="e-body" style={{ margin: 0 }}>{m.text}</p></div></div>;
  }
  const act = v.canComment || v.canDecide;
  const validGuest = g.name.trim().length >= 2 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(g.email.trim());
  const refresh = () => view.refetch();
  const run = async (f: () => Promise<unknown>, ok: string) => { setBusy(true); try { await f(); toast.success(ok); refresh(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); } };

  return (
    <div className="gl-page">
      <header className="gl-head"><EchoLogo size={24} /><b>{v.brand}</b><span className="e-caption">Link válido até {new Date(v.expiresAt!).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span></header>

      {act && !identified && (
        <section className="gl-card e-glass">
          <h1 className="e-h3" style={{ margin: 0 }}>Antes de começar, quem é você?</h1>
          <p className="e-caption" style={{ margin: 0 }}>Seu nome e e-mail ficam registrados junto dos comentários e decisões.</p>
          <div className="ls-link-form" style={{ background: "none", padding: 0 }}>
            <Field label="Nome" value={g.name} onChange={(e) => setG({ ...g, name: e.target.value })} autoComplete="name" />
            <Field label="E-mail" type="email" value={g.email} onChange={(e) => setG({ ...g, email: e.target.value })} autoComplete="email" />
            {v.needsCode && codeSent && <Field label="Código enviado por e-mail" inputMode="numeric" maxLength={6} value={g.code ?? ""} onChange={(e) => setG({ ...g, code: e.target.value.replace(/\D/g, "") })} help={codeSent.demo ? `Modo demonstração: o código é ${codeSent.demo}.` : "Confira sua caixa de entrada."} />}
          </div>
          <div className="gl-actions">
            {v.needsCode && !codeSent ? (
              <Button disabled={!validGuest || busy} onClick={async () => { setBusy(true); try { const r = await requestLinkCode(token, g.email); if (!r.sent) toast.error("Este link é de outro e-mail."); else setCodeSent({ demo: r.demoCode }); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); } }}>Receber código</Button>
            ) : (
              <Button disabled={!validGuest || (v.needsCode && (g.code ?? "").length !== 6)} onClick={() => setIdentified(true)}>Continuar</Button>
            )}
          </div>
        </section>
      )}
      {!act && <Alert kind="info" title="Este link é só para visualizar" />}

      {(v.items ?? []).length === 0 && <div className="gl-state e-glass"><Icon name="checkCircle" size="lg" /><b>Nada para revisar agora</b></div>}
      {(v.items ?? []).map((it) => {
        const ver = it.version;
        const pending = PENDING.includes(it.status);
        const can = identified || !act;
        return (
          <article key={it.id} className="gl-item e-glass">
            <div className="e-row between wrap"><span><span className="e-caption">{KIND_LABEL[it.kind]}{it.publishAt ? ` · publicação ${new Date(it.publishAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}` : ""}</span><h2 className="e-h3" style={{ margin: 0 }}>{it.title}</h2></span><Badge tone={LIKE_STATUS_TONE[it.status]} dot>{STATUS_LABEL[it.status]}</Badge></div>
            {ver && !["roteiro", "texto"].includes(it.kind) && <MaterialFrame assets={ver.assets} kind={it.kind} dimension={it.presetDimension} watermark={pending} />}
            {ver?.caption && <p className="lk-caption">{ver.caption}{ver.hashtags ? <span className="lk-tags"> {ver.hashtags}</span> : null}</p>}
            {ver?.script && ver.script.length > 0 && <ScriptView script={ver.script} />}
            {ver?.textBody && <div className="lk-textbody">{ver.textBody}</div>}
            {ver && ver.number > 1 && ver.changesNote && <div className="rv-changed"><Icon name="sparkle" size="sm" /><span><b>O que mudou na v{ver.number}</b>{ver.changesNote}</span></div>}
            {it.comments.length > 0 && <ul className="gl-comments">{it.comments.map((c, i) => <li key={i}><b>{c.authorName}</b> {c.body}</li>)}</ul>}
            {can && identified && v.canComment && (
              <div className="e-row" style={{ gap: 8, alignItems: "flex-end" }}>
                <div className="e-grow"><TextArea label="Comentário" rows={2} value={drafts[it.id] ?? ""} onChange={(e) => setDrafts({ ...drafts, [it.id]: e.target.value })} /></div>
                <Button variant="secondary" icon="send" disabled={!(drafts[it.id] ?? "").trim() || busy} onClick={() => run(async () => { await guestComment(token, g, it.id, drafts[it.id]); setDrafts({ ...drafts, [it.id]: "" }); }, "Comentário enviado")}>Enviar</Button>
              </div>
            )}
            {can && identified && v.canDecide && pending && (
              <div className="gl-actions">
                <Button variant="secondary" icon="refresh" onClick={() => setAdjust({ id: it.id, phrases: [], note: "" })}>Pedir ajustes</Button>
                <Button icon="check" loading={busy} onClick={() => run(() => guestDecide(token, g, it.id, "approved"), "Material aprovado. Obrigado!")}>Aprovar</Button>
              </div>
            )}
          </article>
        );
      })}

      <Modal open={!!adjust} onClose={() => setAdjust(null)} title="Pedir ajustes" icon="refresh"
        footer={<><Button variant="ghost" onClick={() => setAdjust(null)}>Cancelar</Button><Button loading={busy} disabled={!adjust?.note.trim() && !adjust?.phrases.length} onClick={() => run(async () => { await guestDecide(token, g, adjust!.id, "changes_requested", adjust!.note, adjust!.phrases); setAdjust(null); }, "Pedido enviado para a Reach")}>Enviar pedido</Button></>}>
        {adjust && <div className="stack">
          <div className="e-row wrap" style={{ gap: 6 }}>{PHRASES.map((p) => <Chip key={p} pressed={adjust.phrases.includes(p)} onClick={() => setAdjust({ ...adjust, phrases: adjust.phrases.includes(p) ? adjust.phrases.filter((x) => x !== p) : [...adjust.phrases, p] })}>{p}</Chip>)}</div>
          <TextArea label="O que precisa mudar?" rows={3} value={adjust.note} onChange={(e) => setAdjust({ ...adjust, note: e.target.value })} />
        </div>}
      </Modal>
    </div>
  );
}
