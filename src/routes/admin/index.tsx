import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { BarChart3 } from "lucide-react";

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Platform analytics — Mithaq" }] }),
  component: Platform,
});

type Stats = {
  users_total: number;
  users_7d: number;
  users_30d: number;
  active_7d: number;
  account_types: Record<string, number>;
  organizations: number;
  conversations: number;
  messages: number;
  documents: number;
  library_items: number;
  contracts: Record<string, number>;
  ai_actions_30d: Record<string, number>;
  daily: { day: string; signups: number; ai: number }[];
  recent_users: { email: string | null; created_at: string; full_name: string | null; account_type: string | null }[];
};

const L = (ar: string, en: string) => ({ ar, en });

const ACTIONS: Record<string, { ar: string; en: string }> = {
  "ai.chat": L("محادثة الذكاء الاصطناعي", "AI chat"),
  "ai.verify": L("التحقق من الاستشهادات", "Citation check"),
  "ai.council": L("وضع المجلس", "Council mode"),
  "contract.generated": L("إنشاء عقد", "Contract generated"),
  "contract.approved": L("اعتماد عقد", "Contract approved"),
  "contract.rejected": L("رفض عقد", "Contract rejected"),
};

const ACCOUNT_TYPES: Record<string, { ar: string; en: string }> = {
  lawyer: L("محامٍ", "Lawyer"),
  law_firm: L("مكتب محاماة", "Law firm"),
  in_house: L("إدارة قانونية", "In-house"),
  individual: L("فرد", "Individual"),
  unset: L("غير محدد", "Not set"),
};

