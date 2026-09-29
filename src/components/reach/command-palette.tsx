import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getNavItems } from "@/lib/nav";
import { Search } from "lucide-react";

export function CommandPalette({ basePath, open, onClose }: { basePath: string; open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const items = getNavItems(basePath);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const results = items.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 grid place-items-start justify-center pt-[15vh]">
      <div className="fixed inset-0 overlay-scrim" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card/95 shadow-soft backdrop-blur-xl">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar módulos…"
            className="flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">esc</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {results.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.to}
                onClick={() => {
                  navigate({ to: item.to as any });
                  onClose();
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] hover:bg-muted"
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                {item.label}
              </button>
            );
          })}
          {results.length === 0 && <div className="px-3 py-6 text-center text-[12.5px] text-muted-foreground">Nenhum resultado.</div>}
        </div>
      </div>
    </div>
  );
}
