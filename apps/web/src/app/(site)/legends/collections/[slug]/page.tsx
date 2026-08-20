import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TeamCrest } from "@/components/matches/TeamCrest";
import { listPublicCollectionMembers } from "@/lib/legend-collections-service";
import { LEGEND_COLLECTIONS } from "@/lib/legends-catalog";
import { getLegendScoresForPlayers } from "@/lib/legend-score-service";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const meta = LEGEND_COLLECTIONS.find((c) => c.slug === slug);
  if (!meta) return { title: "Legends collection" };
  return {
    title: `${meta.label} | Planet Rugby Legends`,
    description: meta.description,
    alternates: { canonical: `/legends/collections/${meta.slug}` },
  };
}

export default async function LegendCollectionPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await listPublicCollectionMembers(slug);
  if (!data) notFound();

  const { collection, members } = data;
  const playerIds = members.filter((m) => m.kind === "player").map((m) => m.id);
  const scores = await getLegendScoresForPlayers(playerIds);

  return (
    <article className="pr-mc-fixtures-page pr-legends-page">
      <nav className="pr-mc-breadcrumbs" aria-label="Breadcrumb">
        <Link href="/matches">Home</Link>
        <span aria-hidden>/</span>
        <Link href="/legends">Legends</Link>
        <span aria-hidden>/</span>
        <span aria-current="page">{collection.label}</span>
      </nav>

      <header className="pr-legends-header">
        <p className="pr-legends-header__eyebrow">Planet Rugby Legends</p>
        <h1>{collection.label}</h1>
        <p className="pr-legends-header__lede">{collection.description}</p>
      </header>

      <ul className="pr-legends-chip-row">
        {LEGEND_COLLECTIONS.map((c) => (
          <li key={c.slug}>
            <Link
              href={`/legends/collections/${c.slug}`}
              className={`pr-legends-chip${c.slug === collection.slug ? " is-active" : ""}`}
            >
              {c.label}
            </Link>
          </li>
        ))}
      </ul>

      {members.length === 0 ? (
        <p className="pr-mc-transfers-muted">
          No members yet. Seed from Admin → Legends
          {collection.entityKind === "coach" ? " (Seed coaches)" : ""}.
        </p>
      ) : (
        <ul className="pr-legends-grid">
          {members.map((m) => {
            const score = m.kind === "player" ? scores.get(m.id) : null;
            return (
              <li key={m.memberId}>
                <Link href={m.href} className="pr-legends-card">
                  <TeamCrest name={m.name} imageUrl={m.imageUrl} size="md" />
                  <span className="pr-legends-card__name">{m.name}</span>
                  <span className="pr-legends-card__meta">
                    {[m.nationality, m.kind === "player" ? "Player" : "Coach"]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  {score ? (
                    <span className="pr-legends-card__tags">
                      Legend Score {score.overallScore}
                      {score.allTimeRank != null ? ` · #${score.allTimeRank}` : ""}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
