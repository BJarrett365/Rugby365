import type { BettingIntelAccuracyPoint } from "@/lib/betting-intel-accuracy-service";

/** SVG chart: daily correct/wrong bars + cumulative accuracy line. */
export function BettingIntelAccuracyChart({
  series,
}: {
  series: BettingIntelAccuracyPoint[];
}) {
  if (!series.length) {
    return (
      <p className="cms-muted">
        No graded finished matches in this window yet. Once results land with model
        probabilities, the accuracy curve will appear here.
      </p>
    );
  }

  const w = 720;
  const h = 260;
  const padL = 44;
  const padR = 16;
  const padT = 16;
  const padB = 36;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const maxPlayed = Math.max(...series.map((p) => p.played), 1);
  const n = series.length;

  const xAt = (i: number) => padL + ((i + 0.5) / n) * plotW;
  const barW = Math.max(4, Math.min(18, (plotW / n) * 0.55));

  const yAcc = (pct: number) => padT + plotH - (pct / 100) * plotH;
  const linePoints = series
    .map((p, i) => {
      if (p.cumulativeAccuracyPct == null) return null;
      return `${xAt(i).toFixed(1)},${yAcc(p.cumulativeAccuracyPct).toFixed(1)}`;
    })
    .filter(Boolean)
    .join(" ");

  const labelStep = Math.max(1, Math.ceil(n / 8));

  return (
    <figure className="bi-acc-chart">
      <svg viewBox={`0 0 ${w} ${h}`} className="bi-acc-chart__svg" role="img" aria-label="Model pick accuracy over time">
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = yAcc(tick);
          return (
            <g key={tick}>
              <line
                x1={padL}
                x2={w - padR}
                y1={y}
                y2={y}
                stroke="rgba(15,42,49,0.12)"
                strokeWidth="1"
              />
              <text x={padL - 8} y={y + 4} textAnchor="end" className="bi-acc-chart__axis">
                {tick}%
              </text>
            </g>
          );
        })}

        {series.map((p, i) => {
          const x = xAt(i);
          const correctH = (p.correct / maxPlayed) * plotH * 0.85;
          const wrongH = (p.wrong / maxPlayed) * plotH * 0.85;
          const base = padT + plotH;
          return (
            <g key={p.dateKey}>
              {p.wrong > 0 ? (
                <rect
                  x={x - barW / 2}
                  y={base - wrongH}
                  width={barW}
                  height={wrongH}
                  rx="2"
                  fill="#f07171"
                  opacity="0.85"
                >
                  <title>{`${p.label}: ${p.wrong} wrong`}</title>
                </rect>
              ) : null}
              {p.correct > 0 ? (
                <rect
                  x={x - barW / 2}
                  y={base - wrongH - correctH}
                  width={barW}
                  height={correctH}
                  rx="2"
                  fill="#6ee7a8"
                  opacity="0.9"
                >
                  <title>{`${p.label}: ${p.correct} correct`}</title>
                </rect>
              ) : null}
              {i % labelStep === 0 || i === n - 1 ? (
                <text
                  x={x}
                  y={h - 12}
                  textAnchor="middle"
                  className="bi-acc-chart__axis"
                >
                  {p.label}
                </text>
              ) : null}
            </g>
          );
        })}

        {linePoints ? (
          <polyline
            points={linePoints}
            fill="none"
            stroke="#0f2a31"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
        {series.map((p, i) =>
          p.cumulativeAccuracyPct != null ? (
            <circle
              key={`pt-${p.dateKey}`}
              cx={xAt(i)}
              cy={yAcc(p.cumulativeAccuracyPct)}
              r="3.5"
              fill="#e7bc63"
              stroke="#0f2a31"
              strokeWidth="1.5"
            >
              <title>{`${p.label}: cumulative ${p.cumulativeAccuracyPct}%`}</title>
            </circle>
          ) : null,
        )}
      </svg>
      <figcaption className="bi-acc-chart__legend">
        <span className="bi-acc-chart__swatch bi-acc-chart__swatch--ok" /> Correct picks
        <span className="bi-acc-chart__swatch bi-acc-chart__swatch--bad" /> Wrong picks
        <span className="bi-acc-chart__swatch bi-acc-chart__swatch--line" /> Cumulative accuracy
      </figcaption>
    </figure>
  );
}
