import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import {
  AccountTypePicker,
  type AccountType,
  AuthScreen,
  ConsentChecks,
  type Consent,
  ErrorNote,
  Field,
  LinkButton,
  PrimaryButton,
  arabicError,
  buzz,
  completeOnboarding,
  isAccountType,
  saveConsent,
} from "../components/auth-ui";
import { supabase } from "../lib/supabase";
import { C, F } from "../lib/theme";

/**
 * Signed in but profiles.onboarded is false or consent is missing. Finishes automatically when
 * sign-up already captured the choices and consent; otherwise asks for them here.
 */
export default function Onboarding() {
  const [accountType, setAccountType] = useState<AccountType>("individual");
  const [firmName, setFirmName] = useState("");
  const [terms, setTerms] = useState(false);
  const [aiConsent, setAiConsent] = useState(false);
  // Already onboarded (e.g. joined by invitation) and only the consent is missing.
  const [consentOnly, setConsentOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [auto, setAuto] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  async function finish(type: AccountType, firm: string, consent: Consent | null, onlyConsent = consentOnly) {
    if (!consent) return (buzz(false), setError("يجب الموافقة على شروط الاستخدام وسياسة الخصوصية."));
    if (!onlyConsent && type !== "individual" && !firm.trim()) return (buzz(false), setError("أدخل اسم المكتب أو مساحة العمل."));
    setError(null);
    setBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("No session");
      if (onlyConsent) await saveConsent(data.session.user.id, consent);
      else await completeOnboarding(data.session.user, type, firm, consent);
      buzz(true); // root layout now routes into the app
    } catch (e) {
      buzz(false);
      setError(arabicError(e));
      setAuto(false);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) return setAuto(false);
      const { data: p } = await supabase.from("profiles").select("onboarded,consented_at").eq("id", user.id).maybeSingle();
      const meta = user.user_metadata ?? {};
      const consent: Consent | null =
        typeof meta.consented_at === "string" ? { at: meta.consented_at, ai: meta.ai_processing_consent === true } : null;
      if (p?.onboarded) {
        setConsentOnly(true);
        // Consent given at sign-up but not yet written (e.g. invited user who signed up in the app).
        if (consent) return void finish("individual", "", consent, true);
        return setAuto(false);
      }
      const type = meta.account_type;
      const firm = typeof meta.firm_name === "string" ? meta.firm_name : "";
      if (isAccountType(type)) {
        setAccountType(type);
        setFirmName(firm);
        if (consent && (type === "individual" || firm.trim())) return void finish(type, firm, consent, false);
      }
      setAuto(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (auto) {
    return (
      <View style={{ flex: 1, backgroundColor: C.navy, alignItems: "center", justifyContent: "center", gap: 16 }}>
        <ActivityIndicator color={C.teal} size="large" />
        <Text style={{ fontFamily: F.medium, fontSize: 16, color: "#fff" }}>جارٍ تجهيز حسابك…</Text>
      </View>
    );
  }

  const consent = terms ? { at: new Date().toISOString(), ai: aiConsent } : null;
  return (
    <AuthScreen
      title={consentOnly ? "قبل المتابعة" : "لنُكمل إعداد حسابك"}
      subtitle={consentOnly ? "يلزم موافقتك على الشروط وسياسة الخصوصية." : "اختر نوع الحساب المناسب لك."}
      back={false}
    >
      {!consentOnly && <AccountTypePicker value={accountType} onChange={setAccountType} />}
      {!consentOnly && accountType !== "individual" && (
        <Field
          label="اسم المكتب أو مساحة العمل"
          icon="business-outline"
          placeholder="مثال: مكتب العدل للمحاماة"
          value={firmName}
          onChangeText={setFirmName}
        />
      )}
      <ConsentChecks terms={terms} ai={aiConsent} onTerms={setTerms} onAi={setAiConsent} />
      <ErrorNote text={error} />
      <PrimaryButton label="ابدأ الآن" onPress={() => finish(accountType, firmName, consent)} busy={busy} disabled={!terms} />
      <LinkButton label="تسجيل الخروج" color={C.muted} onPress={() => supabase.auth.signOut()} />
    </AuthScreen>
  );
}
