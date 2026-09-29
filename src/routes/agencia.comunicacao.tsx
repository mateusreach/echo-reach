import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar, Badge, Button, EmptyState, Skeleton } from "@/components/echo/primitives";
import { Chip, Field, Menu, Select, Switch, TextArea } from "@/components/echo/controls";
import { Drawer, HoldButton, Modal } from "@/components/echo/overlays";
import { Icon } from "@/components/echo/icon";
import { stagger } from "@/components/echo/motion";
import { useAccess } from "@/components/echo/session";
import { POST_KINDS } from "@/lib/agency-data";
import { listPostsWithAcks, listTeamForAcks, removePost, savePost, toggleAck, type PostWithAcks } from "@/lib/agency-page-data";
import { relDay } from "@/lib/home-data";

export const Route = createFileRoute("/agencia/comunicacao")({
  head: () => ({ meta: [{ title: "Comunicação · Agência · Echo" }] }),
  component: Communication,
});

type Draft = { id?: string; title: string; content: string; kind: string; pinned: boolean };
const EMPTY: Draft = { title: "", content: "", kind: "comunicado", pinned: false };
const KIND_ICON: Record<string, "megaphone" | "alert" | "refresh" | "lock"> = { comunicado: "megaphone", aviso: "alert", atualizacao: "refresh", nota: "lock" };

