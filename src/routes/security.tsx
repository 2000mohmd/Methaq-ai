import { createFileRoute } from "@tanstack/react-router";
import { KeyRound, Lock, ScrollText, ShieldCheck } from "lucide-react";

import { MarketingLayout } from "@/components/MarketingLayout";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/security")({
  head: () => ({
    meta: [
      { title: "Security — Mithaq Alarabia" },
      { name: "description", content: "How Mithaq Alarabia protects your legal data: firm-level isolation, private files, role-based access and activity logs." },
      { property: "og:title", content: "Security at Mithaq Alarabia" },
      { property: "og:description", content: "Firm-level data isolation, private document storage, roles and audit logs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Security,
});

const ITEMS = [
  { icon: Lock, en: ["Firm-level isolation", "Every record belongs to your firm and is invisible to others."], ar: ["عزل على مستوى المكتب", "كل سجل يخص مكتبك ولا يراه غيرك."] },
  { icon: ShieldCheck, en: ["Private documents", "Files are stored privately and shared only through short-lived links."], ar: ["مستندات خاصة", "تُحفظ الملفات بشكل خاص وتُشارك عبر روابط مؤقتة فقط."] },
  { icon: KeyRound, en: ["Roles & permissions", "Owners, admins, lawyers, paralegals and more — each with the right access."], ar: ["الأدوار والصلاحيات", "مالك، مدير، محامٍ، مساعد قانوني وغيرهم — لكلٍ صلاحياته."] },
  { icon: ScrollText, en: ["Activity logs", "AI requests and sensitive actions are recorded for review."], ar: ["سجلات النشاط", "تُسجّل طلبات الذكاء الاصطناعي والإجراءات الحساسة للمراجعة."] },
];

function Security() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  return (
    <MarketingLayout
      title={ar ? "أمان يليق بعملك القانوني" : "Security worthy of legal work"}
      subtitle={ar ? "بياناتك وبيانات موكليك محمية منذ اليوم الأول." : "Your data and your clients' data, protected from day one."}
    >
      <div className="grid gap-6 sm:grid-cols-2">
        {ITEMS.map((v) => (
          <div key={v.en[0]} className="rounded-2xl border border-border bg-card p-8 shadow-soft">
            <v.icon className="size-6 text-teal" />
            <h2 className="mt-4 font-semibold text-navy">{ar ? v.ar[0] : v.en[0]}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{ar ? v.ar[1] : v.en[1]}</p>
          </div>
        ))}
      </div>
      <div className="mt-10 rounded-2xl border border-dashed border-border p-8 text-center">
        <h2 className="font-semibold text-navy">{ar ? "خارطة طريق الأمان" : "Security roadmap"}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {ar ? "نعمل على شهادات امتثال مستقلة. سنعلن عنها هنا عند اكتمالها." : "We are working toward independent compliance certifications and will list them here once completed."}
        </p>
      </div>
    </MarketingLayout>
  );
}
