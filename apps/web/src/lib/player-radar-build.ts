/**
 * Pure radar builders — percentile spokes from position cohort rates.
 */

import {
  RADAR_METRICS,
  RADAR_TYPE_LABELS,
  average,
  buildRadarWrittenSummary,
  computeMetricRates,
  metricsForRadarType,
  percentileRank,
  type RadarMetricKey,
  type RadarType,
  type SeasonStatRatesInput,
} from "./player-radar-metrics";
import {
  RADAR_POSITION_LABELS,
  normalizePositionFamily,
  positionCohortFamilies,
  type RadarPositionFamily,
} from "./player-radar-positions";

export type RadarSpoke = {
  key: RadarMetricKey;
  label: string;
  /** Player rate (per 80 / percent / raw as defined) */
  playerValue: number | null;
  /** Position cohort average for same rate */
  positionAverage: number | null;
  /** Competition-scoped average when competition filter applied; else same as position */
  competitionAverage: number | null;
  percentile: number | null;
  rank: number | null;
  sampleSize: number;
  format: "rate" | "percent" | "count";
};

export type RadarViewPayload = {
  type: RadarType;
  typeLabel: string;
  spokes: RadarSpoke[];
  summary: string;
  unavailableReason: string | null;
};

export type PlayerRadarBundle = {
  enabled: boolean;
  title: string;
  positionFamily: RadarPositionFamily;
  positionLabel: string;
  competitionLabel: string | null;
  seasonLabel: string | null;
  minMinutes: number;
  cohortSize: number;
  defaultType: RadarType;
  radars: Partial<Record<RadarType, RadarViewPayload>>;
  /** Structured SEO/HTML mirror of the active default type (UI may switch). */
  seoSpokes: RadarSpoke[];
  summary: string;
  summaryApproved: boolean;
  future: {
    playerVsPlayer: boolean;
    seasonVsSeason: boolean;
    clubVsInternational: boolean;
    careerProgression: boolean;
    animatedHistory: boolean;
  };
};

export type CohortPeerRow = SeasonStatRatesInput & {
  playerId: string;
  positionName: string | null;
  competitionId: string | null;
};

export function peerMatchesPosition(
  positionName: string | null | undefined,
  targetFamily: RadarPositionFamily,
): boolean {
  const peer = normalizePositionFamily(positionName);
  const allowed = new Set(positionCohortFamilies(targetFamily));
  // Also allow peers already tagged with wider buckets when target is specific
  if (allowed.has(peer)) return true;
  // Wider peer bucket covers specific target (e.g. peer "flanker", target "openside")
  const peerWiden = positionCohortFamilies(peer);
  return peerWiden.includes(targetFamily) || peerWiden.some((f) => allowed.has(f));
}

export function buildSpokesForType(input: {
  type: RadarType;
  family: RadarPositionFamily;
  playerRates: Partial<Record<RadarMetricKey, number>>;
  peerRates: Array<Partial<Record<RadarMetricKey, number>>>;
}): RadarSpoke[] {
  const keys = metricsForRadarType(input.type, input.family);
  return keys.map((key) => {
    const def = RADAR_METRICS[key];
    const cohortValues = input.peerRates
      .map((r) => r[key])
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    const playerValue = input.playerRates[key] ?? null;
    const posAvg = average(cohortValues);
    let percentile: number | null = null;
    let rank: number | null = null;
    if (playerValue != null && cohortValues.length > 0) {
      const ranked = percentileRank(playerValue, cohortValues, def.inverted === true);
      percentile = ranked.percentile;
      rank = ranked.rank;
    }
    return {
      key,
      label: def.label,
      playerValue,
      positionAverage: posAvg,
      competitionAverage: posAvg,
      percentile,
      rank,
      sampleSize: cohortValues.length,
      format: def.format,
    };
  });
}

export function buildRadarView(input: {
  type: RadarType;
  family: RadarPositionFamily;
  playerName: string;
  competitionLabel: string | null;
  playerRates: Partial<Record<RadarMetricKey, number>>;
  peerRates: Array<Partial<Record<RadarMetricKey, number>>>;
  summaryOverride?: string | null;
}): RadarViewPayload {
  const keys = metricsForRadarType(input.type, input.family);
  if (!keys.length) {
    return {
      type: input.type,
      typeLabel: RADAR_TYPE_LABELS[input.type],
      spokes: [],
      summary: `${RADAR_TYPE_LABELS[input.type]} metrics are not yet available from Rugby365 match data.`,
      unavailableReason: "awaiting_source_metrics",
    };
  }
  const spokes = buildSpokesForType(input);
  const withData = spokes.filter((s) => s.playerValue != null && s.percentile != null);
  if (withData.length < 3) {
    return {
      type: input.type,
      typeLabel: RADAR_TYPE_LABELS[input.type],
      spokes,
      summary: `${input.playerName} needs more comparable minutes among ${RADAR_POSITION_LABELS[input.family].toLowerCase()} before a full ${RADAR_TYPE_LABELS[input.type].toLowerCase()} radar can be ranked.`,
      unavailableReason: "insufficient_comparable_metrics",
    };
  }
  return {
    type: input.type,
    typeLabel: RADAR_TYPE_LABELS[input.type],
    spokes,
    summary: buildRadarWrittenSummary({
      playerName: input.playerName,
      positionLabel: RADAR_POSITION_LABELS[input.family],
      competitionLabel: input.competitionLabel,
      spokes,
      override: input.summaryOverride,
    }),
    unavailableReason: null,
  };
}

