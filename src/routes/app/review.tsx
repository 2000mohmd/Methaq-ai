import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Check, Loader2, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/app/review")({
  head: () => ({ meta: [{ title: "Contract review — Mithaq" }] }),
  component: Review,
});

type Item = Database["public"]["Functions"]["review_queue"]["Returns"][number];

const STATUS: Record<string, { ar: string; en: string; cls: string }> = {
  pending_review: { ar: "قيد المراجعة", en: "In review", cls: "bg-amber-100 text-amber-800" },
  approved: { ar: "معتمد", en: "Approved", cls: "bg-teal/10 text-teal" },
  rejected: { ar: "مرفوض", en: "Rejected", cls: "bg-destructive/10 text-destructive" },
};

function Review() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [sel, setSel] = useState<Item | null>(null);
  const [body, setBody] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data, error } = await supabase.rpc("review_queue");
    if (error) { toast.error(error.message); return; }
    setItems(data ?? []);
  }

  useEffect(() => {
    supabase.rpc("is_reviewer").then(({ data }) => {
      setAllowed(!!data);
      if (data) load();
    });
  }, []);

  function pick(c: Item) {
    setSel(c);
    setBody(c.status === "approved" && c.approved_body ? c.approved_body : c.body);
    setNote(c.review_note ?? "");
  }

  async function decide(decision: "approved" | "rejected") {
    if (!sel) return;
    if (decision === "rejected" && !note.trim()) { toast.error(ar ? "اكتب سبب الرفض في الملاحظة" : "A note is required to reject"); return; }
    if (decision === "approved" && !body.trim()) { toast.error(ar ? "نص العقد فارغ" : "Contract text is empty"); return; }
    setBusy(true);
    const { error } = await supabase.rpc("review_contract", { _id: sel.id, _decision: decision, _body: body, _note: note });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(decision === "approved" ? (ar ? "تم اعتماد العقد" : "Contract approved") : (ar ? "تم رفض العقد" : "Contract rejected"));
    setSel(null);
    load();
  }

  if (allowed === null) return <div className="p-4 text-sm text-muted-foreground sm:p-10">…</div>;
  if (!allowed) {
    return (
      <div className="p-4 sm:p-10">
        <ShieldCheck className="size-6 text-teal" />
        <p className="mt-3 text-muted-foreground">
          {ar ? "هذه الصفحة متاحة لمحامي المراجعة المعتمدين فقط." : "Only authorised reviewing lawyers can open this page."}
        </p>
      </div>
    );
  }

  const shown = filter === "pending" ? items.filter((i) => i.status === "pending_review") : items;
  const rtl = (sel?.language ?? "ar") !== "en";
  const inputs = sel && sel.inputs && typeof sel.inputs === "object" && !Array.isArray(sel.inputs) ? Object.entries(sel.inputs) : [];

  return (
    <div className="p-4 sm:p-10">
      <h1 className="text-2xl font-semibold text-navy">{ar ? "مراجعة العقود" : "Contract review"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {ar ? "لا يرى العميل العقد إلا بعد اعتماده من محامٍ." : "Clients only see a contract after a lawyer approves it."}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <div className="min-w-0">
          <div className="flex gap-2">
            {(["pending", "all"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`min-h-10 rounded-full px-4 text-xs sm:min-h-8 ${filter === f ? "bg-navy text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {f === "pending" ? (ar ? "قيد المراجعة" : "Pending") : (ar ? "الكل" : "All")}
              </button>
            ))}
          </div>
          {shown.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">{ar ? "لا توجد عقود." : "No contracts."}</p>
          ) : (
            <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card">
              {shown.map((c) => {
                const s = STATUS[c.status] ?? STATUS["pending_review"]!;
                return (
                  <li key={c.id}>
                    <button onClick={() => pick(c)}
                      className={`grid min-h-10 w-full gap-1 px-4 py-3 text-start ${sel?.id === c.id ? "bg-teal/5" : "hover:bg-muted/50"}`}>
                      <span className="flex items-start justify-between gap-2">
                        <span className="min-w-0 break-words text-sm font-medium text-navy">{c.title}</span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${s.cls}`}>{ar ? s.ar : s.en}</span>
                      </span>
                      <span className="flex justify-between gap-2 text-xs text-muted-foreground">
                        <span className="min-w-0 truncate" dir="ltr">{c.author_email ?? "—"}</span>
                        <span className="shrink-0">{new Date(c.created_at).toLocaleDateString(ar ? "ar-SA" : "en-GB")}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6">
          {!sel ? (
            <p className="text-sm text-muted-foreground">{ar ? "اختر عقداً لمراجعته." : "Select a contract to review."}</p>
          ) : (
            <div className="grid gap-4">
              <div>
                <h2 className="break-words font-semibold text-navy">{sel.title}</h2>
                <p className="text-xs text-muted-foreground">{sel.contract_type} · <span dir="ltr">{sel.author_email}</span></p>
              </div>

              {inputs.length > 0 && (
                <section>
                  <h3 className="text-sm font-medium text-navy">{ar ? "مدخلات المستخدم" : "User inputs"}</h3>
                  <dl className="mt-2 grid gap-1 text-sm">
                    {inputs.map(([k, v]) => (
                      <div key={k} className="flex flex-wrap gap-x-2 break-words">
                        <dt className="text-muted-foreground">{k}:</dt>
                        <dd className="min-w-0">{typeof v === "string" ? v : JSON.stringify(v)}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}

              <label className="grid gap-1 text-sm">
                <span className="font-medium text-navy">{ar ? "نص العقد" : "Contract text"}</span>
                <Textarea rows={16} dir={rtl ? "rtl" : "ltr"} value={body} onChange={(e) => setBody(e.target.value)} className="font-mono text-sm leading-relaxed" />
              </label>

              <label className="grid gap-1 text-sm">
                <span className="font-medium text-navy">{ar ? "ملاحظة (مطلوبة عند الرفض)" : "Note (required to reject)"}</span>
                <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
              </label>

              <div className="flex flex-wrap gap-2 [&>button]:h-10">
                <Button disabled={busy} onClick={() => decide("approved")}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} {ar ? "اعتماد" : "Approve"}
                </Button>
                <Button variant="outline" disabled={busy} onClick={() => decide("rejected")} className="text-destructive">
                  <X className="size-4" /> {ar ? "رفض" : "Reject"}
                </Button>
              </div>

              <section>
                <h3 className="text-sm font-medium text-navy">{ar ? "معاينة" : "Preview"}</h3>
                <div dir={rtl ? "rtl" : "ltr"}
                  className="mt-2 break-words rounded-xl border border-border p-4 text-sm leading-loose [&_table]:block [&_table]:overflow-x-auto [&_h1]:mt-4 [&_h1]:text-center [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:font-semibold [&_li]:ms-5 [&_ol]:list-decimal [&_p]:my-2 [&_ul]:list-disc">
                  <ReactMarkdown>{body}</ReactMarkdown>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
