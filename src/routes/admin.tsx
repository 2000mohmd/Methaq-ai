import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeftRight, BadgeCheck, BarChart3, LayoutGrid, LogOut, Scale, UserCog, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LogoLockup, LogoMark } from "@/components/brand/Logo";
import { HexPattern } from "@/components/brand/HexPattern";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Platform admin — Mithaq" }] }),
  component: AdminShell,
});

// Platform staff only (platform_staff): admins see everything, lawyers see document review.
const ITEMS = [
  { to: "/admin", en: "Analytics", ar: "التحليلات", icon: BarChart3, adminOnly: true },
  { to: "/admin/review", en: "Document review", ar: "مراجعة المستندات", icon: Scale, adminOnly: false },
  { to: "/admin/lawyers", en: "Lawyer approvals", ar: "توثيق المحامين", icon: BadgeCheck, adminOnly: true },
  { to: "/admin/users", en: "Users", ar: "المستخدمون", icon: Users, adminOnly: true },
  { to: "/admin/team", en: "Team & access", ar: "الفريق والصلاحيات", icon: UserCog, adminOnly: true },
] as const;

function AdminShell() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const navigate = useNavigate();
  const pathname = useLocation({ select: (l) => l.pathname });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "lawyer" | "none" | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      const user = data.session?.user;
      if (!user) {
        navigate({ to: "/auth" });
        return;
      }
      const [{ data: staff }, { data: admin }] = await Promise.all([supabase.rpc("is_reviewer"), supabase.rpc("is_platform_admin")]);
      if (!active) return;
      setEmail(user.email ?? "");
      setRole(admin ? "admin" : staff ? "lawyer" : "none");
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  // Lawyers have no analytics: send them to the review queue.
  useEffect(() => {
    if (role === "lawyer" && !pathname.startsWith("/admin/review")) {
      navigate({ to: "/admin/review" });
    }
  }, [role, pathname, navigate]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  if (role === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LogoMark className="h-10 animate-pulse" />
      </div>
    );
  }

  if (role === "none") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <LogoMark className="h-10" />
        <p className="text-sm text-muted-foreground">
          {ar ? "هذه الصفحة متاحة لفريق إدارة المنصة فقط." : "This area is for the platform team only."}
        </p>
        <Button asChild variant="outline"><Link to="/app">{ar ? "العودة إلى التطبيق" : "Back to the app"}</Link></Button>
      </div>
    );
  }

  const items = ITEMS.filter((i) => role === "admin" || !i.adminOnly);

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 start-0 z-50 flex w-72 max-w-[85vw] shrink-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground transition-transform lg:static lg:h-dvh lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full rtl:translate-x-full",
          "lg:rtl:translate-x-0",
        )}
      >
        <div className="border-b border-sidebar-border px-5 py-5">
          <Link to="/admin"><LogoLockup tone="white" /></Link>
          <p className="mt-3 text-[11px] tracking-[0.18em] text-sidebar-primary uppercase">{ar ? "إدارة المنصة" : "Platform admin"}</p>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <ul className="space-y-0.5">
            {items.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  activeOptions={{ exact: item.to === "/admin" }}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:py-2"
                  activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground border-s-2 border-sidebar-primary" }}
                >
                  <item.icon className="size-4 shrink-0" />
                  {ar ? item.ar : item.en}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="relative space-y-2 overflow-hidden border-t border-sidebar-border p-4">
          <HexPattern className="text-white" opacity={0.08} />
          <p className="relative truncate text-xs text-sidebar-foreground/60">{email}</p>
          <Link to="/app" className="relative flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent">
            <ArrowLeftRight className="size-4" /> {ar ? "العودة إلى التطبيق" : "Back to app"}
          </Link>
          <button onClick={signOut} className="relative flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent">
            <LogOut className="size-4" /> {ar ? "تسجيل الخروج" : "Sign out"}
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <button type="button" aria-label="close menu" className="fixed inset-0 z-40 bg-navy/50 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background/90 px-3 backdrop-blur sm:px-6">
          <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 lg:hidden" aria-label="menu" onClick={() => setMobileOpen(true)}>
            <LayoutGrid />
          </Button>
          <p className="text-sm font-semibold text-navy">{ar ? "لوحة إدارة المنصة" : "Platform admin"}</p>
          <div className="ms-auto"><LanguageToggle className="h-10 px-2.5 sm:h-8 sm:px-3" /></div>
        </header>
        <main className="min-w-0 flex-1"><Outlet /></main>
      </div>
    </div>
  );
}
