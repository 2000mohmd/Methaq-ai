import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Text, View } from "react-native";

import { AuthScreen, ErrorNote, Field, LinkButton, PrimaryButton, arabicError, buzz, isEmail, type InputRef } from "../../components/auth-ui";
import { supabase } from "../../lib/supabase";
import { C, F } from "../../lib/theme";

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pwRef = useRef<InputRef>(null);

  async function submit() {
    if (!isEmail(email)) return (buzz(false), setError("أدخل بريداً إلكترونياً صحيحاً."));
    if (!password) return (buzz(false), setError("أدخل كلمة المرور."));
    setError(null);
    setBusy(true);
    const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (e) return (buzz(false), setError(arabicError(e)));
    buzz(true); // the root layout routes to onboarding or the app
  }

  return (
    <AuthScreen title="مرحباً بعودتك" subtitle="سجّل الدخول لمتابعة قضاياك ومستنداتك.">
      <Field
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
      <View>
        <Field
          ref={pwRef}
          label="كلمة المرور"
          icon="lock-closed-outline"
          placeholder="••••••••"
          secret
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={submit}
        />
        <View style={{ alignItems: "flex-end" }}>
          <LinkButton label="نسيت كلمة المرور؟" onPress={() => router.push({ pathname: "/forgot", params: { email } })} />
        </View>
      </View>
      <ErrorNote text={error} />
      <PrimaryButton label="تسجيل الدخول" onPress={submit} busy={busy} />
      <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 4, marginTop: "auto" }}>
        <Text style={{ fontFamily: F.regular, fontSize: 14, color: C.muted }}>ليس لديك حساب؟</Text>
        <LinkButton label="أنشئ حساباً" onPress={() => router.replace("/sign-up")} />
      </View>
    </AuthScreen>
  );
}
