import { useEffect, useState } from "react";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HexPattern } from "@/components/brand/HexPattern";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";

export type Field = {
  key: string;
  en: string;
  ar: string;
  type?: "text" | "date" | "number" | "select";
  options?: string[];
  required?: boolean;
  list?: boolean;
};

type Props = {
  table: string;
  title: { en: string; ar: string };
  fields: Field[];
  summary?: (rows: Record<string, unknown>[]) => { en: string; ar: string; value: string }[];
};

export function RecordModule({ table, title, fields, summary }: Props) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [orgId, setOrgId] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const load = async () => {
    const { data, error } = await db.from(table).select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows(data ?? []);
  };

  useEffect(() => {
    load();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: p } = await supabase.from("profiles").select("organization_id").eq("id", data.user.id).single();
      setOrgId(p?.organization_id ?? null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);

  const save = async () => {
    if (!orgId) return toast.error(ar ? "أكمل إعداد الحساب أولاً" : "Finish onboarding first");
    const payload: Record<string, unknown> = { organization_id: orgId };
    for (const f of fields) {
      const v = form[f.key];
      if (f.required && !v) return toast.error(`${ar ? f.ar : f.en} *`);
      if (v) payload[f.key] = f.type === "number" ? Number(v) : v;
    }
    const { error } = await db.from(table).insert(payload);
    if (error) return toast.error(error.message);
    setOpen(false);
    setForm({});
    load();
  };

  const remove = async (id: string) => {
    const { error } = await db.from(table).delete().eq("id", id);
    if (error) toast.error(error.message);
    load();
  };

  const listFields = fields.filter((f) => f.list !== false).slice(0, 5);
  const filtered = rows.filter((r) => !q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="p-6 sm:p-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-navy">{ar ? title.ar : title.en}</h1>
        <Input className="ms-auto w-56" placeholder={ar ? "بحث…" : "Search…"} value={q} onChange={(e) => setQ(e.target.value)} />
        <Button onClick={() => setOpen(true)}><Plus className="size-4" /> {ar ? "إضافة" : "Add"}</Button>
      </div>

      {summary && rows.length > 0 && (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {summary(rows).map((s) => (
            <div key={s.en} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
              <p className="text-xs text-muted-foreground">{ar ? s.ar : s.en}</p>
              <p className="mt-1 text-2xl font-semibold text-navy">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="relative mt-6 overflow-hidden rounded-2xl border border-border bg-navy-tint">
          <HexPattern className="text-navy" opacity={0.06} />
          <div className="relative max-w-md px-8 py-16">
            <Sparkles className="size-6 text-teal" />
            <p className="mt-4 leading-relaxed text-muted-foreground">
              {ar ? "لا توجد سجلات بعد. أضف أول سجل للبدء." : "No records yet. Add your first one to get started."}
            </p>
            <Button className="mt-6" onClick={() => setOpen(true)}><Plus className="size-4" /> {ar ? "إضافة" : "Add"}</Button>
          </div>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                {listFields.map((f) => <th key={f.key} className="px-4 py-3 text-start font-medium">{ar ? f.ar : f.en}</th>)}
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id as string} className="border-t border-border">
                  {listFields.map((f) => <td key={f.key} className="px-4 py-3">{String(r[f.key] ?? "—")}</td>)}
                  <td className="px-2 text-end">
                    <button onClick={() => remove(r.id as string)} aria-label="Delete"><Trash2 className="size-4 text-muted-foreground hover:text-destructive" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{ar ? "سجل جديد" : "New record"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            {fields.map((f) => (
              <label key={f.key} className="grid gap-1 text-sm">
                <span>{ar ? f.ar : f.en}{f.required && " *"}</span>
                {f.type === "select" ? (
                  <select className="h-10 rounded-lg border border-input bg-background px-3" value={form[f.key] ?? ""}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}>
                    <option value="" />
                    {f.options!.map((o) => <option key={o}>{o}</option>)}
                  </select>
                ) : (
                  <Input type={f.type ?? "text"} value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                )}
              </label>
            ))}
            <Button onClick={save}>{ar ? "حفظ" : "Save"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
