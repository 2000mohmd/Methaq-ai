import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Download, FileText, Loader2, Sparkles, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { HexPattern } from "@/components/brand/HexPattern";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { streamAI } from "@/lib/ai-stream";

export const Route = createFileRoute("/app/documents")({
  head: () => ({ meta: [{ title: "Documents — Mithaq eFirm" }] }),
  component: DocumentsPage,
});

type Doc = {
  id: string;
  name: string;
  storage_path: string;
  size_bytes: number | null;
  extracted_text: string | null;
  analysis: string | null;
  created_at: string;
};

const ANALYSES = [
  { id: "summary", en: "Summarise", ar: "تلخيص", prompt: "Summarise this document: parties, purpose, key obligations, dates, amounts." },
  { id: "risks", en: "Risk review", ar: "مراجعة المخاطر", prompt: "Review this document for legal risks. List each risk with severity (High/Medium/Low), the clause quoted, and a suggested redline." },
  { id: "clauses", en: "Key clauses", ar: "البنود الرئيسية", prompt: "Extract key clauses (term, termination, liability, indemnity, governing law, dispute resolution, confidentiality, payment) in a table-like list." },
];

function DocumentsPage() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [docs, setDocs] = useState<Doc[]>([]);
  const [sel, setSel] = useState<Doc | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
    });
  }, []);

  const upload = async (file: File) => {
    if (!orgId) { toast.error(ar ? "أكمل إعداد الحساب أولاً" : "Finish onboarding first"); return; }
    setUploading(true);
    try {
      const path = `${orgId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, file);
      if (upErr) throw upErr;
      let text = "";
      try {
        const { extractText } = await import("@/lib/extract-text");
        text = (await extractText(file)).slice(0, 200000);
      } catch {
        toast.message(ar ? "تعذر استخراج النص من هذا الملف" : "Could not read text from this file");
      }
      const { data, error } = await supabase
        .from("documents")
        .insert({ organization_id: orgId, name: file.name, storage_path: path, mime_type: file.type, size_bytes: file.size, extracted_text: text })
        .select("*")
        .single();
      if (error) throw error;
      await load();
      setSel(data as Doc);
    } catch (e) {
      toast.error((e as Error).message);
    }
    setUploading(false);
  };

  const analyze = async (a: (typeof ANALYSES)[number]) => {
    if (!sel?.extracted_text) { toast.error(ar ? "لا يوجد نص قابل للتحليل" : "No readable text in this document"); return; }
    setAnalyzing(true);
    let acc = "";
    const doc = sel;
    try {
      await streamAI(
        [{ role: "user", content: `${a.prompt}\nRespond in ${ar ? "Arabic" : "English"}.\n\nDOCUMENT "${doc.name}":\n${doc.extracted_text!.slice(0, 60000)}` }],
        { mode: "document analysis" },
        (d) => {
          acc += d;
          setSel({ ...doc, analysis: acc });
        },
      );
      await supabase.from("documents").update({ analysis: acc }).eq("id", doc.id);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
    setAnalyzing(false);
  };

  const download = async (d: Doc) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(d.storage_path, 60);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, "_blank");
  };

  const remove = async (d: Doc) => {
    await supabase.storage.from("documents").remove([d.storage_path]);
    const { error } = await supabase.from("documents").delete().eq("id", d.id);
    if (error) { toast.error(error.message); return; }
    if (sel?.id === d.id) setSel(null);
    load();
  };

  return (
    <div className="p-6 sm:p-10">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-navy">{ar ? "المستندات" : "Documents"}</h1>
        <input ref={fileRef} type="file" hidden accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
        <Button className="ms-auto" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {ar ? "رفع مستند" : "Upload document"}
        </Button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{ar ? "PDF أو Word أو نص — حتى 20 ميغابايت" : "PDF, Word or text — up to 20MB"}</p>

      {docs.length === 0 ? (
        <div className="relative mt-6 overflow-hidden rounded-2xl border border-border bg-navy-tint">
          <HexPattern className="text-navy" opacity={0.06} />
          <div className="relative max-w-md px-8 py-16">
            <FileText className="size-6 text-teal" />
            <p className="mt-4 text-muted-foreground">{ar ? "ارفع عقداً أو حكماً أو مذكرة ليحللها ميثاق." : "Upload a contract, judgment or memo and let Mithaq analyse it."}</p>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="space-y-2">
            {docs.map((d) => (
              <div key={d.id} className={cn("group flex items-center gap-2 rounded-xl border p-3 text-sm", sel?.id === d.id ? "border-teal bg-teal/5" : "border-border bg-card")}>
                <FileText className="size-4 shrink-0 text-teal" />
                <button className="flex-1 truncate text-start" onClick={() => setSel(d)}>{d.name}</button>
                <button onClick={() => download(d)} aria-label="Download"><Download className="size-4 text-muted-foreground" /></button>
                <button onClick={() => remove(d)} aria-label="Delete"><Trash2 className="size-4 text-muted-foreground hover:text-destructive" /></button>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            {!sel ? (
              <p className="text-muted-foreground">{ar ? "اختر مستنداً" : "Select a document"}</p>
            ) : (
              <>
                <h2 className="font-semibold text-navy">{sel.name}</h2>
                <p className="text-xs text-muted-foreground">
                  {sel.extracted_text ? `${sel.extracted_text.length.toLocaleString()} ${ar ? "حرف مستخرج" : "characters extracted"}` : ar ? "لا يوجد نص" : "No text extracted"}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {ANALYSES.map((a) => (
                    <Button key={a.id} variant="outline" size="sm" disabled={analyzing} onClick={() => analyze(a)}>
                      <Sparkles className="size-3.5 text-teal" /> {ar ? a.ar : a.en}
                    </Button>
                  ))}
                </div>
                <div className="mt-6 whitespace-pre-wrap text-sm leading-relaxed">
                  {sel.analysis || (analyzing ? <Loader2 className="size-4 animate-spin text-teal" /> : <span className="text-muted-foreground">{ar ? "اختر نوع التحليل." : "Choose an analysis to run."}</span>)}
                </div>
                <p className="mt-6 text-[11px] text-muted-foreground">{ar ? "ليس بديلاً عن محامٍ مرخّص." : "Not a substitute for a licensed lawyer."}</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
