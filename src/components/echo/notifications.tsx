// ---------------------------------------------------------------------------
// Echo · central de notificações (sino na barra superior)
// Tempo real, agrupada em hoje / esta semana / antes, marcar como lida, marcar
// todas e ir ao item. Contador no sino.
// ---------------------------------------------------------------------------
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icon";
import { isDemoMode } from "@/lib/home-data";
import { demoActor } from "@/lib/like-data";
import { listNotifications, markAllRead, markRead, subscribeNotifications, type Notification } from "@/lib/notify-data";

const ICON: Record<string, string> = {
  "like.nova_rodada": "inbox", "like.nova_versao": "refresh", "like.lembrete": "clock", "like.mencao": "at", "like.resposta": "reply",
  "like.comentario": "message", "like.decisao": "checkCircle", "like.ajuste": "edit", "like.rodada_vencida": "alert",
};
const rel = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};
function groupOf(iso: string) {
  const d = new Date(iso), now = new Date();
  if (d.toDateString() === now.toDateString()) return "Hoje";
  if (now.getTime() - d.getTime() < 7 * 86400e3) return "Esta semana";
  return "Antes";
}

export function NotificationBell({ userId: liveUserId }: { userId?: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const userId = isDemoMode() ? demoActor().id : liveUserId ?? "";
  const q = useQuery({ queryKey: ["notifications", userId], queryFn: () => listNotifications(userId), enabled: !!userId, staleTime: 30_000 });
  useEffect(() => (userId ? subscribeNotifications(userId, () => qc.invalidateQueries({ queryKey: ["notifications", userId] })) : undefined), [userId]);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", down); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [open]);
  const list = q.data ?? [];
  const unread = list.filter((n) => !n.readAt).length;
  const refresh = () => qc.invalidateQueries({ queryKey: ["notifications", userId] });
  const go = async (n: Notification) => { setOpen(false); if (!n.readAt) { await markRead([n.id]); refresh(); } if (n.link) navigate({ to: n.link as never }); };
  const groups = ["Hoje", "Esta semana", "Antes"].map((g) => ({ g, items: list.filter((n) => groupOf(n.createdAt) === g) })).filter((x) => x.items.length);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" className="e-btn secondary icon nt-bell" aria-label={unread ? `Notificações, ${unread} ${unread === 1 ? "nova" : "novas"}` : "Notificações"} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Icon name="bell" />
        {unread > 0 && <span className="nt-count tnum" aria-hidden="true">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="e-pop right nt-panel" role="dialog" aria-label="Notificações">
          <div className="nt-head"><b>Notificações</b>{unread > 0 && <button type="button" className="e-link" onClick={async () => { await markAllRead(userId); refresh(); }}>Marcar todas como lidas</button>}</div>
          {list.length === 0 ? <div className="nt-empty"><Icon name="bell" /><span>Nada por aqui ainda.</span></div> : (
            <div className="nt-list">
              {groups.map(({ g, items }) => (
                <section key={g}>
                  <div className="e-menu-title e-label">{g}</div>
                  {items.map((n) => (
                    <div key={n.id} className={`nt-item${n.readAt ? "" : " unread"}`}>
                      <button type="button" className="nt-main" onClick={() => go(n)}>
                        <span className="nt-ic"><Icon name={ICON[n.kind] ?? "bell"} size="sm" /></span>
                        <span className="nt-txt"><b>{n.title}</b>{n.body && <small>{n.body}</small>}<small className="nt-time">{rel(n.createdAt)}</small></span>
                      </button>
                      {!n.readAt && <button type="button" className="nt-read" aria-label="Marcar como lida" title="Marcar como lida" onClick={async () => { await markRead([n.id]); refresh(); }}><i /></button>}
                    </div>
                  ))}
                </section>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
