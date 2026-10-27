import { Link } from "@tanstack/react-router";

import { useI18n } from "@/i18n";

// Shared by /auth (sign-up) and /onboarding (Google sign-in skips the sign-up form).
// The "-" prefix keeps this file out of the route tree.
export const CONSENT_VERSION = "2026-10-draft";
export const consentFields = (ai: boolean) => ({
  terms_version: CONSENT_VERSION,
  privacy_version: CONSENT_VERSION,
  consented_at: new Date().toISOString(),
  ai_processing_consent: ai,
});

/** Required terms/privacy consent + optional consent to AI processing outside KSA (shared with onboarding). */
export function ConsentChecks({ agree, setAgree, ai, setAi }: {
  agree: boolean;
  setAgree: (v: boolean) => void;
  ai: boolean;
  setAi: (v: boolean) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-3 text-sm">
      <label className="flex items-start gap-2">
        <input type="checkbox" required className="mt-0.5 size-4 shrink-0" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>
          {t("consent.agreePrefix")}{" "}
          <Link to="/terms" target="_blank" className="text-teal hover:underline">{t("consent.terms")}</Link>{" "}
          {t("consent.and")}{" "}
          <Link to="/privacy" target="_blank" className="text-teal hover:underline">{t("consent.privacy")}</Link>
        </span>
      </label>
      <label className="flex items-start gap-2 text-muted-foreground">
        <input type="checkbox" className="mt-0.5 size-4 shrink-0" checked={ai} onChange={(e) => setAi(e.target.checked)} />
        <span>{t("consent.ai")}</span>
      </label>
    </div>
  );
}
