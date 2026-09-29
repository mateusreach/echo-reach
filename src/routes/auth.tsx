import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EchoLogo, type EchoLogoHandle } from "@/components/echo/logo";
import { Button } from "@/components/echo/primitives";
import { Alert, Field } from "@/components/echo/controls";
import { Icon } from "@/components/echo/icon";
import { ENVS } from "@/components/echo/shell";
import { stagger } from "@/components/echo/motion";
import { isDemoMode } from "@/lib/home-data";
import { takeLoginRedirect } from "@/lib/login-redirect";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar · Echo" },
      { name: "description", content: "Acesse o Echo, a plataforma da Reach: Brand, Workspace, Like e Espaço 360." },
      { property: "og:title", content: "Entrar · Echo" },
    ],
  }),
  component: AuthPage,
});

type ViewMode = "login" | "forgot" | "reset";

/**
 * Um link de convite ou de recuperação cria uma sessão temporária. Ela nunca
 * pode valer como login final: a pessoa precisa definir a própria senha antes
 * de entrar no Echo.
 */
function linkContext(): "invite" | "recovery" | null {
  if (typeof window === "undefined") return null;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const search = new URLSearchParams(window.location.search);
  const type = hash.get("type") ?? search.get("type");
  if (type === "invite" || type === "signup" || search.get("invite") === "1") return "invite";
  if (type === "recovery" || search.get("recovery") === "1") return "recovery";
  return null;
}

/** Destino depois de entrar: só caminhos internos do próprio Echo. */
function redirectTarget(): string {
  if (typeof window === "undefined") return "/";
  const r = new URLSearchParams(window.location.search).get("redirect");
  if (r && r.startsWith("/") && !r.startsWith("//") && !r.startsWith("/auth")) return r;
  return takeLoginRedirect() ?? "/";
}

function passwordStrength(p: string): { score: 0 | 1 | 2 | 3; label: string } {
  if (!p) return { score: 0, label: "" };
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p) && /\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  const score = (p.length < 8 ? 0 : Math.min(3, s)) as 0 | 1 | 2 | 3;
  return { score, label: ["Curta demais", "Razoável", "Boa", "Forte"][score] };
}

function translateAuthError(message: string) {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (m.includes("expired") || m.includes("invalid") && m.includes("token")) return "Este link expirou. Peça um novo convite ou link de recuperação à Reach.";
  if (m.includes("missing supabase")) return "O banco não está conectado neste ambiente.";
  if (m.includes("rate limit")) return "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.";
  return message;
}

