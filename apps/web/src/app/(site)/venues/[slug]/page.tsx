import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { venues } from "@rugby365/db";
import { getDb } from "@/lib/db";
import { getVenueDetail } from "@/lib/venue-admin-service";

type PageProps = { params: Promise<{ slug: string }> };

async function getVenueBySlug(slug: string) {
  const db = getDb();
  const [row] = await db.select().from(venues).where(eq(venues.slug, slug)).limit(1);
  return row ?? null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const venue = await getVenueBySlug(slug);
  if (!venue) return { title: "Stadium not found | Rugby365" };
  const place = [venue.city, venue.countryName].filter(Boolean).join(", ");
  return {
    title: `${venue.name} | Stadium | Rugby365`,
    description: place
      ? `${venue.name} — ${place}. Stadium profile on Rugby365.`
      : `${venue.name} stadium profile on Rugby365.`,
  };
}

export default async function PublicVenuePage({ params }: PageProps) {
  const { slug } = await params;
  const venueRow = await getVenueBySlug(slug);
  if (!venueRow) notFound();
  const detail = await getVenueDetail(venueRow.id);
  if (!detail) notFound();
  const { venue, team, fixtures: recent } = detail;

  return (
    <div className="cms-page" style={{ maxWidth: 720, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>
      <p style={{ marginBottom: "0.75rem" }}>
        <Link href="/matches">← Scores &amp; Fixtures</Link>
      </p>
      <header style={{ marginBottom: "1.25rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.75rem" }}>{venue.name}</h1>
        <p style={{ margin: "0.35rem 0 0", color: "#a7adac" }}>
          Stadium
          {venue.city ? ` · ${venue.city}` : ""}
          {venue.countryName ? ` · ${venue.countryName}` : ""}
          {venue.capacity != null ? ` · Capacity ${venue.capacity.toLocaleString("en-GB")}` : ""}
        </p>
        {team ? (
          <p style={{ margin: "0.5rem 0 0" }}>
            Home of <strong>{team.name}</strong>
          </p>
        ) : null}
      </header>

      {recent.length > 0 ? (
        <section>
          <h2 style={{ fontSize: "1.1rem" }}>Recent matches</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: "0.75rem 0 0", lineHeight: 1.55 }}>
            {recent.slice(0, 12).map((f) => (
              <li
                key={f.id}
                style={{
                  padding: "0.55rem 0",
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <Link href={`/matches/${f.slug}`} style={{ color: "#e7bc63", fontWeight: 600 }}>
                  {f.homeTeam ?? "TBC"} {f.homeScore}–{f.awayScore} {f.awayTeam ?? "TBC"}
                </Link>
                <div style={{ fontSize: "0.8125rem", color: "#a7adac" }}>
                  {f.kickoffAt
                    ? new Date(f.kickoffAt).toLocaleDateString("en-GB", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : null}
                  {f.competitionName ? ` · ${f.competitionName}` : ""}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {venue.wikipediaUrl ? (
        <p style={{ marginTop: "1.25rem" }}>
          <a href={venue.wikipediaUrl} target="_blank" rel="noreferrer">
            Wikipedia
          </a>
        </p>
      ) : null}
    </div>
  );
}
