import { useEffect, useState } from "react";
import { BookCheck } from "lucide-react";

import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";

type Row = { id: string; title: string; kind: string; status: string; source_url: string; jurisdiction: string; count: number };

/** Read-only list of the laws the assistant can cite (managed by administrators, not by users). */
export function LegalCorpusList() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    (async () => {
      const { data } = await db.from("legal_sources").select("id,title,kind,status,source_url,jurisdiction").order("title");
      const list = (data ?? []) as Omit<Row, "count">[];
      const counted = await Promise.all(
        list.map(async (s) => {
          const { count } = await db.from("legal_articles").select("id", { count: "exact", head: true }).eq("source_id", s.id);
          return { ...s, count: (count as number | null) ?? 0 };
        }),
      );
      setRows(counted);
    })().catch(() => setRows([]));
  }, []);

  return (
    <div className="mx-4 mt-6 rounded-2xl border border-border bg-card p-4 shadow-soft sm:mx-10 sm:p-5">
      <p className="flex items-center gap-2 text-sm font-semibold text-navy">
        <BookCheck className="size-4 text-teal" /> {ar ? "الأنظمة المعتمدة في المنصة" : "Verified laws the assistant cites"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {ar ? "تُضاف هذه الأنظمة من المصادر الرسمية بواسطة مسؤولي المنصة فقط." : "Added from official sources by platform administrators only."}
      </p>
      {rows === null ? (
        <p className="mt-3 text-sm text-muted-foreground">…</p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-sm text-amber-700">{ar ? "لم تُضف أنظمة بعد؛ ستظهر الإجابات بأنها غير موثّقة." : "No laws added yet; answers will be marked as not grounded."}</p>
      ) : (
        <ul className="mt-3 divide-y divide-border text-sm">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="min-w-0 break-words font-medium">{r.title}</span>
              <span className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{r.count} {ar ? "مادة" : "articles"}</span>
                <span>{r.status}</span>
                <a href={r.source_url} target="_blank" rel="noreferrer" className="text-teal hover:underline">{ar ? "المصدر" : "Source"}</a>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
