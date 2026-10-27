import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { useEffect, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, View } from "react-native";

import type { ScrollViewInstance } from "react-native";
import { ChatComposer } from "../../components/chat-composer";
import { ChatHistory, type Conv } from "../../components/chat-history";
import { AssistantMessage, ChatEmpty, UserBubble } from "../../components/chat-messages";
import { streamChat, type Msg } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { C, s } from "../../lib/theme";

export default function ChatScreen() {
  const headerHeight = useHeaderHeight();
  const [convs, setConvs] = useState<Conv[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState("research");
  const juris = "Saudi Arabia"; // Saudi-only app
  const [listOpen, setListOpen] = useState(false);
  const scrollRef = useRef<ScrollViewInstance>(null);

  const loadConvs = async () => {
    const { data } = await supabase.from("conversations").select("id,title,updated_at").order("updated_at", { ascending: false });
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

  const headerBtn = { width: 38, height: 38, borderRadius: 19, marginHorizontal: 10, backgroundColor: C.navyTint, alignItems: "center", justifyContent: "center" } as const;

  return (
    <View style={s.screen}>
      <Tabs.Screen
        options={{
          headerLeft: () => (
            <Pressable onPress={() => setListOpen(true)} style={headerBtn} accessibilityLabel="المحادثات">
              <Ionicons name="time-outline" size={20} color={C.navy} />
            </Pressable>
          ),
          headerRight: () => (
            <Pressable onPress={newChat} style={headerBtn} accessibilityLabel="محادثة جديدة">
              <Ionicons name="create-outline" size={20} color={C.navy} />
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={headerHeight}>
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, gap: 16, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {msgs.length === 0 ? (
            <ChatEmpty onPick={send} />
          ) : (
            msgs.map((m, i) => (m.role === "user" ? <UserBubble key={i} text={m.content} /> : <AssistantMessage key={i} text={m.content} />))
          )}
        </ScrollView>

        <ChatComposer
          value={input}
          onChange={setInput}
          onSend={() => send()}
          busy={busy}
          mode={mode}
          setMode={setMode}
        />
      </KeyboardAvoidingView>

      <ChatHistory visible={listOpen} onClose={() => setListOpen(false)} convs={convs} active={active} onOpen={open} onNew={newChat} onDelete={remove} />
    </View>
  );
}
