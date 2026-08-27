/**
 * Shape Team of the Week edition for public / admin UI.
 */
import type { getTeamOfWeekEditionBundle } from "./team-of-week-service";
import { coaches, players, referees } from "@rugby365/db";
import { inArray } from "drizzle-orm";
import { getDb } from "./db";

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

function fillImage<T extends { imageUrl: string | null }>(row: T, url: string | null | undefined): T {
  if (row.imageUrl || !url) return row;
  return { ...row, imageUrl: url };
}

/** Prefer live CMS photos when TotW snapshots were frozen without images. */
export async function hydrateTotwLiveImages(view: TotwPublicView): Promise<TotwPublicView> {
  const playerIds = new Set<string>();
  const coachIds = new Set<string>();
  const refereeIds = new Set<string>();

  for (const row of [...view.starting, ...view.bench, ...view.closeCalls, ...view.droppedOut]) {
    if (row.playerId && !row.imageUrl) playerIds.add(row.playerId);
  }
  for (const award of Object.values(view.awards)) {
    if (!award || award.imageUrl) continue;
    if (award.playerId) playerIds.add(award.playerId);
    if (award.coachId) coachIds.add(award.coachId);
    if (award.refereeId) refereeIds.add(award.refereeId);
  }

  if (playerIds.size === 0 && coachIds.size === 0 && refereeIds.size === 0) return view;

  const db = getDb();
  const [playerRows, coachRows, refereeRows] = await Promise.all([
    playerIds.size
      ? db
          .select({
            id: players.id,
            imageUrl: players.imageUrl,
            badgeImageUrl: players.badgeImageUrl,
          })
          .from(players)
          .where(inArray(players.id, [...playerIds]))
      : Promise.resolve([] as Array<{ id: string; imageUrl: string | null; badgeImageUrl: string | null }>),
    coachIds.size
      ? db
          .select({ id: coaches.id, imageUrl: coaches.imageUrl })
          .from(coaches)
          .where(inArray(coaches.id, [...coachIds]))
      : Promise.resolve([] as Array<{ id: string; imageUrl: string | null }>),
    refereeIds.size
      ? db
          .select({ id: referees.id, imageUrl: referees.imageUrl })
          .from(referees)
          .where(inArray(referees.id, [...refereeIds]))
      : Promise.resolve([] as Array<{ id: string; imageUrl: string | null }>),
  ]);

  const playerImage = new Map(
    playerRows.map((row) => [row.id, row.imageUrl || row.badgeImageUrl] as const),
  );
  const coachImage = new Map(coachRows.map((row) => [row.id, row.imageUrl] as const));
  const refereeImage = new Map(refereeRows.map((row) => [row.id, row.imageUrl] as const));

  const patchPlayers = (rows: TotwPublicPlayer[]) =>
    rows.map((row) => fillImage(row, row.playerId ? playerImage.get(row.playerId) : null));

  const awards = Object.fromEntries(
    Object.entries(view.awards).map(([key, award]) => {
      if (!award) return [key, award];
      const live =
        (award.playerId ? playerImage.get(award.playerId) : null) ??
        (award.coachId ? coachImage.get(award.coachId) : null) ??
        (award.refereeId ? refereeImage.get(award.refereeId) : null);
      return [key, fillImage(award, live)];
    }),
  );

  return {
    ...view,
    starting: patchPlayers(view.starting),
    bench: patchPlayers(view.bench),
    closeCalls: patchPlayers(view.closeCalls),
    droppedOut: patchPlayers(view.droppedOut),
    awards,
  };
}

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
