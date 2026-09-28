import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, MessageSquare } from "lucide-react";

import { HexPattern } from "@/components/brand/HexPattern";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/app/")({
  component: Workspace,
});

function Workspace() {
  const { t } = useI18n();

  return (
    <div className="p-6 sm:p-10">
      <div className="relative overflow-hidden rounded-2xl bg-navy p-8 text-white sm:p-12">
        <HexPattern className="text-white" opacity={0.1} />
        <div className="relative max-w-xl">
          <p className="brand-caps text-[10px] text-teal">{t("brand.name")}</p>
          <h1 className="mt-4 text-3xl font-semibold">{t("app.welcome")}</h1>
          <p className="mt-4 leading-relaxed text-white/70">{t("app.welcomeBody")}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-border bg-card p-7 shadow-soft">
          <MessageSquare className="size-6 text-teal" />
          <h2 className="mt-4 text-lg font-semibold text-navy">{t("app.chat")}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {t("home.chatDesc")}
          </p>
          <Button variant="outline" className="mt-5" asChild>
            <Link to="/app/chat">{t("app.open")}</Link>
          </Button>
        </article>
        <article className="rounded-2xl border border-border bg-card p-7 shadow-soft">
          <Building2 className="size-6 text-teal" />
          <h2 className="mt-4 text-lg font-semibold text-navy">{t("app.matters")}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {t("home.efirmDesc")}
          </p>
          <Button variant="outline" className="mt-5" asChild>
            <Link to="/app/matters">{t("app.open")}</Link>
          </Button>
        </article>
      </div>

      <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
        {t("app.disclaimer")}
      </p>
    </div>
  );
}
