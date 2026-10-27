// Native port of the website's src/routes/app/contracts.tsx (Saudi contract builder).
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, type ScrollViewInstance, Share, Text, TextInput, View } from "react-native";

import { postJSON } from "../../lib/api";
import { dualDate } from "../../lib/dates";
import { shareDocx } from "../../lib/docx-export";
import { loadLetterhead } from "../../lib/letterhead";
import { supabase } from "../../lib/supabase";
import { C, F, R, s } from "../../lib/theme";
import { Banner, Button, Choice, FieldLabel, IconBtn, IconTile, type IconName, Pill, ScreenHeader, SectionTitle, success, tap } from "../../components/ui-kit";

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
    { v: "Saudi courts (competent court in the city of the contract)", en: "Saudi courts", ar: "المحاكم السعودية المختصة" },
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
// Employment contracts: Arabic or bilingual only (the Arabic text is the one Qiwa / the labour courts rely on).
const langsFor = (t: Template) => (t.id === "employment" ? LANGS.filter((l) => l.v !== "en") : LANGS);

type Status = "pending_review" | "approved" | "rejected";
type Kind = "contract" | "workflow" | "chat_draft";
const KIND: Record<Kind, { ar: string; icon: IconName }> = {
  contract: { ar: "عقد", icon: "document-text-outline" },
  workflow: { ar: "سير عمل", icon: "git-branch-outline" },
  chat_draft: { ar: "مسودة من المحادثة", icon: "chatbubble-ellipses-outline" },
};
// Clients can never read the AI draft (body) -- only the lawyer-approved text (per-instance review).
const COLS = "id,kind,title,contract_type,language,inputs,status,approved_body,review_note,reviewer_name,reviewer_licence,reviewed_at,created_at,updated_at";
type Saved = {
  id: string; kind: Kind | null; title: string; contract_type: string; inputs: Record<string, string> | null; language?: OutLang; created_at: string;
  status: Status; approved_body: string | null; review_note: string | null;
  reviewer_name: string | null; reviewer_licence: string | null; reviewed_at: string | null;
};
const stampOf = (sv: Saved) =>
  sv.status === "approved" && sv.reviewer_name
    ? `اعتمده: ${sv.reviewer_name} — ترخيص رقم ${sv.reviewer_licence ?? "—"} — ${dualDate(new Date(sv.reviewed_at ?? sv.created_at))}`
    : "";
const STATUS: Record<Status, { ar: string; color: string; icon: IconName }> = {
  pending_review: { ar: "قيد المراجعة", color: C.amber, icon: "time-outline" },
  approved: { ar: "معتمد", color: C.teal, icon: "checkmark-circle" },
  rejected: { ar: "مرفوض", color: C.danger, icon: "close-circle" },
};

function Badge({ status }: { status: Status }) {
  const b = STATUS[status] ?? STATUS.pending_review;
  return <Pill label={b.ar} color={b.color} icon={b.icon} />;
}

