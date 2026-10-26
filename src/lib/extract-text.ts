// Browser-only: extracts plain text from PDF, Word or text files.
// Scanned PDFs (no text layer) and images are read with AI OCR.
import { supabase } from "@/integrations/supabase/client";
import { isCorruptArabic } from "@/lib/legal/textquality";

export type ExtractOpts = {
  maxPages?: number; // text-layer pages to read (default 80)
  maxOcrPages?: number; // pages to OCR when the text layer is missing or corrupt (default 24)
  fromPage?: number; // 1-based, optional page range
  toPage?: number;
  onProgress?: (msg: string) => void;
};

async function ocr(images: string[], onProgress?: (msg: string) => void): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const out: string[] = [];
  const BATCH = 4;
  for (let i = 0; i < images.length; i += BATCH) {
    onProgress?.(`OCR ${Math.min(i + BATCH, images.length)} / ${images.length}`);
    for (let attempt = 0; ; attempt++) {
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
        body: JSON.stringify({ images: images.slice(i, i + BATCH) }),
      });
      if (res.status === 429 && attempt < 6) {
        await new Promise((r) => setTimeout(r, 15000)); // rate limit: wait and retry
        continue;
      }
      if (!res.ok) throw new Error(await res.text());
      out.push(((await res.json()) as { text: string }).text);
      break;
    }
  }
  return out.join("\n\n");
}

const fileToDataUrl = (file: File) =>
  new Promise<string>((ok, fail) => {
    const r = new FileReader();
    r.onload = () => ok(r.result as string);
    r.onerror = fail;
    r.readAsDataURL(file);
  });

export async function extractText(file: File, opts: ExtractOpts = {}): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) {
    const pdfjs = await import("pdfjs-dist");
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const from = Math.max(1, opts.fromPage ?? 1);
    const to = Math.min(doc.numPages, opts.toPage ?? doc.numPages, from + (opts.maxPages ?? 80) - 1);
    const pageNumbers = Array.from({ length: Math.max(0, to - from + 1) }, (_, k) => from + k);
    const pages: string[] = [];
    for (const i of pageNumbers) {
      opts.onProgress?.(`Reading page ${i} / ${to}`);
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map((it) => ("str" in it ? it.str : "")).join(" "));
    }
    const text = pages.join("\n\n");
    const hasText = text.replace(/\s/g, "").length > 20 * pageNumbers.length;
    if (hasText && !isCorruptArabic(text)) return text;
    // Scanned PDF or corrupted Arabic text layer: render the pages to images and OCR them.
    opts.onProgress?.("Text layer unusable, switching to OCR");
    const images: string[] = [];
    for (const i of pageNumbers.slice(0, opts.maxOcrPages ?? 24)) {
      opts.onProgress?.(`Rendering page ${i} / ${to}`);
      const page = await doc.getPage(i);
      const vp = page.getViewport({ scale: 1.6 });
      const canvas = document.createElement("canvas");
      canvas.width = vp.width;
      canvas.height = vp.height;
      await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport: vp } as never).promise;
      images.push(canvas.toDataURL("image/jpeg", 0.8));
    }
    return ocr(images, opts.onProgress);
  }
  if (/\.(png|jpe?g|webp)$/.test(name)) return ocr([await fileToDataUrl(file)]);
  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const res = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return res.value;
  }
  return file.text();
}
