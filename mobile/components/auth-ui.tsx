import { Ionicons } from "@expo/vector-icons";
import type { User } from "@supabase/supabase-js";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useRouter } from "expo-router";
import { type ComponentProps, type ComponentRef, type ReactNode, type Ref, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { API_URL, supabase } from "../lib/supabase";
import { C, F, R, shadow } from "../lib/theme";
import { BrandMark, BrandPattern } from "./brand-mark";

// ---------- account types + onboarding (mirrors the website's src/routes/onboarding.tsx) ----------

export const ACCOUNT_TYPES = [
  { value: "individual", label: "فرد", hint: "استشارات وعقود لشؤونك الشخصية", icon: "person-outline" },
  { value: "lawyer", label: "محامٍ مستقل", hint: "لممارستك المهنية الخاصة", icon: "briefcase-outline" },
  { value: "law_firm", label: "مكتب محاماة", hint: "مساحة عمل مشتركة لفريقك", icon: "business-outline" },
  { value: "in_house", label: "إدارة قانونية داخلية", hint: "للإدارة القانونية في منشأتك", icon: "shield-checkmark-outline" },
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number]["value"];
export const isAccountType = (v: unknown): v is AccountType => ACCOUNT_TYPES.some((t) => t.value === v);

/**
 * Root layout registers `done` so finishing onboarding releases the route guard;
 * `next` is where the guard sends the user afterwards (lawyers → licence verification).
 */
export const onboardingSignal: { done: () => void; next: Href | null } = { done: () => {}, next: null };

// ---------- consent (profiles.terms_version / privacy_version / consented_at / ai_processing_consent) ----------

export const CONSENT_VERSION = "2026-10-draft";
export type Consent = { at: string; ai: boolean };
const consentColumns = (c: Consent) => ({
  terms_version: CONSENT_VERSION, privacy_version: CONSENT_VERSION, consented_at: c.at, ai_processing_consent: c.ai,
});

/** For already-onboarded profiles that predate the consent columns. */
export async function saveConsent(userId: string, c: Consent) {
  const { error } = await supabase.from("profiles").update(consentColumns(c)).eq("id", userId);
  if (error) throw error;
  onboardingSignal.done();
}

/**
 * Same writes as the website: individuals → profile only; everyone else →
 * organization + owner role + profile, then onboarded:true.
 */
export async function completeOnboarding(user: User, accountType: AccountType, firmName: string, consent: Consent) {
  // ponytail: Saudi-first app, so jurisdictions default to KSA instead of the website's picker step.
  const jurisdictions = ["Saudi Arabia"];
  let orgId: string | null = null;
  if (accountType !== "individual") {
    const { data: org, error } = await supabase
      .from("organizations")
      .insert({
        name: firmName.trim() || (user.email ?? "Workspace"),
        account_type: accountType,
        jurisdictions,
        default_language: "ar",
        created_by: user.id,
      })
      .select()
      .single();
    if (error) throw error;
    orgId = org.id;
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({ user_id: user.id, organization_id: org.id, role: "owner" });
    if (roleError) throw roleError;
  }
  const { error } = await supabase
    .from("profiles")
    .update({ organization_id: orgId, account_type: accountType, jurisdictions, language: "ar", onboarded: true, ...consentColumns(consent) })
    .eq("id", user.id);
  if (error) throw error;
  if (accountType === "lawyer") onboardingSignal.next = "/lawyer";
  onboardingSignal.done();
}

// ---------- errors + haptics ----------

export function arabicError(e: unknown): string {
  const m = (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e)).toLowerCase();
  if (m.includes("invalid login")) return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
  if (m.includes("already registered") || m.includes("already been registered")) return "هذا البريد مسجّل مسبقاً. سجّل الدخول بدلاً من ذلك.";
  if (m.includes("email not confirmed")) return "لم يتم تأكيد بريدك بعد. افتح رابط التفعيل المرسل إليك.";
  if (m.includes("rate limit") || m.includes("too many") || m.includes("security purposes")) return "محاولات كثيرة. انتظر قليلاً ثم حاول مجدداً.";
  if (m.includes("network") || m.includes("fetch")) return "تعذّر الاتصال. تحقق من الإنترنت وحاول مجدداً.";
  if (m.includes("password")) return "كلمة المرور ضعيفة. استخدم 8 أحرف على الأقل.";
  if (m.includes("email")) return "البريد الإلكتروني غير صالح.";
  return "حدث خطأ غير متوقع. حاول مرة أخرى.";
}

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
export const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
export const buzz = (ok: boolean) =>
  Haptics.notificationAsync(ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error).catch(() => {});

