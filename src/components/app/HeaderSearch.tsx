import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";

type Hit = { label: string; sub: string; to: string };

// Searches the pages you can open plus record titles (RLS scopes the rows to you / your firm).
const TABLES = [
  { table: "matters", col: "title", to: "/app/matters", sub: "Matters" },
  { table: "clients", col: "name", to: "/app/clients", sub: "Clients" },
  { table: "library_items", col: "title", to: "/app/library", sub: "Library" },
  { table: "documents", col: "name", to: "/app/documents", sub: "Documents" },
] as const;

export function HeaderSearch({ pages }: { pages: { to: string; label: string }[] }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  // Below sm the input is hidden behind an icon button and opens as a bar under the header.
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      return;
    }
    const timer = setTimeout(async () => {
      const lower = term.toLowerCase();
      const pageHits = pages
        .filter((p) => p.label.toLowerCase().includes(lower))
        .map((p) => ({ label: p.label, sub: ar ? "صفحة" : "Page", to: p.to }));
      const safe = term.replace(/[%,]/g, " ");
      const rows = await Promise.all(
        TABLES.map(async (t) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data } = await (supabase as any)
            .from(t.table)
            .select(t.col)
            .ilike(t.col, `%${safe}%`)
            .limit(4);
          return ((data ?? []) as Record<string, string>[]).map((r) => ({
            label: r[t.col] ?? "",
            sub: t.sub,
            to: t.to,
          }));
        }),
      );
      setHits([...pageHits, ...rows.flat()].slice(0, 10));
    }, 250);
    return () => clearTimeout(timer);
  }, [q, pages, ar]);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10 shrink-0 sm:hidden"
        aria-label={ar ? "بحث" : "Search"}
        onClick={() => setOpen((o) => !o)}
      >
        <Search />
      </Button>
      <div
        className={
          open
            ? "fixed inset-x-0 top-16 z-40 border-b border-border bg-background p-3 sm:static sm:border-0 sm:bg-transparent sm:p-0"
            : "hidden sm:block"
        }
      >
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="search"
            className="h-10 w-full ps-9 sm:h-9 sm:w-64"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
            }}
            placeholder={ar ? "بحث…" : "Search…"}
          />
          {hits.length > 0 && (
            <ul className="absolute start-0 top-full z-50 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-lg sm:w-80">
              {hits.map((h, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-start text-sm hover:bg-muted sm:py-2"
                    onClick={() => {
                      setQ("");
                      setHits([]);
                      setOpen(false);
                      navigate({ to: h.to });
                    }}
                  >
                    <span className="truncate">{h.label}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{h.sub}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
