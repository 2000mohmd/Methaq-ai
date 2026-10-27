// Lawyer verification: licence details + licence copy, reviewed by a platform admin
// (supabase/migrations/20261029100000_lawyers_consent_review.sql). Editing sends it back to pending.
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Banner, Button, Choice, FieldLabel, type IconName, Pill, success } from "../components/ui-kit";
import { supabase } from "../lib/supabase";
import { C, F, R, s } from "../lib/theme";

export type LawyerStatus = "pending" | "approved" | "rejected";
type LawyerProfile = {
  user_id: string; full_name: string; licence_no: string; licence_expiry: string | null; phone: string | null; city: string | null;
  specialties: string[]; licence_file: string | null; status: LawyerStatus; review_note: string | null;
};

export const LAWYER_STATUS: Record<LawyerStatus, { ar: string; color: string; icon: IconName }> = {
  pending: { ar: "قيد المراجعة", color: C.amber, icon: "time-outline" },
  approved: { ar: "موثّق", color: C.teal, icon: "checkmark-circle" },
  rejected: { ar: "مرفوض", color: C.danger, icon: "close-circle" },
};

const SPECIALTIES = ["أحوال شخصية", "عمالي", "تجاري", "جنائي", "عقاري", "إداري", "تحكيم", "ملكية فكرية"];
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

