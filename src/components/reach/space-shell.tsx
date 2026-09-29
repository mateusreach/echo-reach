import { Link } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { applyBrandColors } from "@/lib/branding";
import { EchoLayout, EchoSubnav } from "@/components/echo/layout";
import { Icon } from "@/components/echo/icon";

/** Moldura do Espaço 360: barra do Echo, cliente em contexto e navegação do espaço. */
export function SpaceShell({
  children,
  brandSlug,
  brandName,
  primaryColor,
  accentColor,
}: {
  children: ReactNode;
  brandSlug: string;
  brandName: string;
  primaryColor?: string | null;
  accentColor?: string | null;
}) {
  useEffect(() => {
    applyBrandColors(primaryColor, accentColor);
    return () => applyBrandColors(null, null);
  }, [primaryColor, accentColor]);

  const p = { brandSlug };
  const s = { tab: undefined, filtro: undefined };
  return (
    <EchoLayout
      env="e360"
      wide
      eyebrow={<Link to="/e360" className="e-link" style={{ fontSize: "inherit", fontWeight: 500 }}><Icon name="chevLeft" size="sm" /> Espaço 360</Link>}
      title={brandName}
      nav={
        <EchoSubnav
          label="Áreas do cliente"
          items={[
            { to: "/e360/$brandSlug", params: p, search: s, label: "Execução", exact: true, icon: "zap" },
            { to: "/e360/$brandSlug/plano", params: p, search: s, label: "Plano", icon: "target" },
            { to: "/e360/$brandSlug/agenda", params: p, search: s, label: "Agenda", icon: "calendar" },
            { to: "/e360/$brandSlug/resultados", params: p, search: s, label: "Resultados", icon: "chart" },
            { to: "/e360/$brandSlug/personalizacao", params: p, search: s, label: "Personalização", icon: "palette" },
          ]}
          secondary={[
            { to: "/b/$brandSlug/biblioteca", params: p, search: { tab: undefined }, label: "Brand", icon: "layers" },
            { to: "/workspace/cliente/$brandSlug", params: p, label: "Workspace", icon: "grid" },
          ]}
        />
      }
    >
      {children}
    </EchoLayout>
  );
}
