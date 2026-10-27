// Native port of the website's src/routes/app/contracts.tsx (Saudi contract builder).
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, type ScrollViewInstance, Share, Text, TextInput, View } from "react-native";

import { postJSON } from "../../lib/api";
import { shareDocx } from "../../lib/docx-export";
import { loadLetterhead } from "../../lib/letterhead";
import { supabase } from "../../lib/supabase";
import { C, s } from "../../lib/theme";

type Field = { key: string; en: string; ar: string; long?: boolean; options?: { v: string; en: string; ar: string }[] };
type Step = { en: string; ar: string; fields: Field[] };
type Template = {
  id: string; icon: keyof typeof Ionicons.glyphMap; en: string; ar: string; lawEn: string; lawAr: string;
  steps: Step[]; rules: string;
};

// Templates, fields and rules are copied verbatim from the website.
const DISPUTE: Field = {
  key: "dispute", en: "Dispute resolution", ar: "تسوية المنازعات",
  options: [
    { v: "Saudi courts (competent court in the city of the contract)", en: "Saudi courts", ar: "المحاكم السعودية" },
    { v: "Saudi Commercial Courts", en: "Commercial Courts", ar: "المحاكم التجارية" },
    { v: "Arbitration under the Saudi Center for Commercial Arbitration (SCCA) rules, seat Riyadh", en: "SCCA arbitration", ar: "التحكيم - المركز السعودي للتحكيم التجاري" },
  ],
};

const PARTY = (k: string, en: string, ar: string): Field[] => [
  { key: `${k}_name`, en: `${en} — full name / company`, ar: `${ar} — الاسم الكامل / المنشأة` },
  { key: `${k}_id`, en: `${en} — National ID / Iqama / CR no.`, ar: `${ar} — الهوية / الإقامة / السجل التجاري` },
  { key: `${k}_addr`, en: `${en} — address`, ar: `${ar} — العنوان` },
];

