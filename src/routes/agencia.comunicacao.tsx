import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, History, Pin, PinOff, Plus, ThumbsUp, Trash2 } from "lucide-react";
import { PillButton } from "@/components/reach/ui";
import {
  POST_KINDS,
  ackPost,
  createAgencyPost,
  deleteAgencyPost,
  getFullAccess,
  listAgencyPosts,
  listPostAcks,
  listProfiles,
  unackPost,
  updateAgencyPost,
  type AgencyPost,
  type PostAck,
  type ProfileRow,
} from "@/lib/agency-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/agencia/comunicacao")({
  head: () => ({
    meta: [
      { title: "Comunicados — Reach Brand OS" },
      { name: "description", content: "Mural interno da Reach com avisos, comunicados e confirmação de leitura da equipe." },
      { property: "og:title", content: "Comunicados internos da Reach" },
      { property: "og:description", content: "Avisos internos com registro de quem confirmou ciência e quando." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ComunicacaoPage,
});

function ComunicacaoPage() {
  const [posts, setPosts] = useState<AgencyPost[]>([]);
  const [acks, setAcks] = useState<PostAck[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [canPublish, setCanPublish] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [kind, setKind] = useState<string>("aviso");
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    const [p, a, pr] = await Promise.all([listAgencyPosts(), listPostAcks().catch(() => []), listProfiles().catch(() => [])]);
    setPosts(p);
    setAcks(a);
    setProfiles(pr);
  }

  useEffect(() => {
    getFullAccess()
      .then((access) => {
        setUserId(access.userId);
        setIsAdmin(access.isAdmin);
        setCanPublish(access.can("comunicados.publicar"));
      })
      .catch(() => undefined);
    refresh().catch(() => undefined);
  }, []);

  const nameById = useMemo(
    () => new Map(profiles.map((p) => [p.id, p.display_name || p.email || "Usuário"])),
    [profiles],
  );
  const acksByPost = useMemo(() => {
    const map = new Map<string, PostAck[]>();
    for (const a of acks) map.set(a.post_id, [...(map.get(a.post_id) ?? []), a]);
    return map;
  }, [acks]);

  async function submit() {
    if (!title.trim()) return;
    setErr(null);
    try {
      await createAgencyPost({ title: title.trim(), content: content.trim() || null, kind, pinned: false });
      setTitle("");
      setContent("");
      setOpen(false);
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao publicar");
    }
  }

  async function toggleAck(postId: string, mine: boolean) {
    setErr(null);
    try {
      if (mine) await unackPost(postId);
      else await ackPost(postId);
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao registrar confirmação");
    }
  }

  return (
    <div className="space-y-5">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight">Comunicados</h1>
          <p className="truncate text-sm text-muted-foreground">
            Avisos internos com registro formal de ciência: quem confirmou e quando.
          </p>
        </div>
        {canPublish && (
          <PillButton onClick={() => setOpen((v) => !v)} className="shrink-0">
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Novo comunicado</span>
          </PillButton>
        )}
      </header>

      {err && <p className="text-sm text-destructive">{err}</p>}

      {open && canPublish && (
        <section className="surface space-y-3 rounded-2xl p-5">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" className="w-full rounded-full border border-border bg-background/50 px-4 py-2.5 text-sm outline-none focus:border-primary" />
          <textarea rows={4} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Mensagem" className="w-full rounded-2xl border border-border bg-background/50 px-4 py-2.5 text-sm outline-none focus:border-primary" />
          <div className="flex flex-wrap items-center gap-2">
            <select value={kind} onChange={(e) => setKind(e.target.value)} className="rounded-full border border-border bg-background/50 px-4 py-2 text-sm outline-none">
              {POST_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
            </select>
            <PillButton onClick={submit}>Publicar</PillButton>
          </div>
        </section>
      )}

      <div className="space-y-3">
        {posts.map((p) => {
          const postAcks = acksByPost.get(p.id) ?? [];
          const mine = !!userId && postAcks.some((a) => a.user_id === userId);
          return (
            <article key={p.id} className={cn("surface rounded-2xl p-5", p.pinned && "ring-1 ring-primary/40")}>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    {POST_KINDS.find((k) => k.key === p.kind)?.label ?? p.kind} · {new Date(p.created_at).toLocaleDateString("pt-BR")}
                  </p>
                  <h2 className="truncate text-sm font-semibold">{p.title}</h2>
                </div>
                {canPublish && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      aria-label={p.pinned ? "Desafixar" : "Fixar"}
                      onClick={async () => {
                        await updateAgencyPost(p.id, { pinned: !p.pinned });
                        await refresh();
                      }}
                      className="grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground"
                    >
                      {p.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      aria-label="Excluir comunicado"
                      onClick={async () => {
                        await deleteAgencyPost(p.id);
                        await refresh();
                      }}
                      className="grid h-9 w-9 place-items-center rounded-full border border-border text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
              {p.content && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{p.content}</p>}

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <button
                  onClick={() => toggleAck(p.id, mine)}
                  aria-pressed={mine}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-medium transition-colors",
                    mine
                      ? "border-success/40 bg-success/10 text-success"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {mine ? <Check className="h-3.5 w-3.5" /> : <ThumbsUp className="h-3.5 w-3.5" />}
                  {mine ? "Você está ciente" : "Estou ciente"}
                </button>

                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  {postAcks.slice(0, 6).map((a) => (
                    <span
                      key={a.id}
                      title={`${nameById.get(a.user_id) ?? "Usuário"} · ${new Date(a.created_at).toLocaleString("pt-BR")}`}
                      className="grid h-7 w-7 place-items-center rounded-full bg-muted text-[10.5px] font-semibold text-muted-foreground"
                    >
                      {initials(nameById.get(a.user_id) ?? "?")}
                    </span>
                  ))}
                  <span className="text-[11px] text-muted-foreground">
                    {postAcks.length === 0 ? "Ninguém confirmou ainda" : `${postAcks.length} confirmação(ões)`}
                  </span>
                </div>

                {isAdmin && (
                  <button
                    onClick={() => setHistoryFor(historyFor === p.id ? null : p.id)}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] text-muted-foreground"
                  >
                    <History className="h-3.5 w-3.5" /> Histórico
                  </button>
                )}
              </div>

              {isAdmin && historyFor === p.id && (
                <div className="mt-3 space-y-1 rounded-2xl border border-border p-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Histórico de confirmações</p>
                  {postAcks.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma confirmação registrada.</p>}
                  {postAcks.map((a) => (
                    <p key={a.id} className="text-xs">
                      <span className="font-medium">{nameById.get(a.user_id) ?? a.user_id}</span>{" "}
                      <span className="text-muted-foreground">confirmou em {new Date(a.created_at).toLocaleString("pt-BR")}</span>
                    </p>
                  ))}
                  <p className="pt-1 text-[11px] text-muted-foreground">
                    Pendentes: {pending(profiles, postAcks).join(", ") || "ninguém"}
                  </p>
                </div>
              )}
            </article>
          );
        })}
        {posts.length === 0 && <p className="text-sm text-muted-foreground">Nenhum comunicado ainda.</p>}
      </div>
    </div>
  );
}

function pending(profiles: ProfileRow[], acks: PostAck[]) {
  const done = new Set(acks.map((a) => a.user_id));
  return profiles
    .filter((p) => p.role === "agency" && !done.has(p.id))
    .map((p) => p.display_name || p.email || "Usuário");
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}