export default function LawyerVerification() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [uid, setUid] = useState<string | null>(null);
  const [row, setRow] = useState<LawyerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ full_name: "", licence_no: "", licence_expiry: "", phone: "", city: "" });
  const [specs, setSpecs] = useState<string[]>([]);
  const [picked, setPicked] = useState<DocumentPicker.DocumentPickerAsset | null>(null);

  async function load() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setUid(u.user.id);
    const { data } = await supabase.from("lawyer_profiles").select("*").eq("user_id", u.user.id).maybeSingle();
    const r = data as LawyerProfile | null;
    setRow(r);
    const name = typeof u.user.user_metadata?.full_name === "string" ? u.user.user_metadata.full_name : "";
    setF({
      full_name: r?.full_name ?? name, licence_no: r?.licence_no ?? "", licence_expiry: r?.licence_expiry ?? "",
      phone: r?.phone ?? "", city: r?.city ?? "",
    });
    setSpecs(r?.specialties ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const toggle = (sp: string) => setSpecs((x) => (x.includes(sp) ? x.filter((y) => y !== sp) : [...x, sp]));

  async function pickFile() {
    const res = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/*"], copyToCacheDirectory: true });
    if (!res.canceled && res.assets[0]) setPicked(res.assets[0]);
  }

  async function submit() {
    if (!uid) return;
    if (f.full_name.trim().length < 2) return Alert.alert("بيانات ناقصة", "أدخل الاسم الكامل كما في الترخيص.");
    if (!f.licence_no.trim()) return Alert.alert("بيانات ناقصة", "أدخل رقم الترخيص.");
    if (f.licence_expiry && !isDate(f.licence_expiry)) return Alert.alert("تاريخ غير صحيح", "اكتب تاريخ انتهاء الترخيص بالصيغة 2027-12-31.");
    if (!picked && !row?.licence_file) return Alert.alert("بيانات ناقصة", "أرفق صورة من ترخيص المحاماة.");
    setBusy(true);
    try {
      let licence_file = row?.licence_file ?? null;
      if (picked) {
        const ext = (picked.name.split(".").pop() || "pdf").toLowerCase().replace(/[^a-z0-9]/g, "") || "pdf";
        const path = `${uid}/licence-${Date.now()}.${ext}`;
        const buf = await new File(picked.uri).arrayBuffer();
        const { error } = await supabase.storage.from("lawyer-licences").upload(path, buf, { contentType: picked.mimeType ?? "application/octet-stream" });
        if (error) throw error;
        licence_file = path;
      }
      const fields = {
        full_name: f.full_name.trim(), licence_no: f.licence_no.trim(), licence_expiry: f.licence_expiry || null,
        phone: f.phone.trim() || null, city: f.city.trim() || null, specialties: specs, licence_file,
      };
      // Insert/update separately: users have no UPDATE grant on user_id, so an upsert would be rejected.
      const { error } = row
        ? await supabase.from("lawyer_profiles").update(fields).eq("user_id", uid)
        : await supabase.from("lawyer_profiles").insert({ user_id: uid, ...fields });
      if (error) throw error;
      setPicked(null);
      success();
      Alert.alert("تم الإرسال", "أُرسل طلب التوثيق للمراجعة. سنُعلمك بالنتيجة في هذه الصفحة.");
      await load();
    } catch (e) {
      Alert.alert("خطأ", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const st = row ? LAWYER_STATUS[row.status] ?? LAWYER_STATUS.pending : null;
  const input = [s.input, { backgroundColor: C.surface }];

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 6, backgroundColor: C.bg }}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/chat"))} hitSlop={8} accessibilityRole="button"
          accessibilityLabel="رجوع" style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
          {/* RTL: "back" points right */}
          <Ionicons name="chevron-forward" size={24} color={C.navy} />
        </Pressable>
        <Text style={{ flex: 1, textAlign: "center", fontFamily: F.semibold, fontSize: 18, color: C.navy }}>توثيق حساب المحامي</Text>
        <View style={{ width: 44 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={C.teal} style={{ marginTop: 40 }} />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
            <Banner icon="ribbon-outline" title="لماذا التوثيق؟"
              text="بعد توثيق حسابك تُعتمد العقود والمستندات التي تنشئها مباشرةً باسمك ورقم ترخيصك، وتظهر عليها عبارة الاعتماد. أنت المسؤول المهني عنها." />

            {row && st && (
              <View style={[s.card, { gap: 8 }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={[s.h2, { flex: 1, fontSize: 16 }]}>حالة الطلب</Text>
                  <Pill label={st.ar} color={st.color} icon={st.icon} />
                </View>
                {row.status === "pending" && <Text style={s.muted}>يراجع فريق المنصة بياناتك وصورة الترخيص. أي تعديل يعيد الطلب للمراجعة.</Text>}
                {row.status === "approved" && <Text style={s.muted}>حسابك موثّق. تعديل البيانات يعيد الطلب للمراجعة.</Text>}
                {!!row.review_note && <Text style={[s.text, { color: row.status === "rejected" ? C.danger : C.fg }]}>ملاحظة المراجع: {row.review_note}</Text>}
              </View>
            )}

            <View style={[s.card, { gap: 14 }]}>
              <View style={{ gap: 6 }}>
                <FieldLabel>الاسم الكامل (كما في الترخيص)</FieldLabel>
                <TextInput style={input} value={f.full_name} onChangeText={set("full_name")} autoComplete="name" />
              </View>
              <View style={{ gap: 6 }}>
                <FieldLabel>رقم ترخيص المحاماة</FieldLabel>
                <TextInput style={input} value={f.licence_no} onChangeText={set("licence_no")} keyboardType="number-pad" />
              </View>
              <View style={{ gap: 6 }}>
                <FieldLabel>تاريخ انتهاء الترخيص (ميلادي)</FieldLabel>
                <TextInput style={input} value={f.licence_expiry} onChangeText={set("licence_expiry")} placeholder="2027-12-31"
                  placeholderTextColor={C.muted} keyboardType="numbers-and-punctuation" maxLength={10} />
              </View>
              <View style={{ gap: 6 }}>
                <FieldLabel>رقم الجوال</FieldLabel>
                <TextInput style={input} value={f.phone} onChangeText={set("phone")} keyboardType="phone-pad" autoComplete="tel" placeholder="05xxxxxxxx" placeholderTextColor={C.muted} />
              </View>
              <View style={{ gap: 6 }}>
                <FieldLabel>المدينة</FieldLabel>
                <TextInput style={input} value={f.city} onChangeText={set("city")} placeholder="مثال: الرياض" placeholderTextColor={C.muted} />
              </View>
              <View style={{ gap: 8 }}>
                <FieldLabel>التخصصات</FieldLabel>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {SPECIALTIES.map((sp) => <Choice key={sp} label={sp} active={specs.includes(sp)} onPress={() => toggle(sp)} />)}
                </View>
              </View>
              <View style={{ gap: 8 }}>
                <FieldLabel>صورة الترخيص</FieldLabel>
                <Pressable onPress={pickFile} accessibilityRole="button"
                  style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: R.md, borderWidth: 1.5, borderStyle: "dashed", borderColor: C.teal, backgroundColor: C.tealTint }}>
                  <Ionicons name={picked || row?.licence_file ? "document-attach" : "cloud-upload-outline"} size={22} color={C.teal} />
                  <Text style={{ flex: 1, fontFamily: F.medium, fontSize: 14, color: C.navy, textAlign: "left" }} numberOfLines={1}>
                    {picked ? picked.name : row?.licence_file ? "تم رفع الترخيص — اضغط للاستبدال" : "اختر ملف PDF أو صورة"}
                  </Text>
                </Pressable>
              </View>
            </View>

            <Button icon="shield-checkmark-outline" label={row ? "تحديث وإعادة الإرسال" : "إرسال طلب التوثيق"} variant="teal" loading={busy} onPress={submit} />
            {!router.canGoBack() && <Button label="لاحقاً" variant="ghost" onPress={() => router.replace("/(tabs)/chat")} />}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}
