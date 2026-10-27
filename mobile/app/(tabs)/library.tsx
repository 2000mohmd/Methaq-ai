import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { LibraryDocuments } from "../../components/library-documents";
import { Banner, Button, Choice, EmptyState, Fab, FieldLabel, IconBtn, IconTile, type IconName, Pill, SectionTitle, Segmented, tap } from "../../components/ui-kit";
import { supabase } from "../../lib/supabase";
import { C, F, R, s } from "../../lib/theme";

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

const CAT_ICON: Record<string, IconName> = {
  law: "book-outline", regulation: "reader-outline", judgment: "hammer-outline", template: "document-text-outline", article: "newspaper-outline",
};

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
    <View style={[s.card, { gap: 12 }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <IconTile icon="library-outline" size={44} color="#fff" bg={C.navy} />
        <View style={{ flex: 1 }}>
          <Text style={[s.h2, { fontSize: 16 }]}>الأنظمة المعتمدة في المنصة</Text>
          <Text style={[s.muted, { fontSize: 12 }]}>تُضاف هذه الأنظمة من المصادر الرسمية بواسطة مسؤولي المنصة فقط.</Text>
        </View>
      </View>
      {rows === null ? (
        <ActivityIndicator color={C.teal} style={{ paddingVertical: 8 }} />
      ) : rows.length === 0 ? (
        <Banner icon="alert-circle-outline" color={C.amber} text="لم تُضف أنظمة بعد؛ ستظهر الإجابات بأنها غير موثّقة." />
      ) : (
        rows.map((r) => (
          <View key={r.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: R.md, backgroundColor: C.surface }}>
            <IconTile icon="book-outline" size={36} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontFamily: F.semibold, fontSize: 14, color: C.navy, textAlign: "left" }}>{r.title}</Text>
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <Pill label={`${r.count} مادة`} color={C.navySoft} icon="list-outline" />
                <Pill label={r.status} color={r.status === "repealed" ? C.danger : r.status === "amended" ? C.amber : C.teal} />
              </View>
            </View>
            {!!r.source_url && <IconBtn icon="open-outline" label="المصدر" color={C.teal} onPress={() => Linking.openURL(r.source_url)} />}
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
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        <CorpusList />
        <SectionTitle title="المكتبة القانونية" right={rows.length ? <Pill label={String(rows.length)} color={C.navySoft} icon="folder-outline" /> : undefined} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, paddingHorizontal: 14, borderRadius: R.md, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border }}>
          <Ionicons name="search-outline" size={18} color={C.muted} />
          <TextInput style={{ flex: 1, fontFamily: F.regular, fontSize: 15, color: C.fg, textAlign: "left", paddingVertical: 10 }}
            placeholder="بحث…" placeholderTextColor={C.muted} value={q} onChangeText={setQ} />
          {!!q && <IconBtn icon="close-circle" label="مسح" onPress={() => setQ("")} />}
        </View>

        {rows.length === 0 ? (
          <EmptyState icon="albums-outline" title="لا توجد سجلات بعد." text="أضف أول سجل للبدء باستخدام زر + في الأسفل." />
        ) : filtered.length === 0 ? (
          <EmptyState icon="search-outline" title="لا توجد نتائج مطابقة." />
        ) : (
          filtered.map((r) => {
            const meta = listFields.filter((f) => f.key !== "title" && f.key !== "source_url" && r[f.key] != null && r[f.key] !== "");
            return (
              <Pressable key={String(r.id)} onPress={() => { tap(); open(r); }}
                style={({ pressed }) => [s.card, { flexDirection: "row", gap: 12, alignItems: "flex-start", paddingEnd: 8 }, pressed && { opacity: 0.92 }]}>
                <IconTile icon={CAT_ICON[String(r.category)] ?? "document-outline"} />
                <View style={{ flex: 1, gap: 8 }}>
                  <Text style={{ fontFamily: F.semibold, fontSize: 15, color: C.navy, textAlign: "left" }} numberOfLines={2}>{String(r.title ?? "—")}</Text>
                  {meta.length > 0 && (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {meta.map((f) => <Pill key={f.key} label={String(r[f.key])} color={f.key === "status" && r[f.key] === "repealed" ? C.danger : C.navySoft} />)}
                    </View>
                  )}
                  {!!r.source_url && <Text style={[s.muted, { fontSize: 12, color: C.teal }]} numberOfLines={1}>{String(r.source_url)}</Text>}
                </View>
                <View style={{ alignItems: "center" }}>
                  <IconBtn icon="create-outline" label="تعديل" color={C.teal} onPress={() => open(r)} />
                  <IconBtn icon="trash-outline" label="حذف" color={C.danger} onPress={() => remove(String(r.id))} />
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <Fab icon="add" label="إضافة سجل" onPress={() => open()} />

      <Modal visible={form !== null} animationType="slide" onRequestClose={() => setForm(null)}>
        <ScrollView style={s.screen} contentContainerStyle={{ padding: 16, paddingTop: 48, gap: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <IconTile icon={editId ? "create-outline" : "add-circle-outline"} />
            <Text style={[s.h1, { flex: 1 }]}>{editId ? "تعديل السجل" : "سجل جديد"}</Text>
            <IconBtn icon="close" label="إغلاق" onPress={() => setForm(null)} />
          </View>
          <View style={[s.card, { gap: 16 }]}>
            {form && FIELDS.map((f) => (
              <View key={f.key} style={{ gap: 8 }}>
                <FieldLabel>{f.ar}{f.required ? " *" : ""}</FieldLabel>
                {f.options ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {f.options.map((o) => (
                      <Choice key={o} label={o} active={form[f.key] === o} onPress={() => setForm({ ...form, [f.key]: form[f.key] === o ? "" : o })} />
                    ))}
                  </View>
                ) : (
                  <TextInput
                    style={[s.input, { backgroundColor: C.surface, minHeight: 48 }, f.key === "content" && { minHeight: 120, textAlignVertical: "top" }]}
                    multiline={f.key === "content"}
                    autoCapitalize={f.key === "source_url" ? "none" : "sentences"}
                    value={form[f.key] ?? ""}
                    onChangeText={(v) => setForm({ ...form, [f.key]: v })}
                  />
                )}
              </View>
            ))}
          </View>
          <Button icon="checkmark" label="حفظ" onPress={save} />
        </ScrollView>
      </Modal>
    </View>
  );
}

export default function Library() {
  const [tab, setTab] = useState<"library" | "documents">("library");
  return (
    <View style={s.screen}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 }}>
        <Segmented options={[["library", "المكتبة", "library-outline"], ["documents", "المستندات", "folder-open-outline"]] as const} value={tab} onChange={setTab} />
      </View>
      {tab === "library" ? <Records /> : <LibraryDocuments />}
    </View>
  );
}
