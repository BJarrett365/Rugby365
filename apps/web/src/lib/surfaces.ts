export type SurfaceId = "mobile" | "tablet" | "desktop" | "app" | "tv" | "print";

export const SURFACE_IDS: SurfaceId[] = ["mobile", "tablet", "desktop", "app", "tv", "print"];

export const SURFACE_LABELS: Record<SurfaceId, string> = {
  mobile: "Mobile",
  tablet: "Tablet",
  desktop: "Desktop",
  app: "App",
  tv: "TV",
  print: "Print",
};

/** Detect surface from viewport, standalone PWA, and optional override. */
export function detectSurface(override?: string | null): SurfaceId {
  if (override && SURFACE_IDS.includes(override as SurfaceId)) {
    return override as SurfaceId;
  }

  if (typeof window === "undefined") return "desktop";

  if (window.matchMedia("(print)").matches) return "print";

  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone);

  if (standalone) return "app";

  const w = window.innerWidth;
  if (w >= 1920 && window.matchMedia("(pointer: coarse)").matches) return "tv";
  if (w >= 1280) return "desktop";
  if (w >= 768) return "tablet";
  return "mobile";
}

export function surfaceFromSearchParams(params: URLSearchParams): SurfaceId | null {
  const raw = params.get("surface");
  if (raw && SURFACE_IDS.includes(raw as SurfaceId)) return raw as SurfaceId;
  return null;
}
