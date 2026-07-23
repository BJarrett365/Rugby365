/** Rugby Union XV pitch markers for main / secondary positions. */

const XV_POSITIONS: Array<{
  number: number;
  label: string;
  aliases: string[];
  x: number;
  y: number;
}> = [
  { number: 1, label: "Loosehead prop", aliases: ["loosehead", "prop", "lh"], x: 22, y: 78 },
  { number: 2, label: "Hooker", aliases: ["hooker", "hk"], x: 50, y: 82 },
  { number: 3, label: "Tighthead prop", aliases: ["tighthead", "prop", "th"], x: 78, y: 78 },
  { number: 4, label: "Lock", aliases: ["lock", "second row", "second-row"], x: 35, y: 68 },
  { number: 5, label: "Lock", aliases: ["lock", "second row", "second-row"], x: 65, y: 68 },
  { number: 6, label: "Blindside flanker", aliases: ["blindside", "flanker", "6"], x: 18, y: 58 },
  { number: 7, label: "Openside flanker", aliases: ["openside", "flanker", "7"], x: 82, y: 58 },
  { number: 8, label: "Number eight", aliases: ["number eight", "number 8", "8", "no. 8", "eighth"], x: 50, y: 58 },
  { number: 9, label: "Scrum-half", aliases: ["scrum-half", "scrum half", "halfback", "9"], x: 50, y: 46 },
  { number: 10, label: "Fly-half", aliases: ["fly-half", "fly half", "out-half", "10"], x: 50, y: 36 },
  { number: 12, label: "Inside centre", aliases: ["inside centre", "inside center", "12"], x: 38, y: 28 },
  { number: 13, label: "Outside centre", aliases: ["outside centre", "outside center", "13"], x: 62, y: 28 },
  { number: 11, label: "Left wing", aliases: ["left wing", "wing", "11"], x: 12, y: 20 },
  { number: 14, label: "Right wing", aliases: ["right wing", "wing", "14"], x: 88, y: 20 },
  { number: 15, label: "Full-back", aliases: ["full-back", "fullback", "full back", "15"], x: 50, y: 12 },
];

function normalizePos(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, " ").trim();
}

function matchPosition(value: string | null | undefined): number[] {
  if (!value) return [];
  const n = normalizePos(value);
  const hits: number[] = [];
  for (const pos of XV_POSITIONS) {
    if (pos.aliases.some((a) => n === a || n.includes(a)) || n === String(pos.number)) {
      hits.push(pos.number);
    }
  }
  // Prefer specific lock #4 when only "lock"
  if (n === "lock" || n === "second row") return [4, 5];
  if (n === "flanker") return [6, 7];
  if (n === "prop") return [1, 3];
  if (n === "wing") return [11, 14];
  if (n === "centre" || n === "center") return [12, 13];
  return hits;
}

export function RugbyPositionPitch({
  mainPosition,
  otherPositions = [],
  compact = false,
  summary,
}: {
  mainPosition: string | null;
  otherPositions?: string[];
  compact?: boolean;
  summary?: string | null;
}) {
  const main = new Set(matchPosition(mainPosition));
  const secondary = new Set(otherPositions.flatMap((p) => matchPosition(p)));
  for (const n of main) secondary.delete(n);

  const textSummary =
    summary ||
    (mainPosition
      ? `Main position ${mainPosition}${
          otherPositions.length ? `, also ${otherPositions.join(", ")}` : ""
        }.`
      : "Position map unavailable.");

  return (
    <figure className={`pr-rugby-pitch${compact ? " pr-rugby-pitch--compact" : ""}`}>
      <svg
        viewBox="0 0 100 100"
        role="img"
        aria-label={textSummary}
        className="pr-rugby-pitch__svg"
      >
        <rect x="2" y="2" width="96" height="96" className="pr-rugby-pitch__field" rx="1" />
        <line x1="2" y1="50" x2="98" y2="50" className="pr-rugby-pitch__line" />
        <line x1="2" y1="22" x2="98" y2="22" className="pr-rugby-pitch__line" />
        <line x1="2" y1="78" x2="98" y2="78" className="pr-rugby-pitch__line" />
        {XV_POSITIONS.map((pos) => {
          const isMain = main.has(pos.number);
          const isSecondary = secondary.has(pos.number);
          const r = isMain ? 4.2 : isSecondary ? 3.2 : 2.2;
          return (
            <g key={pos.number}>
              <circle
                cx={pos.x}
                cy={pos.y}
                r={r}
                className={
                  isMain
                    ? "pr-rugby-pitch__dot pr-rugby-pitch__dot--main"
                    : isSecondary
                      ? "pr-rugby-pitch__dot pr-rugby-pitch__dot--secondary"
                      : "pr-rugby-pitch__dot"
                }
              />
              <text
                x={pos.x}
                y={pos.y + 0.8}
                textAnchor="middle"
                className="pr-rugby-pitch__num"
                aria-hidden
              >
                {pos.number}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="pr-rugby-pitch__caption">{textSummary}</figcaption>
    </figure>
  );
}
