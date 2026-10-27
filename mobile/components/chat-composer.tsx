import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { C, F, R } from "../lib/theme";

export const MODES = [
  { id: "research", ar: "بحث قانوني", icon: "search", desc: "إجابات مدعومة بالمصادر والمواد النظامية" },
  { id: "drafting", ar: "صياغة", icon: "create", desc: "صياغة مسودات العقود والخطابات والبنود" },
  { id: "contract review", ar: "مراجعة عقود", icon: "document-text", desc: "تحليل البنود وتحديد المخاطر والملاحظات" },
  { id: "due diligence", ar: "العناية الواجبة", icon: "briefcase", desc: "فحص شامل للمستندات والالتزامات" },
  { id: "council", ar: "مجلس النماذج", icon: "git-compare", desc: "عدة نماذج تتحقق من الإجابة — للمسائل الحرجة" },
] as const;

// Values are what the API expects; labels are for display only.
export const JURIS: Record<string, string> = {
  "Saudi Arabia": "السعودية", UAE: "الإمارات", Qatar: "قطر", Kuwait: "الكويت", Bahrain: "البحرين",
  Oman: "عُمان", Egypt: "مصر", Jordan: "الأردن", Lebanon: "لبنان",
};

type Props = {
  value: string;
  onChange: (t: string) => void;
  onSend: () => void;
  busy: boolean;
  mode: string;
  setMode: (m: string) => void;
  juris: string;
  setJuris: (j: string) => void;
};

export function ChatComposer({ value, onChange, onSend, busy, mode, setMode, juris, setJuris }: Props) {
  const [sheet, setSheet] = useState(false);
  const insets = useSafeAreaInsets();
  const m = MODES.find((x) => x.id === mode) ?? MODES[0];
  const canSend = !!value.trim() && !busy;

  return (
    <View style={{ backgroundColor: C.bg, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8, borderTopStartRadius: R.xl, borderTopEndRadius: R.xl }}>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
        <Pressable onPress={() => setSheet(true)} style={chip}>
          <Ionicons name={m.icon} size={14} color={C.teal} />
          <Text style={chipText}>{m.ar}</Text>
          <Ionicons name="chevron-down" size={13} color={C.muted} />
        </Pressable>
        <Pressable onPress={() => setSheet(true)} style={chip}>
          <Ionicons name="globe-outline" size={14} color={C.teal} />
          <Text style={chipText}>{JURIS[juris] ?? juris}</Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, backgroundColor: C.surface, borderRadius: 26, borderWidth: 1, borderColor: C.border, paddingStart: 16, paddingEnd: 5, paddingVertical: 5 }}>
        <TextInput
          value={value}
          onChangeText={onChange}
          multiline
          placeholder="اكتب سؤالك القانوني أو الصق نص العقد…"
          placeholderTextColor={C.muted}
          style={{ flex: 1, fontFamily: F.regular, fontSize: 15, lineHeight: 22, color: C.fg, textAlign: "left", maxHeight: 22 * 5 + 16, paddingVertical: 8 }}
        />
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            onSend();
          }}
          disabled={!canSend}
          accessibilityLabel="إرسال"
          style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: canSend || busy ? C.teal : C.border }}
        >
          {busy ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="arrow-up" size={21} color="#fff" />}
        </Pressable>
      </View>
      <Text style={{ fontFamily: F.regular, color: C.muted, textAlign: "center", fontSize: 11, marginTop: 6 }}>
        ميثاق ليس بديلاً عن محامٍ مرخّص. تحقق من المصادر دائماً.
      </Text>

      <Modal visible={sheet} transparent animationType="slide" onRequestClose={() => setSheet(false)}>
        <Pressable onPress={() => setSheet(false)} style={{ flex: 1, backgroundColor: "rgba(17,55,74,0.45)" }} />
        <View style={{ backgroundColor: C.bg, borderTopStartRadius: R.xl, borderTopEndRadius: R.xl, paddingHorizontal: 16, paddingTop: 10, paddingBottom: insets.bottom + 16 }}>
          <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, marginBottom: 14 }} />
          <Text style={sheetTitle}>وضع المحادثة</Text>
          {MODES.map((x) => {
            const on = x.id === mode;
            return (
              <Pressable
                key={x.id}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setMode(x.id);
                  setSheet(false);
                }}
                style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: R.md, backgroundColor: on ? C.tealTint : "transparent" }}
              >
                <View style={{ width: 38, height: 38, borderRadius: R.sm, alignItems: "center", justifyContent: "center", backgroundColor: on ? C.teal : C.navyTint }}>
                  <Ionicons name={x.icon} size={18} color={on ? "#fff" : C.navy} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: F.semibold, fontSize: 15, color: C.navy, textAlign: "left" }}>{x.ar}</Text>
                  <Text style={{ fontFamily: F.regular, fontSize: 12.5, lineHeight: 19, color: C.muted, textAlign: "left" }}>{x.desc}</Text>
                </View>
                {on && <Ionicons name="checkmark-circle" size={20} color={C.teal} />}
              </Pressable>
            );
          })}
          <Text style={[sheetTitle, { marginTop: 16 }]}>الاختصاص القضائي</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
            {Object.entries(JURIS).map(([v, label]) => {
              const on = v === juris;
              return (
                <Pressable key={v} onPress={() => setJuris(v)} style={[chip, on && { borderColor: C.teal, backgroundColor: C.tealTint }]}>
                  <Text style={[chipText, on && { color: C.teal, fontFamily: F.semibold }]}>{label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const chip = {
  flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: C.border, backgroundColor: C.bg,
  borderRadius: R.pill, paddingHorizontal: 12, paddingVertical: 6,
} as const;
const chipText = { fontFamily: F.medium, fontSize: 13, color: C.navy } as const;
const sheetTitle = { fontFamily: F.semibold, fontSize: 13, color: C.muted, textAlign: "left", marginBottom: 6, paddingHorizontal: 4 } as const;
