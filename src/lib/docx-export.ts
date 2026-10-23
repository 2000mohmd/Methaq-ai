// Browser-side Word export: firm letterhead header, dual Hijri/Gregorian date, RTL-aware body from markdown.
import { AlignmentType, BorderStyle, Document, Footer, Header, Packer, PageNumber, Paragraph, TextRun } from "docx";

import { dualDate } from "@/lib/legal/dates";

export type Letterhead = {
  name_ar?: string;
  name_en?: string;
  address?: string;
  contact?: string; // phone / email / website
  cr?: string; // commercial registration or licence no.
};

const FONT = "Arial";
const hasArabic = (s: string) => /[؀-ۿ]/.test(s);

/** **bold** spans -> runs. */
function runs(text: string, rtl: boolean, base: { size?: number; bold?: boolean } = {}): TextRun[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part) => {
    const bold = part.startsWith("**") && part.endsWith("**");
    return new TextRun({ text: bold ? part.slice(2, -2) : part, bold: bold || base.bold === true, size: base.size ?? 24, font: FONT, rightToLeft: rtl });
  });
}

function para(line: string, rtl: boolean): Paragraph {
  const h = /^(#{1,3})\s+(.*)$/.exec(line);
  if (h) {
    const level = h[1]!.length;
    return new Paragraph({
      children: runs(h[2]!, rtl, { size: level === 1 ? 32 : 26, bold: true }),
      alignment: level === 1 ? AlignmentType.CENTER : AlignmentType.START,
      bidirectional: rtl,
      spacing: { before: 240, after: 120 },
    });
  }
  const list = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/.exec(line);
  const text = list ? line.trim() : line;
  return new Paragraph({
    children: runs(text, rtl),
    alignment: AlignmentType.START,
    bidirectional: rtl,
    ...(list ? { indent: { start: 360 } } : {}),
    spacing: { after: 120, line: 320 },
  });
}

export function buildDocx(opts: { title: string; markdown: string; letterhead?: Letterhead; lang?: "ar" | "en"; date?: Date }): Document {
  const lang = opts.lang ?? (hasArabic(opts.markdown) ? "ar" : "en");
  const rtl = lang === "ar";
  const l = opts.letterhead ?? {};
  const center = (text: string, size: number, bold = false) =>
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, size, bold, font: FONT, rightToLeft: hasArabic(text) })] });

  const headerParas = [
    ...(l.name_ar ? [center(l.name_ar, 32, true)] : []),
    ...(l.name_en ? [center(l.name_en, 26, true)] : []),
    ...(l.address ? [center(l.address, 18)] : []),
    ...([l.contact, l.cr].filter(Boolean).length ? [center([l.contact, l.cr].filter(Boolean).join("  |  "), 18)] : []),
  ];
  if (headerParas.length) {
    headerParas.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: "1F3A5F", space: 4 } }, children: [] }));
  }

  const dateLine = new Paragraph({
    alignment: AlignmentType.START,
    bidirectional: rtl,
    spacing: { before: 120, after: 240 },
    children: [new TextRun({ text: `${rtl ? "التاريخ: " : "Date: "}${dualDate(opts.date ?? new Date(), lang)}`, size: 22, font: FONT, rightToLeft: rtl })],
  });

  const body = opts.markdown.split("\n").filter((x) => x.trim()).map((line) => para(line, rtl && hasArabic(line) ? true : rtl));

  return new Document({
    title: opts.title,
    sections: [
      {
        headers: { default: new Header({ children: headerParas }) },
        footers: {
          default: new Footer({
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT, " / ", PageNumber.TOTAL_PAGES], size: 18, font: FONT })] })],
          }),
        },
        children: [dateLine, ...body],
      },
    ],
  });
}

export async function downloadDocx(opts: Parameters<typeof buildDocx>[0], filename: string) {
  const blob = await Packer.toBlob(buildDocx(opts));
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename.endsWith(".docx") ? filename : `${filename}.docx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

import { supabase } from "@/integrations/supabase/client";

/** The signed-in user's saved letterhead (Settings), if any. */
export async function loadLetterhead(): Promise<Letterhead> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).from("profiles").select("letterhead").eq("id", u.user.id).single();
  return (data?.letterhead as Letterhead | null) ?? {};
}
