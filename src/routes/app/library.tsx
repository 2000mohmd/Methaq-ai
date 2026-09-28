import { createFileRoute } from "@tanstack/react-router";

import { RecordModule, type Field } from "@/components/app/RecordModule";

const FIELDS: Field[] = [
  { key: "title", en: "Title", ar: "العنوان", required: true },
  { key: "jurisdiction", en: "Jurisdiction", ar: "الاختصاص", type: "select", options: ["Saudi Arabia", "UAE", "Qatar", "Kuwait", "Bahrain", "Oman", "Egypt", "Jordan", "Lebanon"] },
  { key: "category", en: "Type", ar: "النوع", type: "select", options: ["law", "regulation", "judgment", "template", "article"] },
  { key: "source_url", en: "Source link", ar: "رابط المصدر" },
  { key: "content", en: "Text / notes", ar: "النص / ملاحظات", list: false },
];

export const Route = createFileRoute("/app/library")({
  head: () => ({ meta: [{ title: "Legal library — Mithaq" }] }),
  component: () => <RecordModule table="library_items" title={{ en: "Legal library", ar: "المكتبة القانونية" }} fields={FIELDS} />,
});
