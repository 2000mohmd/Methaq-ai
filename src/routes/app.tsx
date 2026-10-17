import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Bell,
  Building2,
  CalendarDays,
  Coins,
  FileText,
  FolderOpen,
  Gavel,
  LayoutGrid,
  LibraryBig,
  ListTodo,
  Mail,
  MessageSquare,
  PanelsTopLeft,
  Receipt,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Timer,
  UserRound,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { LogoLockup, LogoMark } from "@/components/brand/Logo";
import { HexPattern } from "@/components/brand/HexPattern";
import { LanguageToggle } from "@/components/LanguageToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { fetchProfile, type Profile } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app")({
  component: AppShell,
});

const GROUPS = [
  {
    label: "app.groupChat",
    items: [
      { to: "/app/chat", key: "app.chat", icon: MessageSquare },
      { to: "/app/workflows", key: "app.workflows", icon: Sparkles },
    ],
  },
  {
    label: "app.groupEfirm",
    items: [
      { to: "/app/matters", key: "app.matters", icon: Gavel },
      { to: "/app/clients", key: "app.clients", icon: Users },
      { to: "/app/kyc", key: "app.kyc", icon: ShieldCheck },
      { to: "/app/leads", key: "app.leads", icon: PanelsTopLeft },
      { to: "/app/tasks", key: "app.tasks", icon: ListTodo },
      { to: "/app/calendar", key: "app.calendar", icon: CalendarDays },
      { to: "/app/time", key: "app.time", icon: Timer },
      { to: "/app/billing", key: "app.billing", icon: Receipt },
      { to: "/app/emails", key: "app.emails", icon: Mail },
      { to: "/app/hr", key: "app.hr", icon: Building2 },
      { to: "/app/documents", key: "app.documents", icon: FolderOpen },
    ],
  },
  {
    label: "app.groupMore",
    items: [
      { to: "/app/library", key: "app.library", icon: LibraryBig },
      { to: "/app/portal", key: "app.portal", icon: UserRound },
      { to: "/app/admin", key: "app.admin", icon: ShieldCheck },
      { to: "/app/settings", key: "app.settings", icon: Settings },
    ],
  },
] as const;

// Individuals only see personal pages, not the firm-management modules.
const INDIVIDUAL_GROUPS = [
  {
    label: "app.groupChat",
    items: [
      { to: "/app/chat", key: "app.chat", icon: MessageSquare },
      { to: "/app/workflows", key: "app.workflows", icon: Sparkles },
      { to: "/app/documents", key: "app.documents", icon: FolderOpen },
      { to: "/app/library", key: "app.library", icon: LibraryBig },
      { to: "/app/settings", key: "app.settings", icon: Settings },
    ],
  },
] as const;

function AppShell() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [checking, setChecking] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      const user = data.session?.user;
      if (!user) {
        navigate({ to: "/auth" });
        return;
      }
      let loaded = await fetchProfile(user.id).catch(() => null);
      if (!active) return;
      if (loaded && !loaded.onboarded) {
        // A new user may have pending invitations (team member or client):
        // claiming them joins the firm and marks the profile onboarded.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: claimed } = await (supabase as any).rpc("claim_invitations");
        if ((claimed as number | null) && (claimed as number) > 0) {
          loaded = await fetchProfile(user.id).catch(() => null);
          if (loaded?.onboarded) {
            navigate({ to: "/app/portal" });
            return;
          }
        }
        if (!active) return;
        if (loaded && !loaded.onboarded && !window.location.pathname.startsWith("/app/portal")) {
          navigate({ to: "/onboarding" });
          return;
        }
      }
      setProfile(loaded);
      // Portal-only users (invited clients) get a reduced menu.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: roleRows } = await (supabase as any)
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const roles = (roleRows ?? []) as { role: string }[];
      if (roles.length > 0 && roles.every((r) => r.role === "client")) setIsClient(true);
      setChecking(false);
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  // Individuals can't open firm-management pages by typing the URL.
  const pathname = useLocation({ select: (l) => l.pathname });
  const individual = profile?.account_type === "individual";
  const allowed = INDIVIDUAL_GROUPS[0].items.some((i) => pathname.startsWith(i.to)) || pathname === "/app" || pathname === "/app/";
  useEffect(() => {
    if (!checking && individual && !allowed) navigate({ to: "/app/chat" });
  }, [checking, individual, allowed, navigate]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LogoMark className="h-10 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 z-50 flex w-72 shrink-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground transition-transform lg:static lg:h-screen lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full rtl:translate-x-full",
          "lg:rtl:translate-x-0",
        )}
      >
        <div className="border-b border-sidebar-border px-5 py-5">
          <Link to="/app">
            <LogoLockup tone="white" />
          </Link>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {(isClient
            ? [{ label: "app.groupMore", items: [{ to: "/app/portal", key: "app.portal", icon: UserRound }] as const }]
            : profile?.account_type === "individual"
              ? INDIVIDUAL_GROUPS
              : GROUPS
          ).map((group) => (
            <div key={group.label}>
              <p className="px-3 pb-2 text-[10px] tracking-[0.18em] text-sidebar-foreground/45 uppercase">
                {t(group.label)}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeProps={{
                        className:
                          "bg-sidebar-accent text-sidebar-accent-foreground border-s-2 border-sidebar-primary",
                      }}
                    >
                      <item.icon className="size-4 shrink-0" />
                      {t(item.key)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="relative overflow-hidden border-t border-sidebar-border p-5">
          <HexPattern className="text-white" opacity={0.08} />
          <p className="relative text-xs leading-relaxed text-sidebar-foreground/55">
            {t("brand.tagline2")}
          </p>
        </div>
      </aside>

      {mobileOpen && (
        <button
          type="button"
          aria-label="close menu"
          className="fixed inset-0 z-40 bg-navy/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <LayoutGrid />
          </Button>

          <div className="hidden items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground sm:flex">
            <Search className="size-4" />
            {t("app.search")}
          </div>

          <div className="ms-auto flex items-center gap-1.5">
            <span className="hidden items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground sm:inline-flex">
              <Coins className="size-3.5 text-teal" />
              {t("app.credits")}
            </span>
            <LanguageToggle />
            <Button variant="ghost" size="icon" aria-label={t("app.notifications")}>
              <Bell />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={t("app.profile")}>
                  <UserRound />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">
                  {profile?.full_name || profile?.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/app/settings">
                    <Settings className="size-4" />
                    {t("app.settings")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={signOut}>
                  <FileText className="size-4" />
                  {t("app.signOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
