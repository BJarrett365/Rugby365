import {
  parseWorldRugbyRankings,
  type RawWorldRugbyRankingsResponse,
  worldRugbyRankingsUrl,
} from "./parse-rankings";
import type { WorldRugbyRankingCategory, WorldRugbyRankingsPayload } from "./rankings-types";

export async function fetchWorldRugbyRankings(
  category: WorldRugbyRankingCategory,
  options?: { language?: string; date?: string; fetchImpl?: typeof fetch },
): Promise<WorldRugbyRankingsPayload> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const url = worldRugbyRankingsUrl(category, options?.language ?? "en", options?.date);
  const res = await fetchImpl(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Rugby365/1.0 (+https://rugby365.com)",
    },
  });
  if (!res.ok) {
    throw new Error(`World Rugby rankings fetch failed (${res.status}) for ${category}`);
  }

  const raw = (await res.json()) as RawWorldRugbyRankingsResponse;
  return parseWorldRugbyRankings(category, raw);
}