// ---------- layout ----------

/** Navy branded header + white sheet with the form, keyboard-safe. */
export function AuthScreen({ title, subtitle, children, back = true }: { title: string; subtitle?: string; children: ReactNode; back?: boolean }) {
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: C.navy }}>
      <LinearGradient colors={[C.navy, C.navySoft]} style={StyleSheet.absoluteFill} />
      <BrandPattern opacity={0.06} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" bounces={false}>
            <View style={ui.header}>
              <View style={ui.headerRow}>
                {back && router.canGoBack() ? (
                  <Pressable onPress={() => router.back()} hitSlop={8} style={ui.backBtn} accessibilityRole="button" accessibilityLabel="رجوع">
                    {/* RTL: "back" points right */}
                    <Ionicons name="chevron-forward" size={22} color="#fff" />
                  </Pressable>
                ) : (
                  <View style={{ width: 44 }} />
                )}
                <BrandMark size={30} color={C.teal} />
                <View style={{ width: 44 }} />
              </View>
              <Text style={ui.title}>{title}</Text>
              {subtitle ? <Text style={ui.subtitle}>{subtitle}</Text> : null}
            </View>
            <SafeAreaView edges={["bottom"]} style={ui.sheet}>
              {children}
            </SafeAreaView>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// ---------- controls ----------

type FieldProps = TextInputProps & { label: string; icon: ComponentProps<typeof Ionicons>["name"]; secret?: boolean; ref?: Ref<InputRef> };
export type InputRef = ComponentRef<typeof TextInput>;

export function Field({ label, icon, secret, style, ref, ...rest }: FieldProps) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  return (
    <View style={{ gap: 6 }}>
      <Text style={ui.label}>{label}</Text>
      <View style={[ui.field, focused && ui.fieldFocused]}>
        <Ionicons name={icon} size={20} color={focused ? C.teal : C.muted} />
        <TextInput
          ref={ref}
          placeholderTextColor="#9aa7ae"
          {...rest}
          secureTextEntry={secret && hidden}
          onFocus={(e) => (setFocused(true), rest.onFocus?.(e))}
          onBlur={(e) => (setFocused(false), rest.onBlur?.(e))}
          style={[ui.input, style]}
        />
        {secret ? (
          <Pressable onPress={() => setHidden(!hidden)} hitSlop={10} accessibilityRole="button" accessibilityLabel={hidden ? "إظهار كلمة المرور" : "إخفاء كلمة المرور"}>
            <Ionicons name={hidden ? "eye-outline" : "eye-off-outline"} size={21} color={C.muted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function PrimaryButton({ label, onPress, busy, disabled, tone = "teal" }: {
  label: string; onPress: () => void; busy?: boolean; disabled?: boolean; tone?: "teal" | "navy";
}) {
  return (
    <Pressable
      onPress={() => (tap(), onPress())}
      disabled={busy || disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(busy || disabled), busy: !!busy }}
      style={({ pressed }) => [ui.primary, { backgroundColor: tone === "teal" ? C.teal : C.navy, opacity: disabled ? 0.45 : pressed || busy ? 0.85 : 1 }]}
    >
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={ui.primaryText}>{label}</Text>}
    </Pressable>
  );
}

export function LinkButton({ label, onPress, color = C.teal }: { label: string; onPress: () => void; color?: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={{ minHeight: 44, justifyContent: "center", alignItems: "center" }} accessibilityRole="button">
      <Text style={{ fontFamily: F.semibold, fontSize: 14, color }}>{label}</Text>
    </Pressable>
  );
}

export function ErrorNote({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <View style={ui.error}>
      <Ionicons name="alert-circle" size={18} color={C.danger} />
      <Text style={ui.errorText}>{text}</Text>
    </View>
  );
}

export function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <Pressable
      onPress={() => (Haptics.selectionAsync().catch(() => {}), onChange(!checked))}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, minHeight: 44, paddingVertical: 4 }}
    >
      <View style={[ui.box, checked && ui.boxOn]}>{checked && <Ionicons name="checkmark" size={16} color="#fff" />}</View>
      <Text style={ui.checkText}>{children}</Text>
    </Pressable>
  );
}

