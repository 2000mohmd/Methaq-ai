import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, FileSignature, Gavel, Loader2, Mail, ScrollText, ShieldAlert, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/app/workflows")({
  head: () => ({ meta: [{ title: "Workflows — Mithaq" }] }),
  component: Workflows,
});

type WF = {
  id: string;
  icon: typeof Sparkles;
  en: string;
  ar: string;
  descEn: string;
  descAr: string;
  inputs: { key: string; en: string; ar: string; long?: boolean }[];
  prompt: (v: Record<string, string>) => string;
};

const WORKFLOWS: WF[] = [
  {
    id: "nda", icon: FileSignature, en: "Draft an NDA", ar: "صياغة اتفاقية سرية",
    descEn: "Mutual or one-way non-disclosure agreement.", descAr: "اتفاقية عدم إفصاح متبادلة أو من طرف واحد.",
    inputs: [
      { key: "a", en: "Disclosing party", ar: "الطرف المُفصح" },
      { key: "b", en: "Receiving party", ar: "الطرف المتلقي" },
      { key: "purpose", en: "Purpose & term", ar: "الغرض والمدة", long: true },
    ],
    prompt: (v) => `Draft a complete non-disclosure agreement between ${v["a"]} (disclosing) and ${v["b"]} (receiving). Purpose and term: ${v["purpose"]}. Include governing law and dispute resolution clauses.`,
  },
  {
    id: "demand", icon: Mail, en: "Demand letter", ar: "خطاب مطالبة",
    descEn: "Formal payment or performance demand.", descAr: "مطالبة رسمية بالسداد أو التنفيذ.",
    inputs: [
      { key: "to", en: "Recipient", ar: "المرسل إليه" },
      { key: "amount", en: "Amount / obligation", ar: "المبلغ أو الالتزام" },
      { key: "facts", en: "Facts", ar: "الوقائع", long: true },
    ],
    prompt: (v) => `Draft a formal legal demand letter to ${v["to"]} regarding: ${v["amount"]}. Facts: ${v["facts"]}. Set a clear deadline and state consequences of non-compliance.`,
  },
  {
    id: "review", icon: ShieldAlert, en: "Contract risk checklist", ar: "قائمة مخاطر العقد",
    descEn: "Paste a clause or contract, get a risk table.", descAr: "الصق بنداً أو عقداً واحصل على جدول مخاطر.",
    inputs: [
      { key: "side", en: "You represent", ar: "تمثّل الطرف" },
      { key: "text", en: "Contract text", ar: "نص العقد", long: true },
    ],
    prompt: (v) => `Acting for ${v["side"]}, review this contract and output a markdown table of risks (clause, risk, severity, suggested redline), then a short summary.\n\n${v["text"]}`,
  },
  {
    id: "memo", icon: ScrollText, en: "Legal memo", ar: "مذكرة قانونية",
    descEn: "Issue, rule, analysis, conclusion.", descAr: "المسألة، القاعدة، التحليل، الخلاصة.",
    inputs: [
      { key: "q", en: "Legal question", ar: "المسألة القانونية" },
      { key: "facts", en: "Facts", ar: "الوقائع", long: true },
    ],
    prompt: (v) => `Write a legal memorandum in IRAC format on: ${v["q"]}. Facts: ${v["facts"]}. Cite relevant laws where possible and flag uncertainty.`,
  },
  {
    id: "hearing", icon: Gavel, en: "Hearing preparation", ar: "التحضير للجلسة",
    descEn: "Arguments, likely questions, evidence list.", descAr: "الحجج والأسئلة المتوقعة وقائمة الأدلة.",
    inputs: [
      { key: "case", en: "Case summary", ar: "ملخص القضية", long: true },
      { key: "court", en: "Court", ar: "المحكمة" },
    ],
    prompt: (v) => `Prepare a hearing brief for ${v["court"]}. Case: ${v["case"]}. Include key arguments, anticipated counter-arguments, likely questions from the judge, and an evidence checklist.`,
  },
];

