import { useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";

const JURIS = ["Saudi Arabia", "UAE", "Qatar", "Kuwait", "Bahrain", "Oman", "Egypt", "Jordan", "Lebanon"];

/** Imports one official law file (PDF/DOCX/TXT) into the library; articles are split at query time. */
export function LawImport({ onDone }: { onDone: () => void }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [title, setTitle] = useState("");
  const [juris, setJuris] = useState("Saudi Arabia");
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("in_force");
  const [busy, setBusy] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [progress, setProgress] = useState("");

  async function run(file: File) {
    if (!title || !url) {
      toast.error(ar ? "العنوان ورابط المصدر الرسمي مطلوبان" : "Title and official source link are required");
      return;
    }
    setBusy(true);
    try {
      const { extractText } = await import("@/lib/extract-text");
      const content = (
        await extractText(file, {
          maxPages: 300,
          maxOcrPages: 200,
          ...(from ? { fromPage: Number(from) } : {}),
          ...(to ? { toPage: Number(to) } : {}),
          onProgress: setProgress,
        })
      ).trim();
      if (!content) throw new Error(ar ? "تعذر قراءة نص الملف" : "No readable text in this file");
      const { data: u } = await supabase.auth.getUser();
      const { data: p } = await supabase.from("profiles").select("organization_id").eq("id", u.user!.id).single();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("library_items")
        .insert({ organization_id: p?.organization_id ?? null, title, jurisdiction: juris, category: "law", source_url: url, status, content });
      if (error) throw error;
      toast.success(ar ? "تم استيراد النظام" : "Law imported");
      setTitle("");
      setUrl("");
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy(false);
    setProgress("");
  }

  return (
    <div className="mx-6 mt-6 rounded-2xl border border-border bg-card p-5 shadow-soft sm:mx-10">
      <p className="text-sm font-semibold text-navy">{ar ? "استيراد نظام رسمي" : "Import an official law"}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {ar ? "ارفع ملف النظام من المصدر الرسمي (هيئة الخبراء / أم القرى). يُقسَّم تلقائياً إلى مواد." : "Upload the law file from the official source (Bureau of Experts / Umm Al-Qura). It is split into articles automatically."}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Input placeholder={ar ? "اسم النظام" : "Law name"} value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input placeholder={ar ? "رابط المصدر الرسمي" : "Official source URL"} value={url} onChange={(e) => setUrl(e.target.value)} />
        <select value={juris} onChange={(e) => setJuris(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-2 text-sm">
          {JURIS.map((j) => <option key={j}>{j}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-2 text-sm">
          {["in_force", "amended", "repealed"].map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span>{ar ? "نطاق الصفحات (اختياري):" : "Page range (optional):"}</span>
        <Input className="w-20" inputMode="numeric" placeholder={ar ? "من" : "from"} value={from} onChange={(e) => setFrom(e.target.value.replace(/\D/g, ""))} />
        <Input className="w-20" inputMode="numeric" placeholder={ar ? "إلى" : "to"} value={to} onChange={(e) => setTo(e.target.value.replace(/\D/g, ""))} />
      </div>
      {progress && <p className="mt-2 text-xs text-teal">{progress}</p>}
      <label className="mt-3 inline-block">
        <input type="file" accept=".pdf,.docx,.txt" hidden disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) run(f); e.target.value = ""; }} />
        <Button asChild variant="outline" disabled={busy}>
          <span>{busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} {ar ? "اختر ملفاً" : "Choose file"}</span>
        </Button>
      </label>
    </div>
  );
}