function Platform() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const tr = (x: { ar: string; en: string }) => (ar ? x.ar : x.en);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lawyers, setLawyers] = useState<Record<string, number>>({});

  useEffect(() => {
    supabase.rpc("is_platform_admin").then(async ({ data }) => {
      setAllowed(!!data);
      if (!data) return;
      const [res, lw] = await Promise.all([supabase.rpc("platform_stats"), supabase.rpc("platform_stats_lawyers")]);
      if (lw.data) setLawyers(lw.data as Record<string, number>);
      if (res.error) setError(res.error.message);
      else setStats(res.data as unknown as Stats);
    });
  }, []);

  if (allowed === null) return <div className="p-4 text-sm text-muted-foreground sm:p-10">…</div>;
  if (!allowed) {
    return (
      <div className="p-4 sm:p-10">
        <BarChart3 className="size-6 text-teal" />
        <p className="mt-3 text-muted-foreground">
          {ar ? "هذه الصفحة متاحة لمشرفي المنصة فقط." : "Only platform administrators can open this page."}
        </p>
      </div>
    );
  }
  if (error) return <div className="p-4 text-sm text-destructive sm:p-10">{error}</div>;
  if (!stats) return <div className="p-4 text-sm text-muted-foreground sm:p-10">…</div>;

  const fmt = (n: number) => n.toLocaleString(ar ? "ar-SA" : "en-GB");
  const fmtDate = (d: string) => new Date(d).toLocaleDateString(ar ? "ar-SA" : "en-GB");
  const c = stats.contracts;

  const tiles: { label: string; value: number; to?: "/admin/review" | "/admin/lawyers" }[] = [
    { label: ar ? "إجمالي المستخدمين" : "Total users", value: stats.users_total },
    { label: ar ? "جدد (٧ أيام)" : "New (7d)", value: stats.users_7d },
    { label: ar ? "جدد (٣٠ يوماً)" : "New (30d)", value: stats.users_30d },
    { label: ar ? "نشطون (٧ أيام)" : "Active (7d)", value: stats.active_7d },
    { label: ar ? "المنظمات" : "Organizations", value: stats.organizations },
    { label: ar ? "المحادثات" : "Conversations", value: stats.conversations },
    { label: ar ? "الرسائل" : "Messages", value: stats.messages },
    { label: ar ? "المستندات" : "Documents", value: stats.documents },
    { label: ar ? "عقود قيد المراجعة" : "Contracts pending", value: c["pending_review"] ?? 0, to: "/admin/review" },
    { label: ar ? "عقود معتمدة" : "Contracts approved", value: c["approved"] ?? 0, to: "/admin/review" },
    { label: ar ? "عقود مرفوضة" : "Contracts rejected", value: c["rejected"] ?? 0, to: "/admin/review" },
    { label: ar ? "طلبات توثيق محامين" : "Lawyer applications pending", value: lawyers["pending"] ?? 0, to: "/admin/lawyers" },
  ];

  const types = Object.entries(stats.account_types).sort((a, b) => b[1] - a[1]);
  const maxType = Math.max(1, ...types.map(([, n]) => n));
  const actions = Object.entries(stats.ai_actions_30d).sort((a, b) => b[1] - a[1]);

  return (
    <div className="p-4 sm:p-10">
      <h1 className="text-2xl font-semibold text-navy">{ar ? "لوحة التحكم" : "Platform analytics"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {ar ? "نظرة عامة على استخدام المنصة." : "An overview of platform usage."}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {tiles.map((tile) => {
          const body = (
            <>
              <p className="text-xs text-muted-foreground">{tile.label}</p>
              <p className="mt-1 text-2xl font-semibold text-navy tabular-nums">{fmt(tile.value)}</p>
            </>
          );
          const cls = "block rounded-2xl border border-border bg-card p-4 shadow-soft";
          return tile.to ? (
            <Link key={tile.label} to={tile.to} className={`${cls} hover:border-teal`}>{body}</Link>
          ) : (
            <div key={tile.label} className={cls}>{body}</div>
          );
        })}
      </div>

      {/* Two measures of different scale → two charts, never a dual axis. */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Trend title={ar ? "التسجيلات اليومية (٣٠ يوماً)" : "Daily sign-ups (30 days)"} label={ar ? "تسجيلات" : "Sign-ups"}
          data={stats.daily} dataKey="signups" color="var(--chart-1)" ar={ar} />
        <Trend title={ar ? "طلبات الذكاء الاصطناعي اليومية (٣٠ يوماً)" : "Daily AI requests (30 days)"} label={ar ? "طلبات" : "Requests"}
          data={stats.daily} dataKey="ai" color="var(--chart-2)" ar={ar} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6">
          <h2 className="font-semibold text-navy">{ar ? "أنواع الحسابات" : "Account types"}</h2>
          {types.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">—</p>
          ) : (
            <ul className="mt-4 grid gap-3">
              {types.map(([k, n]) => (
                <li key={k} className="grid gap-1 text-sm" title={`${tr(ACCOUNT_TYPES[k] ?? L(k, k))}: ${fmt(n)}`}>
                  <span className="flex justify-between gap-2">
                    <span>{tr(ACCOUNT_TYPES[k] ?? L(k, k))}</span>
                    <span className="tabular-nums text-muted-foreground">{fmt(n)}</span>
                  </span>
                  <span className="h-2 rounded-full bg-muted">
                    <span className="block h-2 rounded-full bg-chart-2" style={{ width: `${(n / maxType) * 100}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6">
          <h2 className="font-semibold text-navy">{ar ? "الإجراءات (٣٠ يوماً)" : "Actions (30 days)"}</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[280px] text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="py-2 text-start font-normal">{ar ? "الإجراء" : "Action"}</th>
                  <th className="py-2 text-end font-normal">{ar ? "العدد" : "Count"}</th>
                </tr>
              </thead>
              <tbody>
                {actions.length === 0 && (
                  <tr><td colSpan={2} className="py-3 text-muted-foreground">—</td></tr>
                )}
                {actions.map(([k, n]) => (
                  <tr key={k} className="border-b border-border last:border-0">
                    <td className="py-2">
                      {ACTIONS[k] ? tr(ACTIONS[k]) : <span dir="ltr" className="font-mono text-xs">{k}</span>}
                    </td>
                    <td className="py-2 text-end tabular-nums">{fmt(n)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="mt-6 min-w-0 rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6">
        <h2 className="font-semibold text-navy">{ar ? "أحدث التسجيلات" : "Recent sign-ups"}</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="py-2 text-start font-normal">{ar ? "البريد الإلكتروني" : "Email"}</th>
                <th className="py-2 text-start font-normal">{ar ? "الاسم" : "Name"}</th>
                <th className="py-2 text-start font-normal">{ar ? "نوع الحساب" : "Account type"}</th>
                <th className="py-2 text-start font-normal">{ar ? "التاريخ" : "Date"}</th>
              </tr>
            </thead>
            <tbody>
              {stats.recent_users.map((u, i) => (
                <tr key={`${u.email}-${i}`} className="border-b border-border last:border-0">
                  <td className="py-2 pe-3" dir="ltr">{u.email ?? "—"}</td>
                  <td className="py-2 pe-3">{u.full_name || "—"}</td>
                  <td className="py-2 pe-3">{u.account_type ? tr(ACCOUNT_TYPES[u.account_type] ?? L(u.account_type, u.account_type)) : "—"}</td>
                  <td className="py-2 whitespace-nowrap">{fmtDate(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Trend({ title, label, data, dataKey, color, ar }: {
  title: string;
  label: string;
  data: Stats["daily"];
  dataKey: "signups" | "ai";
  color: string;
  ar: boolean;
}) {
  const config = { [dataKey]: { label, color } } satisfies ChartConfig;
  const total = data.reduce((s, d) => s + d[dataKey], 0);
  const short = (d: string) => new Date(d).toLocaleDateString(ar ? "ar-SA" : "en-GB", { day: "numeric", month: "short" });
  return (
    <section className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold text-navy">{title}</h2>
        <span className="text-sm tabular-nums text-muted-foreground">{total.toLocaleString(ar ? "ar-SA" : "en-GB")}</span>
      </div>
      <ChartContainer config={config} className="mt-4 aspect-auto h-56 w-full" dir="ltr">
        <AreaChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} strokeOpacity={0.4} />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={short} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
          <ChartTooltip cursor content={<ChartTooltipContent labelFormatter={(v) => short(String(v))} />} />
          <Area dataKey={dataKey} type="monotone" stroke={`var(--color-${dataKey})`} strokeWidth={2}
            fill={`var(--color-${dataKey})`} fillOpacity={0.15} />
        </AreaChart>
      </ChartContainer>
    </section>
  );
}
