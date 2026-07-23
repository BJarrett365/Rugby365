import {
  flattenPremiershipTransfers,
  parsePremiershipTransferWikitext,
  type ParsedPremiershipTransfer,
} from "@rugby365/import-sdk";
import {
  AUTO_MATCH_THRESHOLD,
  matchPlayers,
  matchTeamName,
} from "./transfer-match-service";
import {
  createTransferImportLog,
  createTransferRecord,
  resolvePremiershipSeason,
  resolveTransferPlayer,
  resolveTransferTeam,
} from "./transfer-admin-service";
import { normalizedEntityKey } from "./entity-normalize";
import type { TransferImportSummary } from "./transfer-types";
import { getDb } from "./db";
import { players, teams } from "@rugby365/db";

import {
  DEFAULT_PREMIERSHIP_TRANSFER_SEASON,
  PREMIERSHIP_TRANSFER_CLUB_UPDATE_SEASONS,
  PREMIERSHIP_TRANSFERS_WIKI_URL,
  type PremiershipTransferSeasonLabel,
} from "./premiership-transfer-constants";

export {
  DEFAULT_PREMIERSHIP_TRANSFER_SEASON,
  PREMIERSHIP_TRANSFERS_WIKI_URL,
  PREMIERSHIP_TRANSFERS_WIKI_URL_2025_26,
  PREMIERSHIP_TRANSFERS_WIKI_URL_2026_27,
  PREMIERSHIP_TRANSFER_SOURCES,
} from "./premiership-transfer-constants";

function wikiTitleFromUrl(url: string): string {
  const part = url.split("/wiki/")[1];
  if (!part) throw new Error("Invalid Wikipedia URL");
  return decodeURIComponent(part.replace(/_/g, " "));
}

export async function fetchWikipediaWikitext(url: string): Promise<string> {
  const title = wikiTitleFromUrl(url);
  const api = new URL("https://en.wikipedia.org/w/api.php");
  api.searchParams.set("action", "query");
  api.searchParams.set("prop", "revisions");
  api.searchParams.set("rvprop", "content");
  api.searchParams.set("rvslots", "main");
  api.searchParams.set("format", "json");
  api.searchParams.set("titles", title);
  api.searchParams.set("origin", "*");

  const res = await fetch(api.toString(), {
    headers: { "User-Agent": "Rugby365-SDMS/1.0 (transfer-import)" },
  });
  if (!res.ok) throw new Error(`Wikipedia fetch failed (${res.status})`);

  const data = (await res.json()) as {
    query?: { pages?: Record<string, { revisions?: Array<{ slots?: { main?: { "*"?: string } } }> }> };
  };
  const pages = data.query?.pages ?? {};
  const page = Object.values(pages)[0];
  const wikitext = page?.revisions?.[0]?.slots?.main?.["*"];
  if (!wikitext) throw new Error("Wikipedia page content not found");
  return wikitext;
}

export async function importPremiershipTransfers(input?: {
  url?: string;
  seasonLabel?: string;
  dryRun?: boolean;
  forcePlayerIds?: Record<string, string>;
}) {
  const url = input?.url ?? PREMIERSHIP_TRANSFERS_WIKI_URL;
  const seasonLabel = input?.seasonLabel ?? DEFAULT_PREMIERSHIP_TRANSFER_SEASON;
  const dryRun = input?.dryRun ?? false;

  const summary: TransferImportSummary = {
    newPlayers: 0,
    existingPlayersLinked: 0,
    transfersAdded: 0,
    transfersUpdated: 0,
    transfersSkipped: 0,
    teamsMapped: 0,
    warnings: [],
    errors: [],
    pendingPlayerMatches: [],
  };

  const wikitext = await fetchWikipediaWikitext(url);
  const document = parsePremiershipTransferWikitext(wikitext, { seasonLabel });
  const transfers = flattenPremiershipTransfers(document);
  const { competition, season } = await resolvePremiershipSeason(seasonLabel);
  const updatePlayerAssignment = PREMIERSHIP_TRANSFER_CLUB_UPDATE_SEASONS.has(
    seasonLabel as PremiershipTransferSeasonLabel,
  );

  const db = getDb();
  const allPlayers = await db.select().from(players);
  const allTeams = await db.select().from(teams);
  const mappedTeams = new Set<string>();

  for (const transfer of transfers) {
    try {
      await importSingleTransfer(transfer, {
        dryRun,
        seasonId: season?.id ?? null,
        competitionId: competition.id,
        sourceUrl: url,
        allPlayers,
        allTeams,
        mappedTeams,
        summary,
        forcePlayerIds: input?.forcePlayerIds ?? {},
        updatePlayerAssignment,
      });
    } catch (error) {
      summary.errors.push(
        `${transfer.playerName}: ${error instanceof Error ? error.message : "Import failed"}`,
      );
    }
  }

  if (!dryRun) {
    await createTransferImportLog({
      sourceUrl: url,
      seasonLabel,
      competitionId: competition.id,
      summary,
    });
  }

  summary.teamsMapped = mappedTeams.size;
  return { summary, document, dryRun };
}

