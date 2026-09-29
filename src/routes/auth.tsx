import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { PillButton, ReachMark } from "@/components/reach/ui";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Reach Echo" },
      { name: "description", content: "Acesse o Reach Echo: o ecossistema da Reach, com Branding Space, Espaço 360 e Workspace." },
      { property: "og:title", content: "Entrar — Reach Echo" },
      { property: "og:description", content: "Uma só conta para o Brand e o Workspace da Reach." },
    ],
  }),
  component: AuthPage,
});

type ViewMode = "login" | "signup" | "forgot" | "reset";

/**
 * Um link de convite ou de recuperação cria uma sessão temporária. Ela nunca
 * pode valer como login final: o usuário precisa definir a própria senha antes
 * de entrar no Reach Echo.
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

function AuthPage() {
  const [mode, setMode] = useState<ViewMode>("login");
  const [passwordFlow, setPasswordFlow] = useState<"invite" | "recovery" | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<{ email: string } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // O Supabase envia `type=recovery` no hash e emite PASSWORD_RECOVERY ao
    // abrir o link do e-mail. Essa sessão é temporária: ela deve levar à troca
    // de senha, nunca direto ao painel.
    const context = linkContext();
    if (context) {
      setPasswordFlow(context);
      setMode("reset");
    }

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
      if (data.session?.user?.email) {
        setActiveSession({ email: data.session.user.email });
      }
    }).catch(() => undefined);
    return () => listener.subscription.unsubscribe();
  }, []);

  function goBack() {
    if (window.history.length > 1) window.history.back();
    else navigate({ to: "/" });
  }

  async function switchAccount() {
    setLoading(true);
    await supabase.auth.signOut();
    setActiveSession(null);
    setLoading(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      if (mode === "forgot") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth?recovery=1`,
        });
        if (resetError) throw resetError;
        setSuccess("Se este e-mail estiver cadastrado, enviamos um link para redefinir sua senha.");
      } else if (mode === "reset") {
        if (password.length < 6) throw new Error("A nova senha deve ter pelo menos 6 caracteres.");
        if (password !== passwordConfirmation) throw new Error("As senhas não coincidem.");
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        setSuccess("Senha criada. Bem-vindo ao Reach Echo.");
        setPassword("");
        setPasswordConfirmation("");
        setPasswordFlow(null);
        setMode("login");
        // Limpa o token do link para que ele não volte a valer como acesso.
        window.history.replaceState({}, "", "/auth");
        await supabase.auth.refreshSession();
        navigate({ to: "/" });
      } else if (mode === "signup") {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        if (!signUpData.session) {
          setSuccess("Conta criada! Confirme seu e-mail (verifique também a caixa de spam) para poder entrar.");
          setMode("login");
        } else {
          navigate({ to: "/" });
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        navigate({ to: "/" });
      }
    } catch (err) {
      setError(err instanceof Error ? translateAuthError(err.message) : "Não foi possível autenticar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  function translateAuthError(message: string) {
    if (message.toLowerCase().includes("invalid login credentials")) return "E-mail ou senha incorretos.";
    if (message.toLowerCase().includes("user already registered")) return "Este e-mail já está cadastrado.";
    if (message.toLowerCase().includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
    return message;
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <button
          type="button"
          onClick={goBack}
          className="mb-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </button>

        <div className="flex flex-col items-center text-center">
          <ReachMark className="h-14 w-14 text-2xl" />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Reach Echo</h1>
          <p className="mt-1 text-sm text-muted-foreground">Branding Space, Espaço 360 e Workspace na mesma conta</p>
        </div>

        {activeSession && mode !== "reset" && (
          <div className="glass mt-8 rounded-2xl p-5 text-center">
            <p className="text-sm">
              Você já está conectado como <span className="font-medium">{activeSession.email}</span>
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <PillButton size="md" className="w-full" onClick={() => navigate({ to: "/" })}>
                Continuar
              </PillButton>
              <PillButton size="md" variant="secondary" className="w-full" disabled={loading} onClick={switchAccount}>
                {loading ? "Aguarde…" : "Trocar de conta"}
              </PillButton>
            </div>
          </div>
        )}

        {(mode === "reset" || !activeSession) && (
          <div className="glass mt-8 rounded-2xl p-6">
            {mode === "login" && (
              <div className="mb-2">
                <h2 className="text-sm font-medium">Entrar</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  O acesso ao Reach Echo é feito por convite da equipe ou do cliente.
                </p>
              </div>
            )}
            {mode === "forgot" && (
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-medium">Recuperar senha</h2>
                <button type="button" onClick={() => { setMode("login"); setError(null); setSuccess(null); }} className="text-xs text-muted-foreground hover:text-foreground">
                  Voltar ao login
                </button>
              </div>
            )}

            {mode === "reset" && (
              <div className="mb-2">
                <h2 className="text-sm font-medium">
                  {passwordFlow === "invite" ? "Criar sua senha" : "Definir nova senha"}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {passwordFlow === "invite"
                    ? "Você foi convidado para o Reach Echo. Crie uma senha para concluir seu acesso."
                    : "Crie uma nova senha para acessar sua conta."}
                </p>
              </div>
            )}

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              {mode !== "reset" && <div>
                <label className="text-xs text-muted-foreground" htmlFor="email">
                  E-mail
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@agencia.com"
                  className="mt-1 w-full rounded-full border border-border bg-background/50 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>}
              {mode !== "forgot" && (
                <div>
                  <label className="text-xs text-muted-foreground" htmlFor="password">
                    {mode === "reset" ? "Nova senha" : "Senha"}
                  </label>
                  <div className="relative mt-1">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-full border border-border bg-background/50 px-4 py-2.5 pr-11 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}
              {mode === "reset" && (
                <div>
                  <label className="text-xs text-muted-foreground" htmlFor="password-confirmation">
                    Confirmar nova senha
                  </label>
                  <input
                    id="password-confirmation"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={passwordConfirmation}
                    onChange={(e) => setPasswordConfirmation(e.target.value)}
                    placeholder="••••••••"
                    className="mt-1 w-full rounded-full border border-border bg-background/50 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              )}
              {mode === "login" && (
                <button
                  type="button"
                  onClick={() => { setMode("forgot"); setError(null); setSuccess(null); }}
                  className="text-[11.5px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  Esqueci minha senha
                </button>
              )}
              {error && <p className="text-xs text-destructive">{error}</p>}
              {success && <p className="text-xs text-reach-mint">{success}</p>}
              <PillButton size="lg" className="w-full" type="submit" disabled={loading}>
                {loading
                  ? "Aguarde…"
                  : mode === "login"
                    ? "Entrar"
                    : mode === "signup"
                      ? "Criar conta"
                      : mode === "forgot"
                        ? "Enviar link de recuperação"
                        : passwordFlow === "invite"
                          ? "Criar senha e entrar"
                          : "Salvar nova senha"}
              </PillButton>
            </form>
          </div>
        )}

        <p className="mt-8 text-center text-xs text-muted-foreground">
          <span className="text-gradient-brand font-semibold">Reach Echo</span> · Branding Space, Espaço 360 e Workspace
        </p>
      </div>
    </div>
  );
}
