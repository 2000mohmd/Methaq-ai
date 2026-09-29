// Browser-only: extracts plain text from PDF, Word or text files.
// Scanned PDFs (no text layer) and images are read with AI OCR.
import { supabase } from "@/integrations/supabase/client";

async function ocr(images: string[]): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const out: string[] = [];
  for (let i = 0; i < images.length; i += 6) {
    const res = await fetch("/api/ocr", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
      body: JSON.stringify({ images: images.slice(i, i + 6) }),
    });
    if (!res.ok) throw new Error(await res.text());
    out.push(((await res.json()) as { text: string }).text);
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

export async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) {
    const pdfjs = await import("pdfjs-dist");
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages: string[] = [];
    const total = Math.min(doc.numPages, 80);
    for (let i = 1; i <= total; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map((it) => ("str" in it ? it.str : "")).join(" "));
    }
    const text = pages.join("\n\n");
    if (text.replace(/\s/g, "").length > 20 * total) return text;
    // Scanned PDF: render up to 24 pages to images and OCR them.
    const images: string[] = [];
    for (let i = 1; i <= Math.min(total, 24); i++) {
      const page = await doc.getPage(i);
      const vp = page.getViewport({ scale: 1.6 });
      const canvas = document.createElement("canvas");
      canvas.width = vp.width;
      canvas.height = vp.height;
      await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport: vp } as never).promise;
      images.push(canvas.toDataURL("image/jpeg", 0.8));
    }
    return ocr(images);
  }
  if (/\.(png|jpe?g|webp)$/.test(name)) return ocr([await fileToDataUrl(file)]);
  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const res = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return res.value;
  }
  return file.text();
}
