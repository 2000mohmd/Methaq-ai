import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Alert, Linking, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { LibraryDocuments } from "../../components/library-documents";
import { supabase } from "../../lib/supabase";
import { C, s } from "../../lib/theme";

type Field = { key: string; ar: string; options?: string[]; required?: boolean; list?: boolean };
type Rec = Record<string, unknown>;
type Source = { id: string; title: string; kind: string; status: string; source_url: string; jurisdiction: string; count: number };

// Same fields as the website's src/routes/app/library.tsx.
const FIELDS: Field[] = [
  { key: "title", ar: "العنوان", required: true },
  { key: "jurisdiction", ar: "الاختصاص", options: ["Saudi Arabia", "UAE", "Qatar", "Kuwait", "Bahrain", "Oman", "Egypt", "Jordan", "Lebanon"] },
  { key: "category", ar: "النوع", options: ["law", "regulation", "judgment", "template", "article"] },
  { key: "status", ar: "الحالة", options: ["in_force", "amended", "repealed"] },
  { key: "source_url", ar: "رابط المصدر" },
  { key: "content", ar: "النص / ملاحظات", list: false },
];

const chip = (on: boolean) => ({
  borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
  borderColor: on ? C.teal : C.border, backgroundColor: on ? C.tealTint : C.bg,
});