const TEMPLATES: Template[] = [
  {
    id: "employment", icon: "briefcase-outline", en: "Employment Contract", ar: "عقد عمل",
    lawEn: "Saudi Labor Law (M/51) as amended", lawAr: "نظام العمل السعودي (م/51) وتعديلاته",
    steps: [
      { en: "Parties", ar: "الأطراف", fields: [...PARTY("employer", "Employer", "صاحب العمل"), ...PARTY("employee", "Employee", "العامل"), { key: "nationality", en: "Employee nationality", ar: "جنسية العامل" }] },
      { en: "Job & pay", ar: "الوظيفة والأجر", fields: [
        { key: "title", en: "Job title", ar: "المسمى الوظيفي" },
        { key: "location", en: "Work location (city)", ar: "مكان العمل (المدينة)" },
        { key: "salary", en: "Basic monthly salary (SAR)", ar: "الأجر الأساسي الشهري (ريال)" },
        { key: "allowances", en: "Allowances (housing, transport…)", ar: "البدلات (سكن، نقل…)" },
        { key: "hours", en: "Weekly working hours", ar: "ساعات العمل الأسبوعية" },
      ] },
      { en: "Term", ar: "المدة", fields: [
        { key: "type", en: "Contract type", ar: "نوع العقد", options: [
          { v: "fixed-term", en: "Fixed term", ar: "محدد المدة" }, { v: "indefinite", en: "Indefinite", ar: "غير محدد المدة" }] },
        { key: "duration", en: "Start date & duration", ar: "تاريخ البدء والمدة" },
        { key: "probation", en: "Probation (max 180 days)", ar: "فترة التجربة (بحد أقصى 180 يوماً)" },
        { key: "leave", en: "Annual leave days (min 21)", ar: "أيام الإجازة السنوية (21 يوماً على الأقل)" },
      ] },
      { en: "Clauses", ar: "البنود", fields: [
        { key: "noncompete", en: "Non-compete (max 2 years, defined area & activity) — or 'none'", ar: "عدم المنافسة (بحد أقصى سنتين ونطاق محدد) — أو 'لا يوجد'" },
        { key: "extra", en: "Other terms", ar: "شروط إضافية", long: true },
      ] },
    ],
    rules: "Comply with the Saudi Labor Law and its Implementing Regulations: probation not exceeding 180 days in total (Art. 53), annual leave minimum 21 days rising to 30 after 5 years (Art. 109), working hours limits (Art. 98), end-of-service award (Arts. 84–85), termination and notice rules (Arts. 74–80), non-compete only in writing, limited in time (max 2 years), place and activity (Art. 83). Reference GOSI and Qiwa contract documentation. For non-Saudis, fixed term must align with the work permit.",
  },
  {
    id: "services", icon: "hand-left-outline", en: "Services Agreement", ar: "عقد تقديم خدمات",
    lawEn: "Civil Transactions Law (M/191, 1444H)", lawAr: "نظام المعاملات المدنية (م/191 لعام 1444هـ)",
    steps: [
      { en: "Parties", ar: "الأطراف", fields: [...PARTY("client", "Client", "العميل"), ...PARTY("provider", "Service provider", "مقدم الخدمة")] },
      { en: "Scope", ar: "النطاق", fields: [
        { key: "scope", en: "Scope of services & deliverables", ar: "نطاق الخدمات والمخرجات", long: true },
        { key: "duration", en: "Start date & duration", ar: "تاريخ البدء والمدة" },
      ] },
      { en: "Price", ar: "المقابل", fields: [
        { key: "fee", en: "Fee (SAR, excl./incl. 15% VAT)", ar: "المقابل (ريال، شامل/غير شامل ضريبة 15%)" },
        { key: "payment", en: "Payment schedule", ar: "جدول الدفعات" },
        { key: "penalty", en: "Delay penalty (liquidated damages)", ar: "غرامة التأخير (الشرط الجزائي)" },
      ] },
      { en: "Clauses", ar: "البنود", fields: [DISPUTE, { key: "extra", en: "Other terms (IP, confidentiality…)", ar: "شروط إضافية (الملكية الفكرية، السرية…)", long: true }] },
    ],
    rules: "Ground in the Saudi Civil Transactions Law: contract formation and consent, binding force, the court's power to reduce a penalty clause that is excessive or to deny it where no damage occurred (Art. 178), limitation of liability cannot exclude fraud or gross negligence, force majeure and exceptional circumstances (Art. 97), termination for breach. No interest/riba on late payments — use a lawful fixed penalty instead. Include VAT per ZATCA rules.",
  },
  {
    id: "nda", icon: "document-lock-outline", en: "Non-Disclosure Agreement", ar: "اتفاقية عدم إفصاح",
    lawEn: "Civil Transactions Law + PDPL", lawAr: "نظام المعاملات المدنية ونظام حماية البيانات الشخصية",
    steps: [
      { en: "Parties", ar: "الأطراف", fields: [...PARTY("a", "First party", "الطرف الأول"), ...PARTY("b", "Second party", "الطرف الثاني"),
        { key: "mutual", en: "Type", ar: "النوع", options: [{ v: "mutual", en: "Mutual", ar: "متبادلة" }, { v: "one-way (first party discloses)", en: "One-way", ar: "من طرف واحد" }] }] },
      { en: "Terms", ar: "الشروط", fields: [
        { key: "purpose", en: "Purpose of disclosure", ar: "الغرض من الإفصاح", long: true },
        { key: "term", en: "Confidentiality period", ar: "مدة السرية" },
        DISPUTE,
      ] },
    ],
    rules: "Ground in the Saudi Civil Transactions Law, the Personal Data Protection Law (PDPL) for any personal data, and the Anti-Cyber Crime Law where relevant. Define confidential information, exclusions, permitted disclosures to regulators/courts, return/destruction, remedies (injunctive relief before the competent court), and any penalty clause subject to judicial reduction.",
  },
];

const LANGS = [
  { v: "ar", ar: "العربية" },
  { v: "both", ar: "ثنائي اللغة" },
  { v: "en", ar: "الإنجليزية" },
] as const;
type OutLang = (typeof LANGS)[number]["v"];

