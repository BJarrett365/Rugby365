"use client";

import { use, useEffect } from "react";
import { CommentaryFeed, useFixtureBySlug } from "@/components/commentary/CommentaryFeed";
import { useSurface } from "@/components/surface/SurfaceProvider";

export default function TvCommentaryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { fixture, homeName, awayName } = useFixtureBySlug(slug);
  const { setOverride } = useSurface();

  useEffect(() => {
    setOverride("tv");
    return () => setOverride(null);
  }, [setOverride]);

  return (
    <div className="tv-display">
      <header className="tv-display__header">
        <p className="tv-display__badge">Rugby365 Live</p>
        <h1 className="tv-display__title">
          {homeName} vs {awayName}
        </h1>
      </header>
      <CommentaryFeed fixtureId={fixture?.id ?? null} fixture={fixture} homeName={homeName} awayName={awayName} />
    </div>
  );
}
