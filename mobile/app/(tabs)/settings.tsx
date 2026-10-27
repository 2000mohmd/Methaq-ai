import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useNavigation, useRouter } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useState } from "react";
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, Switch, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { API_URL, supabase } from "../../lib/supabase";
import { LAWYER_STATUS, type LawyerStatus } from "../lawyer";
import { C, F, R, s, shadow } from "../../lib/theme";

/** Same shape as the website's Letterhead (src/lib/docx-export.ts). */
type Letterhead = { name_ar?: string; name_en?: string; address?: string; contact?: string; cr?: string; logo?: boolean };
type Profile = { id: string; email: string | null; full_name: string | null; account_type: string | null; numerals: string | null; letterhead: Letterhead | null };
type Icon = keyof typeof Ionicons.glyphMap;

// ponytail: placeholder inbox, replace with the firm's real support address before release.
const SUPPORT_EMAIL = "support@mithaq.sa";

const ACCOUNT_TYPES: Record<string, string> = { individual: "فرد", lawyer: "محامٍ", law_firm: "مكتب محاماة", in_house: "إدارة قانونية" };

const LH_FIELDS = [
  ["name_ar", "اسم المكتب (عربي)"],
  ["name_en", "اسم المكتب (إنجليزي)"],
  ["address", "العنوان"],
  ["contact", "الهاتف / البريد / الموقع"],
  ["cr", "رقم السجل التجاري / ترخيص المحاماة"],
] as const;

function initials(name: string, email: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length) return words.slice(0, 2).map((w) => w[0]).join("‌"); // ZWNJ: keep Arabic initials from joining
  return email ? email[0].toUpperCase() : "";
}

