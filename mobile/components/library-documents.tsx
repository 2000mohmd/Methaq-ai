import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, View } from "react-native";

import { streamChat } from "../lib/api";
import { supabase } from "../lib/supabase";
import { C, F, R, s } from "../lib/theme";
import { Button, EmptyState, Fab, IconBtn, IconTile, type IconName, Pill, SectionTitle, success, tap } from "./ui-kit";

const fileIcon = (n: string): IconName => /\.pdf$/i.test(n) ? "document-attach-outline" : /\.(png|jpe?g|heic|webp)$/i.test(n) ? "image-outline" : "document-text-outline";

type Doc = {
  id: string;
  name: string;
  storage_path: string;
  size_bytes: number | null;
  extracted_text: string | null;
  analysis: string | null;
  created_at: string;
};

// Same prompts as the website's src/routes/app/documents.tsx.
const ANALYSES: { id: string; ar: string; icon: IconName; prompt: string }[] = [
  { id: "summary", ar: "تلخيص", icon: "reader-outline", prompt: "Summarise this document: parties, purpose, key obligations, dates, amounts." },
  { id: "risks", ar: "مراجعة المخاطر", icon: "warning-outline", prompt: "Review this document for legal risks. List each risk with severity (High/Medium/Low), the clause quoted, and a suggested redline." },
  { id: "clauses", ar: "البنود الرئيسية", icon: "list-outline", prompt: "Extract key clauses (term, termination, liability, indemnity, governing law, dispute resolution, confidentiality, payment) in a table-like list." },
];

/** Plain text from .txt/.md/.docx; "" for anything else (no PDF parsing or OCR on device). */
async function extractText(name: string, buf: ArrayBuffer): Promise<string> {
  const n = name.toLowerCase();
  if (n.endsWith(".txt") || n.endsWith(".md")) return new TextDecoder().decode(buf);
  if (n.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    return (await mammoth.extractRawText({ arrayBuffer: buf })).value;
  }
  return "";
}

