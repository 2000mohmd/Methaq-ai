import { Languages } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

export function LanguageToggle({
  variant = "ghost",
  className,
}: {
  variant?: "ghost" | "onNavy";
  className?: string;
}) {
  const { toggleLang, t } = useI18n();
  return (
    <Button
      variant={variant}
      size="sm"
      onClick={toggleLang}
      className={cn("gap-2", className)}
    >
      <Languages />
      {t("common.language")}
    </Button>
  );
}
