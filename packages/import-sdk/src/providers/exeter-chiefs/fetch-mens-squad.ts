import type { ParsedClubSquadDocument, ParsedClubSquadPlayer } from "../club-website/types";

export const EXETER_CHIEFS_MENS_SQUAD_URL = "https://www.exeterchiefs.co.uk/teams/mens";

/** Parse squad rows from Exeter Chiefs Next.js RSC payload (Sanity CMS). */
export function parseExeterChiefsRscSquad(payload: string): ParsedClubSquadPlayer[] {
  const players: ParsedClubSquadPlayer[] = [];
  const seen = new Set<string>();
  const playerRe = /"playerName":"([^"]+)","positions":\[([\s\S]*?)\]/g;

  for (const match of payload.matchAll(playerRe)) {
    const name = match[1]!.trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);

    const positionsBlock = match[2] ?? "";
    const positionTitles = [...positionsBlock.matchAll(/"_type":"position"[\s\S]*?"title":"([^"]+)"/g)].map(
      (entry) => entry[1]!.trim(),
    );

    const squadNumberMatch = positionsBlock.match(/"squadNumber":(\d+)|"shirtNumber":(\d+)/);
    const squadNumber = squadNumberMatch
      ? Number.parseInt(squadNumberMatch[1] ?? squadNumberMatch[2] ?? "", 10)
      : null;

    const slugMatch = payload
      .slice(Math.max(0, (match.index ?? 0) - 400), (match.index ?? 0) + 200)
      .match(/"slug":\{"_type":"slug","current":"([^"]+)"\}/);
    const profileUrl = slugMatch ? `https://www.exeterchiefs.co.uk/players/${slugMatch[1]}` : null;

    players.push({
      name,
      positionName: positionTitles.length ? [...new Set(positionTitles)].join(" / ") : null,
      squadNumber: Number.isFinite(squadNumber) ? squadNumber : null,
      profileUrl,
    });
  }

  return players.sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchExeterChiefsMensSquad(
  sourceUrl = EXETER_CHIEFS_MENS_SQUAD_URL,
): Promise<ParsedClubSquadDocument> {
  const response = await fetch(sourceUrl, {
    headers: {
      RSC: "1",
      Accept: "text/x-component",
      "User-Agent": "Rugby365-ClubSquadImport/1.0 (+https://rugby365.com)",
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Exeter Chiefs squad fetch failed (${response.status})`);
  }
  const payload = await response.text();
  const players = parseExeterChiefsRscSquad(payload);
  if (!players.length) {
    throw new Error("No players parsed from Exeter Chiefs squad page");
  }
  return {
    clubName: "Exeter Chiefs",
    sourceUrl,
    players,
  };
}