export function LibraryDocuments() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [sel, setSel] = useState<Doc | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("documents").select("*").order("created_at", { ascending: false });
    setDocs((data as Doc[]) ?? []);
  };
  useEffect(() => {
    load();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: p } = await supabase.from("profiles").select("organization_id").eq("id", data.user.id).single();
      setOrgId(p?.organization_id ?? null);
      setUserId(data.user.id);
    });
  }, []);

  const upload = async () => {
    if (!userId) return;
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    setUploading(true);
    try {
      const buf = await new File(asset.uri).arrayBuffer();
      const rand = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`; // no crypto.randomUUID in Hermes
      const path = `${orgId ?? userId}/${rand}-${asset.name.replace(/[^\w.\-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, buf, { contentType: asset.mimeType ?? "application/octet-stream" });
      if (upErr) throw upErr;
      let text = "";
      try {
        text = (await extractText(asset.name, buf)).slice(0, 200000);
      } catch {}
      if (!text) Alert.alert("تعذر استخراج النص من هذا الملف", "استخراج النص على الجوال متاح لملفات Word والنصوص فقط. لتحليل ملفات PDF أو الصور استخدم الموقع.");
      const { data, error } = await supabase
        .from("documents")
        .insert({ organization_id: orgId as string, name: asset.name, storage_path: path, mime_type: asset.mimeType ?? null, size_bytes: asset.size ?? buf.byteLength, extracted_text: text })
        .select("*")
        .single();
      if (error) throw error;
      await load();
      success();
      setSel(data as Doc);
    } catch (e) {
      Alert.alert("خطأ", (e as Error).message);
    }
    setUploading(false);
  };

  const analyze = async (a: (typeof ANALYSES)[number]) => {
    if (!sel?.extracted_text) return Alert.alert("لا يوجد نص قابل للتحليل");
    setAnalyzing(true);
    let acc = "";
    const doc = sel;
    try {
      await streamChat(
        [{ role: "user", content: `${a.prompt}\nRespond in Arabic.\n\nDOCUMENT "${doc.name}":\n${doc.extracted_text!.slice(0, 60000)}` }],
        { mode: "document analysis" },
        (d) => {
          acc += d;
          setSel({ ...doc, analysis: acc });
        },
      );
      await supabase.from("documents").update({ analysis: acc }).eq("id", doc.id);
      load();
    } catch (e) {
      Alert.alert("خطأ", (e as Error).message);
    }
    setAnalyzing(false);
  };

  const openDoc = async (d: Doc) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(d.storage_path, 60);
    if (error) return Alert.alert("خطأ", error.message);
    Linking.openURL(data.signedUrl);
  };

  const remove = (d: Doc) =>
    Alert.alert("حذف المستند؟", d.name, [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: async () => {
        await supabase.storage.from("documents").remove([d.storage_path]);
        const { error } = await supabase.from("documents").delete().eq("id", d.id);
        if (error) return Alert.alert("خطأ", error.message);
        if (sel?.id === d.id) setSel(null);
        load();
      } },
    ]);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        <SectionTitle title="المستندات" right={docs.length ? <Pill label={String(docs.length)} color={C.navySoft} icon="documents-outline" /> : undefined} />
        <Text style={[s.muted, { marginTop: -10 }]}>PDF أو Word أو نص — حتى 20 ميغابايت</Text>

        {docs.length === 0 ? (
          <EmptyState icon="cloud-upload-outline" title="لا توجد مستندات بعد" text="ارفع عقداً أو حكماً أو مذكرة ليحللها ميثاق." />
        ) : (
          docs.map((d) => {
            const on = sel?.id === d.id;
            return (
              <View key={d.id} style={[s.card, { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingEnd: 6, borderWidth: 1.5, borderColor: on ? C.teal : "transparent" }, on && { backgroundColor: C.tealTint }]}>
                <Pressable style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12 }} onPress={() => { tap(); setSel(d); }}>
                  <IconTile icon={fileIcon(d.name)} color={on ? "#fff" : C.teal} bg={on ? C.teal : undefined} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontFamily: F.semibold, fontSize: 15, color: C.navy, textAlign: "left" }} numberOfLines={1}>{d.name}</Text>
                    <Text style={[s.muted, { fontSize: 12 }]}>
                      {new Date(d.created_at).toLocaleDateString("ar-SA")}{d.size_bytes ? ` · ${(d.size_bytes / 1024).toFixed(0)} ك.ب` : ""}{d.analysis ? " · تم التحليل" : ""}
                    </Text>
                  </View>
                </Pressable>
                <IconBtn icon="open-outline" label="فتح" onPress={() => openDoc(d)} />
                <IconBtn icon="trash-outline" label="حذف" color={C.danger} onPress={() => remove(d)} />
              </View>
            );
          })
        )}

        {sel && (
          <View style={[s.card, { gap: 14, padding: 18 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <IconTile icon="sparkles-outline" color="#fff" bg={C.navy} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.navy, textAlign: "left" }} numberOfLines={2}>{sel.name}</Text>
                <Text style={[s.muted, { fontSize: 12 }]}>
                  {sel.extracted_text ? `${sel.extracted_text.length.toLocaleString()} حرف مستخرج` : "لا يوجد نص — تحليل ملفات PDF والصور متاح على الموقع فقط"}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {ANALYSES.map((a) => (
                <Button key={a.id} icon={a.icon} label={a.ar} variant="outline" compact disabled={analyzing} onPress={() => analyze(a)} style={{ flexGrow: 1 }} />
              ))}
            </View>
            {sel.analysis ? (
              <View style={{ backgroundColor: C.surface, borderRadius: R.md, padding: 14 }}>
                <Text style={s.text} selectable>{sel.analysis}</Text>
              </View>
            ) : analyzing ? (
              <ActivityIndicator color={C.teal} />
            ) : (
              <Text style={[s.muted, { textAlign: "center" }]}>اختر نوع التحليل.</Text>
            )}
            <Text style={[s.muted, { fontSize: 11 }]}>ليس بديلاً عن محامٍ مرخّص.</Text>
          </View>
        )}
      </ScrollView>
      <Fab icon="add" label="رفع مستند" onPress={upload} loading={uploading} />
    </View>
  );
}
