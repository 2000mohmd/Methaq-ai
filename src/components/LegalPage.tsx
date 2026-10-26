import { MarketingLayout } from "@/components/MarketingLayout";
import { useI18n } from "@/i18n";

export type Section = { en: [string, string]; ar: [string, string] };

/** Shared layout for Terms / Privacy. Content is a DRAFT until the partner lawyer approves it. */
export function LegalPage({
  title,
  subtitle,
  sections,
}: {
  title: { en: string; ar: string };
  subtitle: { en: string; ar: string };
  sections: Section[];
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  return (
    <MarketingLayout title={ar ? title.ar : title.en} subtitle={ar ? subtitle.ar : subtitle.en}>
      <div className="mx-auto max-w-3xl">
        <p className="mb-8 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
          {ar ? "مسودة: هذا النص قيد المراجعة من محامٍ مرخّص ولم يُعتمد بعد." : "Draft: this text is pending review and approval by a licensed lawyer."}
        </p>
        <div className="space-y-8">
          {sections.map((s, i) => (
            <section key={i}>
              <h2 className="text-lg font-semibold text-navy">{ar ? s.ar[0] : s.en[0]}</h2>
              <p className="mt-2 leading-relaxed text-muted-foreground">{ar ? s.ar[1] : s.en[1]}</p>
            </section>
          ))}
        </div>
      </div>
    </MarketingLayout>
  );
}
