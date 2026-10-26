import { cn } from "@/lib/utils";

// Built-in vector logo (no image files). Replace with the final brand artwork once the name is cleared.
type Tone = "teal" | "navy" | "white";

const COLOR: Record<Tone, string> = {
  teal: "text-teal",
  navy: "text-navy",
  white: "text-white",
};

export function LogoMark({ tone = "teal", className }: { tone?: Tone; className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      role="img"
      aria-label="Mithaq Alarabia"
      className={cn("h-9 w-auto select-none", COLOR[tone], className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinejoin="round"
    >
      <path d="M24 3 42 13.5v21L24 45 6 34.5v-21z" />
      <text x="24" y="31" textAnchor="middle" fontSize="22" fontWeight="700" fill="currentColor" stroke="none" fontFamily="'IBM Plex Sans Arabic','Noto Naskh Arabic',Arial,sans-serif">
        م
      </text>
    </svg>
  );
}

export function LogoLockup({
  tone = "navy",
  className,
  markClassName,
}: {
  tone?: "navy" | "white";
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <span className={cn("flex flex-col leading-tight", COLOR[tone])}>
        <span className="text-lg font-bold">ميثاق العربية</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.25em] opacity-70">Mithaq Alarabia</span>
      </span>
      <LogoMark tone="teal" className={cn("h-10", markClassName)} />
    </span>
  );
}