function Workflows() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [active, setActive] = useState<WF>(WORKFLOWS[0]!);
  const [values, setValues] = useState<Record<string, string>>({});
  // Documents are never shown straight to the user: they go to a licensed lawyer first (or are stamped by a verified lawyer-user).
  const [sent, setSent] = useState<"pending_review" | "approved" | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    if (active.inputs.some((i) => !values[i.key]?.trim())) {
      toast.error(ar ? "أكمل جميع الحقول" : "Fill in all fields");
      return;
    }
    setSent(null);
    setBusy(true);
    try {
      const prompt = `${active.prompt(values)}\nJurisdiction: Kingdom of Saudi Arabia.${ar ? "\n\nRespond in Arabic." : ""}`;
      const subject = (values[active.inputs[0]!.key] ?? "").trim().slice(0, 60);
      const title = `${ar ? active.ar : active.en}${subject ? ` — ${subject}` : ""}`;
      const { data } = await supabase.auth.getSession();
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token}` },
        body: JSON.stringify({ kind: "workflow", title, contract_type: active.id, language: ar ? "ar" : "en", inputs: values, prompt }),
      });
      if (!res.ok) throw new Error((await res.text()) || "AI error");
      const json = (await res.json().catch(() => ({}))) as { status?: string };
      setSent(json.status === "approved" ? "approved" : "pending_review");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 sm:p-10">
      <h1 className="text-2xl font-semibold text-navy">{ar ? "سير العمل" : "Workflows"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {ar ? "مهام قانونية جاهزة ينفذها ميثاق خطوة بخطوة." : "Ready-made legal tasks Mithaq runs for you."}
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {WORKFLOWS.map((w) => (
          <button
            key={w.id}
            onClick={() => { setActive(w); setValues({}); setSent(null); }}
            className={`rounded-2xl border p-4 text-start transition-colors ${active.id === w.id ? "border-teal bg-teal/5" : "border-border bg-card hover:border-teal/50"}`}
          >
            <w.icon className="size-5 text-teal" />
            <p className="mt-3 text-sm font-semibold text-navy">{ar ? w.ar : w.en}</p>
            <p className="mt-1 text-xs text-muted-foreground">{ar ? w.descAr : w.descEn}</p>
          </button>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div className="grid content-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5">
          <p className="text-xs font-semibold text-teal">{ar ? "المملكة العربية السعودية" : "Kingdom of Saudi Arabia"}</p>
          {active.inputs.map((i) => (
            <label key={i.key} className="grid gap-1 text-sm">
              <span>{ar ? i.ar : i.en}</span>
              {i.long ? (
                <Textarea rows={5} value={values[i.key] ?? ""} onChange={(e) => setValues({ ...values, [i.key]: e.target.value })} />
              ) : (
                <Input value={values[i.key] ?? ""} onChange={(e) => setValues({ ...values, [i.key]: e.target.value })} />
              )}
            </label>
          ))}
          <Button onClick={run} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} {ar ? "تشغيل" : "Run workflow"}
          </Button>
        </div>

        <div className="min-h-64 rounded-2xl border border-border bg-card p-4 sm:p-6">
          {busy ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> {ar ? "جارٍ إعداد المستند وإرساله للمراجعة…" : "Preparing the document and sending it for review…"}</p>
          ) : sent ? (
            <div className="grid gap-3 text-sm">
              <p className="flex items-start gap-2 font-medium text-navy">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-teal" />
                {sent === "approved"
                  ? (ar ? "المستند جاهز ومعتمد باسمك في «مستنداتي»." : "The document is ready and approved under your name in My documents.")
                  : (ar ? "أُرسل المستند إلى محامٍ مرخّص للمراجعة. ستتمكن من عرضه وتنزيله بعد اعتماده." : "Sent to a licensed lawyer for review. You can view and download it once approved.")}
              </p>
              <Button asChild variant="outline" className="h-10 w-fit"><Link to="/app/contracts">{ar ? "مستنداتي" : "My documents"}</Link></Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{ar ? "بعد التشغيل يُرسل المستند إلى محامٍ مرخّص للمراجعة، ثم يظهر في «مستنداتي» بعد اعتماده." : "After running, the document goes to a licensed lawyer for review and appears in My documents once approved."}</p>
          )}
          <p className="mt-6 text-xs text-muted-foreground italic">
            {ar ? "ميثاق ليس بديلاً عن محامٍ مرخّص." : "Mithaq is not a substitute for a licensed lawyer."}
          </p>
        </div>
      </div>
    </div>
  );
}
