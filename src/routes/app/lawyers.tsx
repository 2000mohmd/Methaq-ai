import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BadgeCheck, FileText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { SPECIALTIES, statusOf } from "./-lawyer-shared";

export const Route = createFileRoute("/app/lawyers")({
  head: () => ({ meta: [{ title: "Lawyer approvals — Mithaq" }] }),
  component: LawyerApprovals,
});

type Application = Database["public"]["Functions"]["lawyer_applications"]["Returns"][number];

function LawyerApprovals() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [apps, setApps] = useState<Application[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const { data, error } = await supabase.rpc("lawyer_applications");
    if (error) toast.error(error.message);
    else setApps(data ?? []);
  }

  useEffect(() => {
    supabase.rpc("is_platform_admin").then(({ data }) => {
      setAllowed(!!data);
      if (data) load();
    });
  }, []);

  async function openFile(path: string) {
    const { data, error } = await supabase.storage.from("lawyer-licences").createSignedUrl(path, 60);
    if (error) toast.error(error.message);
    else window.open(data.signedUrl, "_blank", "noopener");
  }

  async function decide(a: Application, decision: "approved" | "rejected") {
    const note = (notes[a.user_id] ?? "").trim();
    if (decision === "rejected" && !note) {
      toast.error(ar ? "اكتب سبب الرفض" : "Write a reason for rejecting");
      return;
    }
    setBusy(a.user_id);
    const { error } = await supabase.rpc("review_lawyer", { _user: a.user_id, _decision: decision, _note: note });
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(decision === "approved" ? (ar ? "تم التوثيق" : "Verified") : ar ? "تم الرفض" : "Rejected");
    load();
  }

  if (allowed === null) return <div className="p-4 text-sm text-muted-foreground sm:p-10">…</div>;
  if (!allowed) {
    return (
      <div className="p-4 sm:p-10">
        <BadgeCheck className="size-6 text-teal" />
        <p className="mt-3 text-muted-foreground">
          {ar ? "هذه الصفحة متاحة لمشرفي المنصة فقط." : "Only platform administrators can open this page."}
        </p>
      </div>
    );
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString(ar ? "ar-SA" : "en-GB");
  const spec = (v: string) => {
    const s = SPECIALTIES.find(([k]) => k === v);
    return s ? (ar ? s[1] : s[2]) : v;
  };

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-10">
      <h1 className="text-2xl font-semibold text-navy">{ar ? "توثيق المحامين" : "Lawyer approvals"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {ar
          ? "تحقق من الترخيص قبل الاعتماد: المحامي الموثّق يعتمد مستنداته باسمه ورقم ترخيصه."
          : "Check the licence before approving: a verified lawyer approves their own documents under their name and licence."}
      </p>

      {apps.length === 0 && <p className="mt-6 text-sm text-muted-foreground">{ar ? "لا توجد طلبات." : "No applications."}</p>}

      <ul className="mt-6 space-y-4">
        {apps.map((a) => {
          const st = statusOf(a.status);
          const expired = a.licence_expiry ? new Date(a.licence_expiry) < new Date() : false;
          return (
            <li key={a.user_id} className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-navy">{a.full_name}</p>
                  <p className="truncate text-xs text-muted-foreground" dir="ltr">{a.email ?? "—"}</p>
                </div>
                <span className={cn("rounded-full px-3 py-1 text-xs font-medium", st.cls)}>{ar ? st.ar : st.en}</span>
              </div>

              <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <div><dt className="text-xs text-muted-foreground">{ar ? "رقم الترخيص" : "Licence no."}</dt><dd dir="ltr" className="text-start">{a.licence_no}</dd></div>
                <div>
                  <dt className="text-xs text-muted-foreground">{ar ? "انتهاء الترخيص" : "Licence expiry"}</dt>
                  <dd className={cn(expired && "text-destructive")}>
                    {a.licence_expiry ? fmtDate(a.licence_expiry) : "—"}{expired && (ar ? " (منتهٍ)" : " (expired)")}
                  </dd>
                </div>
                <div><dt className="text-xs text-muted-foreground">{ar ? "الجوال" : "Phone"}</dt><dd dir="ltr" className="text-start">{a.phone || "—"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">{ar ? "المدينة" : "City"}</dt><dd>{a.city || "—"}</dd></div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-muted-foreground">{ar ? "التخصصات" : "Specialties"}</dt>
                  <dd>{a.specialties.length ? a.specialties.map(spec).join("، ") : "—"}</dd>
                </div>
                <div><dt className="text-xs text-muted-foreground">{ar ? "تاريخ الطلب" : "Applied"}</dt><dd>{fmtDate(a.created_at)}</dd></div>
                {a.reviewed_at && <div><dt className="text-xs text-muted-foreground">{ar ? "تاريخ القرار" : "Decided"}</dt><dd>{fmtDate(a.reviewed_at)}</dd></div>}
                {a.review_note && (
                  <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">{ar ? "ملاحظة" : "Note"}</dt><dd>{a.review_note}</dd></div>
                )}
              </dl>

              <div className="mt-4 space-y-3">
                {a.licence_file ? (
                  <Button variant="outline" size="sm" onClick={() => openFile(a.licence_file!)}>
                    <FileText className="size-4" />
                    {ar ? "عرض صورة الترخيص" : "View licence copy"}
                  </Button>
                ) : (
                  <p className="text-xs text-destructive">{ar ? "لم يُرفع ملف الترخيص" : "No licence file uploaded"}</p>
                )}
                <Textarea rows={2} placeholder={ar ? "ملاحظة (مطلوبة عند الرفض)" : "Note (required to reject)"}
                  value={notes[a.user_id] ?? ""} onChange={(e) => setNotes({ ...notes, [a.user_id]: e.target.value })} />
                <div className="flex flex-wrap gap-2">
                  <Button variant="teal" disabled={busy === a.user_id || a.status === "approved"} onClick={() => decide(a, "approved")}>
                    {ar ? "توثيق" : "Approve"}
                  </Button>
                  <Button variant="outline" className="text-destructive" disabled={busy === a.user_id || a.status === "rejected"} onClick={() => decide(a, "rejected")}>
                    {ar ? "رفض" : "Reject"}
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
