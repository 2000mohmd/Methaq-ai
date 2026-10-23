// Dual Hijri (Umm al-Qura) / Gregorian date line for letterhead documents.

export function dualDate(d: Date, lang: "ar" | "en" = "ar"): string {
  const hijri = new Intl.DateTimeFormat(lang === "ar" ? "ar-SA-u-ca-islamic-umalqura-nu-latn" : "en-US-u-ca-islamic-umalqura-nu-latn", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
  const greg = new Intl.DateTimeFormat(lang === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
  const hijriClean = hijri.replace(/\s?(هـ|AH)\s?$/, "");
  return lang === "ar" ? `${hijriClean} هـ الموافق ${greg} م` : `${hijriClean} AH / ${greg}`;
}
