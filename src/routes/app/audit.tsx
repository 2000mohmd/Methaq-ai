import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { AlertTriangle, Check, Download, FileSearch, Loader2, ShieldAlert, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { downloadDocx } from "@/lib/docx-export";
import { loadLetterhead } from "@/lib/letterhead";
import { applyRedlines, splitClauses, type Clause, type Finding, type Risk } from "@/lib/legal/audit";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/audit")({
  head: () => ({ meta: [{ title: "Contract Auditor — Mithaq" }] }),
  component: AuditPage,
});

type SrcInfo = { id: number; title: string; ref: string; status: string; url: string | null };
type Result = Finding & { sources: SrcInfo[] };

const BATCH = 6;
const RISK_STYLE: Record<Risk, string> = {
  high: "border-destructive/50 bg-destructive/5",
  medium: "border-amber-500/50 bg-amber-500/5",
  low: "border-border bg-card",
  ok: "border-teal/40 bg-teal/5",
};
const RISK_LABEL: Record<Risk, { en: string; ar: string }> = {
  high: { en: "High risk", ar: "خطر مرتفع" },
  medium: { en: "Medium risk", ar: "خطر متوسط" },
  low: { en: "Low risk", ar: "خطر منخفض" },
  ok: { en: "Compliant", ar: "متوافق" },
};

