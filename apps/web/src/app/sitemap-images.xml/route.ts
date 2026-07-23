import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { playerImages, players } from "@rugby365/db";
import { getDb } from "@/lib/db";
import { apiErrorResponse } from "@/lib/api-errors";

/**
 * Image sitemap for Google — public approved player images only.
 */
export async function GET() {
  try {
    const db = getDb();
    const rows = await db
      .select({
        slug: players.slug,
        imageUrl: playerImages.imageUrl,
        title: playerImages.title,
        caption: playerImages.caption,
        altText: playerImages.altText,
        updatedAt: playerImages.updatedAt,
      })
      .from(playerImages)
      .innerJoin(players, eq(playerImages.playerId, players.id))
      .where(
        and(
          eq(playerImages.isPublic, true),
          eq(playerImages.status, "approved"),
          eq(players.isPublic, true),
          eq(players.publishStatus, "published"),
        ),
      )
      .limit(5000);

    const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://www.rugby365.com";
    const urls = rows
      .map((row) => {
        const loc = `${base}/players/${row.slug}`;
        const title = (row.title || row.altText || row.caption || "").replace(/]]>/g, "");
        return `  <url>
    <loc>${loc}</loc>
    <image:image>
      <image:loc>${escapeXml(row.imageUrl)}</image:loc>
      ${title ? `<image:title>${escapeXml(title)}</image:title>` : ""}
    </image:image>
  </url>`;
      })
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls}
</urlset>`;

    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (e) {
    return apiErrorResponse(e, "Failed to build image sitemap");
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
