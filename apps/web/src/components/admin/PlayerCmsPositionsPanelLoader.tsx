"use client";

import { useEffect, useState } from "react";
import type { PlayerPositionUsageResult } from "@/lib/player-position-usage-service";
import { PlayerCmsPositionsPanel } from "@/components/admin/PlayerCmsPositionsPanel";

/**
 * Self-loading CMS positions panel for the player edit page.
 */
export function PlayerCmsPositionsPanelLoader({
  playerId,
  publicSlug,
}: {
  playerId: string;
  publicSlug?: string | null;
}) {
  const [usage, setUsage] = useState<PlayerPositionUsageResult | null>(null);
  const [currentPrimary, setCurrentPrimary] = useState<string | null>(null);
  const [secondaryPositions, setSecondaryPositions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/admin/players/${playerId}/position-usage`, {
          cache: "no-store",
        });
        const data = (await res.json()) as {
          error?: string;
          usage?: PlayerPositionUsageResult;
          currentPrimary?: string | null;
          secondaryPositions?: string[];
        };
        if (!res.ok) throw new Error(data.error ?? "Failed to load");
        if (cancelled) return;
        setUsage(data.usage ?? null);
        setCurrentPrimary(data.currentPrimary ?? null);
        setSecondaryPositions(data.secondaryPositions ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Load failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [playerId]);

  if (error) {
    return (
      <div className="cms-card mb-4 border border-zinc-700">
        <h3 className="font-semibold m-0">POSITIONS</h3>
        <p className="text-sm text-zinc-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <PlayerCmsPositionsPanel
        usage={usage}
        currentPrimary={currentPrimary}
        secondaryPositions={secondaryPositions}
        publicSlug={publicSlug}
      />
    </div>
  );
}
