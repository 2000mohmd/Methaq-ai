import Constants from "expo-constants";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";

import { API_URL, supabase } from "../../lib/supabase";
import { C, s } from "../../lib/theme";

/** Same shape as the website's Letterhead (src/lib/docx-export.ts). */
type Letterhead = { name_ar?: string; name_en?: string; address?: string; contact?: string; cr?: string; logo?: boolean };
type Profile = { id: string; email: string | null; full_name: string | null; account_type: string | null; numerals: string | null; letterhead: Letterhead | null };

const LH_FIELDS = [
  ["name_ar", "اسم المكتب (عربي)"],
  ["name_en", "اسم المكتب (إنجليزي)"],
  ["address", "العنوان"],
  ["contact", "الهاتف / البريد / الموقع"],
  ["cr", "رقم السجل التجاري / ترخيص المحاماة"],
] as const;

const section = [s.card, { gap: 12 }];
const label = [s.text, { fontSize: 14 }];

export default function Settings() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [numerals, setNumerals] = useState("western");
  const [lh, setLh] = useState<Letterhead>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: p } = await supabase.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
      if (!p) return;
      setProfile(p as Profile);
      setName(p.full_name ?? "");
      setNumerals(p.numerals ?? "western");
      setLh((p.letterhead ?? {}) as Letterhead);
    });
  }, []);

  async function save() {
    if (!profile) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ full_name: name, numerals, letterhead: lh }).eq("id", profile.id);
    setBusy(false);
    if (error) Alert.alert("خطأ", error.message);
    else Alert.alert("تم الحفظ");
  }

  const disabledInput = [s.input, { backgroundColor: C.navyTint, color: C.muted }];

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
      <View style={section}>
        <Text style={label}>الاسم الكامل</Text>
        <TextInput style={s.input} value={name} onChangeText={setName} />
        <Text style={label}>البريد الإلكتروني</Text>
        <TextInput style={disabledInput} value={profile?.email ?? ""} editable={false} />
        <Text style={label}>نوع الحساب</Text>
        <TextInput style={disabledInput} value={(profile?.account_type ?? "").replace("_", " ")} editable={false} />
      </View>

      <View style={section}>
        <Text style={s.muted}>الأرقام</Text>
        <View style={{ flexDirection: "row", gap: 12 }}>
          {(["western", "eastern"] as const).map((c) => (
            <Pressable key={c} onPress={() => setNumerals(c)}
              style={{ borderWidth: 1, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, borderColor: numerals === c ? C.teal : C.border, backgroundColor: numerals === c ? C.tealTint : C.bg }}>
              <Text style={{ color: C.navy, fontSize: 15 }}>{c === "western" ? "123" : "١٢٣"}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={section}>
        <Text style={{ fontSize: 16, fontWeight: "600", color: C.navy, textAlign: "left" }}>ترويسة المكتب (للمستندات المصدّرة)</Text>
        <Text style={s.muted}>تظهر في أعلى كل ملف Word مع التاريخ الهجري والميلادي.</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Switch value={lh.logo !== false} onValueChange={(v) => setLh({ ...lh, logo: v })} trackColor={{ true: C.teal }} />
          <Text style={[label, { flex: 1 }]}>إظهار شعار ميثاق العربية في الترويسة</Text>
        </View>
        {LH_FIELDS.map(([k, a]) => (
          <View key={k} style={{ gap: 6 }}>
            <Text style={label}>{a}</Text>
            <TextInput style={s.input} value={lh[k] ?? ""} onChangeText={(v) => setLh({ ...lh, [k]: v })} />
          </View>
        ))}
      </View>

      <Pressable style={[s.btn, { backgroundColor: C.teal }, (busy || !profile) && { opacity: 0.5 }]} onPress={save} disabled={busy || !profile}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>حفظ</Text>}
      </Pressable>

      <View style={[s.card, { gap: 4, paddingVertical: 6 }]}>
        {([["/terms", "الشروط والأحكام"], ["/privacy", "سياسة الخصوصية"]] as const).map(([p, t]) => (
          <Pressable key={p} onPress={() => Linking.openURL(API_URL + p)} style={{ paddingVertical: 10 }}>
            <Text style={{ color: C.teal, fontSize: 15, textAlign: "left" }}>{t}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={[s.btn, { backgroundColor: C.bg, borderWidth: 1, borderColor: C.danger }]} onPress={() => supabase.auth.signOut()}>
        <Text style={[s.btnText, { color: C.danger }]}>تسجيل الخروج</Text>
      </Pressable>

      <Text style={[s.muted, { textAlign: "center" }]}>الإصدار {Constants.expoConfig?.version ?? "—"}</Text>
    </ScrollView>
  );
}
