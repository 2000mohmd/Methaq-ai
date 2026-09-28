import { createFileRoute } from "@tanstack/react-router";
import { Globe2, Scale, Users } from "lucide-react";

import { MarketingLayout } from "@/components/MarketingLayout";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Mithaq Alarabia" },
      { name: "description", content: "Mithaq Alarabia builds bilingual, jurisdiction-aware legal technology for the Arab world." },
      { property: "og:title", content: "About Mithaq Alarabia" },
      { property: "og:description", content: "Our mission: make legal knowledge and practice tools accessible in Arabic and English." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: About,
});

const VALUES = [
  { icon: Scale, en: ["Trust first", "Clear sources, careful answers and honest limits."], ar: ["الثقة أولاً", "مصادر واضحة وإجابات دقيقة وحدود صريحة."] },
  { icon: Globe2, en: ["Built for the region", "Arabic and English, aware of local laws and courts."], ar: ["مصمم للمنطقة", "بالعربية والإنجليزية، ومدرك للقوانين والمحاكم المحلية."] },
  { icon: Users, en: ["For everyone", "Individuals, lawyers, in-house teams and firms."], ar: ["للجميع", "للأفراد والمحامين والفرق القانونية الداخلية والمكاتب."] },
];

function About() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  return (
    <MarketingLayout
      title={ar ? "صوتك في الساحة القانونية" : "Your voice in the legal arena"}
      subtitle={ar ? "ميثاق العربية يجمع الذكاء الاصطناعي القانوني وإدارة الممارسة في منصة واحدة." : "Mithaq Alarabia joins legal AI and practice management in one platform."}
    >
      <div className="grid gap-6 md:grid-cols-3">
        {VALUES.map((v) => (
          <div key={v.en[0]} className="rounded-2xl border border-border bg-card p-8 shadow-soft">
            <v.icon className="size-6 text-teal" />
            <h2 className="mt-4 font-semibold text-navy">{ar ? v.ar[0] : v.en[0]}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{ar ? v.ar[1] : v.en[1]}</p>
          </div>
        ))}
      </div>
    </MarketingLayout>
  );
}
