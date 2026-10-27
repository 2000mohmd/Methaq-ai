// Shared by /app/lawyer and /app/lawyers ("-" prefix keeps it out of the route tree).
export const SPECIALTIES = [
  ["personal_status", "أحوال شخصية", "Personal status"],
  ["labour", "عمالي", "Labour"],
  ["commercial", "تجاري", "Commercial"],
  ["criminal", "جنائي", "Criminal"],
  ["real_estate", "عقاري", "Real estate"],
  ["administrative", "إداري", "Administrative"],
  ["arbitration", "تحكيم", "Arbitration"],
  ["ip", "ملكية فكرية", "Intellectual property"],
] as const;

type Status = { ar: string; en: string; cls: string };
export const statusOf = (s: string): Status => STATUS[s as keyof typeof STATUS] ?? STATUS.pending;
export const STATUS: Record<"pending" | "approved" | "rejected", Status> = {
  pending: { ar: "قيد المراجعة", en: "Under review", cls: "bg-amber-100 text-amber-900" },
  approved: { ar: "موثّق", en: "Verified", cls: "bg-emerald-100 text-emerald-900" },
  rejected: { ar: "مرفوض", en: "Rejected", cls: "bg-red-100 text-red-900" },
};
