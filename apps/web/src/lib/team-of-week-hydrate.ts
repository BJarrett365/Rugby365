import "server-only";
import { coaches, players, referees } from "@rugby365/db";
import { inArray } from "drizzle-orm";
import { getDb } from "./db";
import type { TotwPublicPlayer, TotwPublicView } from "./team-of-week-public";

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
