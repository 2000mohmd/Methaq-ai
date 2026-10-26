// Detects PDFs whose text layer is corrupted. Some Arabic PDFs (broken font maps) come out with letters swapped
// or dropped: "المادة" -> "املادة", "الأحوال" -> "األحوال". Such text cannot be searched or cited, so the importer
// falls back to AI OCR on the rendered pages instead.

const BAD = /املاد|األ|اإل|املس|املا|اهلل|الذي ن|ك ما |ع لى /g;
const GOOD = /المادة|الأ|الإ|المال|المسا|الله|على/g;

export function isCorruptArabic(text: string): boolean {
  const arabic = (text.match(/[؀-ۿ]/g) ?? []).length;
  if (arabic < 200) return false; // not enough Arabic to judge
  const t = text.normalize("NFKC");
  const bad = (t.match(BAD) ?? []).length;
  const good = (t.match(GOOD) ?? []).length;
  return bad >= 5 && bad > good * 0.5;
}
