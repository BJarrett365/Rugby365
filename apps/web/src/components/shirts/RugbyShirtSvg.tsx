"use client";

import { useId, type ReactNode } from "react";
import type { ShirtKitType, ShirtPatternType, ShirtSvgConfig } from "@/lib/shirt-library-types";
export { shirtConfigFromVersion } from "@/lib/shirt-svg-config";

export type RugbyShirtSvgProps = Partial<ShirtSvgConfig> & {
  teamId?: string | null;
  kitType?: ShirtKitType | string;
  number?: number | string | null;
  size?: number;
  showCrest?: boolean;
  crestUrl?: string | null;
  className?: string;
  title?: string;
};

function patternOverlay(
  type: string,
  colour: string,
  opacity: number,
  uid: string,
): { defs: ReactNode; fill: string } | null {
  const c = colour || "#ffffff";
  const o = Math.min(1, Math.max(0.08, opacity));

  switch (type) {
    case "HOOPS":
    case "HORIZONTAL_STRIPES":
      return {
        defs: (
          <pattern id={`p-${uid}`} width="80" height="9" patternUnits="userSpaceOnUse">
            <rect width="80" height="4.5" fill={c} fillOpacity={o} />
          </pattern>
        ),
        fill: `url(#p-${uid})`,
      };
    case "VERTICAL_STRIPES":
      return {
        defs: (
          <pattern id={`p-${uid}`} width="8" height="90" patternUnits="userSpaceOnUse">
            <rect width="4" height="90" fill={c} fillOpacity={o} />
          </pattern>
        ),
        fill: `url(#p-${uid})`,
      };
    case "HALVES":
      return {
        defs: (
          <linearGradient id={`p-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="50%" stopColor={c} stopOpacity={o} />
            <stop offset="50%" stopColor="transparent" />
          </linearGradient>
        ),
        fill: `url(#p-${uid})`,
      };
    case "QUARTERS":
      return {
        defs: (
          <pattern id={`p-${uid}`} width="32" height="36" patternUnits="userSpaceOnUse">
            <rect width="16" height="18" fill={c} fillOpacity={o} />
            <rect x="16" y="18" width="16" height="18" fill={c} fillOpacity={o} />
          </pattern>
        ),
        fill: `url(#p-${uid})`,
      };
    case "SASH":
      return {
        defs: (
          <pattern
            id={`p-${uid}`}
            width="80"
            height="90"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-32)"
          >
            <rect x="30" width="10" height="120" fill={c} fillOpacity={o} />
          </pattern>
        ),
        fill: `url(#p-${uid})`,
      };
    case "GRADIENT":
      return {
        defs: (
          <linearGradient id={`p-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c} stopOpacity={o * 0.9} />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        ),
        fill: `url(#p-${uid})`,
      };
    default:
      return null;
  }
}

/**
 * Rugby365 jersey template — athletic polo silhouette inspired by modern international kits.
 * Sponsor-free. Colours/patterns from Shirt Library only.
 */
export function RugbyShirtSvg({
  bodyColour = "#222222",
  secondaryColour = null,
  sleeveColour = null,
  collarColour = null,
  cuffColour = null,
  sidePanelColour = null,
  patternType = "PLAIN",
  patternColour = null,
  patternSettings = {},
  numberColour = "#FFFFFF",
  numberBorderColour = null,
  number = null,
  size = 64,
  showCrest = false,
  crestUrl = null,
  crestEnabled,
  className,
  title,
  kitType,
}: RugbyShirtSvgProps) {
  const uid = useId().replace(/:/g, "");
  const body = bodyColour || "#222222";
  const sleeve = sleeveColour || body;
  const collar = collarColour || body;
  const cuff = cuffColour || body;
  const side = sidePanelColour || null;
  const pColour = patternColour || secondaryColour || "#ffffff";
  const opacity = patternSettings?.opacity ?? 0.35;
  const fabricOn = patternSettings?.fabricTexture !== false;
  // Keep emboss subtle — loud patterns belong in patternType, not fabric texture.
  const fabricOp = Math.min(0.12, Math.max(0.03, patternSettings?.fabricTextureOpacity ?? 0.06));
  const cuffBands = Array.isArray(patternSettings?.cuffBands)
    ? patternSettings.cuffBands.filter((c): c is string => typeof c === "string" && Boolean(c))
    : [];
  const crestOn = showCrest || crestEnabled === true;
  const type = String(patternType as ShirtPatternType);
  const pat = patternOverlay(type, pColour, opacity, uid);
  const num = number == null || number === "" ? null : String(number);
  const strokeNum = numberBorderColour || "rgba(0,0,0,0.22)";

  /*
   * Athletic torso: narrower shoulders → wider chest → slight waist → curved hem.
   * Set-in short sleeves (not raglan triangles). Stand collar + short V placket.
   */
  const bodyPath =
    "M16.6 16.8 " +
    "C18.4 13.6 20.8 11.8 24 11.8 " +
    "C27.2 11.8 29.6 13.6 31.4 16.8 " +
    "L34.8 15.2 " +
    "C36.2 17.8 37.2 21.2 37.6 25.2 " +
    "L38.4 52.2 " +
    "C38.4 54.6 36.4 56.2 34 56.2 " +
    "L14 56.2 " +
    "C11.6 56.2 9.6 54.6 9.6 52.2 " +
    "L10.4 25.2 " +
    "C10.8 21.2 11.8 17.8 13.2 15.2 " +
    "Z";

  // Set-in sleeves — short, rounded, mid-bicep
  const leftSleeve =
    "M16.6 16.8 " +
    "C13.8 18.6 10.2 21.4 7.4 25.6 " +
    "C6.6 26.8 6.4 28.2 6.8 29.4 " +
    "L10.6 33.2 " +
    "C12.8 30.2 15.2 27.4 17.8 25.2 " +
    "L18.6 20.8 Z";
  const rightSleeve =
    "M31.4 16.8 " +
    "C34.2 18.6 37.8 21.4 40.6 25.6 " +
    "C41.4 26.8 41.6 28.2 41.2 29.4 " +
    "L37.4 33.2 " +
    "C35.2 30.2 32.8 27.4 30.2 25.2 " +
    "L29.4 20.8 Z";

  return (
    <svg
      className={className}
      viewBox="0 0 48 60"
      width={size}
      height={Math.round((size * 60) / 48)}
      role="img"
      aria-label={title ?? (kitType ? `${kitType} rugby shirt` : "Rugby shirt")}
    >
      <defs>
        {pat?.defs}

        {/* Soft product lighting — keeps body colour vivid */}
        <radialGradient id={`chest-hi-${uid}`} cx="38%" cy="28%" r="55%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.34" />
          <stop offset="45%" stopColor="#ffffff" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`side-shade-${uid}`} x1="0" y1="0.2" x2="1" y2="0.8">
          <stop offset="0%" stopColor="#000000" stopOpacity="0.18" />
          <stop offset="35%" stopColor="#000000" stopOpacity="0" />
          <stop offset="65%" stopColor="#000000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id={`sleeve-hi-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.12" />
        </linearGradient>

        {/* Soft tonal emboss — barely visible at pitch size */}
        <pattern id={`fabric-${uid}`} width="5" height="5" patternUnits="userSpaceOnUse">
          <circle cx="2.5" cy="2.5" r="0.7" fill="#fff" fillOpacity={fabricOp} />
        </pattern>

        <clipPath id={`clip-${uid}`}>
          <path d={bodyPath} />
        </clipPath>
        <clipPath id={`sleeve-l-${uid}`}>
          <path d={leftSleeve} />
        </clipPath>
        <clipPath id={`sleeve-r-${uid}`}>
          <path d={rightSleeve} />
        </clipPath>

        <filter id={`lift-${uid}`} x="-15%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="1.6" stdDeviation="1.3" floodColor="#000" floodOpacity="0.4" />
        </filter>
      </defs>

      <g filter={`url(#lift-${uid})`}>
        {/* Sleeves behind body edge */}
        <path d={leftSleeve} fill={sleeve} />
        <path d={rightSleeve} fill={sleeve} />
        <path d={leftSleeve} fill={`url(#sleeve-hi-${uid})`} />
        <path d={rightSleeve} fill={`url(#sleeve-hi-${uid})`} />
        {fabricOn ? (
          <>
            <path d={leftSleeve} fill={`url(#fabric-${uid})`} />
            <path d={rightSleeve} fill={`url(#fabric-${uid})`} />
          </>
        ) : null}

        {/* Body volume */}
        <path d={bodyPath} fill={body} />
        <g clipPath={`url(#clip-${uid})`}>
          <rect x="9" y="11" width="30" height="46" fill={`url(#chest-hi-${uid})`} />
          <rect x="9" y="11" width="30" height="46" fill={`url(#side-shade-${uid})`} />
          {fabricOn ? <rect x="9" y="11" width="30" height="46" fill={`url(#fabric-${uid})`} /> : null}
        </g>

        {side ? (
          <g clipPath={`url(#clip-${uid})`} opacity={0.9}>
            <path d="M10.2 24 L13.8 24 L13.2 53 L10 53 Z" fill={side} />
            <path d="M37.8 24 L34.2 24 L34.8 53 L38 53 Z" fill={side} />
          </g>
        ) : null}

        {pat ? (
          <g clipPath={`url(#clip-${uid})`}>
            <rect x="9" y="11" width="30" height="46" fill={pat.fill} />
          </g>
        ) : null}

        {type === "CHEST_BAND" ? (
          <rect
            x="12"
            y="28"
            width="24"
            height="6.5"
            rx="0.6"
            fill={pColour}
            fillOpacity={opacity}
            clipPath={`url(#clip-${uid})`}
          />
        ) : null}
        {type === "SHOULDER_PANEL" ? (
          <path
            d="M13.2 15.2 L24 18.5 L34.8 15.2 L36.5 26 L11.5 26 Z"
            fill={pColour}
            fillOpacity={opacity}
            clipPath={`url(#clip-${uid})`}
          />
        ) : null}

        {/* Ribbed cuffs */}
        {cuffBands.length >= 2 ? (
          <g>
            {cuffBands.map((band, i) => {
              const inset = i * 1.2;
              return (
                <g key={`${band}-${i}`}>
                  <path
                    d={`M${7.2 + inset * 0.4} ${30.6 + inset * 0.55} L${11 + inset * 0.35} ${27.4 + inset * 0.4} L${12 + inset * 0.3} ${29.2 + inset * 0.4} L${8.2 + inset * 0.35} ${32.2 + inset * 0.5} Z`}
                    fill={band}
                  />
                  <path
                    d={`M${40.8 - inset * 0.4} ${30.6 + inset * 0.55} L${37 - inset * 0.35} ${27.4 + inset * 0.4} L${36 - inset * 0.3} ${29.2 + inset * 0.4} L${39.8 - inset * 0.35} ${32.2 + inset * 0.5} Z`}
                    fill={band}
                  />
                </g>
              );
            })}
          </g>
        ) : (
          <g>
            <path
              d="M7.0 30.8 L11.2 27.2 L12.6 29.6 L8.6 33.0 Z"
              fill={cuff}
              stroke="rgba(0,0,0,0.2)"
              strokeWidth="0.35"
            />
            <path
              d="M41.0 30.8 L36.8 27.2 L35.4 29.6 L39.4 33.0 Z"
              fill={cuff}
              stroke="rgba(0,0,0,0.2)"
              strokeWidth="0.35"
            />
            {/* rib texture */}
            <path
              d="M7.6 31.2 L11.2 28.0 M8.2 31.9 L11.6 28.8 M8.8 32.5 L12.0 29.5"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="0.28"
            />
            <path
              d="M40.4 31.2 L36.8 28.0 M39.8 31.9 L36.4 28.8 M39.2 32.5 L36.0 29.5"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="0.28"
            />
          </g>
        )}

        {/* Stand / grandad collar + short V placket (no football V-neck) */}
        <path
          d="M19.6 12.2 C21.0 10.4 22.4 9.6 24 9.6 C25.6 9.6 27.0 10.4 28.4 12.2 L27.6 14.8 C26.6 13.4 25.4 12.8 24 12.8 C22.6 12.8 21.4 13.4 20.4 14.8 Z"
          fill={collar}
          stroke="rgba(0,0,0,0.2)"
          strokeWidth="0.4"
        />
        {/* collar thickness / inner edge */}
        <path
          d="M20.6 13.4 C21.6 12.2 22.7 11.6 24 11.6 C25.3 11.6 26.4 12.2 27.4 13.4"
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="0.55"
        />
        {/* short V placket */}
        <path
          d="M22.6 14.6 L22.6 19.2 L24 20.4 L25.4 19.2 L25.4 14.6 Z"
          fill={collar}
          stroke="rgba(0,0,0,0.16)"
          strokeWidth="0.35"
        />
        <path d="M24 14.8 L24 19.8" stroke="rgba(0,0,0,0.22)" strokeWidth="0.4" />

        {/* Crest — left chest as worn (viewer right). No manufacturer logo. */}
        {crestOn ? (
          crestUrl ? (
            <image
              href={crestUrl}
              x="28.2"
              y="21.5"
              width="7.4"
              height="7.4"
              preserveAspectRatio="xMidYMid meet"
            />
          ) : (
            <g>
              <circle
                cx="31.8"
                cy="25"
                r="3.15"
                fill={secondaryColour || "#fff"}
                fillOpacity={0.18}
                stroke={secondaryColour || "#fff"}
                strokeOpacity={0.5}
                strokeWidth="0.45"
              />
              <path
                d="M31.8 22.6 L32.5 24.4 L34.4 24.6 L32.9 25.8 L33.3 27.6 L31.8 26.6 L30.3 27.6 L30.7 25.8 L29.2 24.6 L31.1 24.4 Z"
                fill={secondaryColour || "#fff"}
                fillOpacity={0.35}
              />
            </g>
          )
        ) : null}

        {/* Clean outline */}
        <path
          d={bodyPath}
          fill="none"
          stroke="rgba(0,0,0,0.2)"
          strokeWidth="0.55"
          strokeLinejoin="round"
        />
        <path d={leftSleeve} fill="none" stroke="rgba(0,0,0,0.16)" strokeWidth="0.4" />
        <path d={rightSleeve} fill="none" stroke="rgba(0,0,0,0.16)" strokeWidth="0.4" />

        {num ? (
          <text
            x="24"
            y="42"
            textAnchor="middle"
            fontFamily="system-ui, -apple-system, sans-serif"
            fontWeight="800"
            fontSize={num.length > 1 ? 11.5 : 13.5}
            fill={numberColour}
            stroke={strokeNum}
            strokeWidth="0.5"
            paintOrder="stroke"
          >
            {num}
          </text>
        ) : null}
      </g>
    </svg>
  );
}
