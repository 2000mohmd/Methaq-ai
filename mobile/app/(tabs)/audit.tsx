import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { postJSON } from "../../lib/api";
import { applyRedlines, RISK_LABEL, reportMarkdown, splitClauses, withSources, type Clause, type Finding, type Result, type Risk, type SrcInfo } from "../../lib/audit-core";
import { shareDocx } from "../../lib/docx-export";
import { loadLetterhead } from "../../lib/letterhead";
import { C, s } from "../../lib/theme";

const BATCH = 6;
const RISK_COLOR: Record<Risk, string> = { high: C.danger, medium: C.amber, low: C.muted, ok: C.teal };
const RISK_ICON: Record<Risk, keyof typeof Ionicons.glyphMap> = { high: "shield-outline", medium: "warning-outline", low: "warning-outline", ok: "checkmark-circle-outline" };
const PDF_MSG = "قراءة ملفات PDF غير متاحة في التطبيق بعد. انسخ نص العقد والصقه هنا، أو استخدم الموقع لرفع ملف PDF.";

/** Read a picked file as plain text; null = unsupported format (message already shown). */
async function readPicked(asset: DocumentPicker.DocumentPickerAsset): Promise<string | null> {
  const ext = asset.name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") {
    Alert.alert("ملف PDF", PDF_MSG);
    return null;
  }
  const file = new File(asset.uri);
  if (ext === "docx") {
    try {
      const { extractRawText } = await import("mammoth");
      return (await extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
    } catch {
      Alert.alert("تعذرت قراءة ملف Word", "انسخ نص العقد والصقه في الحقل بدلاً من ذلك.");
      return null;
    }
  }
  return file.text();
}

