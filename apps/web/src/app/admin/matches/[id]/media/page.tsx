"use client";

import { use, useCallback, useEffect, useState } from "react";
import { MatchCmsFeatureShell } from "@/components/admin/MatchCmsFeatureShell";
import { MatchYoutubeMediaPanel } from "@/components/admin/MatchYoutubeMediaPanel";

export default function MatchMediaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [watchalong, setWatchalong] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/admin/matches/${id}`);
    const data = await res.json();
    if (!res.ok || !data.fixture) return;
    setWatchalong(data.fixture.watchalongYoutubeUrl ?? null);
    setHighlights(data.fixture.highlightsYoutubeUrl ?? null);
    setLoaded(true);
  }, [id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <MatchCmsFeatureShell
      matchId={id}
      title="YouTube Media"
      description="Watchalong and match highlights — managed independently."
    >
      <div className="cms-card">
        {loaded ? (
          <MatchYoutubeMediaPanel
            fixtureId={id}
            initialWatchalongUrl={watchalong}
            initialHighlightsUrl={highlights}
            onSaved={reload}
          />
        ) : (
          <p className="text-sm text-zinc-500 m-0">Loading media…</p>
        )}
      </div>
    </MatchCmsFeatureShell>
  );
}
