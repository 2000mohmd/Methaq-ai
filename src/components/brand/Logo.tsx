import markTeal from "@/assets/mark-teal.png.asset.json";
import markNavy from "@/assets/mark-navy.png.asset.json";
import markWhite from "@/assets/mark-white.png.asset.json";
import lockupWhite from "@/assets/lockup-white.png.asset.json";
import lockupNavy from "@/assets/lockup-navy.png.asset.json";
import { cn } from "@/lib/utils";

type Tone = "teal" | "navy" | "white";

const marks: Record<Tone, { url: string }> = {
  teal: markTeal,
  navy: markNavy,
  white: markWhite,
};

export function LogoMark({
  tone = "teal",
  className,
}: {
  tone?: Tone;
  className?: string;
}) {
  return (
    <img
      src={marks[tone].url}
      alt="Mithaq Alarabia"
      className={cn("h-9 w-auto select-none", className)}
      draggable={false}
    />
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
  const wordmark = tone === "white" ? lockupWhite : lockupNavy;
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <img
        src={wordmark.url}
        alt="ميثاق العربية — Mithaq Alarabia"
        className="h-10 w-auto select-none"
        draggable={false}
      />
      <LogoMark
        tone={tone === "white" ? "teal" : "teal"}
        className={cn("h-10", markClassName)}
      />
    </span>
  );
}