async function importSingleTransfer(
  transfer: ParsedPremiershipTransfer,
  ctx: {
    dryRun: boolean;
    seasonId: string | null;
    competitionId: string;
    sourceUrl: string;
    allPlayers: Array<(typeof players.$inferSelect)>;
    allTeams: Array<(typeof teams.$inferSelect)>;
    mappedTeams: Set<string>;
    summary: TransferImportSummary;
    forcePlayerIds: Record<string, string>;
    updatePlayerAssignment: boolean;
  },
) {
  const fromMatch = transfer.fromClub
    ? matchTeamName(transfer.fromClub, ctx.allTeams, { createAlias: true })
    : { teamId: null, teamName: null, matched: false, inputName: "" };
  const toMatch = transfer.toClub
    ? matchTeamName(transfer.toClub, ctx.allTeams, { createAlias: true })
    : { teamId: null, teamName: null, matched: false, inputName: "" };

  let fromTeamId = fromMatch.teamId;
  let toTeamId = toMatch.teamId;

  if (transfer.fromClub && !fromTeamId && !ctx.dryRun) {
    const created = await resolveTransferTeam(fromMatch.teamName ?? transfer.fromClub, true);
    fromTeamId = created?.id ?? null;
  }
  if (transfer.toClub && !toTeamId && !ctx.dryRun) {
    const created = await resolveTransferTeam(toMatch.teamName ?? transfer.toClub, true);
    toTeamId = created?.id ?? null;
  }

  if (fromTeamId) ctx.mappedTeams.add(fromTeamId);
  if (toTeamId) ctx.mappedTeams.add(toTeamId);
  if (transfer.fromClub && !fromMatch.matched) {
    ctx.summary.warnings.push(`Unmapped from team: ${transfer.fromClub}`);
  }
  if (transfer.toClub && !toMatch.matched) {
    ctx.summary.warnings.push(`Unmapped to team: ${transfer.toClub}`);
  }

  const forcedPlayerId = ctx.forcePlayerIds[transfer.importKey];
  let playerId = forcedPlayerId ?? null;

  if (!playerId) {
    playerId = findExistingPlayerId(transfer, fromTeamId, toTeamId, ctx.allPlayers, ctx.allTeams);

    if (playerId) {
      ctx.summary.existingPlayersLinked += 1;
    } else if (!ctx.dryRun) {
      const created = await resolveTransferPlayer({
        name: transfer.playerName,
        positionName: transfer.positionName ?? undefined,
        clubName: transfer.toClub ?? transfer.fromClub ?? undefined,
        createIfMissing: true,
      });
      if (!created) {
        throw new Error("Could not resolve or create player");
      }
      playerId = created.id;
      ctx.allPlayers.push(created);
      ctx.summary.newPlayers += 1;
    } else {
      ctx.summary.newPlayers += 1;
      return;
    }
  } else {
    ctx.summary.existingPlayersLinked += 1;
  }

  if (ctx.dryRun || !playerId) return;

  const result = await createTransferRecord({
    playerId,
    fromClub: transfer.fromClub ?? undefined,
    toClub: transfer.toClub ?? undefined,
    fromTeamId: fromTeamId ?? undefined,
    toTeamId: toTeamId ?? undefined,
    transferType: "club",
    movementType: transfer.movementType,
    seasonId: ctx.seasonId ?? undefined,
    competitionId: ctx.competitionId,
    positionName: transfer.positionName ?? undefined,
    effectiveDate: transfer.transferDate ?? undefined,
    notes: transfer.notes ?? undefined,
    sourceProvider: "wikipedia",
    sourceUrl: ctx.sourceUrl,
    importKey: transfer.importKey,
    updatePlayerAssignment:
      ctx.updatePlayerAssignment && transfer.movementType !== "retirement",
    skipBioRefresh: true,
  });

  if (result.skipped) ctx.summary.transfersSkipped += 1;
  else if (result.updated) ctx.summary.transfersUpdated += 1;
  else ctx.summary.transfersAdded += 1;
}

function findExistingPlayerId(
  transfer: ParsedPremiershipTransfer,
  fromTeamId: string | null,
  toTeamId: string | null,
  allPlayers: Array<(typeof players.$inferSelect)>,
  allTeams: Array<(typeof teams.$inferSelect)>,
): string | null {
  const normalized = normalizedEntityKey(transfer.playerName, "player");
  const exact = allPlayers.find((player) => normalizedEntityKey(player.name, "player") === normalized);
  if (exact) return exact.id;

  const matches = matchPlayers({
    name: transfer.playerName,
    currentTeamId: transfer.direction === "out" ? fromTeamId : toTeamId,
    currentTeamName: transfer.direction === "out" ? transfer.premiershipClub : transfer.toClub,
    positionName: transfer.positionName ?? undefined,
    candidates: allPlayers,
    teams: allTeams,
  });

  const top = matches[0];
  const second = matches[1];
  if (top && top.score >= AUTO_MATCH_THRESHOLD && (!second || top.score - second.score >= 0.05)) {
    return top.id;
  }

  return null;
}
