import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Text, View } from "react-native";

import {
  AccountTypePicker,
  type AccountType,
  AuthScreen,
  type InputRef,
  ErrorNote,
  Field,
  LinkButton,
  PrimaryButton,
  arabicError,
  buzz,
  isEmail,
} from "../../components/auth-ui";
import { supabase } from "../../lib/supabase";
import { C, F } from "../../lib/theme";

export default function SignUp() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("individual");
  const [firmName, setFirmName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const emailRef = useRef<InputRef>(null);
  const pwRef = useRef<InputRef>(null);
  const isIndividual = accountType === "individual";

  async function submit() {
    const fail = (m: string) => (buzz(false), setError(m));
    if (fullName.trim().length < 2) return fail("أدخل اسمك الكامل.");
    if (!isEmail(email)) return fail("أدخل بريداً إلكترونياً صحيحاً.");
    if (password.length < 8) return fail("كلمة المرور يجب أن تكون 8 أحرف على الأقل.");
    if (!isIndividual && !firmName.trim()) return fail("أدخل اسم المكتب أو مساحة العمل.");
    setError(null);
    setBusy(true);
    // Account choices ride in user metadata; app/onboarding.tsx completes the
    // same writes as the website as soon as there is a session (now, or after email confirmation).
    const { data, error: e } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim(), account_type: accountType, firm_name: isIndividual ? null : firmName.trim() } },
    });
    setBusy(false);
    if (e) return fail(arabicError(e));
    buzz(true);
    if (!data.session) setSentTo(email.trim());
  }

  if (sentTo) {
    return (
      <AuthScreen title="تحقق من بريدك" subtitle="خطوة أخيرة لتفعيل حسابك.">
        <View style={{ alignItems: "center", gap: 14, paddingVertical: 24 }}>
          <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: C.tealTint, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="mail-open-outline" size={40} color={C.teal} />
          </View>
          <Text style={{ fontFamily: F.regular, fontSize: 15, lineHeight: 26, color: C.fg, textAlign: "center" }}>
            أرسلنا رابط التفعيل إلى{"\n"}
            <Text style={{ fontFamily: F.bold, color: C.navy }}>{sentTo}</Text>
            {"\n"}افتح الرابط ثم سجّل الدخول لإكمال إعداد حسابك.
          </Text>
        </View>
        <PrimaryButton label="الذهاب لتسجيل الدخول" onPress={() => router.replace("/sign-in")} />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen title="إنشاء حساب" subtitle="دقيقة واحدة وتبدأ مع مساعدك القانوني.">
      <Field
        label="الاسم الكامل"
        icon="person-outline"
        placeholder="مثال: عبدالله محمد"
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
        value={fullName}
        onChangeText={setFullName}
        onSubmitEditing={() => emailRef.current?.focus()}
      />
      <Field
        ref={emailRef}
        label="البريد الإلكتروني"
        icon="mail-outline"
        placeholder="name@example.com"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
        value={email}
        onChangeText={setEmail}
        onSubmitEditing={() => pwRef.current?.focus()}
      />
      <Field
        ref={pwRef}
        label="كلمة المرور"
        icon="lock-closed-outline"
        placeholder="8 أحرف على الأقل"
        secret
        autoComplete="new-password"
        textContentType="newPassword"
        value={password}
        onChangeText={setPassword}
      />

      <View style={{ gap: 10, marginTop: 4 }}>
        <Text style={{ fontFamily: F.semibold, fontSize: 15, color: C.navy, textAlign: "left" }}>نوع الحساب</Text>
        <AccountTypePicker value={accountType} onChange={setAccountType} />
      </View>
      {!isIndividual && (
        <Field
          label="اسم المكتب أو مساحة العمل"
          icon="business-outline"
          placeholder="مثال: مكتب العدل للمحاماة"
          value={firmName}
          onChangeText={setFirmName}
        />
      )}

      <ErrorNote text={error} />
      <PrimaryButton label="إنشاء الحساب" onPress={submit} busy={busy} />
      <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 4 }}>
        <Text style={{ fontFamily: F.regular, fontSize: 14, color: C.muted }}>لديك حساب؟</Text>
        <LinkButton label="سجّل الدخول" onPress={() => router.replace("/sign-in")} />
      </View>
    </AuthScreen>
  );
}