/** Numbered step tracker: completed steps get a check, connected by a progress rail. Steps stay tappable. */
function Stepper({ labels, step, onPick }: { labels: string[]; step: number; onPick: (i: number) => void }) {
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ fontFamily: F.semibold, fontSize: 13, color: C.teal }}>الخطوة {step + 1} من {labels.length}</Text>
        <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.navy }}>{labels[step]}</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {labels.map((l, i) => {
          const done = i < step, active = i === step;
          return (
            <View key={i} style={{ flex: i ? 1 : 0, flexDirection: "row", alignItems: "center" }}>
              {i > 0 && <View style={{ flex: 1, height: 3, borderRadius: 2, marginHorizontal: 4, backgroundColor: i <= step ? C.teal : C.border }} />}
              <Pressable onPress={() => { tap(); onPick(i); }} hitSlop={8} accessibilityRole="button" accessibilityLabel={l}
                style={{ width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center",
                  backgroundColor: active ? C.navy : done ? C.teal : C.bg, borderWidth: active || done ? 0 : 1.5, borderColor: C.border }}>
                {done ? <Ionicons name="checkmark" size={16} color="#fff" />
                  : <Text style={{ fontFamily: F.bold, fontSize: 13, color: active ? "#fff" : C.muted }}>{i + 1}</Text>}
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
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
    const { data, error } = await supabase.from("contracts").select(COLS).is("hidden_at", null).order("created_at", { ascending: false }).limit(50);
    if (error) { Alert.alert("خطأ", error.message); return; }
    const rows = (data ?? []) as unknown as Saved[];
    setSaved(rows);
    setCur((c) => (c ? rows.find((r) => r.id === c.id) ?? null : c));
  }
  async function refresh() { setRefreshing(true); await load(); setRefreshing(false); }
  useEffect(() => { load(); }, []);

  function applyTemplate(t: Template) {
    setTpl(t);
    if (!langsFor(t).some((l) => l.v === outLang)) setOutLang("ar");
  }
  function pick(t: Template) { applyTemplate(t); setStep(0); setValues({}); setCur(null); }
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
      const res = await postJSON<{ id: string; status: Status }>("/api/contracts", { title, contract_type: tpl.id, language: outLang, inputs: values, prompt });
      success();
      // Verified lawyers' documents are approved immediately under their own name and licence.
      if (res.status === "approved") Alert.alert("العقد جاهز", "تم اعتماد العقد باسمك ورقم ترخيصك. افتحه من «مستنداتي» لعرضه وتنزيله.");
      else Alert.alert("تم الإرسال", "تم إرسال العقد إلى المحامي للمراجعة. ستتمكن من عرضه وتنزيله بعد اعتماده.");
      load();
    } catch (e) { Alert.alert("خطأ", (e as Error).message); }
    finally { setBusy(false); }
  }

  function remove(id: string) {
    Alert.alert("حذف المستند من قائمتك؟", "سيختفي من «مستنداتي»، وتبقى النسخة المعتمدة محفوظة في سجلات المنصة.", [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: async () => {
        const { error } = await supabase.rpc("hide_contract", { _id: id });
        if (error) { Alert.alert("خطأ", error.message); return; }
        setCur((c) => (c?.id === id ? null : c));
        load();
      } },
    ]);
  }

  function open(sv: Saved) {
    // Only builder contracts refill the builder; workflow / chat drafts just open below.
    const t = (sv.kind ?? "contract") === "contract" ? TEMPLATES.find((x) => x.id === sv.contract_type) : undefined;
    if (t) { applyTemplate(t); setValues(sv.inputs ?? {}); setStep(t.steps.length); }
    setCur(sv);
    if (sv.language) setOutLang(sv.language);
    scroll.current?.scrollTo({ y: 0, animated: true });
  }

  const approved = cur?.status === "approved" && cur.approved_body ? cur.approved_body : "";
  const stamp = cur ? stampOf(cur) : "";

  async function exportWord() {
    if (!approved || !cur) return;
    try {
      const lang = cur.language === "en" ? "en" : "ar";
      await shareDocx({ title: cur.title, markdown: approved, letterhead: await loadLetterhead(), lang, ...(stamp ? { stamp } : {}) },
        cur.title.replace(/[\s/\\:*?"<>|]+/g, "-").slice(0, 80) || "document");
    } catch (e) { Alert.alert("خطأ", (e as Error).message); }
  }

  return (
    <ScrollView ref={scroll} style={s.screen} contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.teal} colors={[C.teal]} />}>
      <ScreenHeader kicker="المملكة العربية السعودية" title="منشئ العقود السعودي" subtitle="صياغة عقود متوافقة مع الأنظمة السعودية خطوة بخطوة." />

      <SectionTitle title="اختر نوع العقد" />
      <View style={{ gap: 12 }}>
        {TEMPLATES.map((t) => {
          const on = tpl.id === t.id;
          return (
            <Pressable key={t.id} onPress={() => { tap(); pick(t); }} accessibilityRole="radio" accessibilityState={{ selected: on }}
              style={({ pressed }) => [s.card, { flexDirection: "row", alignItems: "center", gap: 14, borderWidth: 1.5, borderColor: on ? C.teal : "transparent" },
                on && { backgroundColor: C.tealTint }, pressed && { opacity: 0.9 }]}>
              <IconTile icon={t.icon} size={52} color={on ? "#fff" : C.teal} bg={on ? C.teal : undefined} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.navy, textAlign: "left" }}>{t.ar}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Ionicons name="scale-outline" size={13} color={C.muted} />
                  <Text style={[s.muted, { flex: 1 }]} numberOfLines={2}>{t.lawAr}</Text>
                </View>
              </View>
              <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={22} color={on ? C.teal : C.border} />
            </Pressable>
          );
        })}
      </View>

      <View style={[s.card, { gap: 18, padding: 18 }]}>
        <Stepper labels={[...tpl.steps.map((st) => st.ar), "الإنشاء"]} step={step} onPick={setStep} />
        <View style={{ height: 1, backgroundColor: C.border }} />

        {!last ? (
          <>
            {tpl.steps[step]!.fields.map((f) => (
              <View key={f.key} style={{ gap: 8 }}>
                <FieldLabel>{f.ar}</FieldLabel>
                {f.options ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {f.options.map((o) => (
                      <Choice key={o.v} label={o.ar} active={values[f.key] === o.v} onPress={() => set(f.key, values[f.key] === o.v ? "" : o.v)} />
                    ))}
                  </View>
                ) : (
                  <TextInput style={[s.input, { backgroundColor: C.surface, minHeight: 48 }, f.long && { minHeight: 110, textAlignVertical: "top" }]} multiline={f.long}
                    placeholderTextColor={C.muted} value={values[f.key] ?? ""} onChangeText={(v) => set(f.key, v)} />
                )}
              </View>
            ))}
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Button icon="chevron-forward" label="السابق" variant="outline" disabled={step === 0} onPress={() => setStep(step - 1)} style={{ flex: 1 }} />
              <Button label="التالي" icon="chevron-back" onPress={() => setStep(step + 1)} style={{ flex: 2 }} />
            </View>
          </>
        ) : (
          <>
            <View style={{ gap: 8 }}>
              <FieldLabel>لغة العقد</FieldLabel>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {langsFor(tpl).map((o) => <Choice key={o.v} label={o.ar} active={outLang === o.v} onPress={() => setOutLang(o.v)} />)}
              </View>
            </View>
            <Banner icon="information-circle-outline" color={C.navySoft} text="الحقول الفارغة ستظهر كفراغات [ ____ ] لتعبئتها لاحقاً." />
            <Button icon="sparkles" label="إنشاء العقد وإرساله للمراجعة" variant="teal" loading={busy} onPress={generate} />
            <Button icon="chevron-forward" label="السابق" variant="ghost" onPress={() => setStep(step - 1)} />
          </>
        )}
      </View>

      <View style={[s.card, { gap: 12, padding: 18 }]}>
        {busy ? (
          <View style={{ alignItems: "center", gap: 12, paddingVertical: 24 }}>
            <ActivityIndicator size="large" color={C.teal} />
            <Text style={[s.muted, { textAlign: "center" }]}>جارٍ إنشاء العقد وإرساله للمحامي للمراجعة…</Text>
          </View>
        ) : !cur ? (
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <IconTile icon="document-text-outline" color={C.navySoft} />
            <Text style={[s.muted, { flex: 1 }]}>بعد الإنشاء يُرسل العقد إلى محامٍ لمراجعته، ويمكنك فتحه من قائمة العقود أدناه بعد اعتماده.</Text>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Text style={{ flex: 1, fontFamily: F.bold, fontSize: 16, color: C.navy, textAlign: "left" }}>{cur.title}</Text>
              <Badge status={cur.status} />
            </View>
            {approved ? (
              <>
                {!!stamp && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1.5, borderColor: C.teal, borderRadius: R.md, padding: 12, backgroundColor: C.tealTint }}>
                    <Ionicons name="ribbon-outline" size={20} color={C.teal} />
                    <Text style={{ flex: 1, fontFamily: F.semibold, fontSize: 13, lineHeight: 21, color: C.navy, textAlign: "left" }}>{stamp}</Text>
                  </View>
                )}
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Button icon="share-outline" label="مشاركة النص" variant="outline" compact onPress={() => Share.share({ message: approved })} style={{ flex: 1 }} />
                  <Button icon="download-outline" label="Word (.docx)" compact onPress={exportWord} style={{ flex: 1 }} />
                </View>
                {/* ponytail: raw markdown text; add a markdown renderer if users ask for formatted preview */}
                <View style={{ backgroundColor: C.surface, borderRadius: R.md, padding: 14 }}>
                  <Text selectable style={[s.text, { lineHeight: 26, writingDirection: cur.language === "en" ? "ltr" : "rtl" }]}>{approved}</Text>
                </View>
              </>
            ) : cur.status === "rejected" ? (
              <>
                <Banner icon="close-circle-outline" color={C.danger} title="رفض المحامي هذا العقد."
                  text={cur.review_note ? `ملاحظة المحامي: ${cur.review_note}` : "يمكنك تعديل البيانات أعلاه وإنشاء العقد مرة أخرى."} />
                {cur.review_note ? <Text style={s.muted}>يمكنك تعديل البيانات أعلاه وإنشاء العقد مرة أخرى.</Text> : null}
              </>
            ) : (
              <Banner icon="hourglass-outline" color={C.amber} title="بانتظار مراجعة المحامي"
                text="العقد قيد مراجعة المحامي. ستتمكن من عرضه وتنزيله بعد اعتماده. اسحب الشاشة للأسفل لتحديث الحالة." />
            )}
          </>
        )}
        <Text style={[s.muted, { fontSize: 12 }]}>ميثاق ليس بديلاً عن محامٍ مرخّص. راجع العقد قبل التوقيع.</Text>
      </View>

      <SectionTitle title="مستنداتي" right={saved.length ? <Pill label={String(saved.length)} color={C.navySoft} icon="documents-outline" /> : undefined} />
      <Banner icon="shield-checkmark-outline" title="مراجعة محامٍ مرخّص لكل مستند"
        text="يراجع محامٍ مرخّص كل عقد ومسودة قبل إتاحتها. لا يمكنك عرض المستند أو تنزيله إلا بعد اعتماده." />
      {saved.length === 0 ? (
        <View style={[s.card, { alignItems: "center", gap: 10, paddingVertical: 28 }]}>
          <IconTile icon="folder-open-outline" size={56} />
          <Text style={s.muted}>لا توجد مستندات محفوظة بعد.</Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {saved.map((sv) => {
            const st = STATUS[sv.status] ?? STATUS.pending_review;
            const k = KIND[sv.kind ?? "contract"] ?? KIND.contract;
            const t = sv.kind === "contract" || !sv.kind ? TEMPLATES.find((x) => x.id === sv.contract_type) : undefined;
            return (
              <View key={sv.id} style={[s.card, { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingEnd: 8 },
                cur?.id === sv.id && { borderWidth: 1.5, borderColor: C.teal }]}>
                <Pressable style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12 }} onPress={() => { tap(); open(sv); }}>
                  <IconTile icon={t?.icon ?? k.icon} color={st.color} size={44} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={{ fontFamily: F.semibold, fontSize: 15, color: C.navy, textAlign: "left" }} numberOfLines={1}>{sv.title}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <Pill label={k.ar} color={C.navySoft} icon={k.icon} />
                      <Badge status={sv.status} />
                      <Text style={[s.muted, { fontSize: 12 }]}>{new Date(sv.created_at).toLocaleDateString("ar-SA")}</Text>
                    </View>
                  </View>
                </Pressable>
                <IconBtn icon="trash-outline" label="حذف" onPress={() => remove(sv.id)} />
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
