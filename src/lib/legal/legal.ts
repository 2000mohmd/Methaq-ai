// Grounding pipeline: article-level chunking -> BM25 + exact-article retrieval -> mechanical citation check.
// Pure functions (no I/O) so the chat route and the self-check share the same code.

export type Chunk = {
  title: string;
  jurisdiction: string | null;
  status: string; // in_force | amended | repealed
  ref: string; // normalized article number, "" when the source has no article structure
  text: string;
  sourceUrl: string | null;
  origin?: "official" | "user"; // "user" = the caller's own library note, never an official source (default official)
};

export type Source = Chunk & { id: number };

import { findHeadings, mentionedArticles } from "./articles.ts";

const EASTERN = "٠١٢٣٤٥٦٧٨٩";
export const westernDigits = (s: string) => s.replace(/[٠-٩]/g, (d) => String(EASTERN.indexOf(d)));

/** Light Arabic normalisation so "الأولى"/"الاولى", diacritics and tatweel don't break matching. */
export const norm = (s: string) =>
  westernDigits(s.normalize("NFKC").toLowerCase())
    .replace(/[\u064B-\u0652\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي");

const STOP = new Set(
  ("the of and or a an to in on for by with at from is are was were be as it its this that these those under what which who whom how when where " +
    "law laws article articles regulation regulations nizam does do did can may must shall not no any all per than then if into about between has have had their there here your our you we they " +
    "نظام المادة مادة الأنظمة في من على الى إلى عن مع هذا هذه ذلك تلك التي الذي الذين ما ماذا هل كيف متى اين أين لا لم لن ان إن أن او أو ثم قد كل بين عند هو هي").split(" "),
);
const tokens = (s: string) => norm(s).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1 && !STOP.has(w));

/** Split on article (madda) boundaries, never on a fixed window. */
export function chunkByArticle(text: string): { ref: string; text: string }[] {
  const t = westernDigits(text.normalize("NFKC")); // NFKC folds Arabic presentation forms that PDFs often emit
  const heads = findHeadings(t);
  if (heads.length === 0) return t.trim() ? [{ ref: "", text: t.trim() }] : [];
  const out: { ref: string; text: string }[] = [];
  const pre = t.slice(0, heads[0]!.index).trim();
  if (pre) out.push({ ref: "", text: pre });
  heads.forEach((h, i) => {
    const end = heads[i + 1]?.index ?? t.length;
    out.push({ ref: h.ref, text: t.slice(h.index, end).trim() });
  });
  return out;
}

export const articleNumbers = mentionedArticles;

/** BM25 over chunks, plus a strong boost when the query names an article the chunk carries. */
export function rank(query: string, chunks: Chunk[], k = 5, jurisdiction?: string | null): Source[] {
  const q = tokens(query);
  const wanted = new Set(articleNumbers(query));
  const docs = chunks.map((c) => tokens(`${c.title} ${c.text}`));
  const avg = docs.reduce((a, d) => a + d.length, 0) / (docs.length || 1) || 1;
  const df = new Map<string, number>();
  for (const d of docs) for (const w of new Set(d)) df.set(w, (df.get(w) ?? 0) + 1);
  const N = docs.length;
  const need = Math.min(2, new Set(q).size); // a single shared word is not enough to count as a source
  const scored = chunks.map((c, i) => {
    const d = docs[i]!;
    let s = 0;
    let matched = 0;
    for (const w of new Set(q)) {
      const f = d.filter((x) => x === w).length;
      if (!f) continue;
      matched++;
      const idf = Math.log(1 + (N - (df.get(w) ?? 0) + 0.5) / ((df.get(w) ?? 0) + 0.5));
      s += (idf * f * 2.5) / (f + 1.5 * (0.25 + (0.75 * d.length) / avg));
    }
    if (c.ref && wanted.has(c.ref)) s += 10;
    else if (matched < need) s = 0;
    if (jurisdiction && c.jurisdiction === jurisdiction && s > 0) s += 0.5;
    return { c, s };
  });
  return scored
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, k)
    .map((x, i) => ({ ...x.c, id: i + 1 }));
}

const isUser = (s: Chunk) => s.origin === "user";

/** Header line for a source in the model context; user notes are labelled so they are never taken as law. */
export const sourceLabel = (s: Chunk) =>
  `${s.title}${s.ref ? ` — Article ${s.ref}` : ""}` +
  (isUser(s) ? " — USER NOTE, not an official source" : ` (${s.jurisdiction ?? "—"}, ${s.status})${s.sourceUrl ? ` ${s.sourceUrl}` : ""}`);

export type Verification = {
  text: string;
  grounded: boolean;
  stripped: number[]; // [S#] markers that pointed at nothing retrieved
  repealed: number[]; // cited sources marked repealed
  unverifiedArticles: string[]; // article numbers in the answer that no retrieved source contains
  validCitations: number;
};

