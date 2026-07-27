"use client";

import type { FieldZone } from "@/lib/match-animation-signals";
import { fieldZoneBand } from "@/lib/match-animation-signals";

type Props = {
  homeColour: string;
  awayColour: string;
  ballX: number;
  ballY: number;
  possession: "home" | "away" | "neutral";
  /** Primary line — player name (#14 Name) or team when no player. */
  possessionLabel?: string | null;
  /** Optional team line shown above the player name. */
  possessionTeamLabel?: string | null;
  fieldZone?: FieldZone | null;
  lit?: boolean;
  darkened?: boolean;
  reducedMotion?: boolean;
  /** Line-out arrow + throw path at ball position. */
  showLineoutArrow?: boolean;
  /** Animate conversion kick between the posts. */
  conversionFlight?: "idle" | "kicking" | "success" | "miss" | null;
  conversionSide?: "home" | "away";
};

function toSvgY(yPercent: number): number {
  return (Math.min(100, Math.max(0, yPercent)) / 100) * 56;
}

/** Soft truncate only for extreme lengths; prefer wide tags over cutting mid-name. */
function fitNameTagLine(text: string, maxChars: number): string {
  const t = text.trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
}

function nameTagWidth(lines: string[]): number {
  const longest = lines.reduce((n, line) => Math.max(n, line.length), 0);
  // ~0.55em per char at fontSize 2.6 in this viewBox
  return Math.min(72, Math.max(18, longest * 1.55 + 4));
}

