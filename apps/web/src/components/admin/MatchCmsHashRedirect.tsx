"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy #hash bookmarks from the old mega-edit page → focused CMS routes. */
const HASH_REDIRECTS: Record<string, string> = {
  "#lineups": "lineups",
  "#team-stats": "stats",
  "#stats": "stats",
  "#player-stats": "player-stats",
  "#events": "events",
  "#tracker": "animation",
  "#animation": "animation",
  "#youtube": "media",
  "#media": "media",
  "#tv-schedule": "channels",
  "#channels": "channels",
  "#sources": "sources",
  "#h2h": "h2h",
  "#head-to-head": "h2h",
  "#commentary": "commentary",
  "#score": "edit",
  "#issues": "edit",
  "#information": "edit",
};

export function MatchCmsHashRedirect({ matchId }: { matchId: string }) {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    const target = HASH_REDIRECTS[hash];
    if (!target) return;
    if (target === "edit") {
      window.history.replaceState(null, "", window.location.pathname);
      return;
    }
    router.replace(`/admin/matches/${matchId}/${target}`);
  }, [matchId, router]);

  return null;
}
