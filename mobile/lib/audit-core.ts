// Pure contract-audit helpers, copied from the website's src/lib/legal/audit.ts (keep behaviour identical).

export type Clause = { n: number; text: string };
export type Risk = "high" | "medium" | "low" | "ok";
export type Finding = {
  n: number;
  risk: Risk;
  issue: string;
  redline: string;
  basis: number[]; // [S#] ids that exist in the retrieved sources
  grounded: boolean; // false = a risk was raised with no verified library source behind it
};
export type SrcInfo = { id: number; title: string; ref: string; status: string; url: string | null };
export type Result = Finding & { sources: SrcInfo[] };

export const RISK_LABEL: Record<Risk, string> = { high: "خطر مرتفع", medium: "خطر متوسط", low: "خطر منخفض", ok: "متوافق" };

// "1." "1-" "(1)" "Article 3" "Clause 4" "البند الثالث" "المادة 5" at the start of a line.
const HEAD = /^[ \t]*(?:\(?\d{1,3}[.)\-–][ \t]|\(\d{1,3}\)[ \t]|(?:article|clause|section)[ \t]+\d+|(?:البند|المادة|مادة|بند)[ \t]+\S+)/gim;

/** Split a contract into clauses at numbered/“Article” headings; falls back to paragraphs. */
export function splitClauses(text: string, maxLen = 2500): Clause[] {
  const t = text.replace(/\r/g, "").trim();
  if (!t) return [];
  const heads = [...t.matchAll(HEAD)];
  let parts: string[];
  if (heads.length >= 3) {
    parts = heads.map((h, i) => t.slice(h.index, heads[i + 1]?.index ?? t.length).trim());
    const pre = t.slice(0, heads[0]!.index).trim();
    if (pre) parts.unshift(pre);
  } else {
    parts = t.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  }
  return parts
    .flatMap((p) => (p.length > maxLen ? p.match(new RegExp(`[\\s\\S]{1,${maxLen}}(?:\\s|$)`, "g")) ?? [p] : [p]))
    .filter((p) => p.trim().length > 15)
    .map((p, i) => ({ n: i + 1, text: p.trim() }));
}

/** Replace accepted clauses with their redlines to produce the revised contract text. */
export function applyRedlines(clauses: Clause[], findings: Finding[], accepted: Set<number>): string {
  return clauses.map((c) => (accepted.has(c.n) ? findings.find((f) => f.n === c.n)?.redline || c.text : c.text)).join("\n\n");
}

/** Attach the batch's sources to each finding (same as the web page). */
export function withSources(findings: Finding[], sources: SrcInfo[]): Result[] {
  return findings.map((f) => ({ ...f, sources: sources.filter((s) => f.basis.includes(s.id)) }));
}

/** Arabic audit report as markdown (same content as the website's Arabic export). */
export function reportMarkdown(name: string, clauses: Clause[], results: Result[]): string {
  const count = (r: Risk) => results.filter((x) => x.risk === r).length;
  return [
    "# تقرير التدقيق النظامي السعودي",
    `**العقد:** ${name}`,
    `**الملخص:** ${count("high")} مرتفع / ${count("medium")} متوسط / ${count("low")} منخفض / ${count("ok")} متوافق`,
    ...results.flatMap((r) => [
      `## البند ${r.n} — ${RISK_LABEL[r.risk]}`,
      `**النص الأصلي:** ${clauses.find((c) => c.n === r.n)?.text ?? ""}`,
      ...(r.issue ? [`**الملاحظة:** ${r.issue}`] : []),
      ...(r.sources.length
        ? [`**السند النظامي:** ${r.sources.map((s) => `${s.title}${s.ref ? ` (م ${s.ref})` : ""}`).join("; ")}`]
        : r.risk === "high" || r.risk === "medium" ? ["⚠ لا يوجد مصدر موثّق في المكتبة — تحقق يدوياً."] : []),
      ...(r.redline ? [`**الصياغة المقترحة:** ${r.redline}`] : []),
    ]),
    "*ميثاق ليس بديلاً عن محامٍ مرخّص.*",
  ].join("\n");
}
