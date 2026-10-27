import { useState } from "react";
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../lib/supabase";
import { C, s } from "../lib/theme";

export default function Login() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email || password.length < 8) return Alert.alert("تنبيه", "أدخل البريد وكلمة مرور من 8 أحرف على الأقل.");
    setBusy(true);
    const { data, error } =
      mode === "in"
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({ email: email.trim(), password });
    setBusy(false);
    if (error) return Alert.alert("خطأ", error.message);
    if (mode === "up" && !data.session) Alert.alert("تحقق من بريدك", "أرسلنا رابط التفعيل إلى بريدك.");
  }

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "center", padding: 24, gap: 14 }}>
        <Image source={require("../assets/splash-icon.png")} style={{ width: 64, height: 70, alignSelf: "center" }} resizeMode="contain" />
        <Text style={[s.h1, { textAlign: "center" }]}>ميثاق العربية</Text>
        <Text style={[s.muted, { textAlign: "center", marginBottom: 12 }]}>مساعدك القانوني السعودي</Text>
        <TextInput style={s.input} placeholder="البريد الإلكتروني" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <TextInput style={s.input} placeholder="كلمة المرور" secureTextEntry value={password} onChangeText={setPassword} />
        <Pressable style={s.btn} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{mode === "in" ? "تسجيل الدخول" : "إنشاء حساب"}</Text>}
        </Pressable>
        <Pressable onPress={() => setMode(mode === "in" ? "up" : "in")} style={{ padding: 8 }}>
          <Text style={{ color: C.teal, textAlign: "center" }}>{mode === "in" ? "ليس لديك حساب؟ أنشئ حساباً" : "لديك حساب؟ سجّل الدخول"}</Text>
        </Pressable>
        <View />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