/** Professional SVG rugby pitch with ball, zone highlight, set-piece cues. */
export function MatchAnimationPitch({
  homeColour,
  awayColour,
  ballX,
  ballY,
  possession,
  possessionLabel,
  possessionTeamLabel = null,
  fieldZone = null,
  lit = false,
  darkened = false,
  reducedMotion = false,
  showLineoutArrow = false,
  conversionFlight = null,
  conversionSide = "home",
}: Props) {
  const bx = Math.min(98, Math.max(2, ballX));
  const by = Math.min(95, Math.max(5, ballY));
  const svgY = toSvgY(by);
  const possessionColour =
    possession === "home" ? homeColour : possession === "away" ? awayColour : "#e7bc63";

  const zoneBand =
    fieldZone && !darkened ? fieldZoneBand(fieldZone, possession) : null;

  const postsX = conversionSide === "away" ? 5 : 95;
  const teeX = conversionSide === "away" ? 18 : 82;
  const conversionActive =
    conversionFlight === "kicking" ||
    conversionFlight === "success" ||
    conversionFlight === "miss";

  const teamLine = possessionTeamLabel?.trim()
    ? fitNameTagLine(possessionTeamLabel, 28)
    : null;
  const playerLine = possessionLabel?.trim()
    ? fitNameTagLine(possessionLabel, teamLine ? 32 : 36)
    : null;
  const tagLines = [teamLine, playerLine].filter(Boolean) as string[];
  const tagWidth = tagLines.length ? nameTagWidth(tagLines) : 0;
  const tagHeight = tagLines.length > 1 ? 8.4 : 5.4;
  const labelY = Math.max(tagHeight + 2, svgY - (tagLines.length > 1 ? 9 : 6));
  const labelX = Math.min(100 - tagWidth / 2 - 2, Math.max(tagWidth / 2 + 2, bx));
  const ariaPossession = [teamLine, playerLine].filter(Boolean).join(", ");

  // Line-out: arrow points into field from touch
  const lineoutIntoField = by < 50;
  const arrowTipY = lineoutIntoField ? svgY + 10 : svgY - 10;
  const dashEndY = lineoutIntoField ? Math.min(40, svgY + 18) : Math.max(16, svgY - 18);

  return (
    <div
      className={`pr-ma-pitch${lit ? " pr-ma-pitch--lit" : ""}${darkened ? " pr-ma-pitch--dark" : ""}${reducedMotion ? " pr-ma-pitch--reduced" : ""}`}
      role="img"
      aria-label={
        ariaPossession
          ? `Rugby pitch. ${ariaPossession} in possession. Ball at ${Math.round(bx)} percent along the field.`
          : `Rugby pitch. Ball at ${Math.round(bx)} percent along the field.`
      }
    >
      <svg viewBox="0 0 100 56" className="pr-ma-pitch__svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="pr-ma-grass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1b5e20" />
            <stop offset="50%" stopColor="#2e7d32" />
            <stop offset="100%" stopColor="#1b5e20" />
          </linearGradient>
          <linearGradient id="pr-ma-zone" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={possessionColour} stopOpacity="0" />
            <stop offset="50%" stopColor={possessionColour} stopOpacity="0.28" />
            <stop offset="100%" stopColor={possessionColour} stopOpacity="0" />
          </linearGradient>
          <filter id="pr-ma-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="0.6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect x="0" y="0" width="100" height="56" fill="url(#pr-ma-grass)" rx="1.2" />
        {Array.from({ length: 10 }, (_, i) => (
          <rect
            key={i}
            x={i * 10}
            y="0"
            width="10"
            height="56"
            fill={i % 2 === 0 ? "rgba(255,255,255,0.03)" : "transparent"}
          />
        ))}

        {/* Field status highlight */}
        {zoneBand ? (
          <rect
            className="pr-ma-pitch__zone"
            x={zoneBand.x}
            y="1.5"
            width={zoneBand.width}
            height="53"
            fill="url(#pr-ma-zone)"
          />
        ) : null}

        <rect x="1.5" y="1.5" width="97" height="53" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="0.35" />
        <line x1="5" y1="1.5" x2="5" y2="54.5" stroke="rgba(255,255,255,0.65)" strokeWidth="0.3" />
        <line x1="95" y1="1.5" x2="95" y2="54.5" stroke="rgba(255,255,255,0.65)" strokeWidth="0.3" />
        <line x1="22" y1="1.5" x2="22" y2="54.5" stroke="rgba(255,255,255,0.35)" strokeWidth="0.25" />
        <line x1="78" y1="1.5" x2="78" y2="54.5" stroke="rgba(255,255,255,0.35)" strokeWidth="0.25" />
        <line x1="50" y1="1.5" x2="50" y2="54.5" stroke="rgba(255,255,255,0.8)" strokeWidth="0.35" />
        <circle cx="50" cy="28" r="6" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.3" />
        {/* Goal posts */}
        <line x1="5" y1="20" x2="5" y2="36" stroke="#f5f5f5" strokeWidth="0.7" />
        <line x1="3.5" y1="20" x2="6.5" y2="20" stroke="#f5f5f5" strokeWidth="0.55" />
        <line x1="95" y1="20" x2="95" y2="36" stroke="#f5f5f5" strokeWidth="0.7" />
        <line x1="93.5" y1="20" x2="96.5" y2="20" stroke="#f5f5f5" strokeWidth="0.55" />
        <line x1="5" y1="22" x2="5" y2="34" stroke={homeColour} strokeWidth="0.45" opacity="0.7" />
        <line x1="95" y1="22" x2="95" y2="34" stroke={awayColour} strokeWidth="0.45" opacity="0.7" />

        {/* Line-out arrow */}
        {showLineoutArrow ? (
          <g className="pr-ma-pitch__lineout" aria-hidden>
            <line
              x1={bx}
              y1={svgY}
              x2={bx}
              y2={dashEndY}
              stroke="rgba(255,255,255,0.85)"
              strokeWidth="0.35"
              strokeDasharray="1.2 0.8"
            />
            <polygon
              points={
                lineoutIntoField
                  ? `${bx},${arrowTipY} ${bx - 3.2},${arrowTipY - 5} ${bx + 3.2},${arrowTipY - 5}`
                  : `${bx},${arrowTipY} ${bx - 3.2},${arrowTipY + 5} ${bx + 3.2},${arrowTipY + 5}`
              }
              fill="rgba(76, 175, 80, 0.75)"
              stroke="rgba(255,255,255,0.5)"
              strokeWidth="0.2"
            />
          </g>
        ) : null}

        {/* Conversion flight */}
        {conversionActive ? (
          <g className="pr-ma-pitch__conversion" aria-hidden>
            <path
              d={`M ${teeX} 40 Q ${(teeX + postsX) / 2} 12 ${postsX} 28`}
              fill="none"
              stroke="rgba(255,255,255,0.45)"
              strokeWidth="0.35"
              strokeDasharray="1.5 1"
            />
            <ellipse
              className={
                conversionFlight === "kicking" && !reducedMotion
                  ? "pr-ma-pitch__conv-ball pr-ma-pitch__conv-ball--fly"
                  : "pr-ma-pitch__conv-ball"
              }
              cx={
                conversionFlight === "miss"
                  ? postsX + (conversionSide === "home" ? 4 : -4)
                  : conversionFlight === "kicking"
                    ? (teeX + postsX) / 2
                    : postsX
              }
              cy={conversionFlight === "kicking" ? 18 : 28}
              rx="1.4"
              ry="1"
              fill="#f5f0e6"
              stroke="#3e2723"
              strokeWidth="0.2"
            />
            {conversionFlight === "success" ? (
              <text x={postsX} y="16" textAnchor="middle" fill="#e7bc63" fontSize="3.2" fontWeight="800">
                ✓
              </text>
            ) : null}
            {conversionFlight === "miss" ? (
              <text x={postsX} y="16" textAnchor="middle" fill="#ef5350" fontSize="3.2" fontWeight="800">
                ✕
              </text>
            ) : null}
          </g>
        ) : null}

        {/* Play spotlight under ball */}
        {!darkened ? (
          <circle
            cx={bx}
            cy={svgY}
            r="5"
            fill={possessionColour}
            opacity="0.18"
            className="pr-ma-pitch__spot"
          />
        ) : null}

        {/* Ball + name label */}
        <g
          className="pr-ma-pitch__ball"
          style={{
            transform: `translate(${bx}px, ${svgY}px)`,
            transition: reducedMotion ? "none" : "transform 0.55s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <ellipse
            cx="0"
            cy="0"
            rx="1.6"
            ry="1.1"
            fill="#f5f0e6"
            stroke="#3e2723"
            strokeWidth="0.25"
            filter="url(#pr-ma-glow)"
          />
        </g>

        {tagLines.length > 0 && !darkened ? (
          <g className="pr-ma-pitch__name-tag" transform={`translate(${labelX}, ${labelY})`}>
            <rect
              x={-tagWidth / 2}
              y={-tagHeight / 2}
              width={tagWidth}
              height={tagHeight}
              rx="1.2"
              fill="rgba(15, 30, 40, 0.9)"
              stroke={possessionColour}
              strokeWidth="0.25"
            />
            {teamLine && playerLine ? (
              <>
                <text
                  x="0"
                  y={-1.1}
                  textAnchor="middle"
                  fill={possessionColour}
                  fontSize="2.2"
                  fontWeight="700"
                  style={{ fontFamily: "system-ui, sans-serif" }}
                >
                  {teamLine}
                </text>
                <text
                  x="0"
                  y={2.4}
                  textAnchor="middle"
                  fill="#f7f7f5"
                  fontSize="2.6"
                  fontWeight="700"
                  style={{ fontFamily: "system-ui, sans-serif" }}
                >
                  {playerLine}
                </text>
              </>
            ) : (
              <text
                x="0"
                y="0.85"
                textAnchor="middle"
                fill="#f7f7f5"
                fontSize="2.6"
                fontWeight="700"
                style={{ fontFamily: "system-ui, sans-serif" }}
              >
                {playerLine ?? teamLine}
              </text>
            )}
          </g>
        ) : null}
      </svg>
    </div>
  );
}
