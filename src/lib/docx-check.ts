// Run: node src/lib/docx-check.ts  — builds a real .docx and inspects its XML (fake firm data only).
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { Packer } from "docx";
import JSZip from "jszip";
import { buildDocx } from "./docx-export.ts";

const md = ["# عقد خدمات تجريبي", "**الطرف الأول:** شركة تجريبية", "1. يلتزم الطرف الثاني بتقديم الخدمات.", "## Terms", "English line with **bold** text."].join(String.fromCharCode(10));
const doc = buildDocx({
  title: "TEST",
  markdown: md,
  lang: "ar",
  logoPng: new Uint8Array(readFileSync("public/brand/lockup-navy.png")),
  date: new Date("2026-10-17T12:00:00Z"),
  letterhead: { name_ar: "مكتب تجريبي للمحاماة", name_en: "TEST Law Firm", address: "الرياض", contact: "info@test.invalid", cr: "CR 0000000000" },
});
const buf = await Packer.toBuffer(doc);
const zip = await JSZip.loadAsync(buf);
const body = await zip.file("word/document.xml")!.async("string");
const header = Object.keys(zip.files).filter((f) => f.startsWith("word/header"));
const headerXml = await zip.file(header[0]!)!.async("string");
assert.ok(body.includes("<w:bidi"), "paragraphs are right-to-left");
assert.ok(body.includes("1448") && body.includes("هـ") && body.includes("م"), "dual Hijri/Gregorian date present");
assert.ok(body.includes("عقد خدمات تجريبي") && body.includes("English line"), "body text present");
assert.ok(headerXml.includes("مكتب تجريبي للمحاماة") && headerXml.includes("CR 0000000000"), "letterhead in header");
assert.ok(Object.keys(zip.files).some((f) => f.startsWith("word/media/")), "logo image embedded");
assert.ok(Object.keys(zip.files).some((f) => f.startsWith("word/footer")), "footer with page numbers");
writeFileSync(process.env["TEMP"] + "/mithaq-sample.docx", buf);
console.log("docx check ok", buf.length, "bytes ->", process.env["TEMP"] + "/mithaq-sample.docx");
