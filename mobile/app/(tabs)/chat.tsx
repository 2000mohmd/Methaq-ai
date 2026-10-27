import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Pressable, ScrollView, Share, Text, TextInput, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { ScrollViewInstance } from "react-native";
import { streamChat, type Msg } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { C, s } from "../../lib/theme";

type Conv = { id: string; title: string };

const MODES = [
  { id: "research", ar: "بحث قانوني" },
  { id: "drafting", ar: "صياغة" },
  { id: "contract review", ar: "مراجعة عقود" },
  { id: "due diligence", ar: "العناية الواجبة" },
  { id: "council", ar: "مجلس النماذج (حرج)" },
];
const JURIS = ["Saudi Arabia", "UAE", "Qatar", "Kuwait", "Bahrain", "Oman", "Egypt", "Jordan", "Lebanon"];
const SUGGESTIONS = ["ما هي شروط إنهاء عقد العمل في السعودية؟", "صغ اتفاقية عدم إفصاح ثنائية", "راجع هذا البند من حيث المخاطر"];

// Plain-text rendering: drop heading markers and bold asterisks.
const clean = (t: string) => t.replace(/^#{1,6}\s+/gm, "").replace(/\*\*/g, "");

export default function ChatScreen() {
  const headerHeight = useHeaderHeight();
  const [convs, setConvs] = useState<Conv[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState("research");
  const [juris, setJuris] = useState("Saudi Arabia");
  const [listOpen, setListOpen] = useState(false);
  const [jurisOpen, setJurisOpen] = useState(false);
  const scrollRef = useRef<ScrollViewInstance>(null);

  const loadConvs = async () => {
    const { data } = await supabase.from("conversations").select("id,title").order("updated_at", { ascending: false });
    setConvs(data ?? []);
  };
  useEffect(() => {
    loadConvs();
  }, []);

  const newChat = () => {
    setActive(null);
    setMsgs([]);
    setListOpen(false);
  };

  const open = async (id: string) => {
    setActive(id);
    setListOpen(false);
    const { data } = await supabase.from("messages").select("role,content").eq("conversation_id", id).order("created_at");
    setMsgs((data as Msg[]) ?? []);
  };

  const remove = async (id: string) => {
    await supabase.from("conversations").delete().eq("id", id);
    if (active === id) {
      setActive(null);
      setMsgs([]);
    }
    loadConvs();
  };

  const send = async (text = input) => {
    const content = text.trim();
    if (!content || busy) return;
    setInput("");
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user!.id;
    let convId = active;
    if (!convId) {
      const { data: prof } = await supabase.from("profiles").select("organization_id").eq("id", uid).single();
      const { data: c, error } = await supabase
        .from("conversations")
        .insert({ user_id: uid, title: content.slice(0, 60), jurisdiction: juris, organization_id: prof?.organization_id ?? null })
        .select("id")
        .single();
      if (error) {
        Alert.alert("خطأ", error.message);
        setBusy(false);
        return;
      }
      convId = c.id;
      setActive(convId);
      loadConvs();
    }
    const history: Msg[] = [...msgs, { role: "user", content }];
    setMsgs([...history, { role: "assistant", content: "" }]);
    await supabase.from("messages").insert({ conversation_id: convId, user_id: uid, role: "user", content });
    let acc = "";
    try {
      await streamChat(
        history,
        { mode, jurisdiction: juris },
        (d) => {
          acc += d;
          setMsgs([...history, { role: "assistant", content: acc }]);
        },
        (verified) => {
          acc = verified;
          setMsgs([...history, { role: "assistant", content: acc }]);
        },
      );
      await supabase.from("messages").insert({ conversation_id: convId, user_id: uid, role: "assistant", content: acc });
      await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);
    } catch (e) {
      Alert.alert("خطأ", (e as Error).message);
      setMsgs(history);
    }
    setBusy(false);
  };

  const iconBtn = { padding: 10 };

  return (
    <View style={s.screen}>
      <Tabs.Screen
        options={{
          headerLeft: () => (
            <Pressable onPress={() => setListOpen(true)} style={iconBtn} accessibilityLabel="المحادثات">
              <Ionicons name="time-outline" size={22} color={C.navy} />
            </Pressable>
          ),
          headerRight: () => (
            <Pressable onPress={newChat} style={iconBtn} accessibilityLabel="محادثة جديدة">
              <Ionicons name="create-outline" size={22} color={C.navy} />
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={headerHeight}>
        <View style={{ borderBottomWidth: 1, borderColor: C.border }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, padding: 10 }}>
            <Pressable onPress={() => setJurisOpen(true)} style={[chip, { flexDirection: "row", alignItems: "center", gap: 4 }]}>
              <Ionicons name="globe-outline" size={14} color={C.navy} />
              <Text style={{ fontSize: 13, color: C.navy }}>{juris}</Text>
            </Pressable>
            {MODES.map((m) => (
              <Pressable key={m.id} onPress={() => setMode(m.id)} style={[chip, mode === m.id && chipOn]}>
                <Text style={{ fontSize: 13, color: mode === m.id ? C.navy : C.muted }}>{m.ar}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 14, gap: 12 }}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {msgs.length === 0 ? (
            <View style={{ marginTop: 32, gap: 10 }}>
              <Text style={[s.h1, { textAlign: "center", marginBottom: 12 }]}>كيف يمكنني مساعدتك اليوم؟</Text>
              {SUGGESTIONS.map((t) => (
                <Pressable key={t} onPress={() => send(t)} style={s.card}>
                  <Text style={s.text}>{t}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            msgs.map((m, i) =>
              m.role === "user" ? (
                <Pressable key={i} onLongPress={() => Share.share({ message: m.content })} style={bubbleUser}>
                  <Text style={[s.text, { color: "#fff" }]}>{m.content}</Text>
                </Pressable>
              ) : (
                <Pressable key={i} onLongPress={() => m.content && Share.share({ message: m.content })} style={s.card}>
                  {m.content ? <Text selectable style={s.text}>{clean(m.content)}</Text> : <ActivityIndicator color={C.teal} />}
                </Pressable>
              ),
            )
          )}
        </ScrollView>

        <View style={{ borderTopWidth: 1, borderColor: C.border, padding: 10 }}>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
            <TextInput
              value={input}
              onChangeText={setInput}
              multiline
              placeholder="اكتب سؤالك القانوني أو الصق نص العقد…"
              placeholderTextColor={C.muted}
              style={[s.input, { flex: 1, maxHeight: 140 }]}
            />
            <Pressable
              onPress={() => send()}
              disabled={busy}
              style={{ backgroundColor: C.navy, borderRadius: 12, width: 48, height: 48, alignItems: "center", justifyContent: "center", opacity: busy ? 0.6 : 1 }}
              accessibilityLabel="إرسال"
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="send" size={20} color="#fff" style={{ transform: [{ scaleX: -1 }] }} />}
            </Pressable>
          </View>
          <Text style={[s.muted, { textAlign: "center", fontSize: 11, marginTop: 6 }]}>ميثاق ليس بديلاً عن محامٍ مرخّص. تحقق من المصادر دائماً.</Text>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={listOpen} animationType="slide" onRequestClose={() => setListOpen(false)}>
        <SafeAreaView style={s.screen}>
          <View style={{ flexDirection: "row", alignItems: "center", padding: 12, gap: 8 }}>
            <Pressable onPress={newChat} style={[s.btn, { flex: 1, flexDirection: "row", justifyContent: "center", gap: 6 }]}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={s.btnText}>محادثة جديدة</Text>
            </Pressable>
            <Pressable onPress={() => setListOpen(false)} style={iconBtn} accessibilityLabel="إغلاق">
              <Ionicons name="close" size={24} color={C.navy} />
            </Pressable>
          </View>
          <FlatList
            data={convs}
            keyExtractor={(c) => c.id}
            ListEmptyComponent={<Text style={[s.muted, { textAlign: "center", marginTop: 24 }]}>لا توجد محادثات بعد</Text>}
            renderItem={({ item: c }) => (
              <View style={{ flexDirection: "row", alignItems: "center", marginHorizontal: 8, borderRadius: 10, backgroundColor: active === c.id ? C.tealTint : undefined }}>
                <Pressable onPress={() => open(c.id)} style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 12 }}>
                  <Text numberOfLines={1} style={s.text}>{c.title}</Text>
                </Pressable>
                <Pressable
                  onPress={() => Alert.alert("حذف المحادثة؟", c.title, [{ text: "إلغاء", style: "cancel" }, { text: "حذف", style: "destructive", onPress: () => remove(c.id) }])}
                  style={{ padding: 14 }}
                  accessibilityLabel="حذف"
                >
                  <Ionicons name="trash-outline" size={18} color={C.muted} />
                </Pressable>
              </View>
            )}
          />
        </SafeAreaView>
      </Modal>

      <Modal visible={jurisOpen} transparent animationType="fade" onRequestClose={() => setJurisOpen(false)}>
        <Pressable onPress={() => setJurisOpen(false)} style={{ flex: 1, backgroundColor: "rgba(17,55,74,0.5)", justifyContent: "center", padding: 32 }}>
          <View style={[s.card, { paddingVertical: 6 }]}>
            {JURIS.map((j) => (
              <Pressable key={j} onPress={() => { setJuris(j); setJurisOpen(false); }} style={{ paddingVertical: 12, flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={[s.text, juris === j && { color: C.teal, fontWeight: "600" }]}>{j}</Text>
                {juris === j && <Ionicons name="checkmark" size={18} color={C.teal} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const chip = { borderWidth: 1, borderColor: C.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 } as const;
const chipOn = { borderColor: C.teal, backgroundColor: C.tealTint } as const;
const bubbleUser = { alignSelf: "flex-end", maxWidth: "85%", backgroundColor: C.navy, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 } as const;
