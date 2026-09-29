import type { ReactNode, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Props = HTMLAttributes<HTMLDivElement> & {
  level?: 1 | 2 | 3;
  children: ReactNode;
};

export function GlassCard({ level = 2, className, children, ...rest }: Props) {
  const lvl = level === 1 ? "glass-1" : level === 3 ? "glass-3" : "glass-2";
  return (
    <div {...rest} className={cn(lvl, "rounded-2xl", className)}>
      {children}
    </div>
  );
}
