// Builds the SQL that loads one official law into the shared corpus (paste into the Supabase SQL editor).
// Pure: used by scripts/law-to-sql.mjs and covered by the self-check.
import { chunkByArticle } from "./legal.ts";
import { isCorruptArabic } from "./textquality.ts";

export type CorpusMeta = {
  title: string;
  url: string; // official source link (required: every law must be traceable)
  kind?: "law" | "regulation" | "other";
  status?: "in_force" | "amended" | "repealed";
  jurisdiction?: string;
  issued?: string;
};

export type CorpusReport = { articles: number; maxArticle: number; duplicates: number[]; missing: number[]; warnings: string[] };

const lit = (s: string) => {
  let tag = "law";
  while (s.includes(`$${tag}$`)) tag += "x";
  return `$${tag}$${s}$${tag}$`;
};

export function buildCorpusSql(rawText: string, meta: CorpusMeta): { sql: string; report: CorpusReport } {
  if (!meta.title.trim() || !meta.url.trim()) throw new Error("title and official source url are required");
  const warnings: string[] = [];
  if (isCorruptArabic(rawText)) warnings.push("The Arabic text looks corrupted (broken PDF font map). Use the Word/text version or OCR it first.");
  const chunks = chunkByArticle(rawText).filter((c) => c.text.trim().length > 0);
  const nums = chunks.map((c) => c.ref).filter(Boolean).map(Number);
  const seen = new Set<number>();
  const dup = new Set<number>();
  for (const n of nums) (seen.has(n) ? dup : seen).add(n);
  const max = nums.length ? Math.max(...nums) : 0;
  const missing: number[] = [];
  for (let i = 1; i <= max; i++) if (!seen.has(i)) missing.push(i);
  if (nums.length === 0) warnings.push("No article headings were found; the whole text would be stored as one block.");
  if (dup.size) warnings.push(`Article numbers repeat (${[...dup].slice(0, 8).join(", ")}...). Is this a combined law + regulation file? Load them separately.`);
  if (missing.length) warnings.push(`Missing article numbers: ${missing.slice(0, 15).join(", ")}${missing.length > 15 ? "..." : ""}`);

  const m = { kind: "law", status: "in_force", jurisdiction: "Saudi Arabia", issued: "", ...meta };
  const sid = "(SELECT id FROM public.legal_sources WHERE title = " + lit(m.title) + " AND kind = " + lit(m.kind) + ")";
  const rows = chunks.map((c, i) => `(${sid}, ${i + 1}, ${lit(c.ref)}, ${lit(c.text.normalize("NFKC"))})`);
  const sql = [
    "-- Generated law import. Review the report, then run once in the Supabase SQL editor.",
    `INSERT INTO public.legal_sources (title, jurisdiction, kind, source_url, status, issued) VALUES (${lit(m.title)}, ${lit(m.jurisdiction)}, ${lit(m.kind)}, ${lit(m.url)}, ${lit(m.status)}, ${lit(m.issued)})`,
    `ON CONFLICT (title, kind) DO UPDATE SET source_url = EXCLUDED.source_url, status = EXCLUDED.status, issued = EXCLUDED.issued, jurisdiction = EXCLUDED.jurisdiction;`,
    `DELETE FROM public.legal_articles WHERE source_id = ${sid};`,
    `INSERT INTO public.legal_articles (source_id, position, ref, text) VALUES`,
    rows.join(",\n") + ";",
  ].join("\n");
  return { sql, report: { articles: chunks.length, maxArticle: max, duplicates: [...dup], missing, warnings } };
}
