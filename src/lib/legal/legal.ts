// Grounding pipeline: article-level chunking -> BM25 + exact-article retrieval -> mechanical citation check.
// Pure functions (no I/O) so the chat route and the self-check share the same code.

export type Chunk = {
  title: string;
  jurisdiction: string | null;
  status: string; // in_force | amended | repealed
  ref: string; // normalized article number, "" when the source has no article structure
  text: string;
  sourceUrl: string | null;
};

export type Source = Chunk & { id: number };

const EASTERN = "٠١٢٣٤٥٦٧٨٩";
export const westernDigits = (s: string) => s.replace(/[٠-٩]/g, (d) => String(EASTERN.indexOf(d)));

/** Light Arabic normalisation so "الأولى"/"الاولى", diacritics and tatweel don't break matching. */
export const norm = (s: string) =>
  westernDigits(s.toLowerCase())
    .replace(/[\u064B-\u0652\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي");

const tokens = (s: string) => norm(s).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1);

const ART_HEAD = /^[ \t]*(?:article|art\.|المادة|مادة)[ \t]*[(\[]?[ \t]*(\d+)[ \t]*[)\]]?/gim;
const ART_MENTION = /(?:article|art\.|المادة|مادة)[ \t]*[(\[]?[ \t]*(\d+)/gi;

/** Split on article (madda) boundaries, never on a fixed window. */
export function chunkByArticle(text: string): { ref: string; text: string }[] {
  const t = westernDigits(text);
  const heads = [...t.matchAll(ART_HEAD)];
  if (heads.length === 0) return t.trim() ? [{ ref: "", text: t.trim() }] : [];
  const out: { ref: string; text: string }[] = [];
  const pre = t.slice(0, heads[0]!.index).trim();
  if (pre) out.push({ ref: "", text: pre });
  heads.forEach((h, i) => {
    const end = heads[i + 1]?.index ?? t.length;
    out.push({ ref: h[1]!, text: t.slice(h.index, end).trim() });
  });
  return out;
}

export function articleNumbers(s: string): string[] {
  return [...westernDigits(s).matchAll(ART_MENTION)].map((m) => m[1]!);
}

/** BM25 over chunks, plus a strong boost when the query names an article the chunk carries. */
export function rank(query: string, chunks: Chunk[], k = 5, jurisdiction?: string | null): Source[] {
  const q = tokens(query);
  const wanted = new Set(articleNumbers(query));
  const docs = chunks.map((c) => tokens(`${c.title} ${c.text}`));
  const avg = docs.reduce((a, d) => a + d.length, 0) / (docs.length || 1) || 1;
  const df = new Map<string, number>();
  for (const d of docs) for (const w of new Set(d)) df.set(w, (df.get(w) ?? 0) + 1);
  const N = docs.length;
  const scored = chunks.map((c, i) => {
    const d = docs[i]!;
    let s = 0;
    for (const w of new Set(q)) {
      const f = d.filter((x) => x === w).length;
      if (!f) continue;
      const idf = Math.log(1 + (N - (df.get(w) ?? 0) + 0.5) / ((df.get(w) ?? 0) + 0.5));
      s += (idf * f * 2.5) / (f + 1.5 * (0.25 + (0.75 * d.length) / avg));
    }
    if (c.ref && wanted.has(c.ref)) s += 10;
    if (jurisdiction && c.jurisdiction === jurisdiction && s > 0) s += 0.5;
    return { c, s };
  });
  return scored
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, k)
    .map((x, i) => ({ ...x.c, id: i + 1 }));
}

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
  const repealed = [...cited].filter((id) => sources.find((s) => s.id === id)?.status === "repealed");
  const known = new Set(sources.map((s) => s.ref).filter(Boolean));
  const unverifiedArticles = [...new Set(articleNumbers(text))].filter((n) => !known.has(n));

  const ar = /[\u0600-\u06FF]/.test(answer);
  const notes: string[] = [];
  if (sources.length === 0) {
    notes.push(ar ? "⚠ لم يُعثر على مصدر في المكتبة القانونية؛ هذه الإجابة غير موثّقة ولا تُعدّ مرجعاً." : "⚠ No source was found in the legal library; this answer is not grounded and must not be relied on as authority.");
  } else if (cited.size === 0) {
    notes.push(ar ? "⚠ لا توجد استشهادات موثّقة في هذه الإجابة." : "⚠ This answer contains no verified citation.");
  }
  if (repealed.length) notes.push(ar ? `⚠ مصادر ملغاة مذكورة: ${repealed.map((i) => `[S${i}]`).join(" ")}` : `⚠ Cites repealed provision(s): ${repealed.map((i) => `[S${i}]`).join(" ")}`);
  if (unverifiedArticles.length && sources.length > 0) {
    notes.push(ar ? `⚠ مواد غير موجودة في المصادر المسترجعة (تحقق منها): ${unverifiedArticles.join("، ")}` : `⚠ Article(s) not found in retrieved sources (verify manually): ${unverifiedArticles.join(", ")}`);
  }
  if (cited.size) {
    const list = [...cited].sort((a, b) => a - b).map((id) => {
      const s = sources.find((x) => x.id === id)!;
      return `[S${id}] ${s.title}${s.ref ? (ar ? ` — المادة ${s.ref}` : ` — Art. ${s.ref}`) : ""}`;
    });
    notes.push((ar ? "المصادر المتحقق منها:\n" : "Verified sources:\n") + list.join("\n"));
  }
  if (notes.length) text += `\n\n---\n${notes.join("\n")}`;
  return { text, grounded: sources.length > 0, stripped, repealed, unverifiedArticles, validCitations: cited.size };
}