function fmt(isoTs: string) {
  const d = new Date(isoTs);
  return `${relDay(isoTs.slice(0, 10))} · ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function Communication() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const qc = useQueryClient();
  const { can, session } = useAccess();
  const canCreate = can("comunicacao.criar");
  const canDelete = can("comunicacao.excluir");
  const posts = useQuery({ queryKey: ["agency-posts"], queryFn: listPostsWithAcks, enabled: ready });
  const team = useQuery({ queryKey: ["agency-team-acks"], queryFn: listTeamForAcks, enabled: ready, staleTime: 120_000 });
  const [kind, setKind] = useState<string>("todos");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<{ title?: string }>({});
  const [saving, setSaving] = useState(false);
  const [acksOf, setAcksOf] = useState<PostWithAcks | null>(null);
  const [toDelete, setToDelete] = useState<PostWithAcks | null>(null);
  const list = useRef<HTMLDivElement>(null);

  const all = posts.data ?? [];
  const shown = useMemo(() => (kind === "todos" ? all : all.filter((p) => p.kind === kind)), [all, kind]);
  useEffect(() => { if (list.current && posts.data) stagger(list.current.querySelectorAll(".post-card"), { y: 12, dur: 420 }, 50); }, [kind, !!posts.data]);

  const refresh = () => { qc.invalidateQueries({ queryKey: ["agency-posts"] }); qc.invalidateQueries({ queryKey: ["agency-home"] }); };
  const ack = async (p: PostWithAcks) => {
    try { await toggleAck(p.id, !p.mine); toast.success(p.mine ? "Confirmação removida" : "Leitura confirmada"); refresh(); }
    catch { toast.error("Não foi possível registrar. Tente de novo."); }
  };
  const save = async () => {
    if (!draft) return;
    if (!draft.title.trim()) { setErrors({ title: "Dê um título ao comunicado." }); return; }
    setSaving(true);
    try {
      await savePost({ ...draft, title: draft.title.trim(), content: draft.content.trim() });
      toast.success(draft.id ? "Comunicado atualizado" : "Comunicado publicado");
      setDraft(null);
      refresh();
    } catch {
      toast.error("Não foi possível salvar. Confira sua permissão e tente de novo.");
    } finally {
      setSaving(false);
    }
  };
  const pin = async (p: PostWithAcks) => {
    try { await savePost({ id: p.id, title: p.title, content: p.content ?? "", kind: p.kind, pinned: !p.pinned }); toast.success(p.pinned ? "Comunicado desafixado" : "Comunicado fixado no topo"); refresh(); }
    catch { toast.error("Não foi possível alterar."); }
  };
  const remove = async () => {
    if (!toDelete) return;
    try { await removePost(toDelete.id); toast.success("Comunicado excluído"); setToDelete(null); refresh(); }
    catch { toast.error("Não foi possível excluir."); }
  };

  const teamList = team.data ?? [];
  const pending = acksOf ? teamList.filter((t) => !acksOf.acks.some((a) => a.userId === t.id)) : [];

  return (
    <div className="stack-lg">
      <div className="e-row between wrap" style={{ gap: 12 }}>
        <div className="e-row wrap" style={{ gap: 6 }} role="group" aria-label="Filtrar por tipo">
          <Chip pressed={kind === "todos"} onClick={() => setKind("todos")} count={all.length}>Todos</Chip>
          {POST_KINDS.map((k) => (
            <Chip key={k.key} icon={KIND_ICON[k.key]} pressed={kind === k.key} onClick={() => setKind(k.key)} count={all.filter((p) => p.kind === k.key).length}>{k.label}</Chip>
          ))}
        </div>
        {canCreate && <Button icon="plus" onClick={() => { setErrors({}); setDraft({ ...EMPTY }); }}>Novo comunicado</Button>}
      </div>

      {!ready || posts.isLoading ? (
        <div className="stack-lg" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="post-card e-glass"><Skeleton w="30%" h={12} /><Skeleton w="60%" h={20} r={8} /><Skeleton h={40} r={10} /></div>)}</div>
      ) : posts.isError ? (
        <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}><EmptyState kind="error" title="Não foi possível carregar o mural" text="Tente de novo em instantes." actions={<Button variant="secondary" icon="refresh" onClick={() => posts.refetch()}>Tentar novamente</Button>} /></div>
      ) : shown.length === 0 ? (
        <div className="e-glass" style={{ borderRadius: "var(--r-2xl)" }}>
          <EmptyState icon="megaphone" title={kind === "todos" ? "Nenhum comunicado ainda" : "Nenhum comunicado deste tipo"} text="Publique avisos, atualizações e notas para toda a equipe da Reach." actions={canCreate ? <Button icon="plus" onClick={() => setDraft({ ...EMPTY, kind: kind === "todos" ? "comunicado" : kind })}>Novo comunicado</Button> : undefined} />
        </div>
      ) : (
        <div className="stack-lg" ref={list}>
          {shown.map((p) => {
            const mineOwn = p.created_by === session?.userId || session?.isAdmin || session?.mode === "demo";
            const missing = teamList.filter((t) => !p.acks.some((a) => a.userId === t.id)).length;
            return (
              <article key={p.id} className={`post-card e-glass${p.pinned ? " pinned" : ""}`}>
                <header className="e-row between" style={{ gap: 10, alignItems: "flex-start" }}>
                  <div className="e-row wrap" style={{ gap: 6 }}>
                    {p.pinned && <Badge tone="grad" icon="pin">Fixado</Badge>}
                    <Badge tone="glass" icon={KIND_ICON[p.kind]}>{POST_KINDS.find((k) => k.key === p.kind)?.label ?? p.kind}</Badge>
                  </div>
                  {mineOwn && (canCreate || canDelete) && (
                    <Menu
                      align="right"
                      trigger={({ open, toggle }) => <Button variant="ghost" size="sm" iconOnly icon="more" aria-label="Ações do comunicado" aria-expanded={open} onClick={toggle} />}
                      items={[
                        ...(canCreate ? [{ label: "Editar", icon: "edit" as const, onSelect: () => { setErrors({}); setDraft({ id: p.id, title: p.title, content: p.content ?? "", kind: p.kind, pinned: p.pinned }); } }, { label: p.pinned ? "Desafixar" : "Fixar no topo", icon: "pin" as const, onSelect: () => pin(p) }] : []),
                        ...(canDelete ? ["-" as const, { label: "Excluir", icon: "trash" as const, danger: true, onSelect: () => setToDelete(p) }] : []),
                      ]}
                    />
                  )}
                </header>
                <h3 className="e-h4" style={{ margin: 0 }}>{p.title}</h3>
                {p.content && <p className="post-body">{p.content}</p>}
                <footer className="post-foot">
                  <span className="e-row" style={{ gap: 8 }}><Avatar name={p.author} size="xs" /><span className="e-caption">{p.author} · {fmt(p.created_at)}</span></span>
                  <span className="sp" />
                  <button type="button" className="e-link" style={{ fontSize: 13 }} onClick={() => setAcksOf(p)}>
                    {p.acks.length} {p.acks.length === 1 ? "confirmou" : "confirmaram"}{teamList.length ? ` · faltam ${missing}` : ""}
                  </button>
                  <Button size="sm" variant={p.mine ? "tonal" : "primary"} icon={p.mine ? "check" : undefined} onClick={() => ack(p)}>{p.mine ? "Ciente" : "Marcar como ciente"}</Button>
                </footer>
              </article>
            );
          })}
        </div>
      )}

      <Drawer
        open={!!draft}
        onClose={() => setDraft(null)}
        eyebrow="Mural da agência"
        title={draft?.id ? "Editar comunicado" : "Novo comunicado"}
        footer={<><Button variant="ghost" onClick={() => setDraft(null)}>Cancelar</Button><Button icon="send" loading={saving} onClick={save}>{draft?.id ? "Salvar" : "Publicar"}</Button></>}
      >
        {draft && (
          <>
            <Field label="Título" value={draft.title} onChange={(e) => { setDraft({ ...draft, title: e.target.value }); setErrors({}); }} placeholder="Ex.: Feriado de 12 de outubro" error={errors.title} autoFocus />
            <Select label="Tipo" value={draft.kind} onChange={(v) => setDraft({ ...draft, kind: v })} options={POST_KINDS.map((k) => ({ value: k.key, label: k.label, icon: KIND_ICON[k.key] }))} />
            <TextArea label="Mensagem" value={draft.content} max={2000} rows={7} onChange={(e) => setDraft({ ...draft, content: e.target.value })} placeholder="O que a equipe precisa saber e o que deve fazer." />
            <Switch label="Fixar no topo do mural" checked={draft.pinned} onChange={(v) => setDraft({ ...draft, pinned: v })} />
          </>
        )}
      </Drawer>

      <Drawer open={!!acksOf} onClose={() => setAcksOf(null)} eyebrow="Confirmações de leitura" title={acksOf?.title ?? ""}>
        {acksOf && (
          <>
            <div className="e-stack" style={{ gap: 6 }}>
              <span className="e-label">Confirmaram · {acksOf.acks.length}</span>
              {acksOf.acks.length === 0 ? <p className="e-small" style={{ margin: 0 }}>Ninguém confirmou ainda.</p> : acksOf.acks.map((a) => (
                <div key={a.userId} className="e-row" style={{ gap: 10, padding: "6px 4px" }}><Avatar name={a.name} size="sm" /><span className="e-grow">{a.name}</span><span className="e-caption">{fmt(a.at)}</span><Icon name="checkCircle" size="sm" /></div>
              ))}
            </div>
            <div className="e-stack" style={{ gap: 6 }}>
              <span className="e-label">Faltam · {pending.length}</span>
              {pending.length === 0 ? <p className="e-small" style={{ margin: 0 }}>Toda a equipe confirmou.</p> : pending.map((t) => (
                <div key={t.id} className="e-row" style={{ gap: 10, padding: "6px 4px", opacity: 0.75 }}><Avatar name={t.name} size="sm" /><span className="e-grow">{t.name}</span><span className="e-caption">pendente</span></div>
              ))}
            </div>
          </>
        )}
      </Drawer>

      <Modal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        icon="trash"
        tone="danger"
        title="Excluir este comunicado?"
        sub={toDelete?.title}
        footer={<><Button variant="secondary" onClick={() => setToDelete(null)}>Cancelar</Button><HoldButton label="Segure para excluir" onConfirm={remove} /></>}
      >
        <p className="e-small" style={{ margin: 0 }}>O comunicado e as confirmações de leitura saem do mural. Não é possível desfazer.</p>
      </Modal>
    </div>
  );
}
