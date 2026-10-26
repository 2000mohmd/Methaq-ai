import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { LogoLockup, LogoMark } from "@/components/brand/Logo";
import { HexPattern } from "@/components/brand/HexPattern";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useI18n } from "@/i18n";

export const MARKETING_LINKS = [
  { to: "/pricing", en: "Pricing", ar: "الأسعار" },
  { to: "/about", en: "About", ar: "من نحن" },
  { to: "/security", en: "Security", ar: "الأمان" },
] as const;

export function MarketingNav() {
  const { lang } = useI18n();
  return (
    <nav className="hidden items-center gap-5 text-sm text-muted-foreground md:flex">
      {MARKETING_LINKS.map((l) => (
        <Link key={l.to} to={l.to} className="hover:text-navy" activeProps={{ className: "text-navy font-medium" }}>
          {lang === "ar" ? l.ar : l.en}
        </Link>
      ))}
    </nav>
  );
}

export function MarketingLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const { t, lang } = useI18n();
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <Link to="/" aria-label={t("brand.name")}>
            <LogoLockup tone="navy" className="hidden sm:inline-flex" />
            <LogoMark className="sm:hidden" />
          </Link>
          <MarketingNav />
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <Button size="sm" asChild><Link to="/auth" search={{ mode: "signup" }}>{t("nav.getStarted")}</Link></Button>
          </div>
        </div>
      </header>
      <section className="relative overflow-hidden bg-navy text-primary-foreground">
        <HexPattern className="text-teal" opacity={0.08} />
        <div className="relative mx-auto max-w-4xl px-6 py-20 text-center">
          <p className="brand-caps text-[11px] text-teal">MITHAQ ALARABIA</p>
          <h1 className="mt-4 text-4xl font-semibold sm:text-5xl">{title}</h1>
          <p className="mx-auto mt-4 max-w-2xl opacity-80">{subtitle}</p>
        </div>
      </section>
      <main className="mx-auto max-w-6xl px-6 py-16">{children}</main>
      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        <p className="mb-2 flex justify-center gap-4">
          <Link to="/terms" className="hover:text-navy">{lang === "ar" ? "شروط الاستخدام" : "Terms"}</Link>
          <Link to="/privacy" className="hover:text-navy">{lang === "ar" ? "الخصوصية" : "Privacy"}</Link>
        </p>
        © {new Date().getFullYear()} Mithaq Alarabia · {t("brand.name")}
      </footer>
    </div>
  );
}
