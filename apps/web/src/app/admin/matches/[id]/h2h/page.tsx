"use client";

import { use, useCallback, useEffect, useState } from "react";
import { MatchCmsFeatureShell } from "@/components/admin/MatchCmsFeatureShell";
import { MatchHeadToHeadPanel } from "@/components/admin/MatchHeadToHeadPanel";

export default function MatchH2HPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [planetRugbyUrl, setPlanetRugbyUrl] = useState<string | null>(null);
  const [sport365Url, setSport365Url] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/admin/matches/${id}`);
      const data = await res.json();
      if (!res.ok || !data.fixture || cancelled) return;
      setPlanetRugbyUrl(data.fixture.planetRugbyUrl ?? null);
      setSport365Url(data.fixture.sport365Url ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, tick]);

  const onRefresh = useCallback(() => setTick((n) => n + 1), []);

  return (
    <MatchCmsFeatureShell
      matchId={id}
      title="Head to Head"
      description="Historical head-to-head context for this fixture."
    >
      <div className="cms-card">
        <MatchHeadToHeadPanel
          fixtureId={id}
          planetRugbyUrl={planetRugbyUrl}
          sport365Url={sport365Url}
          onRefresh={onRefresh}
        />
      </div>
    </MatchCmsFeatureShell>
  );
}
