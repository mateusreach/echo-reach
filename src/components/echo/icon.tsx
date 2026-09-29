import { ICON_PATHS } from "./icon-paths";

export type IconName = keyof typeof ICON_PATHS | string;

/** Ícone da família Echo Line. Tamanhos: sm 16 · md 20 · lg 24 (padrão 1.25em). */
export function Icon({ name, size, className = "", label }: { name: IconName; size?: "sm" | "md" | "lg"; className?: string; label?: string }) {
  const body = (ICON_PATHS[name] ?? ICON_PATHS.circle).replace(/class="f"/g, 'fill="currentColor" stroke="none"');
  return (
    <svg
      className={`e-ic ${size ?? ""} ${className}`}
      viewBox="0 0 24 24"
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      dangerouslySetInnerHTML={{ __html: body }}
    />
  );
}
