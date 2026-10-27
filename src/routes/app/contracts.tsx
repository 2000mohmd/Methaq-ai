import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Briefcase, Check, Copy, Download, FileSignature, Handshake, Loader2, Printer, Sparkles, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { downloadDocx } from "@/lib/docx-export";
import { loadLetterhead } from "@/lib/letterhead";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/app/contracts")({
  head: () => ({ meta: [{ title: "Saudi Contract Builder — Mithaq" }] }),
  component: ContractsPage,
});

type Field = { key: string; en: string; ar: string; long?: boolean; options?: { v: string; en: string; ar: string }[] };
type Step = { en: string; ar: string; fields: Field[] };
type Template = {
  id: string; icon: typeof Sparkles; en: string; ar: string; lawEn: string; lawAr: string;
  steps: Step[]; rules: string;
};

const DISPUTE: Field = {
  key: "dispute", en: "Dispute resolution", ar: "تسوية المنازعات",
  options: [
    { v: "Saudi courts (competent court in the city of the contract)", en: "Saudi courts", ar: "المحاكم السعودية" },
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
    id: "employment", icon: Briefcase, en: "Employment Contract", ar: "عقد عمل",
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
    id: "services", icon: Handshake, en: "Services Agreement", ar: "عقد تقديم خدمات",
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
    id: "nda", icon: FileSignature, en: "Non-Disclosure Agreement", ar: "اتفاقية عدم إفصاح",
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

type Status = "pending_review" | "approved" | "rejected";
type Kind = "contract" | "workflow" | "chat_draft";
type Saved = {
  id: string; kind: Kind; title: string; contract_type: string; language: string; inputs: Record<string, string>; status: Status;
  approved_body: string | null; review_note: string | null; reviewer_name: string | null; reviewer_licence: string | null;
  reviewed_at: string | null; created_at: string;
};

const KIND: Record<Kind, { ar: string; en: string }> = {
  contract: { ar: "عقد", en: "Contract" },
  workflow: { ar: "سير عمل", en: "Workflow" },
  chat_draft: { ar: "مسودة من المحادثة", en: "Chat draft" },
};

/** Approval stamp shown on screen and carried into Word / Print. */
function stampText(s: Saved, en: boolean): string {
  if (s.status !== "approved" || !s.reviewer_name) return "";
  const date = s.reviewed_at ? new Date(s.reviewed_at).toLocaleDateString(en ? "en-GB" : "ar-SA") : "";
  return en
    ? `Approved by: ${s.reviewer_name} — Licence no. ${s.reviewer_licence ?? "—"}${date ? ` — ${date}` : ""}`
    : `اعتمده: ${s.reviewer_name} — ترخيص رقم ${s.reviewer_licence ?? "—"}${date ? ` — ${date}` : ""}`;
}

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const STATUS: Record<Status, { ar: string; en: string; cls: string }> = {
  pending_review: { ar: "قيد مراجعة المحامي", en: "Awaiting lawyer review", cls: "bg-amber-100 text-amber-800" },
  approved: { ar: "معتمد", en: "Approved", cls: "bg-teal/10 text-teal" },
  rejected: { ar: "مرفوض", en: "Rejected", cls: "bg-destructive/10 text-destructive" },
};

function ContractsPage() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [tpl, setTpl] = useState<Template>(TEMPLATES[0]!);
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [outLang, setOutLang] = useState<"ar" | "en" | "both">("ar");
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [viewing, setViewing] = useState<Saved | null>(null);

  async function load() {
    // Never select the AI draft (body): clients only see approved_body once a lawyer approves (per-instance review).
    const { data } = await supabase.from("contracts")
      .select("id,kind,title,contract_type,language,inputs,status,approved_body,review_note,reviewer_name,reviewer_licence,reviewed_at,created_at")
      .is("hidden_at", null).order("created_at", { ascending: false }).limit(50);
    setSaved((data ?? []) as unknown as Saved[]);
  }
  useEffect(() => { load(); }, []);

  function pick(t: Template) {
    setTpl(t); setStep(0); setValues({}); setOut(""); setViewing(null);
    // Employment contracts are Arabic or bilingual (Arabic prevails) — never English-only.
    if (t.id === "employment" && outLang === "en") setOutLang("ar");
  }

  const last = step === tpl.steps.length;

  async function generate() {
    setOut(""); setViewing(null); setBusy(true);
    const details = tpl.steps.flatMap((s) => s.fields).map((f) => `- ${f.en}: ${values[f.key]?.trim() || "[to be completed]"}`).join("\n");
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
    const title = `${ar ? tpl.ar : tpl.en}${firstParty ? ` — ${firstParty}` : ""}`;
    try {
      // Generated and stored server-side; the draft goes to a lawyer, not back to the browser.
      const { data } = await supabase.auth.getSession();
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token}` },
        body: JSON.stringify({ kind: "contract", title, contract_type: tpl.id, language: outLang, inputs: values, prompt }),
      });
      if (!res.ok) throw new Error((await res.text()) || "AI error");
      toast.success(ar ? "أُرسل العقد إلى المحامي للمراجعة. ستتمكن من عرضه وتنزيله بعد اعتماده." : "Sent to our lawyer for review. You can view and download it once approved.");
      load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  async function hide(id: string) {
    if (!window.confirm(ar ? "إخفاء من القائمة؛ تبقى نسخة الاعتماد محفوظة." : "Hide from your list? The approved record is kept.")) return;
    const { error } = await supabase.rpc("hide_contract", { _id: id });
    if (error) { toast.error(error.message); return; }
    if (id === viewing?.id) { setViewing(null); setOut(""); }
    load();
  }

  function open(s: Saved) {
    // Workflow / chat drafts have no builder template: just show the document.
    const t = s.kind === "contract" ? TEMPLATES.find((x) => x.id === s.contract_type) : undefined;
    if (t) { setTpl(t); setValues(s.inputs ?? {}); setStep(t.steps.length); }
    setViewing(s); setOutLang((s.language as "ar" | "en" | "both") ?? "ar");
    setOut(s.status === "approved" ? s.approved_body ?? "" : "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const docTitle = viewing?.title ?? tpl.en;
  const stamp = viewing ? stampText(viewing, outLang === "en") : "";

  async function exportWord() {
    await downloadDocx(
      { title: docTitle, markdown: out, letterhead: await loadLetterhead(), lang: outLang === "en" ? "en" : "ar", ...(stamp ? { stamp } : {}) },
      docTitle.replace(/\s+/g, "-"),
    );
  }

  function print() {
    const w = window.open("", "_blank");
    if (!w) return;
    const html = document.getElementById("contract-output")?.innerHTML ?? "";
    w.document.write(`<html dir="${outLang === "en" ? "ltr" : "rtl"}"><head><title>${esc(docTitle)}</title><style>body{font-family:'IBM Plex Sans Arabic','Nunito Sans',sans-serif;max-width:800px;margin:40px auto;line-height:1.8;padding:0 24px}h1,h2,h3{margin-top:1.2em}.stamp{margin-top:32px;border:1.5px solid #1F3A5F;padding:10px 14px;text-align:center;font-weight:600}</style></head><body>${html}${stamp ? `<div class="stamp">${esc(stamp)}</div>` : ""}</body></html>`);
    w.document.close(); w.focus(); w.print();
  }

  return (
    <div className="p-4 sm:p-10">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal">{ar ? "المملكة العربية السعودية" : "Kingdom of Saudi Arabia"}</p>
      <h1 className="mt-1 text-2xl font-semibold text-navy">{ar ? "منشئ العقود السعودي" : "Saudi Contract Builder"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {ar ? "صياغة عقود متوافقة مع الأنظمة السعودية خطوة بخطوة." : "Draft contracts compliant with Saudi law, step by step."}
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {TEMPLATES.map((t) => (
          <button key={t.id} onClick={() => pick(t)}
            className={`rounded-2xl border p-4 text-start transition-colors ${tpl.id === t.id ? "border-teal bg-teal/5" : "border-border bg-card hover:border-teal/50"}`}>
            <t.icon className="size-5 text-teal" />
            <p className="mt-3 text-sm font-semibold text-navy">{ar ? t.ar : t.en}</p>
            <p className="mt-1 text-xs text-muted-foreground">{ar ? t.lawAr : t.lawEn}</p>
          </button>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        <div className="grid content-start gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5">
          <ol className="flex flex-wrap gap-2">
            {[...tpl.steps, { en: "Generate", ar: "الإنشاء" }].map((s, i) => (
              <li key={i}>
                <button onClick={() => setStep(i)}
                  className={`flex min-h-9 items-center gap-1 rounded-full px-3 py-1 text-xs sm:min-h-0 ${i === step ? "bg-navy text-primary-foreground" : i < step ? "bg-teal/10 text-teal" : "bg-muted text-muted-foreground"}`}>
                  {i < step && <Check className="size-3" />}{ar ? s.ar : s.en}
                </button>
              </li>
            ))}
          </ol>

          {!last ? (
            <>
              {tpl.steps[step]!.fields.map((f) => (
                <label key={f.key} className="grid gap-1 text-sm">
                  <span>{ar ? f.ar : f.en}</span>
                  {f.options ? (
                    <select className="h-10 min-w-0 rounded-lg border border-input bg-background px-3 text-base sm:text-sm" value={values[f.key] ?? ""}
                      onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}>
                      <option value="">—</option>
                      {f.options.map((o) => <option key={o.v} value={o.v}>{ar ? o.ar : o.en}</option>)}
                    </select>
                  ) : f.long ? (
                    <Textarea rows={4} value={values[f.key] ?? ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
                  ) : (
                    <Input value={values[f.key] ?? ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
                  )}
                </label>
              ))}
              <div className="flex justify-between">
                <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>{ar ? "السابق" : "Back"}</Button>
                <Button onClick={() => setStep(step + 1)}>{ar ? "التالي" : "Next"}</Button>
              </div>
            </>
          ) : (
            <>
              <label className="grid gap-1 text-sm">
                <span>{ar ? "لغة العقد" : "Contract language"}</span>
                <select className="h-10 rounded-lg border border-input bg-background px-3 text-base sm:text-sm" value={outLang} onChange={(e) => setOutLang(e.target.value as "ar" | "en" | "both")}>
                  <option value="ar">{ar ? "العربية" : "Arabic"}</option>
                  <option value="both">{ar ? "ثنائي اللغة" : "Bilingual (AR / EN)"}</option>
                  {tpl.id !== "employment" && <option value="en">{ar ? "الإنجليزية" : "English"}</option>}
                </select>
              </label>
              {tpl.id === "employment" && (
                <p className="text-xs text-muted-foreground">{ar ? "عقد العمل بالعربية أو ثنائي اللغة، والنص العربي هو المعتمد." : "Employment contracts are Arabic or bilingual; the Arabic text prevails."}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {ar ? "الحقول الفارغة ستظهر كفراغات [ ____ ] لتعبئتها لاحقاً." : "Empty fields will appear as [ ____ ] blanks to fill later."}
              </p>
              <Button onClick={generate} disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} {ar ? "إنشاء العقد" : "Generate contract"}
              </Button>
              <Button variant="ghost" onClick={() => setStep(step - 1)}>{ar ? "السابق" : "Back"}</Button>
            </>
          )}
        </div>

        <div className="min-h-64 min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-6">
          {out ? (
            <>
              <div className="mb-3 flex flex-wrap justify-end gap-1 [&>button]:h-10 sm:[&>button]:h-8">
                <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(out); toast.success(ar ? "تم النسخ" : "Copied"); }}>
                  <Copy className="size-4" /> {ar ? "نسخ" : "Copy"}
                </Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={exportWord}><Download className="size-4" /> {ar ? "Word (.docx)" : "Word (.docx)"}</Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={print}><Printer className="size-4" /> {ar ? "طباعة / PDF" : "Print / PDF"}</Button>
              </div>
              {stamp && <p className="mb-3 rounded-lg border border-teal/40 bg-teal/5 px-3 py-2 text-center text-xs font-semibold text-navy">{stamp}</p>}
              <div id="contract-output" dir={outLang === "en" ? "ltr" : "rtl"}
                className="break-words text-sm leading-loose [&_table]:block [&_table]:overflow-x-auto [&_h1]:mt-4 [&_h1]:text-center [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:font-semibold [&_li]:ms-5 [&_ol]:list-decimal [&_p]:my-2 [&_ul]:list-disc">
                <ReactMarkdown>{out}</ReactMarkdown>
              </div>
            </>
          ) : busy ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> {ar ? "جارٍ إنشاء العقد وإرساله للمحامي للمراجعة…" : "Drafting and sending to our lawyer for review…"}</p>
          ) : viewing?.status === "pending_review" ? (
            <p className="text-sm text-amber-800">{ar ? "هذا المستند قيد مراجعة محامٍ مرخّص. ستتمكن من عرضه وتنزيله بعد اعتماده." : "This document is with a licensed lawyer for review. You can view and download it once approved."}</p>
          ) : viewing?.status === "rejected" ? (
            <div className="text-sm">
              <p className="font-medium text-destructive">{ar ? "لم يعتمد المحامي هذا المستند." : "The lawyer did not approve this document."}</p>
              {viewing.review_note && <p className="mt-2 whitespace-pre-wrap">{viewing.review_note}</p>}
              <p className="mt-2 text-muted-foreground">{ar ? "عدّل البيانات وأنشئه من جديد." : "Adjust the details and generate again."}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{ar ? "بعد الإنشاء يُرسل العقد إلى محامينا للمراجعة، ثم يظهر هنا بعد اعتماده." : "After generating, the contract goes to our lawyer for review and appears here once approved."}</p>
          )}
          <p className="mt-6 text-xs italic text-muted-foreground">
            {ar ? "ميثاق ليس بديلاً عن محامٍ مرخّص. راجع العقد قبل التوقيع." : "Mithaq is not a substitute for a licensed lawyer. Review before signing."}
          </p>
        </div>
      </div>

      <h2 className="mt-10 text-lg font-semibold text-navy">{ar ? "مستنداتي" : "My documents"}</h2>
      {saved.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{ar ? "لا توجد مستندات بعد." : "No documents yet."}</p>
      ) : (
        <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card">
          {saved.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <button className="grid min-w-0 gap-0.5 break-words py-1 text-start" onClick={() => open(s)}>
                <span className="text-sm font-medium text-navy hover:text-teal">{s.title}</span>
                <span className="text-xs text-muted-foreground">{ar ? KIND[s.kind]?.ar ?? s.kind : KIND[s.kind]?.en ?? s.kind}</span>
              </button>
              <div className="flex shrink-0 items-center gap-1 sm:gap-3">
                <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS[s.status].cls}`}>{ar ? STATUS[s.status].ar : STATUS[s.status].en}</span>
                <span className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString(ar ? "ar-SA" : "en-GB")}</span>
                <button aria-label={ar ? "إخفاء" : "Hide"} title={ar ? "إخفاء" : "Hide"} onClick={() => hide(s.id)} className="-me-2 p-2.5 text-muted-foreground hover:text-destructive"><EyeOff className="size-4" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