const mail = (subject: string) => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`);

export default function Settings() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [since, setSince] = useState("");
  const router = useRouter();
  const [sheet, setSheet] = useState<"name" | "letterhead" | "delete" | null>(null);
  const [lawyerStatus, setLawyerStatus] = useState<LawyerStatus | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [name, setName] = useState("");
  const [lh, setLh] = useState<Letterhead>({});
  const [busy, setBusy] = useState(false);

  useLayoutEffect(() => navigation.setOptions({ headerShown: false }), [navigation]);
  // Light status bar over the navy header, back to dark when leaving the tab.
  useFocusEffect(useCallback(() => {
    setStatusBarStyle("light");
    return () => setStatusBarStyle("dark");
  }, []));

  // Lawyer verification status; refreshed whenever the tab regains focus (e.g. back from /lawyer).
  const isLawyer = profile?.account_type === "lawyer";
  useFocusEffect(useCallback(() => {
    if (!isLawyer || !profile) return;
    supabase.from("lawyer_profiles").select("status").eq("user_id", profile.id).maybeSingle()
      .then(({ data }) => setLawyerStatus(((data as { status: LawyerStatus } | null)?.status) ?? null));
  }, [isLawyer, profile?.id]));

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      setSince(new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { month: "long", year: "numeric" }).format(new Date(data.user.created_at)));
      const { data: p } = await supabase.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
      if (p) setProfile(p as Profile);
    });
  }, []);

  async function save(patch: Partial<Profile>) {
    if (!profile) return false;
    setBusy(true);
    const { error } = await supabase.from("profiles").update(patch).eq("id", profile.id);
    setBusy(false);
    if (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("خطأ", error.message);
      return false;
    }
    setProfile({ ...profile, ...patch });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    return true;
  }

  function openSheet(which: "name" | "letterhead") {
    setName(profile?.full_name ?? "");
    setLh(profile?.letterhead ?? {});
    setSheet(which);
  }

  function setNumerals(n: string) {
    if (n === profile?.numerals) return;
    Haptics.selectionAsync();
    save({ numerals: n });
  }

  /** Store requirement: in-app deletion. Own storage folders first (SQL can't delete storage objects), then the account. */
  async function deleteAccount() {
    if (!profile || confirmText.trim() !== "حذف") return;
    setBusy(true);
    try {
      for (const bucket of ["documents", "lawyer-licences"]) {
        // ponytail: one page of 1000 files per folder; loop on list() if users ever exceed that.
        const { data, error } = await supabase.storage.from(bucket).list(profile.id, { limit: 1000 });
        if (error) throw error;
        const paths = (data ?? []).map((f) => `${profile.id}/${f.name}`);
        if (paths.length) {
          const { error: rmErr } = await supabase.storage.from(bucket).remove(paths);
          if (rmErr) throw rmErr;
        }
      }
      const { error } = await supabase.rpc("delete_my_account");
      if (error) throw error;
      setSheet(null);
      await supabase.auth.signOut({ scope: "local" }); // the server session is gone with the user
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("تعذّر حذف الحساب", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function signOut() {
    Alert.alert("تسجيل الخروج", "هل تريد تسجيل الخروج من حسابك؟", [
      { text: "إلغاء", style: "cancel" },
      { text: "تسجيل الخروج", style: "destructive", onPress: () => supabase.auth.signOut() },
    ]);
  }

  const fullName = profile?.full_name?.trim() || "";
  const email = profile?.email ?? "";
  const accountType = ACCOUNT_TYPES[profile?.account_type ?? ""] ?? "";
  const numerals = profile?.numerals ?? "western";
  const lhName = profile?.letterhead?.name_ar || profile?.letterhead?.name_en;
  const ini = initials(fullName, email);

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={[C.navy, C.navySoft, C.teal]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ paddingTop: insets.top + 20, paddingBottom: 36, paddingHorizontal: 20, alignItems: "center", borderBottomLeftRadius: R.xl, borderBottomRightRadius: R.xl }}>
          <View style={{ width: 92, height: 92, borderRadius: 46, backgroundColor: "rgba(255,255,255,0.16)", borderWidth: 2, borderColor: "rgba(255,255,255,0.45)", alignItems: "center", justifyContent: "center" }}>
            {ini ? <Text style={{ fontFamily: F.bold, fontSize: 34, color: "#fff" }}>{ini}</Text> : <Ionicons name="person" size={40} color="#fff" />}
          </View>
          {profile ? (
            <>
              <Text style={{ fontFamily: F.bold, fontSize: 22, color: "#fff", marginTop: 14 }}>{fullName || "بدون اسم"}</Text>
              {!!email && <Text style={{ fontFamily: F.regular, fontSize: 14, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>{email}</Text>}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 }}>
                {!!accountType && (
                  <View style={{ backgroundColor: "rgba(255,255,255,0.18)", borderRadius: R.pill, paddingHorizontal: 12, paddingVertical: 4 }}>
                    <Text style={{ fontFamily: F.semibold, fontSize: 12, color: "#fff" }}>{accountType}</Text>
                  </View>
                )}
                {!!since && <Text style={{ fontFamily: F.regular, fontSize: 12, color: "rgba(255,255,255,0.75)" }}>عضو منذ {since}</Text>}
              </View>
            </>
          ) : (
            <ActivityIndicator color="#fff" style={{ marginTop: 18 }} />
          )}
        </LinearGradient>

        <Section title="الحساب">
          <Row icon="person-outline" tint={C.teal} title="الاسم الكامل" value={fullName || "أضف اسمك"} onPress={profile ? () => openSheet("name") : undefined} />
          <Row icon="mail-outline" tint="#3b82f6" title="البريد الإلكتروني" value={email} />
          <Row icon="briefcase-outline" tint={C.navySoft} title="نوع الحساب" value={accountType} />
          {isLawyer && (
            <Row icon="ribbon-outline" tint={C.teal} title="توثيق حساب المحامي"
              value={lawyerStatus ? LAWYER_STATUS[lawyerStatus]?.ar : "غير موثّق"} onPress={() => router.push("/lawyer")} />
          )}
        </Section>

        <Section title="التفضيلات">
          <Row icon="calculator-outline" tint={C.amber} title="الأرقام" subtitle="طريقة عرض الأرقام في التطبيق"
            right={
              <View style={{ flexDirection: "row", backgroundColor: C.navyTint, borderRadius: R.sm, padding: 3 }}>
                {(["western", "eastern"] as const).map((c) => (
                  <Pressable key={c} onPress={() => setNumerals(c)} disabled={!profile || busy} accessibilityRole="button" accessibilityState={{ selected: numerals === c }}
                    style={[{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 }, numerals === c && { backgroundColor: C.bg, ...shadow }]}>
                    <Text style={{ fontFamily: F.semibold, fontSize: 14, color: numerals === c ? C.navy : C.muted }}>{c === "western" ? "123" : "١٢٣"}</Text>
                  </Pressable>
                ))}
              </View>
            } />
        </Section>

        <Section title="المستندات" footer="تظهر الترويسة في أعلى كل ملف Word مُصدَّر مع التاريخ الهجري والميلادي.">
          <Row icon="document-text-outline" tint="#8b5cf6" title="الترويسة الرسمية" value={lhName || "غير مُعدّة"} onPress={profile ? () => openSheet("letterhead") : undefined} />
        </Section>

        <Section title="الدعم والقانوني">
          <Row icon="reader-outline" tint={C.navy} title="الشروط والأحكام" onPress={() => Linking.openURL(API_URL + "/terms")} external />
          <Row icon="lock-closed-outline" tint={C.teal} title="سياسة الخصوصية" onPress={() => Linking.openURL(API_URL + "/privacy")} external />
          <Row icon="chatbubble-ellipses-outline" tint="#10b981" title="تواصل معنا" subtitle={SUPPORT_EMAIL} onPress={() => mail("استفسار من تطبيق ميثاق العربية")} />
        </Section>

        <Section title="عن التطبيق">
          <Row icon="information-circle-outline" tint={C.muted} title="الإصدار" value={Constants.expoConfig?.version ?? "—"} />
        </Section>

        <Section>
          <Row icon="log-out-outline" tint={C.danger} title="تسجيل الخروج" danger onPress={signOut} />
          <Row icon="trash-outline" tint={C.danger} title="حذف الحساب" subtitle="حذف نهائي لحسابك وملفاتك" danger
            onPress={profile ? () => (setConfirmText(""), setSheet("delete")) : undefined} />
        </Section>

        <Text style={[s.muted, { textAlign: "center", marginTop: 20 }]}>ميثاق العربية</Text>
      </ScrollView>

      <Sheet visible={sheet === "name"} title="الاسم الكامل" busy={busy} onClose={() => setSheet(null)}
        onSave={async () => { if (await save({ full_name: name.trim() })) setSheet(null); }}>
        <TextInput style={s.input} value={name} onChangeText={setName} placeholder="اكتب اسمك الكامل" placeholderTextColor={C.muted} autoFocus returnKeyType="done" />
      </Sheet>

      <Sheet visible={sheet === "delete"} title="حذف الحساب نهائياً" busy={busy} onClose={() => setSheet(null)}
        onSave={deleteAccount} saveLabel="حذف الحساب" danger disabled={confirmText.trim() !== "حذف"}>
        <Text style={s.text}>
          سيُحذف حسابك وملفاتك المرفوعة وبياناتك الشخصية نهائياً ولا يمكن التراجع. قد تحتفظ المنصة بسجلات المستندات المعتمدة وسجل التدقيق وفق المتطلبات النظامية.
        </Text>
        <Text style={[s.muted, { fontFamily: F.medium }]}>للتأكيد اكتب كلمة «حذف»</Text>
        <TextInput style={s.input} value={confirmText} onChangeText={setConfirmText} placeholder="حذف" placeholderTextColor={C.muted} autoCorrect={false} />
      </Sheet>

      <Sheet visible={sheet === "letterhead"} title="الترويسة الرسمية" busy={busy} onClose={() => setSheet(null)}
        onSave={async () => { if (await save({ letterhead: lh })) setSheet(null); }}>
        <Text style={s.muted}>تظهر في أعلى كل ملف Word مع التاريخ الهجري والميلادي.</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.surface, borderRadius: R.md, padding: 12 }}>
          <Text style={[s.text, { flex: 1 }]}>إظهار شعار ميثاق العربية في الترويسة</Text>
          <Switch value={lh.logo !== false} onValueChange={(v) => setLh({ ...lh, logo: v })} trackColor={{ true: C.teal }} />
        </View>
        {LH_FIELDS.map(([k, a]) => (
          <View key={k} style={{ gap: 6 }}>
            <Text style={[s.muted, { fontFamily: F.medium }]}>{a}</Text>
            <TextInput style={s.input} value={lh[k] ?? ""} onChangeText={(v) => setLh({ ...lh, [k]: v })} />
          </View>
        ))}
      </Sheet>
    </View>
  );
}

function Section({ title, footer, children }: { title?: string; footer?: string; children: ReactNode }) {
  const rows = (Array.isArray(children) ? children : [children]).filter(Boolean);
  return (
    <View style={{ marginTop: 24, paddingHorizontal: 16 }}>
      {!!title && <Text style={{ fontFamily: F.semibold, fontSize: 13, color: C.muted, marginBottom: 8, paddingHorizontal: 6, textAlign: "left" }}>{title}</Text>}
      <View style={{ backgroundColor: C.bg, borderRadius: R.lg, overflow: "hidden", ...shadow }}>
        {rows.map((r, i) => (
          <View key={i}>
            {i > 0 && <View style={{ height: 1, backgroundColor: C.border, marginStart: 62 }} />}
            {r}
          </View>
        ))}
      </View>
      {!!footer && <Text style={[s.muted, { fontSize: 12, marginTop: 8, paddingHorizontal: 6 }]}>{footer}</Text>}
    </View>
  );
}

function Row({ icon, tint, title, subtitle, value, right, onPress, danger, external }: {
  icon: Icon; tint: string; title: string; subtitle?: string; value?: string; right?: ReactNode; onPress?: () => void; danger?: boolean; external?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? "button" : undefined}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 56, backgroundColor: pressed ? C.navyTint : C.bg })}>
      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: tint, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={19} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: F.medium, fontSize: 15, color: danger ? C.danger : C.fg, textAlign: "left" }}>{title}</Text>
        {!!subtitle && <Text style={[s.muted, { fontSize: 12, lineHeight: 18 }]} numberOfLines={1}>{subtitle}</Text>}
      </View>
      {right}
      {!!value && <Text style={{ fontFamily: F.regular, fontSize: 14, color: C.muted, maxWidth: "45%" }} numberOfLines={1}>{value}</Text>}
      {/* RTL: "back" chevron points left = forward */}
      {onPress && !danger && <Ionicons name={external ? "open-outline" : "chevron-back"} size={18} color={C.border} style={{ marginStart: 2 }} />}
    </Pressable>
  );
}

function Sheet({ visible, title, busy, onClose, onSave, children, saveLabel = "حفظ", danger, disabled }: {
  visible: boolean; title: string; busy: boolean; onClose: () => void; onSave: () => void; children: ReactNode;
  saveLabel?: string; danger?: boolean; disabled?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(17,55,74,0.35)" }} onPress={onClose} accessibilityLabel="إغلاق" />
        <View style={{ backgroundColor: C.bg, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, maxHeight: "88%", paddingBottom: insets.bottom + 16 }}>
          <View style={{ alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: C.border, marginTop: 10 }} />
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12 }}>
            <Text style={[s.h2, { flex: 1 }]}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="إغلاق">
              <Ionicons name="close-circle" size={28} color={C.muted} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          <Pressable style={[s.btn, { backgroundColor: danger ? C.danger : C.teal, marginHorizontal: 20, marginTop: 12 }, (busy || disabled) && { opacity: 0.5 }]}
            onPress={onSave} disabled={busy || disabled} accessibilityRole="button">
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{saveLabel}</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
