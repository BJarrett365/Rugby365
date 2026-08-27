/**
 * Recolour only the shirt pixels in mascot PNGs — skin/hair/shorts stay untouched.
 * Kit-a sprites use purple (~#3C2173); kit-b uses navy (~#0D4878).
 */

export const SPRITE_KIT_A_BASE = "#3C2173";
export const SPRITE_KIT_A_ACCENT = "#4A2A8C";
export const SPRITE_KIT_B_BASE = "#0D4878";
export const SPRITE_KIT_B_ACCENT = "#135078";

type Rgb = { r: number; g: number; b: number };
type Hsl = { h: number; s: number; l: number };
type KitVariant = "a" | "b";

function parseHex(hex: string): Rgb | null {
  const raw = String(hex ?? "").trim().replace(/^#/, "");
  if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(raw)) return null;
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
  else if (max === gn) h = ((bn - rn) / d + 2) * 60;
  else h = ((rn - gn) / d + 4) * 60;
  return { h, s, l };
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let rn = 0;
  let gn = 0;
  let bn = 0;
  if (hp >= 0 && hp < 1) {
    rn = c;
    gn = x;
  } else if (hp < 2) {
    rn = x;
    gn = c;
  } else if (hp < 3) {
    gn = c;
    bn = x;
  } else if (hp < 4) {
    gn = x;
    bn = c;
  } else if (hp < 5) {
    rn = x;
    bn = c;
  } else {
    rn = c;
    bn = x;
  }
  const m = l - c / 2;
  return {
    r: Math.round((rn + m) * 255),
    g: Math.round((gn + m) * 255),
    b: Math.round((bn + m) * 255),
  };
}

function isSkinPixel(r: number, g: number, b: number): boolean {
  return r > 90 && g > 40 && g < 150 && b < 110 && r >= g - 25 && r > b + 10;
}

/** Shirt region on mascot sprites — not skin, boots, or pitch. */
function isKitPixel(
  r: number,
  g: number,
  b: number,
  variant: KitVariant,
): "primary" | "accent" | null {
  if (isSkinPixel(r, g, b)) return null;

  if (variant === "a") {
    // Purple/violet shirt (kit-a)
    if (r <= 100 && g <= 95 && b >= 100 && b > r + 20 && b > g + 25) return "primary";
    // Brighter violet trim on kit-a
    if (r <= 110 && g <= 100 && b >= 120 && b > r + 15 && b > g + 20) return "accent";
    return null;
  }

  // Navy shirt (kit-b)
  if (r <= 50 && g >= 45 && b >= 95 && b > g + 10 && b > r + 40) return "primary";
  if (r <= 60 && g >= 55 && b >= 110 && b > g + 8) return "accent";
  return null;
}

function shadeTarget(base: Rgb, sourceL: number, refL: number): Rgb {
  const { h, s } = rgbToHsl(base);
  const delta = sourceL - refL;
  const l = Math.max(0.05, Math.min(0.95, rgbToHsl(base).l + delta * 0.85));
  return hslToRgb({ h, s: Math.min(1, s * (0.85 + sourceL * 0.3)), l });
}

const tintCache = new Map<string, string>();
const tintInflight = new Map<string, Promise<string>>();

function cacheKey(
  src: string,
  primary: string,
  secondary: string,
  variant: KitVariant,
  skinHex?: string,
): string {
  return `${variant}|${src}|${primary}|${secondary}|${skinHex ?? ""}`;
}

/** Baked mid skin reference on kit-a mascot sprites. */
export const SPRITE_SKIN_BASE = "#a9673d";

/**
 * Returns a data-URL with shirt (+ optional skin) pixels remapped.
 * Hair and boots are preserved.
 */
export async function recolorKitSprite(
  src: string,
  primaryHex: string,
  secondaryHex?: string,
  variant: KitVariant = "a",
  skinHex?: string,
): Promise<string> {
  if (!src || typeof document === "undefined") return src;
  const primary = parseHex(primaryHex);
  if (!primary) return src;
  const secondary = parseHex(secondaryHex ?? primaryHex) ?? primary;
  const skinTarget = skinHex ? parseHex(skinHex) : null;
  const key = cacheKey(src, primaryHex, secondaryHex ?? primaryHex, variant, skinHex);
  const cached = tintCache.get(key);
  if (cached) return cached;

  const existing = tintInflight.get(key);
  if (existing) return existing;

  const baseHex = variant === "b" ? SPRITE_KIT_B_BASE : SPRITE_KIT_A_BASE;
  const accentHex = variant === "b" ? SPRITE_KIT_B_ACCENT : SPRITE_KIT_A_ACCENT;

  const promise = (async () => {
    const img = await loadImage(src);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return src;

    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data } = imageData;
    const primaryRefL = rgbToHsl(parseHex(baseHex)!).l;
    const accentRefL = rgbToHsl(parseHex(accentHex)!).l;
    const skinRefL = rgbToHsl(parseHex(SPRITE_SKIN_BASE)!).l;

    let changed = 0;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3]!;
      if (a < 20) continue;
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;

      if (skinTarget && isSkinPixel(r, g, b)) {
        const sourceL = rgbToHsl({ r, g, b }).l;
        const next = shadeTarget(skinTarget, sourceL, skinRefL);
        data[i] = next.r;
        data[i + 1] = next.g;
        data[i + 2] = next.b;
        changed++;
        continue;
      }

      const kind = isKitPixel(r, g, b, variant);
      if (!kind) continue;

      const sourceL = rgbToHsl({ r, g, b }).l;
      const next =
        kind === "accent"
          ? shadeTarget(secondary, sourceL, accentRefL)
          : shadeTarget(primary, sourceL, primaryRefL);
      data[i] = next.r;
      data[i + 1] = next.g;
      data[i + 2] = next.b;
      changed++;
    }

    if (changed === 0) return src;

    ctx.putImageData(imageData, 0, 0);
    const out = canvas.toDataURL("image/png");
    tintCache.set(key, out);
    return out;
  })();

  tintInflight.set(key, promise);
  try {
    return await promise;
  } finally {
    tintInflight.delete(key);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load sprite: ${src}`));
    img.src = src;
  });
}
