// Echo · modelo de e-mail (logo, faixa com as cores dos caminhos, botão "Revisar agora")
// e envio pelo Resend. Variáveis: RESEND_API_KEY, ECHO_MAIL_FROM, ECHO_APP_URL.

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export function echoMail(o: { title: string; lines: string[]; button?: { label: string; href: string }; accent?: string; footer?: string }) {
  const accent = o.accent ?? "#E0578F"; // cor do caminho Like
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#F4F2F8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1D1B26">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:18px;overflow:hidden">
<tr><td style="height:6px;background:linear-gradient(90deg,#7B61FF,#3E8BFF,${accent},#FF8A3D)"></td></tr>
<tr><td style="padding:22px 26px 8px;font-size:18px;font-weight:600;letter-spacing:-.02em">echo <span style="font-size:12px;font-weight:400;color:#8A8795">por Reach</span></td></tr>
<tr><td style="padding:6px 26px 0;font-size:18px;font-weight:600;line-height:1.35">${esc(o.title)}</td></tr>
${o.lines.map((l) => `<tr><td style="padding:8px 26px 0;font-size:14.5px;line-height:1.55;color:#5B5866">${esc(l)}</td></tr>`).join("")}
${o.button ? `<tr><td style="padding:20px 26px 6px"><a href="${esc(o.button.href)}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:${accent};color:#fff;font-weight:600;text-decoration:none">${esc(o.button.label)}</a></td></tr>` : ""}
<tr><td style="padding:18px 26px 24px;font-size:12px;color:#8A8795">${esc(o.footer ?? "Você recebe este e-mail porque participa das aprovações no Echo. Ajuste em Configurações do Like › Suas notificações.")}</td></tr>
</table></td></tr></table></body></html>`;
}

export async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) { console.warn("RESEND_API_KEY ausente: e-mail não enviado", to, subject); return false; }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: Deno.env.get("ECHO_MAIL_FROM") ?? "Echo <echo@reach.com.br>", to, subject, html }),
  });
  if (!r.ok) console.error("Falha no envio", r.status, await r.text());
  return r.ok;
}
