import { HexPattern } from "@/components/brand/HexPattern";
import { useI18n } from "@/i18n";

export function ModulePlaceholder({ titleKey }: { titleKey: string }) {
  const { t } = useI18n();
  return (
    <div className="p-6 sm:p-10">
      <h1 className="text-2xl font-semibold text-navy">{t(titleKey)}</h1>
      <div className="relative mt-6 overflow-hidden rounded-2xl border border-border bg-navy-tint">
        <HexPattern className="text-navy" opacity={0.06} />
        <div className="relative max-w-md px-8 py-20">
          <p className="brand-caps text-[10px] text-teal">{t("app.comingSoon")}</p>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            {t("app.emptyBody")}
          </p>
        </div>
      </div>
    </div>
  );
}
