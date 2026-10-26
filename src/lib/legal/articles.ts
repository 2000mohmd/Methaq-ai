// Article (madda) detection for Saudi legal texts: digits ("المادة 74", "Article 74") and
// Arabic ordinal words ("المادة الأولى", "المادة الرابعة والسبعون", "المادة الخامسة بعد المائة").
// Works on flattened PDF text too: a heading may follow a sentence end instead of a newline.

const EASTERN = "٠١٢٣٤٥٦٧٨٩";
const westernDigits = (s: string) => s.replace(/[٠-٩]/g, (d) => String(EASTERN.indexOf(d)));
const strip = (s: string) =>
  westernDigits(s.normalize("NFKC").toLowerCase())
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي");

// Normalised stems (no "ال", no trailing ة).
const UNITS: Record<string, number> = {
  اول: 1, اولي: 1, حادي: 1, ثان: 2, ثاني: 2, ثالث: 3, رابع: 4, خامس: 5, سادس: 6, سابع: 7, ثامن: 8, تاسع: 9, عاشر: 10,
};
const TENS: Record<string, number> = {
  عشرون: 20, عشرين: 20, ثلاثون: 30, ثلاثين: 30, اربعون: 40, اربعين: 40, خمسون: 50, خمسين: 50,
  ستون: 60, ستين: 60, سبعون: 70, سبعين: 70, ثمانون: 80, ثمانين: 80, تسعون: 90, تسعين: 90,
};
const HUNDREDS: Record<string, number> = { مائ: 100, مئ: 100, مائتان: 200, مائتين: 200, مئتان: 200, مئتين: 200 };

function stem(word: string): string {
  let w = strip(word);
  if (w.startsWith("ال")) w = w.slice(2);
  if (w.endsWith("ة")) w = w.slice(0, -1);
  return w;
}
const known = (w: string) => w in UNITS || w in TENS || w in HUNDREDS || w === "عشر" || w === "عشره" || w === "بعد";

/** Parses an ordinal phrase from the start of `words`. Returns the number and how many words it used. */
export function parseOrdinal(words: string[]): { n: number; used: number } | null {
  let total = 0;
  let i = 0;
  let any = false;
  while (i < words.length) {
    let w = stem(words[i]!);
    if (!known(w) && w.startsWith("و") && known(stem(w.slice(1)))) w = stem(w.slice(1)); // "والسبعون"
    if (w in UNITS) {
      const nxt = words[i + 1] ? stem(words[i + 1]!) : "";
      if (nxt === "عشر" || nxt === "عشره") {
        total += UNITS[w]! + 10; // 11-19
        i += 2;
      } else {
        total += UNITS[w]!;
        i++;
      }
    } else if (w in TENS) {
      total += TENS[w]!;
      i++;
    } else if (w in HUNDREDS) {
      total += HUNDREDS[w]!;
      i++;
    } else if (w === "بعد" && any && words[i + 1] && stem(words[i + 1]!) in HUNDREDS) {
      total += HUNDREDS[stem(words[i + 1]!)]!; // "الخامسة بعد المائة" = 105
      i += 2;
    } else break;
    any = true;
  }
  return any && total > 0 ? { n: total, used: i } : null;
}

const KEYWORD = /(?:article|art\.|المادة|مادة)/gi;

/** Reads the article number that follows a keyword, or null when it is not a real article reference. */
function numberAfter(text: string, from: number): string | null {
  const rest = text.slice(from, from + 120).replace(/^[\s(\[]+/, "");
  const digits = /^(\d{1,4})\b/.exec(rest);
  if (digits) return String(Number(digits[1]));
  const words = rest.split(/[\s:.\-–—)\]،,]+/).filter(Boolean).slice(0, 7);
  const o = parseOrdinal(words);
  return o ? String(o.n) : null;
}

/** A heading starts a line or follows a sentence end (flattened PDFs have no newlines). */
function atBoundary(text: string, at: number): boolean {
  let j = at - 1;
  while (j >= 0 && (text[j] === " " || text[j] === "\t")) j--;
  return j < 0 || /[\n.:؛؟!)\]]/.test(text[j]!);
}

/** Heading positions with their normalised article number. */
export function findHeadings(text: string): { index: number; ref: string }[] {
  const out: { index: number; ref: string }[] = [];
  for (const m of text.matchAll(KEYWORD)) {
    const idx = m.index!;
    if (!atBoundary(text, idx)) continue;
    const ref = numberAfter(text, idx + m[0].length);
    if (ref) out.push({ index: idx, ref });
  }
  return out;
}

/** Every article number a text refers to, anywhere (used for queries and cross-references). */
export function mentionedArticles(text: string): string[] {
  const t = westernDigits(text);
  const out: string[] = [];
  for (const m of t.matchAll(KEYWORD)) {
    const ref = numberAfter(t, m.index! + m[0].length);
    if (ref) out.push(ref);
  }
  return out;
}
