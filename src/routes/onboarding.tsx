import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogoLockup } from "@/components/brand/Logo";
import { HexPattern } from "@/components/brand/HexPattern";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useI18n, type Lang, type Numerals } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  component: Onboarding,
  head: () => ({
    meta: [
      { title: "Set up your workspace — Mithaq Alarabia" },
      {
        name: "description",
        content: "Choose your role, jurisdictions and language to set up Mithaq.",
      },
      { property: "og:title", content: "Set up your workspace — Mithaq Alarabia" },
      {
        property: "og:description",
        content: "Choose your role, jurisdictions and language to set up Mithaq.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const ACCOUNT_TYPES = [
  { value: "lawyer", key: "onboarding.lawyer" },
  { value: "law_firm", key: "onboarding.lawFirm" },
  { value: "in_house", key: "onboarding.inHouse" },
  { value: "individual", key: "onboarding.individual" },
] as const;

const JURISDICTIONS = [
  "UAE",
  "Saudi Arabia",
  "Qatar",
  "Oman",
  "Kuwait",
  "Bahrain",
  "Jordan",
  "Egypt",
  "Lebanon",
  "Iraq",
  "Morocco",
  "Tunisia",
  "France",
  "UK",
  "US",
];

function Onboarding() {
  const { t, n, lang, setLang, numerals, setNumerals } = useI18n();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [accountType, setAccountType] =
    useState<(typeof ACCOUNT_TYPES)[number]["value"]>("law_firm");
  const [firmName, setFirmName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const isIndividual = accountType === "individual";

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate({ to: "/auth" });
    });
  }, [navigate]);

  function toggle(j: string) {
    setSelected((prev) => (prev.includes(j) ? prev.filter((x) => x !== j) : [...prev, j]));
  }

  async function finish() {
    setBusy(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) throw new Error("No session");

      // Individuals get a personal account: no organization, no owner role.
      let orgId: string | null = null;
      if (!isIndividual) {
        const { data: org, error: orgError } = await supabase
          .from("organizations")
          .insert({
            name: firmName || (user.email ?? "Workspace"),
            account_type: accountType,
            jurisdictions: selected,
            default_language: lang,
            created_by: user.id,
          })
          .select()
          .single();
        if (orgError) throw orgError;
        orgId = org.id;

        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({ user_id: user.id, organization_id: org.id, role: "owner" });
        if (roleError) throw roleError;
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          organization_id: orgId,
          account_type: accountType,
          jurisdictions: selected,
          language: lang,
          numerals,
          onboarded: true,
        })
        .eq("id", user.id);
      if (profileError) throw profileError;

      navigate({ to: "/app" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  const steps = 4;
  // Individuals skip the firm-name step (1).
  const go = (dir: 1 | -1) =>
    setStep((s) => {
      const next = s + dir;
      return isIndividual && next === 1 ? next + dir : Math.max(0, next);
    });

  return (
    <div className="relative min-h-screen bg-navy-tint">
      <HexPattern className="text-navy" opacity={0.05} />
      <div className="relative mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-10">
        <div className="flex items-center justify-between">
          <LogoLockup tone="navy" />
          <LanguageToggle />
        </div>

        <div className="mt-12 flex-1">
          <p className="brand-caps text-xs text-teal">
            {t("onboarding.step")} {n(step + 1)} {t("onboarding.of")} {n(steps)}
          </p>
          <h1 className="mt-4 text-2xl font-semibold text-navy">
            {t("onboarding.title")}
          </h1>

          <div className="mt-8 rounded-2xl border border-border bg-card p-8 shadow-soft">
            {step === 0 && (
              <div className="space-y-4">
                <h2 className="font-semibold text-navy">{t("onboarding.roleQ")}</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {ACCOUNT_TYPES.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setAccountType(option.value)}
                      className={cn(
                        "rounded-xl border p-4 text-start transition-colors",
                        accountType === option.value
                          ? "border-teal bg-accent text-navy"
                          : "border-border hover:border-teal/50",
                      )}
                    >
                      {t(option.key)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <h2 className="font-semibold text-navy">{t("onboarding.firmQ")}</h2>
                <div className="space-y-2">
                  <Label htmlFor="firm">{t("onboarding.firmName")}</Label>
                  <Input
                    id="firm"
                    value={firmName}
                    onChange={(e) => setFirmName(e.target.value)}
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h2 className="font-semibold text-navy">
                  {t("onboarding.jurisdictionQ")}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {JURISDICTIONS.map((j) => (
                    <button
                      key={j}
                      type="button"
                      onClick={() => toggle(j)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                        selected.includes(j)
                          ? "border-teal bg-teal text-navy"
                          : "border-border text-muted-foreground hover:border-teal/50",
                      )}
                    >
                      {selected.includes(j) && <Check className="size-3.5" />}
                      {j}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <h2 className="font-semibold text-navy">{t("onboarding.languageQ")}</h2>
                <div className="flex gap-3">
                  {(["en", "ar"] as Lang[]).map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setLang(code)}
                      className={cn(
                        "rounded-xl border px-5 py-3 transition-colors",
                        lang === code
                          ? "border-teal bg-accent text-navy"
                          : "border-border hover:border-teal/50",
                      )}
                    >
                      {code === "en" ? "English" : "العربية"}
                    </button>
                  ))}
                </div>
                <div>
                  <p className="mb-3 text-sm text-muted-foreground">
                    {t("onboarding.numerals")}
                  </p>
                  <div className="flex gap-3">
                    {(["western", "eastern"] as Numerals[]).map((code) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => setNumerals(code)}
                        className={cn(
                          "rounded-xl border px-5 py-3 transition-colors",
                          numerals === code
                            ? "border-teal bg-accent text-navy"
                            : "border-border hover:border-teal/50",
                        )}
                      >
                        {t(code === "western" ? "onboarding.western" : "onboarding.eastern")}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-between">
            <Button
              variant="ghost"
              onClick={() => go(-1)}
              disabled={step === 0}
            >
              {t("onboarding.backStep")}
            </Button>
            {step < steps - 1 ? (
              <Button onClick={() => go(1)}>{t("onboarding.next")}</Button>
            ) : (
              <Button variant="teal" onClick={finish} disabled={busy}>
                {t("onboarding.finish")}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
