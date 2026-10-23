import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight, ArrowLeft, ScrollText, Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LogoLockup, LogoMark } from "@/components/brand/Logo";
import { HexPattern } from "@/components/brand/HexPattern";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { MarketingNav } from "@/components/MarketingLayout";
import heroDesk from "@/assets/hero-desk.jpg";
import columns from "@/assets/columns.jpg";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "Mithaq Alarabia — Your Voice in the Legal Arena" },
      {
        name: "description",
        content:
          "Mithaq Alarabia is a bilingual legal AI operating system: a jurisdiction-aware assistant plus full practice management for law firms, in-house teams and individuals.",
      },
      { property: "og:title", content: "Mithaq Alarabia — Your Voice in the Legal Arena" },
      {
        property: "og:description",
        content:
          "Jurisdiction-aware legal AI with citations, joined to matters, clients, hearings, time and billing. Arabic and English.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Landing() {
  const { t, dir } = useI18n();
  const Arrow = dir === "rtl" ? ArrowLeft : ArrowRight;
  const navigate = useNavigate();

  // Email-confirmation and Google sign-in links can land here (the project's Site URL).
  // When the URL carries auth tokens, send the new session on to the app instead of the homepage.
  useEffect(() => {
    const callback = /access_token=|[?&]code=|type=(signup|recovery|magiclink)/.test(window.location.hash + window.location.search);
    if (!callback) return;
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/app" });
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-6 py-3">
          <Link to="/" aria-label={t("brand.name")}>
            <LogoLockup tone="navy" className="hidden sm:inline-flex" />
            <LogoMark className="sm:hidden" />
          </Link>
          <MarketingNav />
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <Button variant="ghost" size="sm" asChild>
              <Link to="/auth">{t("nav.signin")}</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/auth" search={{ mode: "signup" }}>
                {t("nav.getStarted")}
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-navy text-white">
        <HexPattern className="text-white" opacity={0.1} />
        <img
          src={heroDesk}
          alt=""
          width={1600}
          height={1200}
          className="absolute inset-0 h-full w-full object-cover opacity-25 mix-blend-luminosity"
        />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-6 py-24 md:py-32">
          <div className="max-w-2xl">
            <p className="brand-caps text-xs text-teal">{t("home.heroKicker")}</p>
            <h1 className="mt-6 text-4xl leading-tight font-semibold md:text-6xl">
              {t("home.heroTitle")}
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/75">
              {t("home.heroSubtitle")}
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button variant="teal" size="xl" asChild>
                <Link to="/auth" search={{ mode: "signup" }}>
                  {t("home.ctaPrimary")}
                  <Arrow />
                </Link>
              </Button>
              <Button variant="onNavy" size="xl" asChild>
                <a href="#products">{t("home.ctaSecondary")}</a>
              </Button>
            </div>
          </div>
          <p className="max-w-md border-s-2 border-teal ps-4 text-sm leading-relaxed text-white/55">
            {t("brand.tagline2")}
          </p>
        </div>
      </section>

      <section id="products" className="mx-auto max-w-6xl px-6 py-24">
        <h2 className="text-3xl font-semibold text-navy md:text-4xl">
          {t("home.products")}
        </h2>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <article className="rounded-2xl border border-border bg-card p-8 shadow-soft transition-shadow hover:shadow-lift">
            <ScrollText className="size-7 text-teal" />
            <h3 className="mt-5 text-xl font-semibold text-navy">{t("nav.chat")}</h3>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              {t("home.chatDesc")}
            </p>
          </article>
          <article className="rounded-2xl border border-border bg-card p-8 shadow-soft transition-shadow hover:shadow-lift">
            <Building2 className="size-7 text-teal" />
            <h3 className="mt-5 text-xl font-semibold text-navy">{t("nav.efirm")}</h3>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              {t("home.efirmDesc")}
            </p>
          </article>
        </div>
      </section>

      <section className="border-y border-border bg-navy-tint">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-24 md:grid-cols-2">
          <div>
            <p className="brand-caps text-xs text-teal">{t("home.about")}</p>
            <p className="mt-6 text-xl leading-relaxed text-navy md:text-2xl">
              {t("home.mission")}
            </p>
            <p className="mt-8 text-sm text-muted-foreground">{t("brand.tagline2")}</p>
          </div>
          <img
            src={columns}
            alt=""
            loading="lazy"
            width={1408}
            height={1008}
            className="rounded-2xl object-cover shadow-lift"
          />
        </div>
      </section>

      <footer className="relative overflow-hidden bg-navy text-white/70">
        <HexPattern className="text-white" opacity={0.07} />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-6 px-6 py-14 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <LogoLockup tone="white" />
            <p className="mt-5 text-sm">www.mithaqalarabia.com</p>
          </div>
          <p className="text-xs">
            © {new Date().getFullYear()} {t("brand.name")}. {t("home.footerRights")}
          </p>
        </div>
      </footer>
    </div>
  );
}
