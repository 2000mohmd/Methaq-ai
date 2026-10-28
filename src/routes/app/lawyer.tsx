import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BadgeCheck, Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { SPECIALTIES, STATUS } from "@/lib/lawyer-shared";

export const Route = createFileRoute("/app/lawyer")({
  head: () => ({ meta: [{ title: "Lawyer verification — Mithaq" }] }),
  component: LawyerVerification,
});

type LawyerProfile = {
  user_id: string;
  full_name: string;
  licence_no: string;
  licence_expiry: string | null;
  phone: string | null;
  city: string | null;
  specialties: string[];
  licence_file: string | null;
  status: "pending" | "approved" | "rejected";
  review_note: string | null;
};

// lawyer_profiles isn't in the generated types yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lawyerTable = () => (supabase as unknown as { from: (t: string) => any }).from("lawyer_profiles");

function LawyerVerification() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [uid, setUid] = useState<string | null>(null);
  const [current, setCurrent] = useState<LawyerProfile | null>(null);
  const [form, setForm] = useState({ full_name: "", licence_no: "", licence_expiry: "", phone: "", city: "" });
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      setUid(data.user.id);
      const { data: row } = await lawyerTable().select("*").eq("user_id", data.user.id).maybeSingle();
      const p = row as LawyerProfile | null;
      setCurrent(p);
      if (p) {
        setForm({
          full_name: p.full_name,
          licence_no: p.licence_no,
          licence_expiry: p.licence_expiry ?? "",
          phone: p.phone ?? "",
          city: p.city ?? "",
        });
        setSpecialties(p.specialties ?? []);
      } else {
        setForm((f) => ({ ...f, full_name: (data.user?.user_metadata?.["full_name"] as string | undefined) ?? "" }));
      }
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!uid) return;
    if (!file && !current?.licence_file) {
      toast.error(ar ? "أرفق صورة الترخيص" : "Attach a copy of your licence");
      return;
    }
    setBusy(true);
    try {
      let licence_file = current?.licence_file ?? null;
      if (file) {
        const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
        licence_file = `${uid}/licence-${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("lawyer-licences").upload(licence_file, file);
        if (error) throw error;
      }
      const fields = {
        full_name: form.full_name.trim(),
        licence_no: form.licence_no.trim(),
        licence_expiry: form.licence_expiry || null,
        phone: form.phone.trim() || null,
        city: form.city.trim() || null,
        specialties,
        licence_file,
      };
      // An update sends the application back to pending (DB trigger).
      const { data, error } = current
        ? await lawyerTable().update(fields).eq("user_id", uid).select().single()
        : await lawyerTable().insert({ user_id: uid, ...fields }).select().single();
      if (error) throw error;
      setCurrent(data as LawyerProfile);
      setFile(null);
      toast.success(ar ? "تم إرسال الطلب للمراجعة" : "Submitted for review");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : ar ? "حدث خطأ" : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const field = (k: keyof typeof form, a: string, en: string, type = "text", required = false) => (
    <div className="space-y-2">
      <Label htmlFor={k}>{ar ? a : en}</Label>
      <Input id={k} type={type} required={required} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })}
        dir={type === "tel" ? "ltr" : undefined} />
    </div>
  );
  const status = current ? STATUS[current.status] : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-navy">{ar ? "توثيق حساب المحامي" : "Lawyer verification"}</h1>
        {status && <span className={cn("rounded-full px-3 py-1 text-xs font-medium", status.cls)}>{ar ? status.ar : status.en}</span>}
      </div>

      <div className="flex gap-3 rounded-2xl border border-teal/40 bg-accent p-4 text-sm text-navy">
        <BadgeCheck className="mt-0.5 size-5 shrink-0 text-teal" />
        <p>
          {ar
            ? "بعد توثيق حسابك، تُعتمد العقود والمستندات التي تُنشئها باسمك ورقم ترخيصك مباشرةً، وتتحمّل مسؤوليتها المهنية بصفتك المحامي المراجِع."
            : "Once verified, contracts and documents you generate are approved under your own name and licence number — you are the reviewing lawyer and carry professional responsibility for them."}
        </p>
      </div>

      {current?.status === "rejected" && current.review_note && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">{ar ? "سبب الرفض" : "Reason for rejection"}</p>
          <p className="mt-1">{current.review_note}</p>
        </div>
      )}
      {current?.status === "approved" && (
        <p className="text-xs text-muted-foreground">
          {ar ? "تعديل البيانات يعيد الطلب إلى المراجعة." : "Editing your details sends the application back for review."}
        </p>
      )}

      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6">
        {field("full_name", "الاسم الكامل (كما في الترخيص)", "Full name (as on licence)", "text", true)}
        <div className="grid gap-4 sm:grid-cols-2">
          {field("licence_no", "رقم الترخيص", "Licence number", "text", true)}
          {field("licence_expiry", "تاريخ انتهاء الترخيص", "Licence expiry date", "date", true)}
          {field("phone", "رقم الجوال", "Phone", "tel")}
          {field("city", "المدينة", "City")}
        </div>
        <div className="space-y-2">
          <Label>{ar ? "التخصصات" : "Specialties"}</Label>
          <div className="flex flex-wrap gap-2">
            {SPECIALTIES.map(([v, a, en]) => {
              const on = specialties.includes(v);
              return (
                <button key={v} type="button" aria-pressed={on}
                  onClick={() => setSpecialties((s) => (on ? s.filter((x) => x !== v) : [...s, v]))}
                  className={cn(
                    "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors sm:min-h-0",
                    on ? "border-teal bg-teal text-navy" : "border-border text-muted-foreground hover:border-teal/50",
                  )}>
                  {on && <Check className="size-3.5" />}
                  {ar ? a : en}
                </button>
              );
            })}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="licence">{ar ? "صورة الترخيص (PDF أو صورة)" : "Licence copy (PDF or image)"}</Label>
          <Input id="licence" type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          {current?.licence_file && !file && (
            <p className="text-xs text-muted-foreground">{ar ? "تم رفع ملف سابقاً — ارفع ملفاً جديداً لاستبداله." : "A file is on record — upload a new one to replace it."}</p>
          )}
        </div>
        <Button type="submit" variant="teal" disabled={busy || !uid}>
          {current ? (ar ? "تحديث وإعادة الإرسال" : "Update and resubmit") : ar ? "إرسال للتوثيق" : "Submit for verification"}
        </Button>
      </form>
    </div>
  );
}
