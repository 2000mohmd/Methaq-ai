import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/team")({
  head: () => ({ meta: [{ title: "Team — Platform admin" }] }),
  component: Team,
});

type Staff = { user_id: string; email: string; role: string; name: string | null; licence_no: string | null; created_at: string; last_sign_in_at: string | null };

// Readable messages for the RPC's guard errors.
const ERRORS: Record<string, { ar: string; en: string }> = {
  "no account with this email": { ar: "لا يوجد حساب بهذا البريد. اطلب من الشخص إنشاء حساب أولاً ثم أضفه.", en: "No account with this email. Ask them to sign up first, then add them." },
  "licence number required for lawyers": { ar: "رقم الترخيص مطلوب للمحامين.", en: "A licence number is required for lawyers." },
  "you cannot remove your own admin role": { ar: "لا يمكنك إزالة صلاحية المشرف عن نفسك.", en: "You can't remove your own admin role." },
  "you cannot remove yourself": { ar: "لا يمكنك إزالة نفسك من الفريق.", en: "You can't remove yourself." },
};

function Team() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [rows, setRows] = useState<Staff[] | null>(null);
  const [form, setForm] = useState({ email: "", role: "lawyer", name: "", licence: "" });
  const [busy, setBusy] = useState(false);

  const msg = (e: { message: string }) => {
    const m = ERRORS[e.message];
    return m ? (ar ? m.ar : m.en) : e.message;
  };

  async function load() {
    const { data, error } = await supabase.rpc("admin_list_staff");
    if (error) toast.error(msg(error));
    setRows((data as Staff[]) ?? []);
  }
  useEffect(() => { load(); }, []);

  async function save(f = form) {
    setBusy(true);
    const { error } = await supabase.rpc("admin_upsert_staff", { _email: f.email, _role: f.role, _name: f.name, _licence: f.licence });
    setBusy(false);
    if (error) { toast.error(msg(error)); return; }
    toast.success(ar ? "تم حفظ عضو الفريق" : "Team member saved");
    setForm({ email: "", role: "lawyer", name: "", licence: "" });
    load();
  }

  async function remove(s: Staff) {
    if (!confirm(ar ? `إزالة ${s.email} من فريق المنصة؟` : `Remove ${s.email} from the platform team?`)) return;
    const { error } = await supabase.rpc("admin_remove_staff", { _user: s.user_id });
    if (error) { toast.error(msg(error)); return; }
    load();
  }

  const roleLabel = (r: string) => (r === "admin" ? (ar ? "مشرف" : "Admin") : ar ? "محامٍ مراجع" : "Reviewing lawyer");

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-10">
      <h1 className="text-2xl font-semibold text-navy">{ar ? "فريق المنصة" : "Platform team"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {ar
          ? "المشرف يرى كل لوحة الإدارة. المحامي المراجع يرى مراجعة المستندات فقط، ويُختم اسمه ورقم ترخيصه على ما يعتمده."
          : "Admins see the whole admin panel. Reviewing lawyers see document review only; their name and licence are stamped on what they approve."}
      </p>

      <form
        className="mt-6 grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft sm:grid-cols-2 sm:p-5 lg:grid-cols-5"
        onSubmit={(e) => { e.preventDefault(); save(); }}
      >
        <Input required type="email" placeholder={ar ? "البريد الإلكتروني للحساب" : "Account email"} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-10 lg:col-span-2" />
        <Input placeholder={ar ? "الاسم" : "Name"} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10" />
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="h-10 rounded-md border border-input bg-background px-3 text-base sm:text-sm">
          <option value="lawyer">{roleLabel("lawyer")}</option>
          <option value="admin">{roleLabel("admin")}</option>
        </select>
        <Input placeholder={ar ? "رقم الترخيص" : "Licence no."} value={form.licence} onChange={(e) => setForm({ ...form, licence: e.target.value })} className="h-10" required={form.role === "lawyer"} />
        <Button type="submit" disabled={busy} className="h-10 sm:col-span-2 lg:col-span-5 lg:justify-self-start">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />} {ar ? "إضافة / تحديث" : "Add / update"}
        </Button>
      </form>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              {(ar ? ["الاسم / البريد", "الدور", "رقم الترخيص", "آخر دخول", ""] : ["Name / email", "Role", "Licence", "Last sign-in", ""]).map((h, i) => (
                <th key={i} className="px-4 py-3 text-start font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows === null ? (
              <tr><td colSpan={5} className="px-4 py-6 text-muted-foreground">…</td></tr>
            ) : rows.map((s) => (
              <tr key={s.user_id}>
                <td className="px-4 py-3"><p className="font-medium text-navy">{s.name || "—"}</p><p className="text-xs text-muted-foreground">{s.email}</p></td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs ${s.role === "admin" ? "bg-navy/10 text-navy" : "bg-teal/10 text-teal"}`}>{roleLabel(s.role)}</span></td>
                <td className="px-4 py-3">{s.licence_no || <span className="text-amber-700">{ar ? "غير مسجّل" : "Missing"}</span>}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{s.last_sign_in_at ? new Date(s.last_sign_in_at).toLocaleDateString(ar ? "ar-SA" : "en-GB") : "—"}</td>
                <td className="px-4 py-3 text-end">
                  <Button size="sm" variant="ghost" onClick={() => setForm({ email: s.email, role: s.role, name: s.name ?? "", licence: s.licence_no ?? "" })}>{ar ? "تعديل" : "Edit"}</Button>
                  <Button size="icon" variant="ghost" aria-label="remove" onClick={() => remove(s)}><Trash2 className="size-4 text-destructive" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
