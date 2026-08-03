export type MatchMediaIconVariant = "listen" | "animation" | "watchalong" | "highlights";

/**
 * Shared media glyphs for Match Centre header chips and fixtures schedule rows.
 */
export function MatchMediaIcon({
  variant,
  size = 16,
  className,
}: {
  variant: MatchMediaIconVariant;
  size?: number;
  className?: string;
}) {
  const common = {
    className,
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    "aria-hidden": true as const,
  };

  if (variant === "listen") {
    return (
      <svg {...common}>
        <path
          d="M4 12a5 5 0 0 1 5-5h1v10H9a5 5 0 0 1-5-5Z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <path
          d="M15 7h1a5 5 0 0 1 0 10h-1V7Z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <path
          d="M10 8.5v7M14 8.5v7"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (variant === "animation") {
    return (
      <svg {...common}>
        <path
          d="M2 12h3l2.2-5.5L11 18l2.8-8.5L16.5 12H22"
          stroke="currentColor"
          strokeWidth="1.85"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (variant === "watchalong") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.75" />
        <path d="M10 8.75v6.5L16 12 10 8.75Z" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <rect
        x="3.5"
        y="6"
        width="17"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path d="M3.5 9.5h17M3.5 14.5h17" stroke="currentColor" strokeWidth="1.25" opacity="0.55" />
      <path d="M10 9.6v4.8L14.6 12 10 9.6Z" fill="currentColor" />
    </svg>
  );
}
