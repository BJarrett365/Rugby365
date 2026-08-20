"use client";

import { useMemo, useState, type CSSProperties } from "react";
import type { SdmsKeyEvent, SdmsMatchStatsBundle } from "@rugby365/import-sdk";
import { possessionHalvesFromStats } from "@/lib/match-header-utils";
import {
  buildMomentumBuckets,
  MOMENTUM_BUCKETS,
  resolveMomentumElapsedMinute,
  type MomentumBucket,
} from "@/lib/match-momentum";
import { teamAccentColor } from "@/lib/team-accent-color";
import { isHomeSideKeyEvent } from "@/lib/match-key-events";

function eventBoostAt(
  events: SdmsKeyEvent[],
  homeTeamIds: Array<string | null | undefined> | string | undefined,
  minuteStart: number,
  minuteEnd: number,
): { home: number; away: number } {
  let home = 0;
  let away = 0;
  for (const e of events) {
    const m = e.minute || 0;
    if (m < minuteStart || m >= minuteEnd) continue;
    const t = e.type.toLowerCase();
    const weight =
      t.includes("try") && !t.includes("penalty")
        ? 0.18
        : t.includes("penalty") || t.includes("drop")
          ? 0.12
          : t.includes("conversion")
            ? 0.06
            : 0;
    if (weight === 0) continue;
    if (isHomeSideKeyEvent(e.team_id, homeTeamIds)) home += weight;
    else away += weight;
  }
  return { home, away };
}

function Column({
  bucket,
  index,
  hover,
  setHover,
}: {
  bucket: MomentumBucket;
  index: number;
  hover: number | null;
  setHover: (n: number | null) => void;
}) {
  const possessor =
    bucket.possession === "home"
      ? "home possession"
      : bucket.possession === "away"
        ? "away possession"
        : "no possession yet";
  return (
    <button
      type="button"
      className={`pr-momentum__col${hover === index ? " is-active" : ""}`}
      onMouseEnter={() => setHover(index)}
      onMouseLeave={() => setHover(null)}
      onFocus={() => setHover(index)}
      onBlur={() => setHover(null)}
      aria-label={`${bucket.label}: ${possessor}`}
    >
      <span className="pr-momentum__lane pr-momentum__lane--home">
        {bucket.home > 0 ? (
          <span
            className="pr-momentum__bar pr-momentum__bar--home"
            style={{ height: `${bucket.home * 100}%` }}
          />
        ) : null}
      </span>
      <span className="pr-momentum__lane pr-momentum__lane--away">
        {bucket.away > 0 ? (
          <span
            className="pr-momentum__bar pr-momentum__bar--away"
            style={{ height: `${bucket.away * 100}%` }}
          />
        ) : null}
      </span>
    </button>
  );
}

export function MatchMomentumChart({
  matchStats,
  events,
  homeTeamId,
  homeTeamIds,
  homeName,
  awayName,
  matchStatus,
  matchMinute,
}: {
  matchStats: SdmsMatchStatsBundle | null | undefined;
  events: SdmsKeyEvent[];
  homeTeamId?: string;
  homeTeamIds?: Array<string | null | undefined>;
  homeName: string;
  awayName: string;
  homeImageUrl?: string | null;
  awayImageUrl?: string | null;
  matchStatus?: string | null;
  matchMinute?: number | null;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const homeColor = teamAccentColor(homeName, "home");
  const awayColor = teamAccentColor(awayName, "away");
  const homeIds = homeTeamIds?.length ? homeTeamIds : [homeTeamId];

  const elapsedMinute = useMemo(
    () =>
      resolveMomentumElapsedMinute({
        matchMinute,
        status: matchStatus,
        eventMinutes: events.map((e) => e.minute || 0),
      }),
    [matchMinute, matchStatus, events],
  );

  const buckets = useMemo(() => {
    const p = possessionHalvesFromStats(matchStats);
    const boosts = Array.from({ length: MOMENTUM_BUCKETS }, (_, i) => {
      const minuteStart = (i / MOMENTUM_BUCKETS) * 80;
      const minuteEnd = ((i + 1) / MOMENTUM_BUCKETS) * 80;
      const boost = eventBoostAt(events, homeIds, minuteStart, minuteEnd);
      return { minuteStart, minuteEnd, ...boost };
    });
    return buildMomentumBuckets({
      homeFirst: p.homeFirst,
      awayFirst: p.awayFirst,
      homeSecond: p.homeSecond,
      awaySecond: p.awaySecond,
      elapsedMinute,
      eventBoosts: boosts,
    });
  }, [matchStats, events, homeIds, elapsedMinute]);

  const hasPossession =
    matchStats?.possession &&
    Object.keys(matchStats.possession).some((k) => /possession|percentage/i.test(k));

  if (!hasPossession && events.length === 0) return null;

  const p = possessionHalvesFromStats(matchStats);
  const hovered = hover != null ? buckets[hover] : null;
  const playedCount = buckets.filter((b) => b.possession != null).length;

  return (
    <section
      className="pr-momentum"
      style={
        {
          "--pr-mom-home": homeColor,
          "--pr-mom-away": awayColor,
        } as CSSProperties
      }
      aria-label="Match momentum from possession"
    >
      <div className="pr-momentum__head">
        <div className="pr-momentum__team pr-momentum__team--home">
          <i className="pr-momentum__swatch" aria-hidden />
          <span>{homeName}</span>
          <span className="pr-momentum__pct">{Math.round(p.homeOverall * 100)}%</span>
        </div>
        <h2 className="pr-momentum__title">Match Momentum</h2>
        <div className="pr-momentum__team pr-momentum__team--away">
          <span className="pr-momentum__pct">{Math.round(p.awayOverall * 100)}%</span>
          <span>{awayName}</span>
          <i className="pr-momentum__swatch" aria-hidden />
        </div>
      </div>

      <div
        className="pr-momentum__chart"
        role="img"
        aria-label={
          playedCount === 0
            ? "Match momentum empty — builds as the match progresses"
            : "Possession momentum by minute"
        }
      >
        <div className="pr-momentum__half pr-momentum__half--1">
          {buckets.slice(0, MOMENTUM_BUCKETS / 2).map((b, i) => (
            <Column key={`h1-${i}`} bucket={b} index={i} hover={hover} setHover={setHover} />
          ))}
        </div>
        <div className="pr-momentum__half pr-momentum__half--2">
          {buckets.slice(MOMENTUM_BUCKETS / 2).map((b, i) => {
            const idx = i + MOMENTUM_BUCKETS / 2;
            return (
              <Column key={`h2-${i}`} bucket={b} index={idx} hover={hover} setHover={setHover} />
            );
          })}
        </div>
        {hovered ? (
          <div className="pr-momentum__tooltip">
            {hovered.possession === "home"
              ? `${hovered.label}: ${homeName} possession`
              : hovered.possession === "away"
                ? `${hovered.label}: ${awayName} possession`
                : `${hovered.label}: —`}
          </div>
        ) : null}
      </div>

      <div className="pr-momentum__axis" aria-hidden>
        <span>0'</span>
        <span>20'</span>
        <span>40'</span>
        <span>60'</span>
        <span>80'</span>
      </div>
    </section>
  );
}
