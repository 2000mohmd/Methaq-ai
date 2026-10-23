import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogoLockup } from "@/components/brand/Logo";
import { HexPattern } from "@/components/brand/HexPattern";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";

type Mode = "signin" | "signup" | "reset";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { mode?: "signup" } =>
    search["mode"] === "signup" ? { mode: "signup" } : {},
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Sign in — Mithaq Alarabia" },
      {
        name: "description",
        content: "Sign in or create your Mithaq Alarabia legal workspace.",
      },
      { property: "og:title", content: "Sign in — Mithaq Alarabia" },
      {
        property: "og:description",
        content: "Access your bilingual legal AI workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function AuthPage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [mode, setMode] = useState<Mode>(search.mode === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app" });
    });
  }, [navigate]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/app`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        // Auto-confirm projects return a session straight away: go to the app (onboarding follows).
        if (data.session) {
          navigate({ to: "/app" });
          return;
        }
        // An already-registered email comes back with no identities and no error.
        if (data.user && data.user.identities?.length === 0) throw new Error(lang === "ar" ? "هذا البريد مسجّل مسبقاً، سجّل الدخول" : "This email is already registered. Please sign in.");
        toast.success(t("auth.checkEmail"));
        setMode("signin");
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/app" });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (error) throw error;
        toast.success(t("auth.resetSent"));
        setMode("signin");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/app` },
    });
    if (error) toast.error(error.message ?? t("common.error"));
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-navy p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <HexPattern className="text-white" opacity={0.12} />
        <Link to="/" className="relative">
          <LogoLockup tone="white" />
        </Link>
        <div className="relative max-w-sm">
          <p className="text-2xl leading-snug font-semibold">{t("brand.tagline")}</p>
          <p className="mt-4 text-sm leading-relaxed text-white/60">
            {t("brand.tagline2")}
          </p>
        </div>
      </aside>

      <main className="flex flex-col px-6 py-10 sm:px-12">
        <div className="flex items-center justify-between">
          <Link to="/" className="lg:hidden">
            <LogoLockup tone="navy" />
          </Link>
          <div className="ms-auto">
            <LanguageToggle />
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
          <h1 className="text-2xl font-semibold text-navy">{t("auth.title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("auth.subtitle")}</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="fullName">{t("auth.fullName")}</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {mode !== "reset" && (
              <div className="space-y-2">
                <Label htmlFor="password">{t("auth.password")}</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
            )}
            <Button type="submit" className="w-full" size="lg" disabled={busy}>
              {mode === "signup"
                ? t("auth.signUp")
                : mode === "reset"
                  ? t("auth.reset")
                  : t("auth.signIn")}
            </Button>
          </form>

          {mode !== "reset" && (
            <>
              <div className="my-6 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                {t("auth.or")}
                <span className="h-px flex-1 bg-border" />
              </div>
              <Button variant="outline" size="lg" className="w-full" onClick={onGoogle}>
                {t("auth.google")}
              </Button>
            </>
          )}

          <div className="mt-8 space-y-2 text-sm text-muted-foreground">
            {mode === "signin" && (
              <>
                <button
                  type="button"
                  className="text-teal hover:underline"
                  onClick={() => setMode("reset")}
                >
                  {t("auth.forgot")}
                </button>
                <p>
                  {t("auth.noAccount")}{" "}
                  <button
                    type="button"
                    className="text-teal hover:underline"
                    onClick={() => setMode("signup")}
                  >
                    {t("auth.signUp")}
                  </button>
                </p>
              </>
            )}
            {mode === "signup" && (
              <p>
                {t("auth.haveAccount")}{" "}
                <button
                  type="button"
                  className="text-teal hover:underline"
                  onClick={() => setMode("signin")}
                >
                  {t("auth.signIn")}
                </button>
              </p>
            )}
            {mode === "reset" && (
              <button
                type="button"
                className="text-teal hover:underline"
                onClick={() => setMode("signin")}
              >
                {t("auth.back")}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