export default function AuditScreen() {
  const [text, setText] = useState("");
  const [name, setName] = useState("عقد");
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [accepted, setAccepted] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  async function pick() {
    const r = await DocumentPicker.getDocumentAsync({
      type: ["text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/pdf"],
      copyToCacheDirectory: true,
    });
    const asset = r.canceled ? undefined : r.assets[0];
    if (!asset) return;
    const t = await readPicked(asset).catch(() => null);
    if (t == null) return;
    setText(t);
    setName(asset.name.replace(/\.[^.]+$/, ""));
  }

  async function run() {
    const cl = splitClauses(text);
    if (cl.length === 0) return Alert.alert("تنبيه", "تعذر قراءة نص العقد");
    setBusy(true);
    setResults([]);
    setAccepted(new Set());
    setProgress(0);
    setClauses(cl);
    try {
      const all: Result[] = [];
      for (let i = 0; i < cl.length; i += BATCH) {
        const j = await postJSON<{ findings: Finding[]; sources: SrcInfo[] }>("/api/audit", { clauses: cl.slice(i, i + BATCH), jurisdiction: "Saudi Arabia" });
        all.push(...withSources(j.findings, j.sources));
        setResults([...all]);
        setProgress(Math.min(100, Math.round(((i + BATCH) / cl.length) * 100)));
      }
    } catch (e) {
      Alert.alert("فشل التدقيق", (e as Error).message);
    }
    setBusy(false);
  }

  const toggle = (n: number) =>
    setAccepted((cur) => {
      const c = new Set(cur);
      if (c.has(n)) c.delete(n);
      else c.add(n);
      return c;
    });

  async function exportDoc(kind: "report" | "revised") {
    try {
      const letterhead = await loadLetterhead();
      if (kind === "report") await shareDocx({ title: name, markdown: reportMarkdown(name, clauses, results), letterhead }, `${name}-audit`);
      else await shareDocx({ title: name, markdown: applyRedlines(clauses, results, accepted), letterhead }, `${name}-revised`);
    } catch (e) {
      Alert.alert("تعذر التصدير", (e as Error).message);
    }
  }

  const count = (r: Risk) => results.filter((x) => x.risk === r).length;

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
      <Text style={[s.muted, { color: C.teal, fontWeight: "600" }]}>المملكة العربية السعودية</Text>
      <Text style={s.h1}>مدقق العقود والامتثال السعودي</Text>
      <Text style={s.muted}>الصق نص العقد أو اختر ملفاً (Word أو نص) للحصول على تدقيق بند ببند مع المخاطر النظامية والصياغات المقترحة.</Text>

      <TextInput
        style={[s.input, { minHeight: 140, textAlignVertical: "top" }]}
        multiline
        placeholder="الصق نص العقد هنا…"
        placeholderTextColor={C.muted}
        value={text}
        onChangeText={setText}
        editable={!busy}
      />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Btn icon="attach-outline" label="اختيار ملف" outline onPress={pick} disabled={busy} />
        <Btn icon="search-outline" label="تدقيق العقد" onPress={run} disabled={busy || !text.trim()} />
      </View>
      {busy && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <ActivityIndicator color={C.teal} />
          <Text style={s.muted}>جارٍ التدقيق… {progress}%</Text>
        </View>
      )}

      {results.length > 0 && !busy && (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Btn icon="download-outline" label="تقرير التدقيق" outline onPress={() => exportDoc("report")} />
          <Btn icon="download-outline" label={`العقد المعدّل (${accepted.size})`} outline onPress={() => exportDoc("revised")} disabled={accepted.size === 0} />
        </View>
      )}

      {results.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {(["high", "medium", "low", "ok"] as Risk[]).map((r) => (
            <View key={r} style={[s.card, { flexGrow: 1, flexBasis: "45%", borderColor: RISK_COLOR[r], backgroundColor: RISK_COLOR[r] + "10" }]}>
              <Text style={s.muted}>{RISK_LABEL[r]}</Text>
              <Text style={[s.h1, { marginTop: 4 }]}>{count(r)}</Text>
            </View>
          ))}
        </View>
      )}

      {results.map((r) => (
        <View key={r.n} style={[s.card, { gap: 8, borderColor: RISK_COLOR[r.risk], backgroundColor: RISK_COLOR[r.risk] + "0d" }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={[s.text, { fontWeight: "700", color: C.navy }]}>البند {r.n}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Ionicons name={RISK_ICON[r.risk]} size={16} color={RISK_COLOR[r.risk]} />
              <Text style={[s.muted, { color: RISK_COLOR[r.risk], fontWeight: "600" }]}>{RISK_LABEL[r.risk]}</Text>
            </View>
          </View>
          <Text style={s.muted}>{clauses.find((c) => c.n === r.n)?.text}</Text>
          {!!r.issue && <Text style={s.text}>{r.issue}</Text>}
          {r.sources.length > 0 ? (
            <Text style={[s.muted, { color: C.teal }]}>
              السند: {r.sources.map((x) => `${x.title}${x.ref ? ` — م ${x.ref}` : ""}${x.status === "repealed" ? " (ملغى)" : ""}`).join("; ")}
            </Text>
          ) : (
            (r.risk === "high" || r.risk === "medium") && (
              <Text style={[s.muted, { color: C.amber }]}>⚠ لا يوجد مصدر موثّق في المكتبة — تحقق يدوياً قبل الاعتماد.</Text>
            )
          )}
          {!!r.redline && (
            <View style={[s.card, { padding: 12, gap: 6 }]}>
              <Text style={[s.muted, { color: C.navy, fontWeight: "700" }]}>الصياغة المقترحة</Text>
              <Text style={s.text}>{r.redline}</Text>
              <Btn icon="checkmark" label={accepted.has(r.n) ? "تم القبول — اضغط للتراجع" : "قبول التعديل"} outline={!accepted.has(r.n)} onPress={() => toggle(r.n)} />
            </View>
          )}
        </View>
      ))}

      {results.length === 0 && !busy && (
        <View style={{ alignItems: "center", gap: 6, paddingVertical: 24 }}>
          <Ionicons name="document-text-outline" size={40} color={C.teal} />
          <Text style={s.muted}>لم يُدقَّق أي عقد بعد.</Text>
        </View>
      )}
      <Text style={[s.muted, { fontStyle: "italic", marginTop: 8 }]}>هذا تدقيق آلي للمساعدة فقط ويجب أن يراجعه محامٍ مرخّص قبل الاعتماد.</Text>
    </ScrollView>
  );
}

function Btn(p: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; disabled?: boolean; outline?: boolean }) {
  const fg = p.outline ? C.navy : "#fff";
  return (
    <Pressable
      onPress={p.onPress}
      disabled={p.disabled}
      style={[s.btn, { flex: 1, flexDirection: "row", justifyContent: "center", gap: 6, opacity: p.disabled ? 0.5 : 1 }, p.outline && { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border }]}
    >
      <Ionicons name={p.icon} size={18} color={fg} />
      <Text style={[s.btnText, { color: fg, fontSize: 15 }]}>{p.label}</Text>
    </Pressable>
  );
}