function AuthPage() {
  const [mode, setMode] = useState<ViewMode>("login");
  const [passwordFlow, setPasswordFlow] = useState<"invite" | "recovery" | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<{ email: string } | null>(null);
  const [demo, setDemo] = useState(false);
  const navigate = useNavigate();
  const logo = useRef<EchoLogoHandle>(null);
  const card = useRef<HTMLDivElement>(null);
  const hero = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDemo(isDemoMode());
    stagger(hero.current?.querySelectorAll(":scope > *") ?? [], { y: 14, blur: 6, dur: 700 }, 80);
    stagger(card.current ? [card.current] : [], { y: 18, scale: 0.98, blur: 6, dur: 700, delay: 160 });
    window.setTimeout(() => logo.current?.play(), 600);

    // O Supabase envia `type=recovery` no hash e emite PASSWORD_RECOVERY ao
    // abrir o link do e-mail. Essa sessão é temporária: leva à criação de senha.
    const context = linkContext();
    if (context) {
      setPasswordFlow(context);
      setMode("reset");
    }
    if (isDemoMode()) return;
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setPasswordFlow((current) => current ?? "recovery");
        setMode("reset");
      }
      if (event === "SIGNED_IN" && linkContext()) {
        setPasswordFlow((current) => current ?? linkContext());
        setMode("reset");
      }
      if (session?.user?.email) setActiveSession({ email: session.user.email });
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user?.email) setActiveSession({ email: data.session.user.email });
    }).catch(() => undefined);
    return () => listener.subscription.unsubscribe();
  }, []);

  const shake = () => card.current?.animate([{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(5px)" }, { transform: "translateX(-3px)" }, { transform: "translateX(0)" }], { duration: 360, easing: "ease-out" });

  async function switchAccount() {
    setLoading(true);
    await supabase.auth.signOut();
    setActiveSession(null);
    setLoading(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (demo) { setError("O banco não está conectado neste ambiente. Use a Home em modo demonstração para navegar pelo Echo."); shake(); return; }
    setLoading(true);
    try {
      if (mode === "forgot") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth?recovery=1` });
        if (resetError) throw resetError;
        setSuccess("Se este e-mail estiver cadastrado, enviamos um link para criar uma nova senha. Confira também a caixa de spam.");
      } else if (mode === "reset") {
        if (password.length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres.");
        if (password !== passwordConfirmation) throw new Error("As senhas não coincidem.");
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        setSuccess(passwordFlow === "invite" ? "Senha criada. Bem-vindo ao Echo." : "Senha atualizada.");
        setPassword("");
        setPasswordConfirmation("");
        setPasswordFlow(null);
        setMode("login");
        // Limpa o token do link para que ele não volte a valer como acesso.
        window.history.replaceState({}, "", "/auth");
        await supabase.auth.refreshSession();
        navigate({ to: redirectTarget() as never });
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        navigate({ to: redirectTarget() as never });
      }
    } catch (err) {
      setError(err instanceof Error ? translateAuthError(err.message) : "Não foi possível entrar. Tente novamente.");
      shake();
    } finally {
      setLoading(false);
    }
  }

  const strength = passwordStrength(password);
  const title = mode === "login" ? "Entrar" : mode === "forgot" ? "Recuperar senha" : passwordFlow === "invite" ? "Criar sua senha" : "Definir nova senha";
  const lead =
    mode === "login"
      ? "O acesso ao Echo é por convite da Reach ou do administrador do seu cliente."
      : mode === "forgot"
        ? "Informe o e-mail da sua conta. Enviaremos um link para criar uma nova senha."
        : passwordFlow === "invite"
          ? "Você foi convidado para o Echo. Crie uma senha para concluir seu acesso."
          : "Crie uma nova senha para acessar sua conta.";

  return (
    <div className="echo-auth">
      <section className="auth-hero" ref={hero}>
        <span className="auth-logo e-echo-host"><EchoLogo ref={logo} label="Echo" /></span>
        <h1 className="e-display">Cada decisão<br /><em className="e-grad-text">ecoa.</em></h1>
        <p className="home-lead">Brand, Workspace, Like e Espaço 360 na mesma conta: do plano da marca à aprovação do cliente.</p>
        <div className="auth-envs">
          {ENVS.map((e) => (
            <span key={e.id} className="e-lite" style={{ ["--c" as string]: e.color }}><i><Icon name={e.icon} size="sm" /></i>{e.name}</span>
          ))}
        </div>
      </section>

      <section className="auth-card e-glass e-blur" ref={card} aria-labelledby="auth-title">
        {activeSession && mode !== "reset" ? (
          <div className="auth-body">
            <h2 className="e-h3" id="auth-title">Você já está conectado</h2>
            <p className="e-small">Conta: <b style={{ color: "var(--ink)" }}>{activeSession.email}</b></p>
            <Button size="lg" block onClick={() => navigate({ to: redirectTarget() as never })} iconRight="arrowRight">Continuar</Button>
            <Button size="lg" variant="secondary" block loading={loading} onClick={switchAccount}>Trocar de conta</Button>
          </div>
        ) : (
          <form className="auth-body" onSubmit={handleSubmit} noValidate>
            <div>
              <h2 className="e-h3" id="auth-title">{title}</h2>
              <p className="e-small" style={{ marginTop: 6 }}>{lead}</p>
            </div>

            {demo && (
              <Alert kind="warn" title="Banco não conectado" actions={<Link to="/" className="e-btn secondary sm">Ver a Home em demonstração</Link>}>
                Este computador está sem o Supabase configurado, então não é possível entrar. A Home funciona com dados de exemplo.
              </Alert>
            )}

            {mode !== "reset" && (
              <Field label="E-mail" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com.br" icon="at" />
            )}
            {mode !== "forgot" && (
              <Field
                label={mode === "reset" ? "Nova senha" : "Senha"}
                type="password"
                autoComplete={mode === "reset" ? "new-password" : "current-password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                help={mode === "reset" ? "Mínimo de 8 caracteres. Misture letras, números e símbolos." : undefined}
              />
            )}
            {mode === "reset" && password && (
              <div className="auth-strength" aria-live="polite">
                <span className="bars">{[1, 2, 3].map((i) => <i key={i} className={strength.score >= i ? `on s${strength.score}` : ""} />)}</span>
                <span className="e-caption">{strength.label}</span>
              </div>
            )}
            {mode === "reset" && (
              <Field
                label="Confirmar nova senha"
                type="password"
                autoComplete="new-password"
                required
                value={passwordConfirmation}
                onChange={(e) => setPasswordConfirmation(e.target.value)}
                placeholder="••••••••"
                error={passwordConfirmation && passwordConfirmation !== password ? "As senhas não coincidem." : undefined}
              />
            )}

            {error && <Alert kind="danger" title="Não foi possível continuar">{error}</Alert>}
            {success && <Alert kind="ok" title="Pronto">{success}</Alert>}

            <Button size="lg" block type="submit" loading={loading} iconRight={mode === "login" ? "arrowRight" : undefined}>
              {mode === "login" ? "Entrar" : mode === "forgot" ? "Enviar link" : passwordFlow === "invite" ? "Criar senha e entrar" : "Salvar nova senha"}
            </Button>

            {mode === "login" && (
              <button type="button" className="e-link auth-alt" onClick={() => { setMode("forgot"); setError(null); setSuccess(null); }}>Esqueci minha senha</button>
            )}
            {mode === "forgot" && (
              <button type="button" className="e-link auth-alt" onClick={() => { setMode("login"); setError(null); setSuccess(null); }}><Icon name="chevLeft" size="sm" /> Voltar para entrar</button>
            )}
          </form>
        )}
        <p className="auth-foot e-caption">Echo · plataforma da Reach</p>
      </section>
    </div>
  );
}
