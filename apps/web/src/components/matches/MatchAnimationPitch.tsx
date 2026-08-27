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
  /** Live intensity: possession / attack / dangerous (opp 22). */
  intensity?: "possession" | "attack" | "dangerous" | null;
  /** Show dashed kick path (dropout / penalty / free kick). */
  showKickPath?: boolean;
  /** Optional phase label over the shade (Attack / Defence / In Possession). */
  phaseLabel?: string | null;
  /** Hide the pitch oval when the player sprite carries the rugby ball. */
  hideBall?: boolean;
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
  intensity = null,
  showKickPath = false,
  phaseLabel = null,
  hideBall = false,
}: Props) {
  const bx = Math.min(98, Math.max(2, ballX));
  const by = Math.min(95, Math.max(5, ballY));
  const svgY = toSvgY(by);
  const possessionColour =
    possession === "home" ? homeColour : possession === "away" ? awayColour : "#e7bc63";

  const zoneBand =
    fieldZone && !darkened ? fieldZoneBand(fieldZone, possession) : null;

  /**
   * F365-style dark shade:
   * - Attack / dangerous → wedge toward the try line being attacked
   * - Possession → shade the half containing the ball
   * - Defence (own_22) → shade own half
   */
  const attackTowardRight = possession !== "away";
  const shade =
    !darkened && intensity
      ? intensity === "dangerous" || intensity === "attack"
        ? attackTowardRight
          ? { points: "42,4 98,4 98,52 50,38", labelX: 72, labelY: 16 }
          : { points: "2,4 58,4 50,38 2,52", labelX: 28, labelY: 16 }
        : fieldZone === "own_22"
          ? attackTowardRight
            ? { points: "2,4 38,4 42,52 2,52", labelX: 18, labelY: 16 }
            : { points: "62,4 98,4 98,52 58,52", labelX: 82, labelY: 16 }
          : bx < 50
            ? { points: "2,4 50,4 50,52 2,52", labelX: 26, labelY: 16 }
            : { points: "50,4 98,4 98,52 50,52", labelX: 74, labelY: 16 }
      : null;

  const tryThreat = !darkened && (fieldZone === "opp_22" || fieldZone === "ingoal");
  const tryZone =
    tryThreat && possession === "away"
      ? { x: 0, width: fieldZone === "ingoal" ? 10 : 22 }
      : tryThreat
        ? { x: fieldZone === "ingoal" ? 90 : 78, width: fieldZone === "ingoal" ? 10 : 22 }
        : null;

  const intensityLabel =
    phaseLabel?.trim() ||
    (intensity === "dangerous"
      ? "Try threat"
      : intensity === "attack"
        ? "Attack"
        : intensity === "possession"
          ? fieldZone === "own_22"
            ? "Defence"
            : "In Possession"
          : null);

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

  const lineoutIntoField = by < 50;
  const arrowTipY = lineoutIntoField ? svgY + 10 : svgY - 10;
  const dashEndY = lineoutIntoField ? Math.min(40, svgY + 18) : Math.max(16, svgY - 18);

  return (
    <div
      className={`pr-ma-pitch${lit ? " pr-ma-pitch--lit" : ""}${darkened ? " pr-ma-pitch--dark" : ""}${reducedMotion ? " pr-ma-pitch--reduced" : ""}${intensity === "dangerous" ? " pr-ma-pitch--dangerous" : ""}${intensity === "attack" ? " pr-ma-pitch--attack" : ""}${intensity === "possession" ? " pr-ma-pitch--possession" : ""}`}
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
          <linearGradient id="pr-ma-try-red" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ef5350" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#c62828" stopOpacity="0.55" />
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

        {/* Dark attack / defence / possession shade */}
        {shade ? (
          <polygon
            className={`pr-ma-pitch__shade${intensity === "dangerous" ? " pr-ma-pitch__shade--danger" : intensity === "attack" ? " pr-ma-pitch__shade--attack" : " pr-ma-pitch__shade--hold"}`}
            points={shade.points}
            fill={
              intensity === "dangerous"
                ? "rgba(8, 18, 14, 0.38)"
                : intensity === "attack"
                  ? "rgba(8, 20, 14, 0.48)"
                  : "rgba(6, 16, 14, 0.55)"
            }
          />
        ) : null}

        {/* Red try-zone when a try is imminent */}
        {tryZone ? (
          <rect
            className={`pr-ma-pitch__try-zone${fieldZone === "ingoal" ? " pr-ma-pitch__try-zone--imminent" : " pr-ma-pitch__try-zone--threat"}`}
            x={tryZone.x}
            y="1.5"
            width={tryZone.width}
            height="53"
            fill={
              fieldZone === "ingoal"
                ? "rgba(198, 40, 40, 0.72)"
                : "url(#pr-ma-try-red)"
            }
          />
        ) : null}

        {/* Field status highlight */}
        {zoneBand && !tryZone ? (
          <rect
            className="pr-ma-pitch__zone"
            x={zoneBand.x}
            y="1.5"
            width={zoneBand.width}
            height="53"
            fill="url(#pr-ma-zone)"
          />
        ) : null}

        <rect
          x="1.5"
          y="1.5"
          width="97"
          height="53"
          fill="none"
          stroke="rgba(255,255,255,0.75)"
          strokeWidth="0.35"
        />
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

        {/* Phase label inside dark shade */}
        {shade && intensityLabel ? (
          <g className="pr-ma-pitch__phase" transform={`translate(${shade.labelX}, ${shade.labelY})`}>
            <text
              x="0"
              y="0"
              textAnchor="middle"
              fill="#f7f7f5"
              fontSize="3.2"
              fontWeight="800"
              style={{ fontFamily: "system-ui, sans-serif" }}
            >
              {intensityLabel}
            </text>
            {teamLine ? (
              <text
                x="0"
                y="4"
                textAnchor="middle"
                fill={possessionColour}
                fontSize="2.4"
                fontWeight="700"
                style={{ fontFamily: "system-ui, sans-serif" }}
              >
                {teamLine}
              </text>
            ) : null}
          </g>
        ) : null}

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

        {showKickPath && !showLineoutArrow ? (
          <g className="pr-ma-pitch__kick-path" aria-hidden>
            <path
              d={`M ${bx} ${svgY} Q ${(bx + (possession === "away" ? 20 : 80)) / 2} ${Math.max(8, svgY - 14)} ${possession === "away" ? Math.min(92, bx + 28) : Math.max(8, bx - 28)} ${svgY - 2}`}
              fill="none"
              stroke="rgba(255,255,255,0.75)"
              strokeWidth="0.4"
              strokeDasharray="1.4 0.9"
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
            fill={tryThreat ? "#ef5350" : possessionColour}
            opacity="0.18"
            className="pr-ma-pitch__spot"
          />
        ) : null}

        {/* Ball + name label */}
        {!hideBall ? (
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
              fill="#c4a574"
              stroke="#3e2723"
              strokeWidth="0.25"
              filter="url(#pr-ma-glow)"
            />
          </g>
        ) : null}

        {tagLines.length > 0 && !darkened && !shade ? (
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
