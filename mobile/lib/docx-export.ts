// Native Word export — port of the website's src/lib/docx-export.ts: firm letterhead header,
// dual Hijri/Gregorian date, RTL-aware body from markdown, page-number footer.
import { AlignmentType, BorderStyle, Document, Footer, Header, ImageRun, Packer, PageNumber, Paragraph, TextRun } from "docx";
import { Asset } from "expo-asset";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { dualDate } from "./dates";

export type Letterhead = {
  name_ar?: string;
  name_en?: string;
  address?: string;
  contact?: string; // phone / email / website
  cr?: string; // commercial registration or licence no.
  logo?: boolean; // show the Mithaq Alarabia logo in the header (default true)
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

export function buildDocx(opts: {
  title: string; markdown: string; letterhead?: Letterhead; lang?: "ar" | "en"; date?: Date; logoPng?: Uint8Array;
  /** Approval stamp ("اعتمده: … — ترخيص رقم … — date"), rendered as a bordered paragraph at the end. */
  stamp?: string;
}): Document {
  const lang = opts.lang ?? (hasArabic(opts.markdown) ? "ar" : "en");
  const rtl = lang === "ar";
  const l = opts.letterhead ?? {};
  const center = (text: string, size: number, bold = false) =>
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, size, bold, font: FONT, rightToLeft: hasArabic(text) })] });

  const logoPara = opts.logoPng && l.logo !== false
    ? [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [new ImageRun({ type: "png", data: opts.logoPng, transformation: { width: 230, height: 64 }, altText: { name: "logo", title: "Mithaq Alarabia", description: "Mithaq Alarabia logo" } })],
        }),
      ]
    : [];
  const headerParas = [
    ...logoPara,
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
  if (opts.stamp) {
    const side = { style: BorderStyle.SINGLE, size: 12, color: "02A79F", space: 6 };
    const stampRtl = hasArabic(opts.stamp);
    body.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      bidirectional: stampRtl,
      spacing: { before: 480 },
      border: { top: side, bottom: side, left: side, right: side },
      children: [new TextRun({ text: opts.stamp, bold: true, size: 22, font: FONT, color: "11374A", rightToLeft: stampRtl })],
    }));
  }

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

async function bundledLogo(): Promise<Uint8Array | undefined> {
  try {
    const a = await Asset.fromModule(require("../assets/lockup-navy.png")).downloadAsync();
    return a.localUri ? await new File(a.localUri).bytes() : undefined;
  } catch {
    return undefined; // export without the logo rather than failing
  }
}

/** Builds the .docx, writes it to the cache directory and opens the share sheet. */
export async function shareDocx(opts: Parameters<typeof buildDocx>[0], filename: string) {
  const logoPng = opts.logoPng ?? (opts.letterhead?.logo !== false ? await bundledLogo() : undefined);
  const b64 = await Packer.toBase64String(buildDocx({ ...opts, ...(logoPng ? { logoPng } : {}) }));
  const file = new File(Paths.cache, filename.endsWith(".docx") ? filename : `${filename}.docx`);
  await file.write(b64, { encoding: "base64" });
  await Sharing.shareAsync(file.uri, {
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    UTI: "org.openxmlformats.wordprocessingml.document",
    dialogTitle: opts.title,
  });
}
