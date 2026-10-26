// Turn one OFFICIAL law file into SQL for the shared corpus.
//
//   node scripts/law-to-sql.mjs <file.txt|.docx|.pdf> --title "نظام الأحوال الشخصية" --url "https://..." \
//        [--kind law|regulation] [--status in_force|amended|repealed] [--issued "1443/..."] [--out law.sql]
//
// Prints a quality report, writes the SQL file, and copies nothing anywhere else. Then paste the SQL into the
// Supabase SQL editor and run it once. Prefer the .docx or .txt version of an official file; some PDFs have a
// broken Arabic text layer and the script refuses them.
import { readFileSync, writeFileSync } from "node:fs";
import { extname } from "node:path";
import { buildCorpusSql } from "../src/lib/legal/corpus.ts";

const args = process.argv.slice(2);
const file = args[0];
const opt = (k) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : undefined;
};
if (!file || !opt("title") || !opt("url")) {
  console.error('usage: node scripts/law-to-sql.mjs <file> --title "..." --url "https://official-source" [--kind law|regulation] [--status in_force] [--issued "..."] [--out law.sql]');
  process.exit(2);
}

async function read(path) {
  const ext = extname(path).toLowerCase();
  if (ext === ".docx") {
    const mammoth = await import("mammoth");
    return (await mammoth.extractRawText({ path })).value;
  }
  if (ext === ".pdf") {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(path)), useSystemFonts: true }).promise;
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) pages.push((await (await doc.getPage(i)).getTextContent()).items.map((x) => x.str).join(" "));
    return pages.join("\n");
  }
  return readFileSync(path, "utf8");
}

const text = await read(file);
const { sql, report } = buildCorpusSql(text, {
  title: opt("title"),
  url: opt("url"),
  kind: opt("kind") ?? "law",
  status: opt("status") ?? "in_force",
  issued: opt("issued") ?? "",
});
const out = opt("out") ?? "law.sql";
writeFileSync(out, sql, "utf8");
console.log(`articles: ${report.articles} | highest article number: ${report.maxArticle}`);
for (const w of report.warnings) console.log("WARNING:", w);
console.log(report.warnings.length ? `\nSQL written to ${out}, but fix the warnings first.` : `\nLooks clean. SQL written to ${out}; paste it into the Supabase SQL editor and run it.`);
process.exit(report.warnings.some((w) => /corrupt/i.test(w)) ? 1 : 0);