/** Required terms/privacy consent + optional consent to out-of-Kingdom AI processing (after PII masking). */
export function ConsentChecks({ terms, ai, onTerms, onAi }: { terms: boolean; ai: boolean; onTerms: (v: boolean) => void; onAi: (v: boolean) => void }) {
  const link = (label: string, path: string) => (
    <Text style={ui.link} onPress={() => Linking.openURL(API_URL + path)} accessibilityRole="link">{label}</Text>
  );
  return (
    <View style={{ gap: 4 }}>
      <Checkbox checked={terms} onChange={onTerms}>
        أوافق على {link("شروط الاستخدام", "/terms")} و{link("سياسة الخصوصية", "/privacy")}
      </Checkbox>
      <Checkbox checked={ai} onChange={onAi}>
        أوافق على معالجة بياناتي بواسطة مزوّد ذكاء اصطناعي خارج المملكة بعد إخفاء البيانات الشخصية <Text style={{ color: C.muted }}>(اختياري)</Text>
      </Checkbox>
    </View>
  );
}

export function AccountTypePicker({ value, onChange }: { value: AccountType; onChange: (v: AccountType) => void }) {
  return (
    <View style={{ gap: 10 }}>
      {ACCOUNT_TYPES.map((t) => {
        const on = t.value === value;
        return (
          <Pressable
            key={t.value}
            onPress={() => (Haptics.selectionAsync().catch(() => {}), onChange(t.value))}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            style={[ui.option, on && ui.optionOn]}
          >
            <View style={[ui.optionIcon, on && { backgroundColor: C.teal }]}>
              <Ionicons name={t.icon} size={20} color={on ? "#fff" : C.navy} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={ui.optionLabel}>{t.label}</Text>
              <Text style={ui.optionHint}>{t.hint}</Text>
            </View>
            <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={22} color={on ? C.teal : C.border} />
          </Pressable>
        );
      })}
    </View>
  );
}

const ui = StyleSheet.create({
  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 28 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 22 },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.1)" },
  title: { fontFamily: F.bold, fontSize: 28, lineHeight: 42, color: "#fff", textAlign: "left" },
  subtitle: { fontFamily: F.regular, fontSize: 15, lineHeight: 24, color: "rgba(255,255,255,0.72)", textAlign: "left", marginTop: 4 },
  sheet: { flexGrow: 1, backgroundColor: C.bg, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 16, gap: 16 },
  label: { fontFamily: F.medium, fontSize: 14, color: C.navy, textAlign: "left" },
  field: {
    flexDirection: "row", alignItems: "center", gap: 10, minHeight: 54, paddingHorizontal: 14,
    borderWidth: 1.5, borderColor: C.border, borderRadius: R.md, backgroundColor: C.surface,
  },
  fieldFocused: { borderColor: C.teal, backgroundColor: C.bg },
  input: { flex: 1, fontFamily: F.regular, fontSize: 16, color: C.fg, textAlign: "left", paddingVertical: 12 },
  primary: { minHeight: 54, borderRadius: R.md, alignItems: "center", justifyContent: "center", ...shadow },
  primaryText: { fontFamily: F.bold, fontSize: 16, color: "#fff" },
  error: { flexDirection: "row", gap: 8, alignItems: "center", padding: 12, borderRadius: R.sm, backgroundColor: "#fbeceb" },
  errorText: { flex: 1, fontFamily: F.medium, fontSize: 14, lineHeight: 22, color: C.danger, textAlign: "left" },
  option: {
    flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, padding: 12,
    borderWidth: 1.5, borderColor: C.border, borderRadius: R.md, backgroundColor: C.bg,
  },
  optionOn: { borderColor: C.teal, backgroundColor: C.tealTint },
  optionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: C.navyTint },
  optionLabel: { fontFamily: F.semibold, fontSize: 15, color: C.navy, textAlign: "left" },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.bg, alignItems: "center", justifyContent: "center", marginTop: 1 },
  boxOn: { borderColor: C.teal, backgroundColor: C.teal },
  checkText: { flex: 1, fontFamily: F.regular, fontSize: 14, lineHeight: 23, color: C.fg, textAlign: "left" },
  link: { fontFamily: F.semibold, color: C.teal, textDecorationLine: "underline" },
  optionHint: { fontFamily: F.regular, fontSize: 12.5, color: C.muted, textAlign: "left", marginTop: 1 },
});
