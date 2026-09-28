import { cn } from "@/lib/utils";

/**
 * Tonal hexagon pattern derived from the brand mark.
 * Very low contrast: used behind auth screens, heroes and empty states.
 */
export function HexPattern({
  className,
  opacity = 0.14,
}: {
  className?: string;
  opacity?: number;
}) {
  return (
    <svg
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
      style={{ opacity }}
    >
      <defs>
        <pattern
          id="mithaq-hex"
          width="88"
          height="152"
          patternUnits="userSpaceOnUse"
          patternTransform="scale(0.85)"
        >
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinejoin="round"
          >
            <path d="M44 4 L80 25 L80 67 L44 88 L8 67 L8 25 Z" />
            <path d="M44 80 L104 101 L104 143 L44 164 L-16 143 L-16 101 Z" />
            <path d="M44 28 L62 38 L62 58 L44 68 L26 58 L26 38 Z" opacity="0.6" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#mithaq-hex)" />
    </svg>
  );
}
