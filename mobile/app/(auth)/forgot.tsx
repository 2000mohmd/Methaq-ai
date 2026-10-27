import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { AuthScreen, ErrorNote, Field, PrimaryButton, arabicError, buzz, isEmail } from "../../components/auth-ui";
import { supabase } from "../../lib/supabase";
import { C, F } from "../../lib/theme";

export default function Forgot() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit() {
    if (!isEmail(email)) return (buzz(false), setError("أدخل بريداً إلكترونياً صحيحاً."));
    setError(null);
    setBusy(true);
    // No redirectTo: the link opens the project's Site URL (the website), where the new password is set.
    const { error: e } = await supabase.auth.resetPasswordForEmail(email.trim());
    setBusy(false);
    if (e) return (buzz(false), setError(arabicError(e)));
    buzz(true);
    setSent(true);
  }

  return (
    <AuthScreen title="استعادة كلمة المرور" subtitle="سنرسل لك رابطاً لتعيين كلمة مرور جديدة.">
      {sent ? (
        <View style={{ alignItems: "center", gap: 14, paddingVertical: 24 }}>
          <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: C.tealTint, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="checkmark-circle-outline" size={42} color={C.teal} />
          </View>
          <Text style={{ fontFamily: F.regular, fontSize: 15, lineHeight: 26, color: C.fg, textAlign: "center" }}>
            إن كان البريد مسجّلاً لدينا فستصلك رسالة خلال دقائق. تحقق من مجلد الرسائل غير المرغوب فيها أيضاً.
          </Text>
          <PrimaryButton label="العودة لتسجيل الدخول" onPress={() => router.back()} />
        </View>
      ) : (
        <>
          <Field
            label="البريد الإلكتروني"
            icon="mail-outline"
            placeholder="name@example.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            returnKeyType="send"
            value={email}
            onChangeText={setEmail}
            onSubmitEditing={submit}
          />
          <ErrorNote text={error} />
          <PrimaryButton label="إرسال الرابط" onPress={submit} busy={busy} />
        </>
      )}
    </AuthScreen>
  );
}
