import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PrimaryButton, tap } from "../../components/auth-ui";
import { BrandMark, BrandPattern } from "../../components/brand-mark";
import { C, F, R } from "../../lib/theme";

const FEATURES = [
  { icon: "chatbubbles-outline", text: "اسأل عن الأنظمة السعودية بلغة واضحة" },
  { icon: "document-text-outline", text: "دقّق عقودك واكتشف البنود الحساسة" },
  { icon: "create-outline", text: "أنشئ عقودك ويعتمدها محامٍ مرخّص قبل التنزيل" },
] as const;

export default function Welcome() {
  const router = useRouter();
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, [a]);
  const up = (from: number) => ({ opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }] });

  return (
    <View style={{ flex: 1, backgroundColor: C.navy }}>
      <LinearGradient colors={[C.navy, C.navySoft, C.navy]} locations={[0, 0.6, 1]} style={StyleSheet.absoluteFill} />
      <BrandPattern opacity={0.07} />
      <SafeAreaView style={{ flex: 1 }}>
        <Animated.View style={[st.hero, up(24)]}>
          <View style={st.markWrap}>
            <BrandMark size={72} color="#fff" />
          </View>
          <Text style={st.word}>ميثاق العربية</Text>
          <Text style={st.tag}>مساعدك القانوني السعودي، في جيبك</Text>
          <View style={st.features}>
            {FEATURES.map((f) => (
              <View key={f.icon} style={st.feature}>
                <View style={st.featureIcon}>
                  <Ionicons name={f.icon} size={18} color={C.teal} />
                </View>
                <Text style={st.featureText}>{f.text}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        <Animated.View style={[st.actions, up(40)]}>
          <PrimaryButton label="إنشاء حساب" onPress={() => router.push("/sign-up")} />
          <Pressable
            onPress={() => (tap(), router.push("/sign-in"))}
            accessibilityRole="button"
            style={({ pressed }) => [st.secondary, pressed && { backgroundColor: "rgba(255,255,255,0.08)" }]}
          >
            <Text style={st.secondaryText}>تسجيل الدخول</Text>
          </Pressable>
          <Text style={st.fine}>بالمتابعة فأنت توافق على شروط الاستخدام وسياسة الخصوصية.</Text>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const st = StyleSheet.create({
  hero: { flex: 1, justifyContent: "center", paddingHorizontal: 28 },
  markWrap: {
    width: 104, height: 104, borderRadius: 32, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(2,167,159,0.16)", borderWidth: 1, borderColor: "rgba(60,191,184,0.35)", marginBottom: 24,
  },
  word: { fontFamily: F.bold, fontSize: 36, lineHeight: 54, color: "#fff", textAlign: "left" },
  tag: { fontFamily: F.regular, fontSize: 17, lineHeight: 28, color: "rgba(255,255,255,0.75)", textAlign: "left" },
  features: { marginTop: 32, gap: 14 },
  feature: { flexDirection: "row", alignItems: "center", gap: 12 },
  featureIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" },
  featureText: { flex: 1, fontFamily: F.medium, fontSize: 15, lineHeight: 24, color: "rgba(255,255,255,0.9)", textAlign: "left" },
  actions: { paddingHorizontal: 24, paddingBottom: 12, gap: 12 },
  secondary: { minHeight: 54, borderRadius: R.md, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.35)" },
  secondaryText: { fontFamily: F.bold, fontSize: 16, color: "#fff" },
  fine: { fontFamily: F.regular, fontSize: 12, lineHeight: 20, color: "rgba(255,255,255,0.55)", textAlign: "center", marginTop: 4 },
});
