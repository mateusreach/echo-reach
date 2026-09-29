// Echo · like-notify: envia por e-mail as notificações pendentes.
// Rodar a cada 5 min (pg_cron + pg_net, ou agendador do Supabase). Respeita:
// preferência de e-mail, horário silencioso (fica para depois) e resumo diário
// (junta tudo num e-mail às 8h). Marca email_status: enviado | resumo | ignorado.
import { createClient } from "npm:@supabase/supabase-js@2";
import { echoMail, sendMail } from "../_shared/echo-mail.ts";

const APP = Deno.env.get("ECHO_APP_URL") ?? "https://echo.reach.com.br";

function inQuiet(p: { quiet_start: string | null; quiet_end: string | null; timezone: string }, now: Date) {
  if (!p.quiet_start || !p.quiet_end) return false;
  const hm = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: p.timezone }).format(now);
  const [s, e] = [p.quiet_start.slice(0, 5), p.quiet_end.slice(0, 5)];
  return s <= e ? hm >= s && hm <= e : hm >= s || hm <= e;
}

Deno.serve(async () => {
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const now = new Date();
  const { data: pend } = await db.from("notifications").select("*").eq("email_status", "pendente").order("created_at").limit(500);
  const byUser = new Map<string, any[]>();
  for (const n of pend ?? []) byUser.set(n.user_id, [...(byUser.get(n.user_id) ?? []), n]);
  let sent = 0;
  for (const [userId, list] of byUser) {
    const { data: prefs } = await db.from("notification_prefs").select("*").eq("user_id", userId).maybeSingle();
    const p = prefs ?? { email: true, daily_digest: false, quiet_start: null, quiet_end: null, timezone: "America/Sao_Paulo" };
    const ids = list.map((n) => n.id);
    if (!p.email) { await db.from("notifications").update({ email_status: "ignorado" }).in("id", ids); continue; }
    if (inQuiet(p, now)) continue; // tenta de novo na próxima rodada
    const { data: prof } = await db.from("profiles").select("email, display_name").eq("id", userId).maybeSingle();
    if (!prof?.email) { await db.from("notifications").update({ email_status: "ignorado" }).in("id", ids); continue; }
    const first = (prof.display_name ?? "").split(" ")[0];
    if (p.daily_digest) {
      const hour = Number(new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", hour12: false, timeZone: p.timezone }).format(now));
      if (hour !== 8) continue;
      const html = echoMail({ title: `${first ? `${first}, ` : ""}seu resumo do Like`, lines: list.slice(0, 12).map((n) => `• ${n.title}${n.body ? ` — ${n.body}` : ""}`), button: { label: "Abrir o Like", href: `${APP}/like` } });
      if (await sendMail(prof.email, `Resumo do Like · ${list.length} ${list.length === 1 ? "novidade" : "novidades"}`, html)) { await db.from("notifications").update({ email_status: "resumo" }).in("id", ids); sent++; }
      continue;
    }
    for (const n of list) {
      const html = echoMail({ title: n.title, lines: [n.body ?? "Você tem novidades no Like."], button: { label: n.kind === "like.lembrete" || n.kind === "like.nova_rodada" || n.kind === "like.nova_versao" ? "Revisar agora" : "Abrir", href: `${APP}${n.link ?? "/like"}` } });
      if (await sendMail(prof.email, n.title, html)) { await db.from("notifications").update({ email_status: "enviado" }).eq("id", n.id); sent++; }
    }
  }
  return new Response(JSON.stringify({ sent }), { headers: { "Content-Type": "application/json" } });
});