/** Deterministic check: nothing the model cites survives unless it was actually retrieved. */
export function verifyAnswer(answer: string, sources: Source[]): Verification {
  const ids = new Set(sources.map((s) => s.id));
  const stripped: number[] = [];
  const cited = new Set<number>();
  let text = answer.replace(/\s?\[S(\d+)\]/g, (m, n: string) => {
    const id = Number(n);
    if (ids.has(id)) {
      cited.add(id);
      return m;
    }
    stripped.push(id);
    return "";
  });
  const official = sources.filter((s) => !isUser(s));
  const citedOfficial = [...cited].filter((id) => official.some((s) => s.id === id));
  const citedNotes = [...cited].filter((id) => !citedOfficial.includes(id));
  const repealed = [...cited].filter((id) => sources.find((s) => s.id === id)?.status === "repealed");
  const known = new Set(sources.map((s) => s.ref).filter(Boolean));
  const unverifiedArticles = [...new Set(articleNumbers(text))].filter((n) => !known.has(n));

  const ar = /[\u0600-\u06FF]/.test(answer);
  const notes: string[] = [];
  if (official.length === 0) {
    notes.push(ar ? "⚠ لم يُعثر على مصدر في المكتبة القانونية؛ هذه الإجابة غير موثّقة ولا تُعدّ مرجعاً." : "⚠ No source was found in the legal library; this answer is not grounded and must not be relied on as authority.");
  } else if (citedOfficial.length === 0) {
    notes.push(ar ? "⚠ لا توجد استشهادات موثّقة في هذه الإجابة." : "⚠ This answer contains no verified citation.");
  }
  if (repealed.length) notes.push(ar ? `⚠ مصادر ملغاة مذكورة: ${repealed.map((i) => `[S${i}]`).join(" ")}` : `⚠ Cites repealed provision(s): ${repealed.map((i) => `[S${i}]`).join(" ")}`);
  if (unverifiedArticles.length && sources.length > 0) {
    notes.push(ar ? `⚠ مواد غير موجودة في المصادر المسترجعة (تحقق منها): ${unverifiedArticles.join("، ")}` : `⚠ Article(s) not found in retrieved sources (verify manually): ${unverifiedArticles.join(", ")}`);
  }
  const list = (ids: number[]) =>
    ids
      .sort((a, b) => a - b)
      .map((id) => {
        const s = sources.find((x) => x.id === id)!;
        return `[S${id}] ${s.title}${s.ref ? (ar ? ` — المادة ${s.ref}` : ` — Art. ${s.ref}`) : ""}`;
      })
      .join("\n");
  if (citedOfficial.length) notes.push((ar ? "المصادر المتحقق منها:\n" : "Verified sources:\n") + list(citedOfficial));
  if (citedNotes.length) notes.push((ar ? "ملاحظاتك (غير موثّقة):\n" : "Your notes (not verified):\n") + list(citedNotes));
  if (notes.length) text += `\n\n---\n${notes.join("\n")}`;
  return { text, grounded: official.length > 0, stripped, repealed, unverifiedArticles, validCitations: citedOfficial.length };
}

/** One hop along the citation graph: pull in articles that a retrieved article refers to (same instrument). */
export function expandReferences(hits: Source[], all: Chunk[], max = 8): Source[] {
  const out = [...hits];
  for (const h of hits) {
    for (const n of articleNumbers(h.text)) {
      if (out.length >= max) return out;
      if (n === h.ref || out.some((o) => o.title === h.title && o.ref === n)) continue;
      const hit = all.find((c) => c.title === h.title && c.ref === n);
      if (hit) out.push({ ...hit, id: out.length + 1 });
    }
  }
  return out;
}

/** Council mode: which sources did each model cite? Disagreement is surfaced, never silently resolved. */
export function councilDisagreement(citedPerModel: Set<number>[]): number[] {
  const all = new Set(citedPerModel.flatMap((s) => [...s]));
  return [...all].filter((id) => !citedPerModel.every((s) => s.has(id))).sort((a, b) => a - b);
}

// ---- Gold-set scoring -------------------------------------------------------------------

export type GoldEntry = {
  id: string;
  practice_area: string;
  question: string;
  expected: { title: string; ref: string }[]; // citations a lawyer says must be retrieved
  status: "draft" | "in_review" | "approved";
  authored_by: string;
  reviewed_by: string;
};

export function validateGold(e: GoldEntry): string[] {
  const errs: string[] = [];
  if (!e.id || !e.question) errs.push("id/question missing");
  if (!e.expected?.length) errs.push("expected citations missing");
  if (e.status === "approved" && (!e.reviewed_by || e.reviewed_by === e.authored_by)) errs.push("approved needs a second lawyer's sign-off");
  return errs;
}

/** Retrieval recall@k over approved entries only. */
export function scoreRetrieval(gold: GoldEntry[], corpus: Chunk[], k = 5) {
  const approved = gold.filter((g) => g.status === "approved");
  const misses: string[] = [];
  let hit = 0;
  for (const g of approved) {
    const got = rank(g.question, corpus, k);
    const ok = g.expected.every((x) => got.some((s) => s.title === x.title && s.ref === x.ref));
    if (ok) hit++;
    else misses.push(g.id);
  }
  return { total: approved.length, recall: approved.length ? hit / approved.length : 0, misses };
}
