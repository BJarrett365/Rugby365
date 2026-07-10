"use client";

import { use } from "react";
import { CommentaryFeed, useFixtureBySlug } from "@/components/commentary/CommentaryFeed";
import { PageHeader } from "@/components/shell/PageHeader";

export default function CommentaryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { fixture, homeName, awayName } = useFixtureBySlug(slug);

  return (
    <>
      <PageHeader
        eyebrow="Rugby365 Live"
        title={`${homeName} vs ${awayName}`}
        description="Live commentary"
        actions={
          <a
            href={`/display/tv/${slug}/commentary`}
            className="cms-btn cms-btn--secondary no-print"
          >
            TV view
          </a>
        }
      />
      <CommentaryFeed fixtureId={fixture?.id ?? null} fixture={fixture} homeName={homeName} awayName={awayName} />
    </>
  );
}
