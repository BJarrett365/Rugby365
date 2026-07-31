import type { CSSProperties } from "react";

export type SilhouetteAvatarProps = {
  name?: string | null;
  /** Match player image aspects used across badges / portraits. */
  aspect?: "portrait" | "square";
  decorative?: boolean;
  className?: string;
};

/**
 * Neutral dark rugby silhouette — fallback when no headshot (or image fails).
 * Same aspect ratios as real player images so layout never jumps.
 */
export function SilhouetteAvatar({
  name,
  aspect = "portrait",
  decorative = false,
  className,
}: SilhouetteAvatarProps) {
  const label = name?.trim() || "Player";
  const style: CSSProperties = {
    aspectRatio: aspect === "square" ? "1 / 1" : "3 / 4",
    width: "100%",
    height: "100%",
  };

  return (
    <span
      className={`pr-silhouette ${className ?? ""}`.trim()}
      style={style}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : `${label} avatar`}
    >
      <svg
        className="pr-silhouette__svg"
        viewBox="0 0 120 160"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
        focusable="false"
      >
        <rect width="120" height="160" fill="#0c2a32" />
        <ellipse cx="60" cy="42" rx="22" ry="24" fill="#1a4550" />
        <path
          d="M28 78c8-14 24-18 32-18s24 4 32 18c6 10 8 22 8 34v36H20v-36c0-12 2-24 8-34z"
          fill="#163a44"
        />
        <path
          d="M38 148h44c2 0 4 2 4 4v8H34v-8c0-2 2-4 4-4z"
          fill="#122f37"
        />
      </svg>
    </span>
  );
}
