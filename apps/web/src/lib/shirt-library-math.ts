/**
 * Pure helpers for Shirt Library contrast + colour-clash checks.
 */

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** Parse #RGB / #RRGGBB / rgb() into [r,g,b] 0–255. */
export function parseHexColour(input: string | null | undefined): [number, number, number] | null {
  if (!input) return null;
  const raw = input.trim();
  const hex = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let h = hex[1]!;
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    return [
      Number.parseInt(h.slice(0, 2), 16),
      Number.parseInt(h.slice(2, 4), 16),
      Number.parseInt(h.slice(4, 6), 16),
    ];
  }
  const rgb = raw.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) {
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  }
  return null;
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const lin = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
}

export function contrastRatio(a: string, b: string): number | null {
  const ca = parseHexColour(a);
  const cb = parseHexColour(b);
  if (!ca || !cb) return null;
  const la = relativeLuminance(ca);
  const lb = relativeLuminance(cb);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Euclidean distance in sRGB (0–441). */
export function colourDistance(a: string, b: string): number | null {
  const ca = parseHexColour(a);
  const cb = parseHexColour(b);
  if (!ca || !cb) return null;
  const dr = ca[0] - cb[0];
  const dg = ca[1] - cb[1];
  const db = ca[2] - cb[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

export type NumberContrastResult = {
  ok: boolean;
  ratio: number | null;
  suggestedNumberColour: "#FFFFFF" | "#000000" | "#FFB81C";
  warning: string | null;
};

export function checkNumberContrast(input: {
  numberColour: string;
  bodyColour: string;
  patternColour?: string | null;
}): NumberContrastResult {
  const againstBody = contrastRatio(input.numberColour, input.bodyColour) ?? 0;
  const againstPattern = input.patternColour
    ? (contrastRatio(input.numberColour, input.patternColour) ?? againstBody)
    : againstBody;
  const ratio = Math.min(againstBody, againstPattern);

  const whiteVsBody = contrastRatio("#FFFFFF", input.bodyColour) ?? 0;
  const blackVsBody = contrastRatio("#000000", input.bodyColour) ?? 0;
  const goldVsBody = contrastRatio("#FFB81C", input.bodyColour) ?? 0;

  let suggested: "#FFFFFF" | "#000000" | "#FFB81C" = "#FFFFFF";
  let best = whiteVsBody;
  if (blackVsBody > best) {
    suggested = "#000000";
    best = blackVsBody;
  }
  if (goldVsBody > best && goldVsBody >= 3) {
    suggested = "#FFB81C";
  }

  const ok = ratio >= 3;
  return {
    ok,
    ratio: Number.isFinite(ratio) ? Math.round(ratio * 100) / 100 : null,
    suggestedNumberColour: suggested,
    warning: ok
      ? null
      : `Number colour may be hard to read (contrast ${ratio.toFixed(1)}:1). Try ${suggested}.`,
  };
}

export type ColourClashResult = {
  clash: boolean;
  distance: number | null;
  warning: string | null;
};

/** Warn when two shirt body colours are too similar (does not block override). */
export function checkShirtColourClash(input: {
  shirtAName: string;
  shirtABody: string;
  shirtBName: string;
  shirtBBody: string;
  threshold?: number;
}): ColourClashResult {
  const threshold = input.threshold ?? 55;
  const distance = colourDistance(input.shirtABody, input.shirtBBody);
  if (distance == null) {
    return { clash: false, distance: null, warning: null };
  }
  const clash = distance < threshold;
  return {
    clash,
    distance: Math.round(distance),
    warning: clash
      ? `Colour clash warning: ${input.shirtAName} is too similar to ${input.shirtBName}. Consider using an approved third shirt.`
      : null,
  };
}

export function pickReadableNumberColour(bodyColour: string): string {
  return checkNumberContrast({ numberColour: "#FFFFFF", bodyColour }).suggestedNumberColour;
}

export function normaliseHex(input: string, fallback = "#222222"): string {
  const parsed = parseHexColour(input);
  if (!parsed) return fallback;
  return `#${parsed.map((c) => clamp(c, 0, 255).toString(16).padStart(2, "0")).join("")}`;
}

export function teamSetStatus(input: {
  homeStatus: string | null;
  awayStatus: string | null;
  homeRequired?: boolean;
  awayRequired?: boolean;
}): import("./shirt-library-types").TeamShirtSetStatus {
  const homeRequired = input.homeRequired !== false;
  const awayRequired = input.awayRequired !== false;
  const statuses = [
    homeRequired ? input.homeStatus : "APPROVED",
    awayRequired ? input.awayStatus : "APPROVED",
  ];

  if (statuses.every((s) => s == null || s === "NOT_CREATED")) return "Not Started";
  if (statuses.some((s) => s === "CHANGES_REQUIRED")) return "Needs Changes";
  if (statuses.every((s) => s === "APPROVED")) return "Fully Approved";
  if (statuses.some((s) => s === "APPROVED") && statuses.some((s) => s !== "APPROVED")) {
    return "Partly Approved";
  }
  if (statuses.some((s) => s === "AWAITING_REVIEW")) return "Awaiting Approval";
  if (statuses.some((s) => s === "DRAFT" || s === "REJECTED")) return "In Progress";
  return "In Progress";
}
