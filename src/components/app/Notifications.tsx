import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";

type Item = { id: string; text: string; date: string; to: string };

/** Tasks due within a week (or overdue) and hearings in the next week. */
export function Notifications() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const week = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    Promise.all([
      db.from("tasks").select("id,title,due_date,status").lte("due_date", week).neq("status", "done").order("due_date").limit(10),
      db.from("hearings").select("id,title,hearing_date").gte("hearing_date", today).lte("hearing_date", week).order("hearing_date").limit(10),
    ])
      .then(([t, h]) => {
        const tasks = ((t.data ?? []) as { id: string; title: string; due_date: string }[]).map((x) => ({
          id: `t${x.id}`,
          text: `${ar ? "مهمة" : "Task"}: ${x.title}`,
          date: x.due_date,
          to: "/app/tasks",
        }));
        const hearings = ((h.data ?? []) as { id: string; title: string; hearing_date: string }[]).map((x) => ({
          id: `h${x.id}`,
          text: `${ar ? "جلسة" : "Hearing"}: ${x.title}`,
          date: x.hearing_date,
          to: "/app/calendar",
        }));
        setItems([...tasks, ...hearings].sort((a, b) => a.date.localeCompare(b.date)));
      })
      .catch(() => setItems([])); // individuals have no firm records
  }, [ar]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-10 w-10" aria-label={ar ? "الإشعارات" : "Notifications"}>
          <Bell />
          {items.length > 0 && <span className="absolute end-1.5 top-1.5 size-2 rounded-full bg-teal" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-1.5rem)]">
        <DropdownMenuLabel>{ar ? "الإشعارات" : "Notifications"}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">{ar ? "لا توجد إشعارات" : "Nothing due this week"}</p>
        ) : (
          items.map((i) => (
            <Link key={i.id} to={i.to} className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-muted">
              <span className="truncate">{i.text}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{i.date}</span>
            </Link>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