/** Read-only list of the laws the assistant can cite (port of LegalCorpusList). */
function CorpusList() {
  const [rows, setRows] = useState<Source[] | null>(null);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("legal_sources").select("id,title,kind,status,source_url,jurisdiction").order("title");
      const list = (data ?? []) as Omit<Source, "count">[];
      setRows(await Promise.all(list.map(async (r) => {
        const { count } = await supabase.from("legal_articles").select("id", { count: "exact", head: true }).eq("source_id", r.id);
        return { ...r, count: count ?? 0 };
      })));
    })().catch(() => setRows([]));
  }, []);

  return (
    <View style={[s.card, { gap: 6 }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Ionicons name="library-outline" size={16} color={C.teal} />
        <Text style={{ fontSize: 15, fontWeight: "600", color: C.navy }}>الأنظمة المعتمدة في المنصة</Text>
      </View>
      <Text style={s.muted}>تُضاف هذه الأنظمة من المصادر الرسمية بواسطة مسؤولي المنصة فقط.</Text>
      {rows === null ? (
        <Text style={s.muted}>…</Text>
      ) : rows.length === 0 ? (
        <Text style={[s.muted, { color: C.amber }]}>لم تُضف أنظمة بعد؛ ستظهر الإجابات بأنها غير موثّقة.</Text>
      ) : (
        rows.map((r) => (
          <View key={r.id} style={{ borderTopWidth: 1, borderColor: C.border, paddingVertical: 8, gap: 4 }}>
            <Text style={[s.text, { fontWeight: "600" }]}>{r.title}</Text>
            <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              <Text style={s.muted}>{r.count} مادة</Text>
              <Text style={s.muted}>{r.status}</Text>
              {!!r.source_url && (
                <Pressable onPress={() => Linking.openURL(r.source_url)} hitSlop={8}>
                  <Text style={{ color: C.teal, fontSize: 13 }}>المصدر</Text>
                </Pressable>
              )}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

/** The user's own library_items (port of RecordModule, plus edit). */
function Records() {
  const [rows, setRows] = useState<Rec[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [q, setQ] = useState("");
  const [form, setForm] = useState<Record<string, string> | null>(null); // null = modal closed
  const [editId, setEditId] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase.from("library_items").select("*").order("created_at", { ascending: false });
    if (error) Alert.alert("خطأ", error.message);
    setRows(data ?? []);
  };

  useEffect(() => {
    load();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: p } = await supabase.from("profiles").select("organization_id").eq("id", data.user.id).single();
      setOrgId(p?.organization_id ?? null);
      setReady(true);
    });
  }, []);

  const open = (r?: Rec) => {
    setEditId(r ? String(r.id) : null);
    setForm(r ? Object.fromEntries(FIELDS.map((f) => [f.key, r[f.key] == null ? "" : String(r[f.key])])) : {});
  };

  const save = async () => {
    if (!ready || !form) return;
    const payload: Rec = editId ? {} : { organization_id: orgId };
    for (const f of FIELDS) {
      const v = form[f.key]?.trim();
      if (f.required && !v) return Alert.alert(`${f.ar} *`);
      if (v) payload[f.key] = v;
      else if (editId) payload[f.key] = null; // inserts omit empties so column defaults apply, like the web
    }
    const { error } = editId
      ? await supabase.from("library_items").update(payload).eq("id", editId)
      : await supabase.from("library_items").insert(payload);
    if (error) return Alert.alert("خطأ", error.message);
    setForm(null);
    load();
  };

  const remove = (id: string) =>
    Alert.alert("حذف السجل؟", "", [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: async () => {
        const { error } = await supabase.from("library_items").delete().eq("id", id);
        if (error) Alert.alert("خطأ", error.message);
        load();
      } },
    ]);

  const listFields = FIELDS.filter((f) => f.list !== false);
  const filtered = rows.filter((r) => !q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase()));

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={[s.h1, { flex: 1 }]}>المكتبة القانونية</Text>
        <Pressable style={[s.btn, { paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", gap: 4 }]} onPress={() => open()}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={s.btnText}>إضافة</Text>
        </Pressable>
      </View>
      <TextInput style={s.input} placeholder="بحث…" placeholderTextColor={C.muted} value={q} onChangeText={setQ} />

      {rows.length === 0 ? (
        <View style={[s.card, { backgroundColor: C.navyTint, paddingVertical: 28 }]}>
          <Text style={s.muted}>لا توجد سجلات بعد. أضف أول سجل للبدء.</Text>
        </View>
      ) : (
        filtered.map((r) => (
          <View key={String(r.id)} style={[s.card, { gap: 4 }]}>
            {listFields.map((f) => (
              <Text key={f.key} style={f.key === "title" ? [s.text, { fontWeight: "600" }] : s.muted}>
                {f.key === "title" ? "" : `${f.ar}: `}{String(r[f.key] ?? "—")}
              </Text>
            ))}
            <View style={{ flexDirection: "row", gap: 16, marginTop: 6 }}>
              <Pressable onPress={() => open(r)} hitSlop={8}><Text style={{ color: C.teal }}>تعديل</Text></Pressable>
              <Pressable onPress={() => remove(String(r.id))} hitSlop={8}><Text style={{ color: C.danger }}>حذف</Text></Pressable>
            </View>
          </View>
        ))
      )}

      <Modal visible={form !== null} animationType="slide" onRequestClose={() => setForm(null)}>
        <ScrollView style={s.screen} contentContainerStyle={{ padding: 16, paddingTop: 48, gap: 12 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={[s.h1, { flex: 1 }]}>{editId ? "تعديل السجل" : "سجل جديد"}</Text>
            <Pressable onPress={() => setForm(null)} hitSlop={10}><Ionicons name="close" size={24} color={C.muted} /></Pressable>
          </View>
          {form && FIELDS.map((f) => (
            <View key={f.key} style={{ gap: 6 }}>
              <Text style={s.text}>{f.ar}{f.required ? " *" : ""}</Text>
              {f.options ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {f.options.map((o) => (
                    <Pressable key={o} style={chip(form[f.key] === o)} onPress={() => setForm({ ...form, [f.key]: form[f.key] === o ? "" : o })}>
                      <Text style={{ color: C.fg }}>{o}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <TextInput
                  style={[s.input, f.key === "content" && { minHeight: 120, textAlignVertical: "top" }]}
                  multiline={f.key === "content"}
                  autoCapitalize={f.key === "source_url" ? "none" : "sentences"}
                  value={form[f.key] ?? ""}
                  onChangeText={(v) => setForm({ ...form, [f.key]: v })}
                />
              )}
            </View>
          ))}
          <Pressable style={s.btn} onPress={save}><Text style={s.btnText}>حفظ</Text></Pressable>
        </ScrollView>
      </Modal>
    </View>
  );
}

export default function Library() {
  const [tab, setTab] = useState<"library" | "documents">("library");
  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: "row", backgroundColor: C.navyTint, borderRadius: 12, padding: 4 }}>
        {([["library", "المكتبة"], ["documents", "المستندات"]] as const).map(([k, label]) => (
          <Pressable key={k} onPress={() => setTab(k)}
            style={{ flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 10, backgroundColor: tab === k ? C.bg : "transparent" }}>
            <Text style={{ color: tab === k ? C.navy : C.muted, fontWeight: tab === k ? "700" : "400" }}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {tab === "library" ? (
        <>
          <CorpusList />
          <Records />
        </>
      ) : (
        <LibraryDocuments />
      )}
    </ScrollView>
  );
}
