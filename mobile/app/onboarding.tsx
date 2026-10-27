import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import {
  AccountTypePicker,
  type AccountType,
  AuthScreen,
  ErrorNote,
  Field,
  LinkButton,
  PrimaryButton,
  arabicError,
  buzz,
  completeOnboarding,
  isAccountType,
} from "../components/auth-ui";
import { supabase } from "../lib/supabase";
import { C, F } from "../lib/theme";

/** Signed in but profiles.onboarded is false. Finishes automatically when sign-up already captured the choices. */
export default function Onboarding() {
  const [accountType, setAccountType] = useState<AccountType>("individual");
  const [firmName, setFirmName] = useState("");
  const [busy, setBusy] = useState(false);
  const [auto, setAuto] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  async function finish(type: AccountType, firm: string) {
    if (type !== "individual" && !firm.trim()) return (buzz(false), setError("أدخل اسم المكتب أو مساحة العمل."));
    setError(null);
    setBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("No session");
      await completeOnboarding(data.session.user, type, firm);
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
    supabase.auth.getSession().then(({ data }) => {
      const meta = data.session?.user.user_metadata ?? {};
      const type = meta.account_type;
      const firm = typeof meta.firm_name === "string" ? meta.firm_name : "";
      if (isAccountType(type)) {
        setAccountType(type);
        setFirmName(firm);
        if (type === "individual" || firm.trim()) return void finish(type, firm);
      }
      setAuto(false);
    });
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

  return (
    <AuthScreen title="لنُكمل إعداد حسابك" subtitle="اختر نوع الحساب المناسب لك." back={false}>
      <AccountTypePicker value={accountType} onChange={setAccountType} />
      {accountType !== "individual" && (
        <Field
          label="اسم المكتب أو مساحة العمل"
          icon="business-outline"
          placeholder="مثال: مكتب العدل للمحاماة"
          value={firmName}
          onChangeText={setFirmName}
        />
      )}
      <ErrorNote text={error} />
      <PrimaryButton label="ابدأ الآن" onPress={() => finish(accountType, firmName)} busy={busy} />
      <LinkButton label="تسجيل الخروج" color={C.muted} onPress={() => supabase.auth.signOut()} />
    </AuthScreen>
  );
}
