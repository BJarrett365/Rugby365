"use client";

import { PrStatRing, ratioToPercent, successRate } from "./PrStatRing";
import { TeamCrest } from "./TeamCrest";

export type CompareStatRow = {
  label: string;
  home: number;
  away: number;
  format?: "percent";
};

function formatPercent(value: number): string {
  if (value <= 1 && value >= 0) return `${Math.round(value * 100)}%`;
  return `${Math.round(value)}%`;
}

function CompareBarRow({
  label,
  home,
  away,
  format,
}: CompareStatRow) {
  const homeVal = home;
  const awayVal = away;
  const total = homeVal + awayVal || 1;
  const homePct = Math.round((homeVal / total) * 100);
  const awayPct = 100 - homePct;
  const homeLabel = format === "percent" ? formatPercent(home) : String(home);
  const awayLabel = format === "percent" ? formatPercent(away) : String(away);
  const homeLeads = homeVal > awayVal;
  const awayLeads = awayVal > homeVal;

  return (
    <div
      className={`pr-compare-row${homeLeads ? " pr-compare-row--home-lead" : ""}${awayLeads ? " pr-compare-row--away-lead" : ""}`}
    >
      <div className="pr-compare-row__values">
        <span className="pr-compare-row__home">{homeLabel}</span>
        <span className="pr-compare-row__label">{label}</span>
        <span className="pr-compare-row__away">{awayLabel}</span>
      </div>
      <div className="pr-compare-row__bar" aria-hidden>
        <span style={{ width: `${homePct}%` }} className="pr-compare-row__bar-home" />
        <span style={{ width: `${awayPct}%` }} className="pr-compare-row__bar-away" />
      </div>
    </div>
  );
}

export function PrCompareStatCard({
  title,
  homeName,
  awayName,
  homeImageUrl,
  awayImageUrl,
  rows,
  rings,
}: {
  title: string;
  homeName: string;
  awayName: string;
  homeImageUrl?: string | null;
  awayImageUrl?: string | null;
  rows: CompareStatRow[];
  rings?: { label: string; homePct: number | null; awayPct: number | null }[];
}) {
  if (rows.length === 0 && (!rings || rings.length === 0)) return null;

  return (
    <article className="pr-compare-card">
      <header className="pr-compare-card__header">
        <TeamCrest name={homeName} imageUrl={homeImageUrl} size="sm" />
        <h3 className="pr-compare-card__title">{title}</h3>
        <TeamCrest name={awayName} imageUrl={awayImageUrl} size="sm" />
      </header>
      {rings && rings.length > 0 && (
        <div className="pr-compare-card__rings">
          {rings.map((ring) => (
            <PrStatRing key={ring.label} {...ring} />
          ))}
        </div>
      )}
      {rows.length > 0 && (
        <div className="pr-compare-card__rows">
          {rows.map((row) => (
            <CompareBarRow key={row.label} {...row} />
          ))}
        </div>
      )}
    </article>
  );
}

/** Simplified possession/territory card with optional pitch silhouette. */
export function PrPossessionTerritoryCard({
  title,
  homeName,
  awayName,
  homeImageUrl,
  awayImageUrl,
  rows,
  showPitch,
}: {
  title: string;
  homeName: string;
  awayName: string;
  homeImageUrl?: string | null;
  awayImageUrl?: string | null;
  rows: CompareStatRow[];
  showPitch?: boolean;
}) {
  if (rows.length === 0) return null;
  const overall = rows.find((r) => /overall|total/i.test(r.label)) ?? rows[0]!;
  const homeOverall = overall.format === "percent" && overall.home <= 1
    ? Math.round(overall.home * 100)
    : Math.round(overall.home);
  const awayOverall = overall.format === "percent" && overall.away <= 1
    ? Math.round(overall.away * 100)
    : Math.round(overall.away);

  return (
    <article className="pr-compare-card pr-compare-card--pitch">
      <header className="pr-compare-card__header">
        <TeamCrest name={homeName} imageUrl={homeImageUrl} size="sm" />
        <h3 className="pr-compare-card__title">{title}</h3>
        <TeamCrest name={awayName} imageUrl={awayImageUrl} size="sm" />
      </header>
      {showPitch && (
        <div className="pr-pitch" aria-hidden>
          <div className="pr-pitch__field">
            <span className="pr-pitch__pct pr-pitch__pct--home">{homeOverall}%</span>
            <span className="pr-pitch__pct pr-pitch__pct--away">{awayOverall}%</span>
          </div>
        </div>
      )}
      <div className="pr-compare-card__rows">
        {rows.map((row) => (
          <CompareBarRow key={row.label} {...row} />
        ))}
      </div>
    </article>
  );
}

export function defenceRingsFromStats(defence: Record<string, number> | undefined): {
  label: string;
  homePct: number | null;
  awayPct: number | null;
}[] {
  if (!defence) return [];
  const homeTackles = defence.home_tackles ?? 0;
  const awayTackles = defence.away_tackles ?? 0;
  const homeMissed = defence.home_tackles_missed ?? defence.home_missed_tackles ?? 0;
  const awayMissed = defence.away_tackles_missed ?? defence.away_missed_tackles ?? 0;
  const home = successRate(homeTackles, homeMissed);
  const away = successRate(awayTackles, awayMissed);
  if (home == null && away == null) return [];
  return [{ label: "Tackle Success", homePct: home, awayPct: away }];
}

export function kickingRingsFromStats(kicking: Record<string, number> | undefined): {
  label: string;
  homePct: number | null;
  awayPct: number | null;
}[] {
  if (!kicking) return [];
  const rings: { label: string; homePct: number | null; awayPct: number | null }[] = [];
  const homeSuccess =
    kicking.home_kicking_success_percentage ??
    kicking.home_kick_success_percentage ??
    kicking.home_success_percentage;
  const awaySuccess =
    kicking.away_kicking_success_percentage ??
    kicking.away_kick_success_percentage ??
    kicking.away_success_percentage;
  if (homeSuccess != null || awaySuccess != null) {
    rings.push({
      label: "Kicking Success",
      homePct: ratioToPercent(homeSuccess ?? null),
      awayPct: ratioToPercent(awaySuccess ?? null),
    });
  }
  return rings;
}

export function percentageRingsFromSection(
  section: Record<string, number> | undefined,
  label: string,
  keys: string[],
): { label: string; homePct: number | null; awayPct: number | null }[] {
  if (!section) return [];
  for (const key of keys) {
    const home = section[`home_${key}`];
    const away = section[`away_${key}`];
    if (home != null || away != null) {
      return [
        {
          label,
          homePct: ratioToPercent(home ?? null),
          awayPct: ratioToPercent(away ?? null),
        },
      ];
    }
  }
  return [];
}
