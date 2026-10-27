import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { useRef, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, type TextInputInstance, View } from "react-native";

import { Banner, Button, EmptyState, IconTile, type IconName, Pill, ScreenHeader, success, tap } from "../../components/ui-kit";

import { postJSON } from "../../lib/api";
import { applyRedlines, RISK_LABEL, reportMarkdown, splitClauses, withSources, type Clause, type Finding, type Result, type Risk, type SrcInfo } from "../../lib/audit-core";
import { shareDocx } from "../../lib/docx-export";
import { loadLetterhead } from "../../lib/letterhead";
import { C, F, R, s } from "../../lib/theme";

const BATCH = 6;
const RISK_COLOR: Record<Risk, string> = { high: C.danger, medium: C.amber, low: C.muted, ok: C.teal };
const RISK_ICON: Record<Risk, IconName> = { high: "alert-circle-outline", medium: "warning-outline", low: "information-circle-outline", ok: "checkmark-circle-outline" };
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
  const input = useRef<TextInputInstance>(null);

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
      success();
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
    <ScrollView style={s.screen} contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
      <ScreenHeader kicker="المملكة العربية السعودية" title="مدقق العقود والامتثال"
        subtitle="تدقيق بند ببند مع المخاطر النظامية والصياغات المقترحة." />

      <View style={[s.card, { gap: 14, padding: 18 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <IconTile icon="shield-checkmark-outline" size={48} />
          <View style={{ flex: 1 }}>
            <Text style={[s.h2, { fontSize: 16 }]}>أضف العقد للتدقيق</Text>
            <Text style={[s.muted, { fontSize: 12 }]}>Word أو ملف نصي، أو الصق النص مباشرة</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Source icon="cloud-upload-outline" label="رفع ملف" onPress={pick} disabled={busy} />
          <Source icon="clipboard-outline" label="لصق النص" onPress={() => input.current?.focus()} disabled={busy} />
        </View>
        <TextInput
          ref={input}
          style={[s.input, { minHeight: 150, textAlignVertical: "top", backgroundColor: C.surface }]}
          multiline
          placeholder="الصق نص العقد هنا…"
          placeholderTextColor={C.muted}
          value={text}
          onChangeText={setText}
          editable={!busy}
        />
        {text.trim() ? <Text style={[s.muted, { fontSize: 12 }]}>{name} · {text.trim().length.toLocaleString("ar-SA")} حرف</Text> : null}
        <Button icon="search-outline" label="تدقيق العقد" variant="teal" onPress={run} disabled={!text.trim()} loading={busy} />
        {busy && (
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={[s.muted, { fontFamily: F.medium }]}>جارٍ التدقيق…</Text>
              <Text style={{ fontFamily: F.bold, fontSize: 13, color: C.teal }}>{progress}%</Text>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: C.navyTint, overflow: "hidden" }}>
              <View style={{ width: `${Math.max(progress, 4)}%`, height: "100%", borderRadius: 4, backgroundColor: C.teal }} />
            </View>
          </View>
        )}
      </View>

      {results.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {(["high", "medium", "low", "ok"] as Risk[]).map((r) => (
            <View key={r} style={[s.card, { flexGrow: 1, flexBasis: "45%", gap: 10, padding: 14 }]}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <IconTile icon={RISK_ICON[r]} color={RISK_COLOR[r]} size={36} />
                <Text style={{ fontFamily: F.bold, fontSize: 28, color: RISK_COLOR[r], lineHeight: 36 }}>{count(r)}</Text>
              </View>
              <Text style={[s.muted, { fontFamily: F.medium, color: C.fg }]}>{RISK_LABEL[r]}</Text>
            </View>
          ))}
        </View>
      )}

      {results.length > 0 && !busy && (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Button icon="document-text-outline" label="تقرير التدقيق" variant="outline" compact onPress={() => exportDoc("report")} style={{ flex: 1 }} />
          <Button icon="download-outline" label={`العقد المعدّل (${accepted.size})`} compact onPress={() => exportDoc("revised")} disabled={accepted.size === 0} style={{ flex: 1 }} />
        </View>
      )}

      {results.map((r) => {
        const color = RISK_COLOR[r.risk];
        const on = accepted.has(r.n);
        return (
          <View key={r.n} style={[s.card, { gap: 10, borderStartWidth: 4, borderStartColor: color }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.navy }}>البند {r.n}</Text>
              <Pill label={RISK_LABEL[r.risk]} color={color} icon={RISK_ICON[r.risk]} />
            </View>
            <Text style={[s.muted, { backgroundColor: C.surface, borderRadius: R.sm, padding: 10 }]}>{clauses.find((c) => c.n === r.n)?.text}</Text>
            {!!r.issue && <Text style={s.text}>{r.issue}</Text>}
            {r.sources.length > 0 ? (
              <View style={{ flexDirection: "row", gap: 6, alignItems: "flex-start" }}>
                <Ionicons name="book-outline" size={14} color={C.teal} style={{ marginTop: 3 }} />
                <Text style={[s.muted, { color: C.teal, flex: 1 }]}>
                  السند: {r.sources.map((x) => `${x.title}${x.ref ? ` — م ${x.ref}` : ""}${x.status === "repealed" ? " (ملغى)" : ""}`).join("; ")}
                </Text>
              </View>
            ) : (
              (r.risk === "high" || r.risk === "medium") && (
                <View style={{ flexDirection: "row", gap: 6, alignItems: "flex-start" }}>
                  <Ionicons name="alert-circle-outline" size={14} color={C.amber} style={{ marginTop: 3 }} />
                  <Text style={[s.muted, { color: C.amber, flex: 1 }]}>لا يوجد مصدر موثّق في المكتبة — تحقق يدوياً قبل الاعتماد.</Text>
                </View>
              )
            )}
            {!!r.redline && (
              <View style={{ gap: 10, padding: 12, borderRadius: R.md, backgroundColor: on ? C.tealTint : C.navyTint }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name="create-outline" size={15} color={C.navy} />
                  <Text style={{ fontFamily: F.semibold, fontSize: 13, color: C.navy }}>الصياغة المقترحة</Text>
                </View>
                <Text style={s.text}>{r.redline}</Text>
                {on ? (
                  <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                    <View style={{ flex: 1 }}><Pill label="تم قبول التعديل" color={C.teal} icon="checkmark-circle" /></View>
                    <Button icon="arrow-undo-outline" label="تراجع" variant="outline" compact onPress={() => toggle(r.n)} />
                  </View>
                ) : (
                  <Button icon="checkmark" label="قبول التعديل" variant="teal" compact onPress={() => toggle(r.n)} />
                )}
              </View>
            )}
          </View>
        );
      })}

      {results.length === 0 && !busy && (
        <EmptyState icon="document-text-outline" title="لم يُدقَّق أي عقد بعد." text="ارفع ملفاً أو الصق نص العقد ثم اضغط «تدقيق العقد»." />
      )}
      <Banner icon="information-circle-outline" color={C.navySoft} text="هذا تدقيق آلي للمساعدة فقط ويجب أن يراجعه محامٍ مرخّص قبل الاعتماد." />
    </ScrollView>
  );
}

function Source(p: { icon: IconName; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={() => { tap(); p.onPress(); }} disabled={p.disabled} accessibilityRole="button"
      style={({ pressed }) => ({ flex: 1, minHeight: 72, gap: 6, alignItems: "center", justifyContent: "center", borderRadius: R.md, borderWidth: 1.5,
        borderStyle: "dashed", borderColor: C.tealSoft, backgroundColor: pressed ? C.tealTint : C.bg, opacity: p.disabled ? 0.5 : 1 })}>
      <Ionicons name={p.icon} size={22} color={C.teal} />
      <Text style={{ fontFamily: F.semibold, fontSize: 14, color: C.navy }}>{p.label}</Text>
    </Pressable>
  );
}
