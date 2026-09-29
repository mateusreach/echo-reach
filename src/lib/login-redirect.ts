// Leva ao login lembrando a página de origem, para voltar a ela depois de entrar.
const KEY = "echo.redirect";

export function goToLogin(navigate: (opts: { to: string }) => unknown) {
  try {
    const here = window.location.pathname + window.location.search;
    if (!here.startsWith("/auth")) sessionStorage.setItem(KEY, here);
  } catch {
    /* sem sessão: volta para a Home */
  }
  navigate({ to: "/auth" });
}

/** Destino salvo (só caminhos internos), consumido uma única vez. */
export function takeLoginRedirect(): string | null {
  try {
    const r = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return r && r.startsWith("/") && !r.startsWith("//") && !r.startsWith("/auth") ? r : null;
  } catch {
    return null;
  }
}