type Status = "pending_review" | "approved" | "rejected";
// Clients can never read the AI draft (body) -- only the lawyer-approved text (per-instance review).
const COLS = "id,title,contract_type,language,inputs,status,approved_body,review_note,reviewed_at,created_at,updated_at";
type Saved = {
  id: string; title: string; contract_type: string; inputs: Record<string, string>; language?: OutLang; created_at: string;
  status: Status; approved_body: string | null; review_note: string | null;
};
const STATUS: Record<Status, { ar: string; color: string }> = {
  pending_review: { ar: "قيد المراجعة", color: C.amber },
  approved: { ar: "معتمد", color: C.teal },
  rejected: { ar: "مرفوض", color: C.danger },
};

function Badge({ status }: { status: Status }) {
  const b = STATUS[status] ?? STATUS.pending_review;
  return (
    <View style={{ borderRadius: 999, borderWidth: 1, borderColor: b.color, paddingHorizontal: 10, paddingVertical: 3 }}>
      <Text style={{ fontSize: 12, color: b.color }}>{b.ar}</Text>
    </View>
  );
}

function Chip({ label, active, done, onPress }: { label: string; active: boolean; done?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8,
        backgroundColor: active ? C.navy : done ? C.tealTint : C.navyTint }}
    >
      {done && !active && <Ionicons name="checkmark" size={12} color={C.teal} />}
      <Text style={{ fontSize: 13, color: active ? "#fff" : done ? C.teal : C.muted }}>{label}</Text>
    </Pressable>
  );
}

