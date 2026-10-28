import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BadgeCheck, Search, ShieldOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ title: "Users — Platform admin" }] }),
  component: Users,
});

type U = {
  user_id: string; email: string; full_name: string | null; account_type: string | null; organization: string | null
  created_at: string; last_sign_in_at: string | null; email_confirmed: boolean; onboarded: boolean
  consented_at: string | null; ai_consent: boolean; lawyer_status: string | null; staff_role: string | null
  verified: boolean; verification_note: string | null; verified_at: string | null
  conversations: number; documents: number; contracts: number; total: number
};

const PAGE = 50;
const TYPES: Record<string, { ar: string; en: string }> = {
  individual: { ar: "فرد", en: "Individual" },
  lawyer: { ar: "محامٍ", en: "Lawyer" },
  law_firm: { ar: "مكتب محاماة", en: "Law firm" },
  in_house: { ar: "إدارة قانونية", en: "In-house" },
};

function Users() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<U[] | null>(null);
  const [sel, setSel] = useState<U | null>(null);
  const [note, setNote] = useState("");

  async function load(search = q, p = page) {
    const { data, error } = await supabase.rpc("admin_users", { _search: search, _limit: PAGE, _offset: p * PAGE });
    if (error) toast.error(error.message);
    setRows((data as U[]) ?? []);
  }
  useEffect(() => { load(); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  async function verify(u: U, verified: boolean) {
    const { error } = await supabase.rpc("admin_verify_user", { _user: u.user_id, _verified: verified, _note: note });
    if (error) { toast.error(error.message); return; }
    toast.success(verified ? (ar ? "تم توثيق المستخدم" : "User verified") : ar ? "أُلغي التوثيق" : "Verification removed");
    setSel(null);
    load();
  }

  const date = (d: string | null) => (d ? new Date(d).toLocaleDateString(ar ? "ar-SA" : "en-GB") : "—");
  const total = rows?.[0]?.total ?? 0;
  const yes = (b: boolean) => (b ? (ar ? "نعم" : "Yes") : ar ? "لا" : "No");

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-10">
      <h1 className="text-2xl font-semibold text-navy">{ar ? "المستخدمون" : "Users"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{ar ? `${total} مستخدم` : `${total} users`}</p>

      <form className="mt-5 flex max-w-md gap-2" onSubmit={(e) => { e.preventDefault(); setPage(0); load(q, 0); }}>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={ar ? "ابحث بالبريد أو الاسم" : "Search email or name"} className="h-10" />
        <Button type="submit" variant="outline" className="h-10"><Search className="size-4" /></Button>
      </form>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                {(ar ? ["المستخدم", "النوع", "التسجيل", "آخر دخول", "الحالة"] : ["User", "Type", "Joined", "Last sign-in", "Status"]).map((h) => (
                  <th key={h} className="px-4 py-3 text-start font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows === null ? (
                <tr><td colSpan={5} className="px-4 py-6 text-muted-foreground">…</td></tr>
              ) : rows.map((u) => (
                <tr key={u.user_id} onClick={() => { setSel(u); setNote(u.verification_note ?? ""); }}
                  className={`cursor-pointer hover:bg-muted/40 ${sel?.user_id === u.user_id ? "bg-teal/5" : ""}`}>
                  <td className="px-4 py-3"><p className="font-medium text-navy">{u.full_name || "—"}</p><p className="text-xs text-muted-foreground">{u.email}</p></td>
                  <td className="px-4 py-3 text-xs">{u.account_type ? (ar ? TYPES[u.account_type]?.ar : TYPES[u.account_type]?.en) ?? u.account_type : "—"}{u.organization ? ` · ${u.organization}` : ""}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{date(u.created_at)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{date(u.last_sign_in_at)}</td>
                  <td className="space-x-1 px-4 py-3 rtl:space-x-reverse">
                    {u.verified && <span className="rounded-full bg-teal/10 px-2 py-0.5 text-xs text-teal">{ar ? "موثّق" : "Verified"}</span>}
                    {u.staff_role && <span className="rounded-full bg-navy/10 px-2 py-0.5 text-xs text-navy">{ar ? "فريق" : "Team"}</span>}
                    {u.lawyer_status === "pending" && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">{ar ? "محامٍ بانتظار التوثيق" : "Lawyer pending"}</span>}
                    {!u.consented_at && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">{ar ? "بلا موافقة" : "No consent"}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs">
            <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>{ar ? "السابق" : "Previous"}</Button>
            <span className="text-muted-foreground">{page + 1} / {Math.max(1, Math.ceil(total / PAGE))}</span>
            <Button size="sm" variant="ghost" disabled={(page + 1) * PAGE >= total} onClick={() => setPage(page + 1)}>{ar ? "التالي" : "Next"}</Button>
          </div>
        </div>

        <aside className="h-fit rounded-2xl border border-border bg-card p-5 lg:sticky lg:top-20">
          {!sel ? (
            <p className="text-sm text-muted-foreground">{ar ? "اختر مستخدماً لعرض تفاصيله." : "Select a user to see details."}</p>
          ) : (
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-semibold text-navy">{sel.full_name || sel.email}</p>
                <p className="text-xs text-muted-foreground">{sel.email}</p>
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                <dt className="text-muted-foreground">{ar ? "البريد مؤكَّد" : "Email confirmed"}</dt><dd>{yes(sel.email_confirmed)}</dd>
                <dt className="text-muted-foreground">{ar ? "أكمل الإعداد" : "Onboarded"}</dt><dd>{yes(sel.onboarded)}</dd>
                <dt className="text-muted-foreground">{ar ? "الموافقة على الشروط" : "Terms consent"}</dt><dd>{date(sel.consented_at)}</dd>
                <dt className="text-muted-foreground">{ar ? "موافقة المعالجة بالذكاء الاصطناعي" : "AI processing consent"}</dt><dd>{yes(sel.ai_consent)}</dd>
                <dt className="text-muted-foreground">{ar ? "المحادثات" : "Conversations"}</dt><dd>{sel.conversations}</dd>
                <dt className="text-muted-foreground">{ar ? "المستندات" : "Documents"}</dt><dd>{sel.documents}</dd>
                <dt className="text-muted-foreground">{ar ? "العقود" : "Contracts"}</dt><dd>{sel.contracts}</dd>
                {sel.lawyer_status && (<><dt className="text-muted-foreground">{ar ? "توثيق المحامي" : "Lawyer verification"}</dt><dd><Link to="/admin/lawyers" className="text-teal hover:underline">{sel.lawyer_status}</Link></dd></>)}
                {sel.verified_at && (<><dt className="text-muted-foreground">{ar ? "آخر تحديث للتوثيق" : "Verification updated"}</dt><dd>{date(sel.verified_at)}</dd></>)}
              </dl>
              <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={ar ? "ملاحظة التوثيق (مثلاً: تم التحقق من الهوية)" : "Verification note (e.g. identity checked)"} />
              <div className="flex flex-wrap gap-2">
                {!sel.verified ? (
                  <Button className="h-10" onClick={() => verify(sel, true)}><BadgeCheck className="size-4" /> {ar ? "توثيق المستخدم" : "Verify user"}</Button>
                ) : (
                  <Button className="h-10" variant="outline" onClick={() => verify(sel, false)}><ShieldOff className="size-4" /> {ar ? "إلغاء التوثيق" : "Remove verification"}</Button>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
