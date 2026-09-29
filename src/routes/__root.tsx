import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { useEffect, type ReactNode } from "react";
import { applyTheme, getStoredTheme } from "@/lib/branding";
import { EchoBackdrop } from "@/components/echo/shell";
import { AppearanceSync } from "@/components/echo/session";
import { EmptyState } from "@/components/echo/primitives";
import { APPEARANCE_BOOT, applyAppearance, readAppearance } from "@/components/echo/appearance";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="echo-center">
      <div className="e-glass" style={{ borderRadius: "var(--r-2xl)", maxWidth: 520, width: "100%" }}>
        <EmptyState
          kind="search"
          title="Página não encontrada"
          text="O endereço não existe ou foi movido. Volte para a Home e siga pelos ambientes."
          actions={<Link to="/" className="e-btn primary">Ir para a Home</Link>}
        />
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error as Error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="echo-center">
      <div className="e-glass" style={{ borderRadius: "var(--r-2xl)", maxWidth: 520, width: "100%" }}>
        <EmptyState
          kind="error"
          title="Esta página não carregou"
          text="Algo deu errado do nosso lado. Tente de novo ou volte para a Home."
          actions={
            <>
              <button type="button" className="e-btn secondary" onClick={() => { router.invalidate(); reset(); }}>Tentar novamente</button>
              <a href="/" className="e-btn ghost">Ir para a Home</a>
            </>
          }
        />
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Echo · Reach" },
      {
        name: "description",
        content:
          "Brand, Workspace, Like e Espaço 360: planejamento, produção, aprovação e acompanhamento de cada cliente da Reach.",
      },
      { name: "author", content: "Reach" },
      { property: "og:title", content: "Echo · Reach" },
      { property: "og:description", content: "A plataforma da Reach para marcas, operação e aprovação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Figtree:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Geist+Mono:wght@400;500;600&family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600&display=swap",
      },
      // Ícone oficial Reach Brand como favicon (versão estática, não animada).
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", href: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { rel: "icon", href: "/favicon-192x192.png", type: "image/png", sizes: "192x192" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" data-reach-theme="blue">
      <head>
        {/* Aplica base e caminho de cor antes da primeira pintura. */}
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_BOOT }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // Aplica o tema e a paleta oficial Reach logo na abertura do app.
  useEffect(() => {
    applyTheme(getStoredTheme());
    // A aparência do Echo (base + caminho de cor) prevalece e mantém o piloto sincronizado.
    applyAppearance(readAppearance());
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Fundo do Echo (aura + grão) comum a todas as telas. */}
      <EchoBackdrop />
      <AppearanceSync />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster />
    </QueryClientProvider>
  );
}
