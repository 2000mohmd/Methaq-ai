import { createFileRoute } from "@tanstack/react-router";

import { useState } from "react";

import { LawImport } from "@/components/app/LawImport";
import { RecordModule, type Field } from "@/components/app/RecordModule";

const FIELDS: Field[] = [
  { key: "title", en: "Title", ar: "العنوان", required: true },
  { key: "jurisdiction", en: "Jurisdiction", ar: "الاختصاص", type: "select", options: ["Saudi Arabia", "UAE", "Qatar", "Kuwait", "Bahrain", "Oman", "Egypt", "Jordan", "Lebanon"] },
  { key: "category", en: "Type", ar: "النوع", type: "select", options: ["law", "regulation", "judgment", "template", "article"] },
  { key: "status", en: "Status", ar: "الحالة", type: "select", options: ["in_force", "amended", "repealed"] },
  { key: "source_url", en: "Source link", ar: "رابط المصدر" },
  { key: "content", en: "Text / notes", ar: "النص / ملاحظات", list: false },
];

function Library() {
  const [n, setN] = useState(0);
  return (
    <>
      <LawImport onDone={() => setN((x) => x + 1)} />
      <RecordModule key={n} table="library_items" title={{ en: "Legal library", ar: "المكتبة القانونية" }} fields={FIELDS} />
    </>
  );
}

export const Route = createFileRoute("/app/library")({
  head: () => ({ meta: [{ title: "Legal library — Mithaq" }] }),
  component: Library,
});
