/**
 * Rugby365 media design tokens — aspect ratios and size presets.
 * Colours/fonts stay on the Planet Rugby CMS/public theme.
 */

export const MEDIA_ASPECT = {
  square: "1 / 1",
  portrait: "3 / 4",
  landscape: "16 / 9",
  og: "1.91 / 1",
  hero: "21 / 9",
} as const;

export type MediaAspect = keyof typeof MEDIA_ASPECT;

export const MEDIA_SIZE = {
  thumbnail: { width: 160, height: 160 },
  card: { width: 400, height: 300 },
  square: { width: 600, height: 600 },
  portrait: { width: 600, height: 800 },
  landscape: { width: 1200, height: 675 },
  hero: { width: 1600, height: 686 },
  og: { width: 1200, height: 630 },
  twitter: { width: 1200, height: 628 },
  discover: { width: 1200, height: 675 },
} as const;

export type MediaSizePreset = keyof typeof MEDIA_SIZE;

export const MEDIA_LICENCES = [
  "planet_rugby",
  "club_supplied",
  "getty",
  "inpho",
  "shutterstock",
  "staff",
  "creative_commons",
  "unknown",
] as const;

export type MediaLicence = (typeof MEDIA_LICENCES)[number];

export const MEDIA_LICENCE_LABELS: Record<MediaLicence, string> = {
  planet_rugby: "Planet Rugby",
  club_supplied: "Club supplied",
  getty: "Getty",
  inpho: "Inpho",
  shutterstock: "Shutterstock",
  staff: "Staff photographer",
  creative_commons: "Creative Commons",
  unknown: "Unknown",
};

/** Hosts we optimise via next/image. */
export const MEDIA_OPTIMIZED_HOST_SUFFIXES = [
  "images.ps-aws.com",
  "d3gbf3ykm8gp5c.cloudfront.net",
  "planetrugby.com",
  "supabase.co",
  "upload.wikimedia.org",
  "commons.wikimedia.org",
  "wikipedia.org",
  "rugbypass.com",
  "wp.com",
] as const;

export function isOptimizedMediaHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  return MEDIA_OPTIMIZED_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
}

export function canOptimizeMediaUrl(raw: string | null | undefined): boolean {
  if (!raw?.trim()) return false;
  try {
    const url = new URL(raw.trim());
    return (url.protocol === "http:" || url.protocol === "https:") && isOptimizedMediaHost(url.hostname);
  } catch {
    return false;
  }
}

export function defaultAltText(name: string, kind?: string | null): string {
  const label = kind?.trim() ? ` ${kind.trim()}` : "";
  return `${name.trim()}${label}`.trim() || "Rugby365 image";
}

export function objectPositionFromFocal(
  focalX: number | null | undefined,
  focalY: number | null | undefined,
): string | undefined {
  if (focalX == null || focalY == null) return undefined;
  const x = Math.min(100, Math.max(0, focalX));
  const y = Math.min(100, Math.max(0, focalY));
  return `${x}% ${y}%`;
}
