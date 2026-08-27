"use client";

import { PlayerCompareCoreChart } from "@/components/players/PlayerCompareCoreChart";

/** Inline head-to-head for the competition→team picker path. */
export function ComparePlayersResult({
  slugA,
  slugB,
}: {
  slugA: string;
  slugB: string;
}) {
  if (!slugA || !slugB || slugA === slugB) return null;
  return <PlayerCompareCoreChart slugA={slugA} slugB={slugB} />;
}
