// Contract audit: clause splitting + strict, verifiable parsing of the model's per-clause findings.
import type { Source } from "./legal";

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

const RISKS = new Set<Risk>(["high", "medium", "low", "ok"]);

/** Parse the model's JSON; drop anything not tied to a clause we sent; strip citations that were not retrieved. */
export function parseAudit(raw: string, clauses: Clause[], sources: Source[]): Finding[] {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  let arr: unknown = [];
  try {
    arr = JSON.parse(raw.slice(start, end + 1));
  } catch {
    /* unparseable -> every clause reported as unaudited below */
  }
  const ids = new Set(sources.map((s) => s.id));
  const byN = new Map<number, Finding>();
  for (const x of Array.isArray(arr) ? (arr as Record<string, unknown>[]) : []) {
    const n = Number(x["n"]);
    if (!clauses.some((c) => c.n === n) || byN.has(n)) continue;
    const risk = RISKS.has(x["risk"] as Risk) ? (x["risk"] as Risk) : "medium";
    const basis = (Array.isArray(x["basis"]) ? (x["basis"] as unknown[]) : []).map(Number).filter((i) => ids.has(i));
    byN.set(n, {
      n,
      risk,
      issue: String(x["issue"] ?? ""),
      redline: String(x["redline"] ?? ""),
      basis,
      grounded: risk === "ok" || risk === "low" || basis.length > 0,
    });
  }
  return clauses.map(
    (c) => byN.get(c.n) ?? { n: c.n, risk: "medium", issue: "Not audited — the model returned no usable result for this clause.", redline: "", basis: [], grounded: false },
  );
}

/** Replace accepted clauses with their redlines to produce the revised contract text. */
export function applyRedlines(clauses: Clause[], findings: Finding[], accepted: Set<number>): string {
  return clauses.map((c) => (accepted.has(c.n) ? findings.find((f) => f.n === c.n)?.redline || c.text : c.text)).join("\n\n");
}
