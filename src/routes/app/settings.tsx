import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchProfile, type Profile } from "@/hooks/useAuth";
import { useI18n, type Lang, type Numerals } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

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

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const p = await fetchProfile(data.user.id).catch(() => null);
      setProfile(p);
      setName(p?.full_name ?? "");
    });
  }, []);

  async function save() {
    if (!profile) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name, language: lang, numerals })
      .eq("id", profile.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success(ar ? "تم الحفظ" : "Saved");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6 sm:p-10">
      <h1 className="text-2xl font-semibold text-navy">{ar ? "الإعدادات" : "Settings"}</h1>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-soft">
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

      <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-soft">
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

      <Button variant="teal" onClick={save} disabled={busy || !profile}>
        {ar ? "حفظ" : "Save"}
      </Button>
    </div>
  );
}
