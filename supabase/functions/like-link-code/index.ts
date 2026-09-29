// Echo · like-link-code: manda o código de verificação de um link externo restrito
// a um e-mail. O código é gerado no banco (like_link_request_code, só service role)
// e nunca volta para o navegador.
import { createClient } from "npm:@supabase/supabase-js@2";
import { echoMail, sendMail } from "../_shared/echo-mail.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { token, email } = await req.json();
    if (typeof token !== "string" || typeof email !== "string" || token.length !== 64) return new Response(JSON.stringify({ sent: false }), { status: 400, headers: cors });
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: code, error } = await db.rpc("like_link_request_code", { p_token: token, p_email: email });
    if (error) return new Response(JSON.stringify({ sent: false, error: error.message }), { status: 400, headers: cors });
    if (!code) return new Response(JSON.stringify({ sent: false }), { headers: cors }); // e-mail não confere: resposta igual, sem dizer qual é
    const html = echoMail({ title: `Seu código: ${code}`, lines: ["Use este código para comentar e aprovar os materiais da Reach.", "Ele vale por 15 minutos."], footer: "Se não foi você, ignore este e-mail." });
    await sendMail(email, `Código de acesso: ${code}`, html);
    return new Response(JSON.stringify({ sent: true }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch {
    return new Response(JSON.stringify({ sent: false }), { status: 400, headers: cors });
  }
});
