import { listPublicPlayerSitemapEntries } from "@/lib/public-players-directory-service";

export const dynamic = "force-dynamic";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const entries = await listPublicPlayerSitemapEntries();
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map((e) => {
    const loc = `/players/${e.slug}`;
    const lastmod = e.updatedAt ? `\n    <lastmod>${e.updatedAt.slice(0, 10)}</lastmod>` : "";
    return `  <url>
    <loc>${escapeXml(loc)}</loc>${lastmod}
  </url>`;
  })
  .join("\n")}
</urlset>
`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
