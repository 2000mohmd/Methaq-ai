import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, Text, View } from "react-native";

import { streamChat } from "../lib/api";
import { supabase } from "../lib/supabase";
import { C, s } from "../lib/theme";

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
const ANALYSES = [
  { id: "summary", ar: "تلخيص", prompt: "Summarise this document: parties, purpose, key obligations, dates, amounts." },
  { id: "risks", ar: "مراجعة المخاطر", prompt: "Review this document for legal risks. List each risk with severity (High/Medium/Low), the clause quoted, and a suggested redline." },
  { id: "clauses", ar: "البنود الرئيسية", prompt: "Extract key clauses (term, termination, liability, indemnity, governing law, dispute resolution, confidentiality, payment) in a table-like list." },
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
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={[s.h1, { flex: 1 }]}>المستندات</Text>
        <Pressable style={[s.btn, { paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", gap: 6 }]} onPress={upload} disabled={uploading}>
          {uploading ? <ActivityIndicator color="#fff" /> : <Ionicons name="cloud-upload-outline" size={18} color="#fff" />}
          <Text style={s.btnText}>رفع مستند</Text>
        </Pressable>
      </View>
      <Text style={s.muted}>PDF أو Word أو نص — حتى 20 ميغابايت</Text>

      {docs.length === 0 ? (
        <View style={[s.card, { backgroundColor: C.navyTint, paddingVertical: 28, gap: 10 }]}>
          <Ionicons name="document-text-outline" size={24} color={C.teal} />
          <Text style={s.muted}>ارفع عقداً أو حكماً أو مذكرة ليحللها ميثاق.</Text>
        </View>
      ) : (
        docs.map((d) => (
          <View key={d.id} style={[s.card, { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6 }, sel?.id === d.id && { borderColor: C.teal, backgroundColor: C.tealTint }]}>
            <Ionicons name="document-text-outline" size={18} color={C.teal} />
            <Pressable style={{ flex: 1, paddingVertical: 8 }} onPress={() => setSel(d)}>
              <Text style={s.text} numberOfLines={1}>{d.name}</Text>
            </Pressable>
            <Pressable style={{ padding: 8 }} onPress={() => openDoc(d)} accessibilityLabel="فتح">
              <Ionicons name="open-outline" size={18} color={C.muted} />
            </Pressable>
            <Pressable style={{ padding: 8 }} onPress={() => remove(d)} accessibilityLabel="حذف">
              <Ionicons name="trash-outline" size={18} color={C.muted} />
            </Pressable>
          </View>
        ))
      )}

      {sel && (
        <View style={[s.card, { gap: 10 }]}>
          <Text style={{ fontSize: 16, fontWeight: "600", color: C.navy, textAlign: "left" }}>{sel.name}</Text>
          <Text style={s.muted}>
            {sel.extracted_text ? `${sel.extracted_text.length.toLocaleString()} حرف مستخرج` : "لا يوجد نص — تحليل ملفات PDF والصور متاح على الموقع فقط"}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {ANALYSES.map((a) => (
              <Pressable key={a.id} disabled={analyzing} onPress={() => analyze(a)}
                style={{ flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, opacity: analyzing ? 0.5 : 1 }}>
                <Ionicons name="sparkles-outline" size={14} color={C.teal} />
                <Text style={{ color: C.fg }}>{a.ar}</Text>
              </Pressable>
            ))}
          </View>
          {sel.analysis ? (
            <Text style={s.text} selectable>{sel.analysis}</Text>
          ) : analyzing ? (
            <ActivityIndicator color={C.teal} />
          ) : (
            <Text style={s.muted}>اختر نوع التحليل.</Text>
          )}
          <Text style={[s.muted, { fontSize: 11 }]}>ليس بديلاً عن محامٍ مرخّص.</Text>
        </View>
      )}
    </View>
  );
}
