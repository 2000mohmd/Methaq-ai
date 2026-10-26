import { cn } from "@/lib/utils";

// Official Mithaq Alarabia artwork (vector, extracted from the brand guide) served from /public/brand.
type Tone = "teal" | "navy" | "white";

export function LogoMark({ tone = "teal", className }: { tone?: Tone; className?: string }) {
  return (
    <img
      src={`/brand/mark-${tone}.svg`}
      alt="Mithaq Alarabia"
      className={cn("h-9 w-auto select-none", className)}
      draggable={false}
    />
  );
}

/** Full lockup: symbol + Arabic and English name + "Law & Legal Consultations" line. */
export function LogoLockup({
  tone = "navy",
  className,
}: {
  tone?: "navy" | "white";
  className?: string;
  markClassName?: string;
}) {
  return (
    <img
      src={`/brand/lockup-${tone}.svg`}
      alt="ميثاق العربية — Mithaq Alarabia"
      className={cn("h-12 w-auto select-none", className)}
      draggable={false}
    />
  );
}
