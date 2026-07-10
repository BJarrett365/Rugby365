import {
  assertSport365RugbyMatchUrl,
  fetchSport365MatchPageHtml,
  parseSport365MatchSnapshotFromHtml,
} from "./sport365-parse";
import type { MatchSnapshot } from "./types";

export type PollOptions = {
  sourceUrl: string;
  html?: string;
};

export async function pollMatchSnapshot(options: PollOptions): Promise<MatchSnapshot> {
  const sourceUrl = assertSport365RugbyMatchUrl(options.sourceUrl).toString();
  const html = options.html ?? (await fetchSport365MatchPageHtml(sourceUrl));
  const snapshot = parseSport365MatchSnapshotFromHtml(html, sourceUrl);
  if (!snapshot) throw new Error("Could not parse Sport365 match snapshot from page.");
  return snapshot;
}

export function confirmFixture(snapshot: MatchSnapshot): {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  competition?: string;
  sourceUrl: string;
} {
  return {
    matchId: snapshot.matchId,
    homeTeam: snapshot.homeTeam,
    awayTeam: snapshot.awayTeam,
    competition: snapshot.competition,
    sourceUrl: snapshot.sourceUrl,
  };
}
