/**
 * Player news items from Ultimate Rugby (and future SA news scrapes).
 */
import "server-only";

import { desc, eq } from "drizzle-orm";
import { playerSourceNews, players } from "@rugby365/db";
import { getDb } from "./db";

export type PublicPlayerNewsItem = {
  id: string;
  title: string;
  url: string;
  publishedLabel: string | null;
  sourceProvider: string;
  viewCount: number | null;
};

export async function getPublicPlayerNews(
  playerId: string,
  limit = 40,
): Promise<PublicPlayerNewsItem[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: playerSourceNews.id,
      title: playerSourceNews.title,
      url: playerSourceNews.url,
      publishedLabel: playerSourceNews.publishedLabel,
      sourceProvider: playerSourceNews.sourceProvider,
      viewCount: playerSourceNews.viewCount,
    })
    .from(playerSourceNews)
    .where(eq(playerSourceNews.playerId, playerId))
    .orderBy(desc(playerSourceNews.syncedAt))
    .limit(limit);

  return rows;
}

export async function getPublicPlayerNewsBySlug(
  slug: string,
  limit = 40,
): Promise<{ playerId: string; name: string; items: PublicPlayerNewsItem[] } | null> {
  const db = getDb();
  const [player] = await db
    .select({ id: players.id, name: players.name })
    .from(players)
    .where(eq(players.slug, slug))
    .limit(1);
  if (!player) return null;
  const items = await getPublicPlayerNews(player.id, limit);
  return { playerId: player.id, name: player.name, items };
}