export function aggregateSeasonRows(rows: SeasonStatRatesInput[]): SeasonStatRatesInput {
  return rows.reduce(
    (acc, row) => ({
      minutesPlayed: acc.minutesPlayed + (row.minutesPlayed || 0),
      appearances: acc.appearances + (row.appearances || 0),
      tries: acc.tries + (row.tries || 0),
      points: acc.points + (row.points || 0),
      carries: acc.carries + (row.carries || 0),
      metresCarried: acc.metresCarried + (row.metresCarried || 0),
      tacklesMade: acc.tacklesMade + (row.tacklesMade || 0),
      tacklesCompleted: acc.tacklesCompleted + (row.tacklesCompleted || 0),
      dominantTackles: acc.dominantTackles + (row.dominantTackles || 0),
      turnoversWon: acc.turnoversWon + (row.turnoversWon || 0),
      tryAssists: acc.tryAssists + (row.tryAssists || 0),
      lineBreaks: acc.lineBreaks + (row.lineBreaks || 0),
      defendersBeaten: acc.defendersBeaten + (row.defendersBeaten || 0),
      touches: acc.touches + (row.touches || 0),
      postContactMetres: acc.postContactMetres + (row.postContactMetres || 0),
      ruckArrivalEffectiveness: Math.max(
        acc.ruckArrivalEffectiveness,
        row.ruckArrivalEffectiveness || 0,
      ),
    }),
    {
      minutesPlayed: 0,
      appearances: 0,
      tries: 0,
      points: 0,
      carries: 0,
      metresCarried: 0,
      tacklesMade: 0,
      tacklesCompleted: 0,
      dominantTackles: 0,
      turnoversWon: 0,
      tryAssists: 0,
      lineBreaks: 0,
      defendersBeaten: 0,
      touches: 0,
      postContactMetres: 0,
      ruckArrivalEffectiveness: 0,
    },
  );
}

const ALL_RADAR_TYPES: RadarType[] = [
  "overall",
  "attack",
  "defence",
  "carrying",
  "set_piece",
  "kicking",
  "discipline",
  "physical",
];

export function buildPlayerRadarBundle(input: {
  playerId: string;
  playerName: string;
  positionName: string | null;
  competitionLabel: string | null;
  seasonLabel: string | null;
  minMinutes: number;
  defaultType: RadarType;
  enabled: boolean;
  summaryOverride: string | null;
  summaryApproved: boolean;
  playerRows: SeasonStatRatesInput[];
  peers: CohortPeerRow[];
}): PlayerRadarBundle {
  const family = normalizePositionFamily(input.positionName);
  const positionLabel = RADAR_POSITION_LABELS[family];
  const playerAgg = aggregateSeasonRows(input.playerRows);
  const playerRates = computeMetricRates(playerAgg);

  const cohortPeers = input.peers.filter(
    (p) =>
      p.playerId !== input.playerId &&
      p.minutesPlayed >= input.minMinutes &&
      peerMatchesPosition(p.positionName, family),
  );
  // Include the player in percentile cohort if they qualify
  const includeSelf =
    playerAgg.minutesPlayed >= input.minMinutes
      ? [playerRates, ...cohortPeers.map((p) => computeMetricRates(p))]
      : cohortPeers.map((p) => computeMetricRates(p));

  const cohortSize = includeSelf.length;
  const titleParts = [
    input.competitionLabel,
    positionLabel,
  ].filter(Boolean);
  const title = titleParts.length
    ? `Compared with ${titleParts.join(" ")} (minimum ${input.minMinutes} minutes)`
    : `Compared with ${positionLabel} (minimum ${input.minMinutes} minutes)`;

  const radars: Partial<Record<RadarType, RadarViewPayload>> = {};
  for (const type of ALL_RADAR_TYPES) {
    radars[type] = buildRadarView({
      type,
      family,
      playerName: input.playerName,
      competitionLabel: input.competitionLabel,
      playerRates,
      peerRates: includeSelf,
      summaryOverride:
        type === input.defaultType && input.summaryApproved
          ? input.summaryOverride
          : type === input.defaultType
            ? input.summaryOverride
            : null,
    });
  }

  const defaultView = radars[input.defaultType] ?? radars.overall!;
  const summary =
    input.summaryOverride?.trim() && (input.summaryApproved || input.summaryOverride)
      ? input.summaryOverride.trim()
      : defaultView.summary;

  return {
    enabled: input.enabled,
    title,
    positionFamily: family,
    positionLabel,
    competitionLabel: input.competitionLabel,
    seasonLabel: input.seasonLabel,
    minMinutes: input.minMinutes,
    cohortSize,
    defaultType: input.defaultType,
    radars,
    seoSpokes: defaultView.spokes,
    summary,
    summaryApproved: input.summaryApproved,
    future: {
      playerVsPlayer: false,
      seasonVsSeason: false,
      clubVsInternational: false,
      careerProgression: false,
      animatedHistory: false,
    },
  };
}

export function emptyRadarBundle(input: {
  playerName: string;
  positionName: string | null;
  minMinutes: number;
  enabled: boolean;
}): PlayerRadarBundle {
  const family = normalizePositionFamily(input.positionName);
  return {
    enabled: input.enabled,
    title: `Compared with ${RADAR_POSITION_LABELS[family]} (minimum ${input.minMinutes} minutes)`,
    positionFamily: family,
    positionLabel: RADAR_POSITION_LABELS[family],
    competitionLabel: null,
    seasonLabel: null,
    minMinutes: input.minMinutes,
    cohortSize: 0,
    defaultType: "overall",
    radars: {},
    seoSpokes: [],
    summary: `${input.playerName} does not yet have enough season performance data for a position radar.`,
    summaryApproved: false,
    future: {
      playerVsPlayer: false,
      seasonVsSeason: false,
      clubVsInternational: false,
      careerProgression: false,
      animatedHistory: false,
    },
  };
}
