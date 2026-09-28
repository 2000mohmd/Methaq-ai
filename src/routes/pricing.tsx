import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MarketingLayout } from "@/components/MarketingLayout";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Mithaq Alarabia" },
      { name: "description", content: "Plans for individuals, lawyers and law firms: legal AI chat, document analysis and full practice management." },
      { property: "og:title", content: "Pricing — Mithaq Alarabia" },
      { property: "og:description", content: "Choose the Mithaq plan for you: Individual, Professional or Firm." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Pricing,
});

const PLANS = [
  { en: "Individual", ar: "فردي", price: { en: "Free to start", ar: "ابدأ مجاناً" },
    fen: ["Legal AI chat", "Plain-language answers", "Limited monthly questions"],
    far: ["محادثة قانونية بالذكاء الاصطناعي", "إجابات بلغة مبسّطة", "عدد محدود من الأسئلة شهرياً"] },
  { en: "Professional", ar: "محترف", price: { en: "Contact us", ar: "تواصل معنا" }, featured: true,
    fen: ["Everything in Individual", "Drafting & contract review", "Document upload & analysis", "Personal legal library"],
    far: ["كل مزايا الفردي", "الصياغة ومراجعة العقود", "رفع المستندات وتحليلها", "مكتبة قانونية خاصة"] },
  { en: "Firm", ar: "مكتب محاماة", price: { en: "Contact us", ar: "تواصل معنا" },
    fen: ["Everything in Professional", "Matters, clients, hearings, tasks", "Time tracking & billing", "Team roles & shared library"],
    far: ["كل مزايا المحترف", "القضايا والموكلون والجلسات والمهام", "تتبع الوقت والفوترة", "أدوار الفريق ومكتبة مشتركة"] },
];

function Pricing() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  return (
    <MarketingLayout
      title={ar ? "خطط تناسب كل ممارسة" : "Plans for every practice"}
      subtitle={ar ? "من الأفراد إلى مكاتب المحاماة — ابدأ اليوم ووسّع لاحقاً." : "From individuals to full law firms — start today, grow later."}
    >
      <div className="grid gap-6 md:grid-cols-3">
        {PLANS.map((p) => (
          <div key={p.en} className={cn("flex flex-col rounded-2xl border bg-card p-8 shadow-soft", p.featured ? "border-teal ring-1 ring-teal" : "border-border")}>
            <h2 className="text-lg font-semibold text-navy">{ar ? p.ar : p.en}</h2>
            <p className="mt-2 text-2xl font-semibold">{ar ? p.price.ar : p.price.en}</p>
            <ul className="mt-6 flex-1 space-y-3 text-sm">
              {(ar ? p.far : p.fen).map((f) => (
                <li key={f} className="flex gap-2"><Check className="size-4 shrink-0 text-teal" />{f}</li>
              ))}
            </ul>
            <Button className="mt-8" variant={p.featured ? "default" : "outline"} asChild>
              <Link to="/auth" search={{ mode: "signup" }}>{ar ? "ابدأ الآن" : "Get started"}</Link>
            </Button>
          </div>
        ))}
      </div>
      <p className="mt-10 text-center text-xs text-muted-foreground">
        {ar ? "ميثاق ليس بديلاً عن محامٍ مرخّص." : "Mithaq is not a substitute for a licensed lawyer."}
      </p>
    </MarketingLayout>
  );
}
