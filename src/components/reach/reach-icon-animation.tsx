import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { OrbitLoader } from "@/components/echo/logo";
import { isDemoMode } from "@/lib/home-data";

export type ReachIconAnimationContext =
  | "boot"
  | "page-loading"
  | "transition"
  | "processing"
  | "empty-state";

const CONTEXT_LABEL: Record<ReachIconAnimationContext, string> = {
  boot: "Carregando o Echo",
  "page-loading": "Carregando conteúdo",
  transition: "Carregando página",
  processing: "Processando",
  "empty-state": "Echo",
};

/**
 * Carregador do Echo (as órbitas da marca), no lugar da animação Lottie do
 * piloto. Mantém a mesma assinatura para não mexer nas telas que o usam.
 * No modo demonstração (sem Supabase), explica por que a tela não carrega.
 */
export function ReachIconAnimation({
  size = 40,
  context = "page-loading",
  label,
  className,
}: {
  size?: number;
  loop?: boolean;
  play?: boolean;
  context?: ReachIconAnimationContext;
  label?: string;
  className?: string;
}) {
  const [demo, setDemo] = useState(false);
  useEffect(() => {
    if (!isDemoMode() || context === "transition" || context === "processing") return;
    const t = window.setTimeout(() => setDemo(true), 1500);
    return () => window.clearTimeout(t);
  }, [context]);
  return (
    <span className={className} style={{ display: "inline-grid", justifyItems: "center", gap: 14 }}>
      <OrbitLoader size={Math.max(56, Math.round(size * 1.8))} label={label ?? CONTEXT_LABEL[context]} />
      {demo && (
        <span className="echo-demo" role="status" style={{ maxWidth: 420, textAlign: "left", marginTop: 8 }}>
          <span>
            <b>Modo demonstração.</b> Esta tela lê os dados do banco, que não está conectado neste computador.{" "}
            <Link to="/" className="e-link">Voltar à Home</Link>
          </span>
        </span>
      )}
    </span>
  );
}
