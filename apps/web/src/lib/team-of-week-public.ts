/**
 * Shape Team of the Week edition for public / admin UI.
 */
import type { getTeamOfWeekEditionBundle } from "./team-of-week-service";

export type TotwPublicPlayer = {
  playerId: string | null;
  playerName: string;
  playerSlug: string | null;
  imageUrl: string | null;
  teamId: string | null;
  teamName: string;
  teamSlug: string | null;
  teamImageUrl: string | null;
  shirtNumber: number | null;
  positionLabel: string;
  positionCode: string | null;
  matchRating: number | null;
  selectionScore: number | null;
  confidencePct: number | null;
  shortReason: string | null;
  fullReason: string | null;
  selectionType: string;
  fixtureId: string | null;
  gapToNext: number | null;
  stats: Record<string, unknown> | null;
  /** Snapshot from Shirt Library at generate/publish time. */
  shirtId: string | null;
  shirtVersionId: string | null;
  kitType: string | null;
  shirtSelectionMethod: string | null;
  shirtSvgConfig: Record<string, unknown> | null;
  shirtIsFallback: boolean;
};

function snap(s: unknown): Record<string, unknown> {
  return s && typeof s === "object" ? (s as Record<string, unknown>) : {};
}

function asPlayer(row: {
  playerId: string | null;
  teamId: string | null;
  fixtureId: string | null;
  shirtNumber: number | null;
  positionCode: string | null;
  matchRating: number | null;
  selectionScore: number | null;
  confidencePct: number | null;
  shortReason: string | null;
  fullReason: string | null;
  selectionType: string;
  snapshot: unknown;
  shirtId?: string | null;
  shirtVersionId?: string | null;
  kitType?: string | null;
  shirtSelectionMethod?: string | null;
}): TotwPublicPlayer {
  const s = snap(row.snapshot);
  return {
    playerId: row.playerId,
    playerName: String(s.playerName ?? "Player"),
    playerSlug: (s.playerSlug as string | null) ?? null,
    imageUrl: (s.imageUrl as string | null) ?? null,
    teamId: row.teamId,
    teamName: String(s.teamName ?? "Team"),
    teamSlug: (s.teamSlug as string | null) ?? null,
    teamImageUrl: (s.teamImageUrl as string | null) ?? null,
    shirtNumber: row.shirtNumber,
    positionLabel: String(s.positionLabel ?? row.positionCode ?? "Position"),
    positionCode: row.positionCode,
    matchRating: row.matchRating,
    selectionScore: row.selectionScore,
    confidencePct: row.confidencePct,
    shortReason: row.shortReason,
    fullReason: row.fullReason,
    selectionType: row.selectionType,
    fixtureId: row.fixtureId,
    gapToNext: typeof s.gapToNext === "number" ? s.gapToNext : null,
    stats: (s.stats as Record<string, unknown> | null) ?? null,
    shirtId: row.shirtId ?? (s.shirtId as string | null) ?? null,
    shirtVersionId: row.shirtVersionId ?? (s.shirtVersionId as string | null) ?? null,
    kitType: row.kitType ?? (s.kitType as string | null) ?? null,
    shirtSelectionMethod:
      row.shirtSelectionMethod ?? (s.shirtSelectionMethod as string | null) ?? null,
    shirtSvgConfig:
      (s.shirtSvgConfig as Record<string, unknown> | null) ?? null,
    shirtIsFallback: Boolean(s.shirtIsFallback),
  };
}

export function presentTeamOfWeekBundle(
  bundle: NonNullable<Awaited<ReturnType<typeof getTeamOfWeekEditionBundle>>>,
) {
  const { edition, selections, awards, competition, season } = bundle;
  const starting = selections
    .filter((s) => s.selectionType === "STARTING")
    .map(asPlayer)
    .sort((a, b) => (a.shirtNumber ?? 99) - (b.shirtNumber ?? 99));
  const bench = selections
    .filter((s) => s.selectionType === "BENCH")
    .map(asPlayer)
    .sort((a, b) => (a.shirtNumber ?? 99) - (b.shirtNumber ?? 99));
  const closeCalls = selections.filter((s) => s.selectionType === "CLOSE_CALL").map(asPlayer);
  const droppedOut = selections.filter((s) => s.selectionType === "DROPPED_OUT").map(asPlayer);

  const awardMap = Object.fromEntries(
    awards.map((a) => {
      const s = snap(a.snapshot);
      return [
        a.awardType,
        {
          awardType: a.awardType,
          rating: a.rating,
          score: a.score,
          shortReason: a.shortReason,
          fullReason: a.fullReason,
          playerId: a.playerId,
          coachId: a.coachId,
          refereeId: a.refereeId,
          teamId: a.teamId,
          fixtureId: a.fixtureId,
          name: String(s.name ?? s.playerName ?? s.teamName ?? "—"),
          imageUrl: (s.imageUrl as string | null) ?? (s.teamImageUrl as string | null) ?? null,
          teamName: (s.teamName as string | null) ?? null,
          teamSlug: (s.teamSlug as string | null) ?? null,
          teamImageUrl: (s.teamImageUrl as string | null) ?? null,
          positionLabel: (s.positionLabel as string | null) ?? null,
          slug: (s.slug as string | null) ?? (s.playerSlug as string | null) ?? null,
          limitedData: Boolean(s.limitedData),
          stats: (s.stats as Record<string, unknown> | null) ?? null,
          selections: typeof s.selections === "number" ? s.selections : null,
        },
      ];
    }),
  );

  const summary = snap(edition.roundSummary);

  return {
    edition: {
      id: edition.id,
      status: edition.status,
      isProvisional: edition.isProvisional,
      roundKey: edition.roundKey,
      roundName: edition.roundName,
      roundNumber: edition.roundNumber,
      roundStartDate: edition.roundStartDate?.toISOString() ?? null,
      roundEndDate: edition.roundEndDate?.toISOString() ?? null,
      methodVersion: edition.methodVersion,
      fixtureCount: edition.fixtureCount,
      completedFixtureCount: edition.completedFixtureCount,
      editorialIntro: edition.editorialIntro,
      publishedAt: edition.publishedAt?.toISOString() ?? null,
    },
    competition,
    season,
    starting,
    bench,
    closeCalls,
    droppedOut,
    awards: awardMap,
    summary: {
      matchesPlayed: Number(summary.matchesPlayed ?? 0),
      totalTries: Number(summary.totalTries ?? 0),
      totalPoints: Number(summary.totalPoints ?? 0),
      totalTackles: Number(summary.totalTackles ?? 0),
      totalMetres: Number(summary.totalMetres ?? 0),
      yellowCards: Number(summary.yellowCards ?? 0),
      redCards: Number(summary.redCards ?? 0),
      highestRatedPlayer: summary.highestRatedPlayer ?? null,
    },
  };
}

export type TotwPublicView = ReturnType<typeof presentTeamOfWeekBundle>;

export function formatTotwDateRange(from: string | null, to: string | null): string {
  if (!from && !to) return "";
  const fmt = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };
  if (from && to) {
    const a = new Date(from);
    const b = new Date(to);
    if (a.toDateString() === b.toDateString()) return fmt(from);
    const sameMonth = a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === b.getUTCFullYear();
    if (sameMonth) {
      return `${a.getUTCDate().toString().padStart(2, "0")} – ${fmt(to)}`;
    }
    return `${fmt(from)} – ${fmt(to)}`;
  }
  return fmt(from ?? to!);
}
