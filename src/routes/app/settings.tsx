import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchProfile, type Profile } from "@/hooks/useAuth";
import { useI18n, type Lang, type Numerals } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { Letterhead } from "@/lib/docx-export";

export const Route = createFileRoute("/app/settings")({
  head: () => ({ meta: [{ title: "Settings — Mithaq" }] }),
  component: Settings,
});

const choice = (on: boolean) =>
  cn("rounded-xl border px-5 py-2.5 text-sm transition-colors", on ? "border-teal bg-accent text-navy" : "border-border hover:border-teal/50");

function Settings() {
  const { lang, setLang, numerals, setNumerals } = useI18n();
  const ar = lang === "ar";
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [lh, setLh] = useState<Letterhead>({});

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const p = await fetchProfile(data.user.id).catch(() => null);
      setProfile(p);
      setName(p?.full_name ?? "");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setLh((((p as any)?.letterhead ?? {}) as Letterhead));
    });
  }, []);

  async function save() {
    if (!profile) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name, language: lang, numerals, letterhead: lh } as never)
      .eq("id", profile.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success(ar ? "تم الحفظ" : "Saved");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-10">
      <h1 className="text-2xl font-semibold text-navy">{ar ? "الإعدادات" : "Settings"}</h1>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6">
        <div className="space-y-2">
          <Label htmlFor="name">{ar ? "الاسم الكامل" : "Full name"}</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>{ar ? "البريد الإلكتروني" : "Email"}</Label>
          <Input value={profile?.email ?? ""} disabled />
        </div>
        <div className="space-y-2">
          <Label>{ar ? "نوع الحساب" : "Account type"}</Label>
          <Input value={(profile?.account_type ?? "").replace("_", " ")} disabled className="capitalize" />
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6">
        <div>
          <p className="mb-2 text-sm text-muted-foreground">{ar ? "اللغة" : "Language"}</p>
          <div className="flex gap-3">
            {(["en", "ar"] as Lang[]).map((c) => (
              <button key={c} type="button" onClick={() => setLang(c)} className={choice(lang === c)}>
                {c === "en" ? "English" : "العربية"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm text-muted-foreground">{ar ? "الأرقام" : "Numerals"}</p>
          <div className="flex gap-3">
            {(["western", "eastern"] as Numerals[]).map((c) => (
              <button key={c} type="button" onClick={() => setNumerals(c)} className={choice(numerals === c)}>
                {c === "western" ? "123" : "١٢٣"}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6">
        <div>
          <h2 className="font-semibold text-navy">{ar ? "ترويسة المكتب (للمستندات المصدّرة)" : "Firm letterhead (for exported documents)"}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{ar ? "تظهر في أعلى كل ملف Word مع التاريخ الهجري والميلادي." : "Shown at the top of every Word export, with the Hijri and Gregorian date."}</p>
        </div>
        <label className="flex min-h-10 items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 shrink-0" checked={lh.logo !== false} onChange={(e) => setLh({ ...lh, logo: e.target.checked })} />
          {ar ? "إظهار شعار ميثاق العربية في الترويسة" : "Show the Mithaq Alarabia logo in the header"}
        </label>
        {([
          ["name_ar", "اسم المكتب (عربي)", "Firm name (Arabic)"],
          ["name_en", "اسم المكتب (إنجليزي)", "Firm name (English)"],
          ["address", "العنوان", "Address"],
          ["contact", "الهاتف / البريد / الموقع", "Phone / email / website"],
          ["cr", "رقم السجل التجاري / ترخيص المحاماة", "CR / law-licence no."],
        ] as const).map(([k, a, e]) => (
          <div key={k} className="space-y-2">
            <Label htmlFor={k}>{ar ? a : e}</Label>
            <Input id={k} value={lh[k] ?? ""} onChange={(ev) => setLh({ ...lh, [k]: ev.target.value })} />
          </div>
        ))}
      </section>

      <Button variant="teal" onClick={save} disabled={busy || !profile}>
        {ar ? "حفظ" : "Save"}
      </Button>

      {profile && <DeleteAccount uid={profile.id} ar={ar} />}
    </div>
  );
}

// Removes every file under `${uid}/` in a bucket (Storage API; the DB can't delete storage rows directly).
async function removeFolder(bucket: string, uid: string) {
  const store = supabase.storage.from(bucket);
  for (;;) {
    const { data, error } = await store.list(uid, { limit: 1000 });
    if (error) throw error;
    const files = (data ?? []).filter((f) => f.id).map((f) => `${uid}/${f.name}`);
    if (files.length === 0) return;
    const { data: removed, error: rmError } = await store.remove(files);
    if (rmError) throw rmError;
    // Nothing removed means no delete permission on this bucket: stop rather than loop forever.
    if (!removed?.length) return;
  }
}

function DeleteAccount({ uid, ar }: { uid: string; ar: boolean }) {
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const ok = confirm.trim() === "حذف" || confirm.trim().toUpperCase() === "DELETE";

  async function deleteAccount() {
    setBusy(true);
    try {
      await removeFolder("documents", uid);
      await removeFolder("lawyer-licences", uid);
      const { error } = await supabase.rpc("delete_my_account");
      if (error) throw error;
      await supabase.auth.signOut();
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : ar ? "حدث خطأ" : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border border-destructive/40 bg-card p-4 shadow-soft sm:p-6">
      <h2 className="font-semibold text-destructive">{ar ? "منطقة الخطر" : "Danger zone"}</h2>
      <p className="text-sm text-muted-foreground">
        {ar
          ? "حذف حسابك نهائياً يزيل ملفاتك الشخصية وبيانات حسابك ولا يمكن التراجع عنه."
          : "Permanently deleting your account removes your personal files and account data. This cannot be undone."}
      </p>
      <Dialog onOpenChange={(open) => !open && setConfirm("")}>
        <DialogTrigger asChild>
          <Button variant="destructive">{ar ? "حذف الحساب نهائياً" : "Delete account permanently"}</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{ar ? "حذف الحساب نهائياً" : "Delete account permanently"}</DialogTitle>
            <DialogDescription>
              {ar ? "للتأكيد اكتب «حذف» (أو DELETE) في الحقل أدناه." : "To confirm, type DELETE (or «حذف») below."}
            </DialogDescription>
          </DialogHeader>
          <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" aria-label={ar ? "تأكيد الحذف" : "Confirm deletion"} />
          <DialogFooter>
            <Button variant="destructive" disabled={!ok || busy} onClick={deleteAccount}>
              {ar ? "حذف نهائي" : "Delete forever"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
