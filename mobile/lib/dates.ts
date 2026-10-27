// Dual Hijri (Umm al-Qura) / Gregorian date line — port of the website's src/lib/legal/dates.ts.
// Hermes' Intl may ignore the islamic-umalqura calendar; then only the Gregorian date is returned.

const OPTS = { day: "numeric", month: "long", year: "numeric" } as const;

export function dualDate(d: Date, lang: "ar" | "en" = "ar"): string {
  const greg = new Intl.DateTimeFormat(lang === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", OPTS).format(d);
  let hijri = "";
  try {
    const f = new Intl.DateTimeFormat(lang === "ar" ? "ar-SA-u-ca-islamic-umalqura-nu-latn" : "en-US-u-ca-islamic-umalqura-nu-latn", OPTS);
    if (f.resolvedOptions().calendar?.startsWith("islamic")) hijri = f.format(d).replace(/\s?(هـ|AH)\s?$/, "");
  } catch {
    /* no Hijri support in this Intl build */
  }
  if (!hijri) return lang === "ar" ? `${greg} م` : greg;
  return lang === "ar" ? `${hijri} هـ الموافق ${greg} م` : `${hijri} AH / ${greg}`;
}
