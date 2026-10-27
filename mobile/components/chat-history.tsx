import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Alert, Modal, Pressable, SectionList, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { C, F, R, s } from "../lib/theme";

export type Conv = { id: string; title: string; updated_at: string | null };

type Props = {
  visible: boolean;
  onClose: () => void;
  convs: Conv[];
  active: string | null;
  onOpen: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
};

function group(convs: Conv[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = today.getTime() - 86_400_000;
  const g: Record<string, Conv[]> = { اليوم: [], أمس: [], أقدم: [] };
  for (const c of convs) {
    const t = c.updated_at ? new Date(c.updated_at).getTime() : 0;
    g[t >= today.getTime() ? "اليوم" : t >= yesterday ? "أمس" : "أقدم"].push(c);
  }
  return Object.entries(g).filter(([, data]) => data.length).map(([title, data]) => ({ title, data }));
}

export function ChatHistory({ visible, onClose, convs, active, onOpen, onNew, onDelete }: Props) {
  const [q, setQ] = useState("");
  const sections = group(q.trim() ? convs.filter((c) => c.title.toLowerCase().includes(q.trim().toLowerCase())) : convs);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[s.screen, { backgroundColor: C.bg }]}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
          <Text style={{ flex: 1, fontFamily: F.bold, fontSize: 22, color: C.navy, textAlign: "left" }}>المحادثات</Text>
          <Pressable onPress={onClose} accessibilityLabel="إغلاق" style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.navyTint, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="close" size={20} color={C.navy} />
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 16, gap: 10, paddingVertical: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.surface, borderRadius: R.md, paddingHorizontal: 12 }}>
            <Ionicons name="search" size={17} color={C.muted} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="ابحث في المحادثات"
              placeholderTextColor={C.muted}
              style={{ flex: 1, fontFamily: F.regular, fontSize: 15, color: C.fg, textAlign: "left", paddingVertical: 11 }}
            />
          </View>
          <Pressable onPress={onNew} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: C.teal, borderRadius: R.md, paddingVertical: 13 }}>
            <Ionicons name="add" size={19} color="#fff" />
            <Text style={{ fontFamily: F.semibold, fontSize: 15, color: "#fff" }}>محادثة جديدة</Text>
          </Pressable>
        </View>

        <SectionList
          sections={sections}
          keyExtractor={(c) => c.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 24 }}
          ListEmptyComponent={
            <Text style={[s.muted, { textAlign: "center", marginTop: 32 }]}>{q ? "لا توجد نتائج" : "لا توجد محادثات بعد"}</Text>
          }
          renderSectionHeader={({ section }) => (
            <Text style={{ fontFamily: F.semibold, fontSize: 12.5, color: C.muted, textAlign: "left", paddingHorizontal: 12, paddingTop: 16, paddingBottom: 6 }}>
              {section.title}
            </Text>
          )}
          renderItem={({ item: c }) => {
            const on = active === c.id;
            return (
              <View style={{ flexDirection: "row", alignItems: "center", borderRadius: R.md, backgroundColor: on ? C.tealTint : undefined }}>
                <Pressable onPress={() => onOpen(c.id)} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 13, paddingHorizontal: 12 }}>
                  <Ionicons name={on ? "chatbubble" : "chatbubble-outline"} size={17} color={on ? C.teal : C.muted} />
                  <Text numberOfLines={1} style={{ flex: 1, fontFamily: on ? F.semibold : F.regular, fontSize: 15, color: on ? C.navy : C.fg, textAlign: "left" }}>
                    {c.title}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    Alert.alert("حذف المحادثة؟", c.title, [
                      { text: "إلغاء", style: "cancel" },
                      { text: "حذف", style: "destructive", onPress: () => onDelete(c.id) },
                    ])
                  }
                  style={{ padding: 13 }}
                  accessibilityLabel="حذف"
                >
                  <Ionicons name="trash-outline" size={17} color={C.muted} />
                </Pressable>
              </View>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}