function AuditPage() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [accepted, setAccepted] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  async function run(file: File) {
    setBusy(true);
    setResults([]);
    setAccepted(new Set());
    setProgress(0);
    try {
      const { extractText } = await import("@/lib/extract-text");
      const text = await extractText(file);
      const cl = splitClauses(text);
      if (cl.length === 0) throw new Error(ar ? "تعذر قراءة نص العقد" : "No readable text in this contract");
      setName(file.name.replace(/\.[^.]+$/, ""));
      setClauses(cl);
      const { data } = await supabase.auth.getSession();
      const all: Result[] = [];
      for (let i = 0; i < cl.length; i += BATCH) {
        const res = await fetch("/api/audit", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
          body: JSON.stringify({ clauses: cl.slice(i, i + BATCH), jurisdiction: "Saudi Arabia" }),
        });
        if (!res.ok) throw new Error((await res.text()) || "Audit failed");
        const j = (await res.json()) as { findings: Finding[]; sources: SrcInfo[] };
        all.push(...j.findings.map((f) => ({ ...f, sources: j.sources.filter((s) => f.basis.includes(s.id)) })));
        setResults([...all]);
        setProgress(Math.min(100, Math.round(((i + BATCH) / cl.length) * 100)));
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy(false);
  }

  const toggle = (n: number) =>
    setAccepted((s) => {
      const c = new Set(s);
      if (c.has(n)) c.delete(n);
      else c.add(n);
      return c;
    });

  const count = (r: Risk) => results.filter((x) => x.risk === r).length;

  async function exportReport() {
    const L = (en: string, a: string) => (ar ? a : en);
    const md = [
      `# ${L("Saudi Compliance Audit", "تقرير التدقيق النظامي السعودي")}`,
      `**${L("Contract", "العقد")}:** ${name}`,
      `**${L("Summary", "الملخص")}:** ${count("high")} ${L("high", "مرتفع")} / ${count("medium")} ${L("medium", "متوسط")} / ${count("low")} ${L("low", "منخفض")} / ${count("ok")} ${L("compliant", "متوافق")}`,
      ...results.flatMap((r) => [
        `## ${L("Clause", "البند")} ${r.n} — ${L(RISK_LABEL[r.risk].en, RISK_LABEL[r.risk].ar)}`,
        `**${L("Original", "النص الأصلي")}:** ${clauses.find((c) => c.n === r.n)?.text ?? ""}`,
        ...(r.issue ? [`**${L("Issue", "الملاحظة")}:** ${r.issue}`] : []),
        ...(r.sources.length ? [`**${L("Legal basis", "السند النظامي")}:** ${r.sources.map((s) => `${s.title}${s.ref ? ` (${L("Art.", "م")} ${s.ref})` : ""}`).join("; ")}`] : r.risk === "high" || r.risk === "medium" ? [`⚠ ${L("No verified library source — verify manually.", "لا يوجد مصدر موثّق في المكتبة — تحقق يدوياً.")}`] : []),
        ...(r.redline ? [`**${L("Suggested redline", "الصياغة المقترحة")}:** ${r.redline}`] : []),
      ]),
      `*${L("Mithaq is not a substitute for a licensed lawyer.", "ميثاق ليس بديلاً عن محامٍ مرخّص.")}*`,
    ].join("\n");
    await downloadDocx({ title: name, markdown: md, letterhead: await loadLetterhead(), lang }, `${name}-audit`);
  }

  async function exportRevised() {
    await downloadDocx({ title: name, markdown: applyRedlines(clauses, results, accepted), letterhead: await loadLetterhead(), lang }, `${name}-revised`);
  }

  return (
    <div className="p-4 sm:p-10">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal">{ar ? "المملكة العربية السعودية" : "Kingdom of Saudi Arabia"}</p>
      <h1 className="mt-1 text-2xl font-semibold text-navy">{ar ? "مدقق العقود والامتثال السعودي" : "Contract Redlining & Saudi Compliance Auditor"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {ar ? "ارفع أي عقد (PDF أو Word) واحصل على تدقيق بند ببند مع مخاطر نظامية وصياغات مقترحة." : "Upload any contract (PDF or Word) for a clause-by-clause Saudi risk audit with suggested redlines."}
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) run(f); e.target.value = ""; }} />
        <Button onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} {ar ? "رفع عقد" : "Upload contract"}
        </Button>
        {busy && <span className="text-sm text-muted-foreground">{progress}%</span>}
        {results.length > 0 && !busy && (
          <>
            <Button variant="outline" onClick={exportReport}><Download className="size-4" /> {ar ? "تقرير التدقيق (Word)" : "Audit report (.docx)"}</Button>
            <Button variant="outline" onClick={exportRevised} disabled={accepted.size === 0}>
              <Download className="size-4" /> {ar ? `العقد المعدّل (${accepted.size})` : `Revised contract (${accepted.size})`}
            </Button>
          </>
        )}
      </div>

      {results.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(["high", "medium", "low", "ok"] as Risk[]).map((r) => (
            <div key={r} className={cn("rounded-2xl border p-4", RISK_STYLE[r])}>
              <p className="text-xs text-muted-foreground">{ar ? RISK_LABEL[r].ar : RISK_LABEL[r].en}</p>
              <p className="mt-1 text-2xl font-semibold text-navy">{count(r)}</p>
            </div>
          ))}
        </div>
      )}

      {results.length === 0 && !busy && (
        <div className="mt-10 flex flex-col items-center gap-2 text-center text-muted-foreground">
          <FileSearch className="size-10 text-teal" />
          <p className="text-sm">{ar ? "لم يُرفع عقد بعد." : "No contract uploaded yet."}</p>
        </div>
      )}

      <ul className="mt-6 grid gap-4">
        {results.map((r) => (
          <li key={r.n} className={cn("rounded-2xl border p-4 sm:p-5", RISK_STYLE[r.risk])}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-navy">{ar ? "البند" : "Clause"} {r.n}</span>
              <span className="inline-flex items-center gap-1 text-xs font-medium">
                {r.risk === "high" ? <ShieldAlert className="size-4 text-destructive" /> : r.risk === "ok" ? <Check className="size-4 text-teal" /> : <AlertTriangle className="size-4 text-amber-600" />}
                {ar ? RISK_LABEL[r.risk].ar : RISK_LABEL[r.risk].en}
              </span>
            </div>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{clauses.find((c) => c.n === r.n)?.text}</p>
            {r.issue && <p className="mt-3 text-sm">{r.issue}</p>}
            {r.sources.length > 0 ? (
              <p className="mt-2 text-xs text-teal">
                {ar ? "السند: " : "Basis: "}
                {r.sources.map((s) => `${s.title}${s.ref ? ` — ${ar ? "م" : "Art."} ${s.ref}` : ""}${s.status === "repealed" ? (ar ? " (ملغى)" : " (repealed)") : ""}`).join("; ")}
              </p>
            ) : (
              (r.risk === "high" || r.risk === "medium") && (
                <p className="mt-2 text-xs text-amber-700">⚠ {ar ? "لا يوجد مصدر موثّق في المكتبة — تحقق يدوياً قبل الاعتماد." : "No verified library source — verify manually before relying on this."}</p>
              )
            )}
            {r.redline && (
              <div className="mt-3 rounded-xl border border-border bg-background p-3">
                <p className="text-xs font-semibold text-navy">{ar ? "الصياغة المقترحة" : "Suggested redline"}</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm">{r.redline}</p>
                <Button size="sm" variant={accepted.has(r.n) ? "default" : "outline"} className="mt-2 h-10 sm:h-8" onClick={() => toggle(r.n)}>
                  <Check className="size-4" /> {accepted.has(r.n) ? (ar ? "تم القبول" : "Accepted") : (ar ? "قبول التعديل" : "Accept redline")}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-8 text-xs italic text-muted-foreground">
        {ar ? "هذا تدقيق آلي للمساعدة فقط ويجب أن يراجعه محامٍ مرخّص قبل الاعتماد." : "Automated audit for assistance only; a licensed lawyer must review it before reliance."}
      </p>
    </div>
  );
}
