"use client";

import { MediaImage } from "@/components/media/MediaImage";
import { defaultAltText } from "@/lib/media-tokens";

function teamInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return name.trim().slice(0, 2).toUpperCase() || "?";
}

const SIZE_PX = { sm: 28, md: 40, lg: 56 } as const;

/**
 * Team crest — Planet Rugby circular badge.
 * Decorative by default when adjacent team name is present.
 */
export function TeamCrest({
  name,
  imageUrl,
  size = "md",
  labelled = false,
}: {
  name: string;
  imageUrl?: string | null;
  size?: "sm" | "md" | "lg";
  /** When true, crest is meaningful alone and gets an alt name. */
  labelled?: boolean;
}) {
  const px = SIZE_PX[size];
  const initials = teamInitials(name);
  const className = `pr-team-crest pr-team-crest--${size}`;

  if (imageUrl) {
    return (
      <MediaImage
        src={imageUrl}
        alt={labelled ? `${name} crest` : ""}
        decorative={!labelled}
        width={px}
        height={px}
        objectFit="contain"
        className={className}
        sizes={`${px}px`}
        fallback={
          <span className={`${className} pr-team-crest--placeholder`} aria-hidden>
            {initials}
          </span>
        }
      />
    );
  }

  return (
    <span
      className={`${className} pr-team-crest--placeholder`}
      aria-hidden={!labelled}
      role={labelled ? "img" : undefined}
      aria-label={labelled ? `${name} crest` : undefined}
    >
      {initials}
    </span>
  );
}

export { defaultAltText };