function Action({ icon, label, onPress, disabled }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={{ flexDirection: "row", alignItems: "center", gap: 6, padding: 10, opacity: disabled ? 0.4 : 1 }}>
      <Ionicons name={icon} size={18} color={C.navy} />
      <Text style={{ color: C.navy, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

export default function Screen() {
  const [tpl, setTpl] = useState<Template>(TEMPLATES[0]!);
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [outLang, setOutLang] = useState<OutLang>("ar");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [cur, setCur] = useState<Saved | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);

  async function load() {
    const { data, error } = await supabase.from("contracts").select(COLS).order("created_at", { ascending: false }).limit(50);
    if (error) { Alert.alert("خطأ", error.message); return; }
    const rows = (data ?? []) as unknown as Saved[];
    setSaved(rows);
    setCur((c) => (c ? rows.find((r) => r.id === c.id) ?? null : c));
  }
  async function refresh() { setRefreshing(true); await load(); setRefreshing(false); }
  useEffect(() => { load(); }, []);

  function pick(t: Template) { setTpl(t); setStep(0); setValues({}); setCur(null); }
  const set = (k: string, v: string) => setValues((x) => ({ ...x, [k]: v }));

  const last = step === tpl.steps.length;

  async function generate() {
    setCur(null); setBusy(true);
    const details = tpl.steps.flatMap((st) => st.fields).map((f) => `- ${f.en}: ${values[f.key]?.trim() || "[to be completed]"}`).join("\n");
    const langLine = outLang === "ar" ? "Write the entire contract in formal Arabic legal drafting (العربية الفصحى القانونية)."
      : outLang === "en" ? "Write the contract in English, noting the Arabic version prevails before Saudi authorities."
      : "Write a bilingual contract: each clause in Arabic followed by its English translation; state the Arabic text prevails.";
    const prompt = `Draft a complete, ready-to-sign ${tpl.en} governed by the laws of the Kingdom of Saudi Arabia.
Applicable law: ${tpl.lawEn}.
Mandatory rules: ${tpl.rules}
Structure: title, date (Hijri and Gregorian), parties with identifiers (الأطراف), preamble (التمهيد), numbered articles (المادة الأولى، الثانية…) with headings, governing law and dispute resolution, number of copies, signatures block.
Mark any missing detail as [ ____ ]. After the contract, add a short section "Compliance notes" listing statutory points the user should verify.
${langLine}

Details:
${details}`;
    const firstParty = Object.entries(values).find(([k]) => k.endsWith("_name"))?.[1];
    const title = `${tpl.ar}${firstParty ? ` — ${firstParty}` : ""}`;
    try {
      // Server generates and stores the draft as pending lawyer review; only the id comes back.
      await postJSON<{ id: string; status: Status }>("/api/contracts", { title, contract_type: tpl.id, language: outLang, inputs: values, prompt });
      Alert.alert("تم الإرسال", "تم إرسال العقد إلى المحامي للمراجعة. ستتمكن من عرضه وتنزيله بعد اعتماده.");
      load();
    } catch (e) { Alert.alert("خطأ", (e as Error).message); }
    finally { setBusy(false); }
  }

  function remove(id: string) {
    Alert.alert("حذف العقد؟", "", [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: async () => {
        const { error } = await supabase.from("contracts").delete().eq("id", id);
        if (error) { Alert.alert("خطأ", error.message); return; }
        setCur((c) => (c?.id === id ? null : c));
        load();
      } },
    ]);
  }

  function open(sv: Saved) {
    const t = TEMPLATES.find((x) => x.id === sv.contract_type) ?? TEMPLATES[0]!;
    setTpl(t); setValues(sv.inputs ?? {}); setCur(sv); setStep(t.steps.length);
    if (sv.language) setOutLang(sv.language);
    scroll.current?.scrollTo({ y: 0, animated: true });
  }

  const approved = cur?.status === "approved" && cur.approved_body ? cur.approved_body : "";

  async function exportWord() {
    if (!approved) return;
    try {
      await shareDocx({ title: tpl.en, markdown: approved, letterhead: await loadLetterhead(), lang: outLang === "en" ? "en" : "ar" }, tpl.en.replace(/\s+/g, "-"));
    } catch (e) { Alert.alert("خطأ", (e as Error).message); }
  }

  return (
    <ScrollView ref={scroll} style={s.screen} contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.teal} colors={[C.teal]} />}>
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 12, fontWeight: "600", color: C.teal, textAlign: "left" }}>المملكة العربية السعودية</Text>
        <Text style={s.h1}>منشئ العقود السعودي</Text>
        <Text style={s.muted}>صياغة عقود متوافقة مع الأنظمة السعودية خطوة بخطوة.</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {TEMPLATES.map((t) => (
          <Pressable key={t.id} onPress={() => pick(t)}
            style={[s.card, { width: 200, gap: 6 }, tpl.id === t.id && { borderColor: C.teal, backgroundColor: C.tealTint }]}>
            <Ionicons name={t.icon} size={20} color={C.teal} />
            <Text style={{ fontSize: 14, fontWeight: "600", color: C.navy, textAlign: "left" }}>{t.ar}</Text>
            <Text style={s.muted}>{t.lawAr}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={[s.card, { gap: 14 }]}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {[...tpl.steps, { ar: "الإنشاء" }].map((st, i) => (
            <Chip key={i} label={st.ar} active={i === step} done={i < step} onPress={() => setStep(i)} />
          ))}
        </View>

        {!last ? (
          <>
            {tpl.steps[step]!.fields.map((f) => (
              <View key={f.key} style={{ gap: 6 }}>
                <Text style={s.text}>{f.ar}</Text>
                {f.options ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {f.options.map((o) => (
                      <Chip key={o.v} label={o.ar} active={values[f.key] === o.v} onPress={() => set(f.key, values[f.key] === o.v ? "" : o.v)} />
                    ))}
                  </View>
                ) : (
                  <TextInput style={[s.input, f.long && { minHeight: 100, textAlignVertical: "top" }]} multiline={f.long}
                    value={values[f.key] ?? ""} onChangeText={(v) => set(f.key, v)} />
                )}
              </View>
            ))}
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Action icon="chevron-forward" label="السابق" disabled={step === 0} onPress={() => setStep(step - 1)} />
              <Pressable style={[s.btn, { paddingHorizontal: 24 }]} onPress={() => setStep(step + 1)}>
                <Text style={s.btnText}>التالي</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <Text style={s.text}>لغة العقد</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {LANGS.map((o) => <Chip key={o.v} label={o.ar} active={outLang === o.v} onPress={() => setOutLang(o.v)} />)}
            </View>
            <Text style={s.muted}>الحقول الفارغة ستظهر كفراغات [ ____ ] لتعبئتها لاحقاً.</Text>
            <Pressable style={[s.btn, { flexDirection: "row", justifyContent: "center", gap: 8 }, busy && { opacity: 0.6 }]} disabled={busy} onPress={generate}>
              {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="sparkles" size={18} color="#fff" />}
              <Text style={s.btnText}>إنشاء العقد</Text>
            </Pressable>
            <Action icon="chevron-forward" label="السابق" onPress={() => setStep(step - 1)} />
          </>
        )}
      </View>

      <View style={[s.card, { gap: 8, minHeight: 160 }]}>
        {busy ? (
          <View style={{ alignItems: "center", gap: 10, paddingVertical: 24 }}>
            <ActivityIndicator color={C.teal} />
            <Text style={s.muted}>جارٍ إنشاء العقد وإرساله للمحامي للمراجعة…</Text>
          </View>
        ) : !cur ? (
          <Text style={s.muted}>بعد الإنشاء يُرسل العقد إلى محامٍ لمراجعته، ويمكنك فتحه من قائمة العقود أدناه بعد اعتماده.</Text>
        ) : (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ flex: 1, fontSize: 15, fontWeight: "600", color: C.navy, textAlign: "left" }}>{cur.title}</Text>
              <Badge status={cur.status} />
            </View>
            {approved ? (
              <>
                <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                  <Action icon="share-outline" label="مشاركة النص" onPress={() => Share.share({ message: approved })} />
                  <Action icon="download-outline" label="Word (.docx)" onPress={exportWord} />
                </View>
                {/* ponytail: raw markdown text; add a markdown renderer if users ask for formatted preview */}
                <Text selectable style={[s.text, { lineHeight: 26, writingDirection: cur.language === "en" ? "ltr" : "rtl" }]}>{approved}</Text>
              </>
            ) : cur.status === "rejected" ? (
              <>
                <Text style={s.text}>رفض المحامي هذا العقد.</Text>
                {cur.review_note ? <Text style={[s.text, { color: C.danger }]}>ملاحظة المحامي: {cur.review_note}</Text> : null}
                <Text style={s.muted}>يمكنك تعديل البيانات أعلاه وإنشاء العقد مرة أخرى.</Text>
              </>
            ) : (
              <Text style={s.muted}>العقد قيد مراجعة المحامي. ستتمكن من عرضه وتنزيله بعد اعتماده. اسحب الشاشة للأسفل لتحديث الحالة.</Text>
            )}
          </>
        )}
        <Text style={[s.muted, { fontStyle: "italic", marginTop: 12 }]}>ميثاق ليس بديلاً عن محامٍ مرخّص. راجع العقد قبل التوقيع.</Text>
      </View>

      <Text style={[s.h1, { fontSize: 18 }]}>العقود المحفوظة</Text>
      {saved.length === 0 ? (
        <Text style={s.muted}>لا توجد عقود محفوظة بعد.</Text>
      ) : (
        <View style={[s.card, { padding: 0 }]}>
          {saved.map((sv, i) => (
            <View key={sv.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10,
              borderTopWidth: i ? 1 : 0, borderColor: C.border }}>
              <Pressable style={{ flex: 1 }} onPress={() => open(sv)}>
                <Text style={{ fontSize: 14, fontWeight: "500", color: C.navy, textAlign: "left" }}>{sv.title}</Text>
                <Text style={s.muted}>{new Date(sv.created_at).toLocaleDateString("ar-SA")}</Text>
              </Pressable>
              <Badge status={sv.status} />
              <Pressable accessibilityLabel="حذف" hitSlop={8} onPress={() => remove(sv.id)} style={{ padding: 6 }}>
                <Ionicons name="trash-outline" size={18} color={C.muted} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
