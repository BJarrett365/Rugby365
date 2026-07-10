import type { SdmsMatchStatsBundle } from "./sdms-match-stats";

export type TeamMatchSide = "home" | "away";

export type ParsedTeamMatchSummary = {
  tries: number;
  conversions: number;
  penalties: number;
  dropGoals: number;
  carries: number;
  metres: number;
  tackles: number;
  turnoversWon: number;
};

export type ParsedTeamMatchStats = ParsedTeamMatchSummary & {
  side: TeamMatchSide;
  sections: Record<string, Record<string, number>>;
};

const SUMMARY_FIELDS: Array<{ key: keyof ParsedTeamMatchSummary; sdms: string }> = [
  { key: "tries", sdms: "tries" },
  { key: "conversions", sdms: "conversions" },
  { key: "penalties", sdms: "penalties" },
  { key: "dropGoals", sdms: "drop_goals" },
  { key: "carries", sdms: "carries" },
  { key: "metres", sdms: "metres" },
  { key: "tackles", sdms: "tackles" },
  { key: "turnoversWon", sdms: "turnovers_won" },
];

const SECTION_KEYS = [
  "summary",
  "possession",
  "territory",
  "attack",
  "defence",
  "kicking",
  "rucks",
  "set_piece",
] as const;

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function extractSideSection(
  section: Record<string, number> | undefined,
  side: TeamMatchSide,
): Record<string, number> {
  if (!section) return {};
  const prefix = `${side}_`;
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(section)) {
    if (!key.startsWith(prefix)) continue;
    out[key.slice(prefix.length)] = num(value);
  }
  return out;
}

export function parseSdmsTeamMatchStats(
  bundle: SdmsMatchStatsBundle,
  side: TeamMatchSide,
): ParsedTeamMatchStats {
  const summary: ParsedTeamMatchSummary = {
    tries: 0,
    conversions: 0,
    penalties: 0,
    dropGoals: 0,
    carries: 0,
    metres: 0,
    tackles: 0,
    turnoversWon: 0,
  };

  for (const field of SUMMARY_FIELDS) {
    const raw = bundle.summary?.[`${side}_${field.sdms}`];
    summary[field.key] = num(raw);
  }

  const sections: Record<string, Record<string, number>> = {};
  for (const sectionKey of SECTION_KEYS) {
    sections[sectionKey] = extractSideSection(bundle[sectionKey], side);
  }

  return { side, ...summary, sections };
}

export function parseSdmsMatchTeamStats(bundle: SdmsMatchStatsBundle): ParsedTeamMatchStats[] {
  return (["home", "away"] as const).map((side) => parseSdmsTeamMatchStats(bundle, side));
}

export function buildTeamMatchImportKey(matchId: string, side: TeamMatchSide): string {
  return `${matchId}:team:${side}`;
}

export function averageTeamMatchSummary(
  rows: ParsedTeamMatchSummary[],
): ParsedTeamMatchSummary & { matches: number } {
  const matches = rows.length;
  if (matches === 0) {
    return {
      matches: 0,
      tries: 0,
      conversions: 0,
      penalties: 0,
      dropGoals: 0,
      carries: 0,
      metres: 0,
      tackles: 0,
      turnoversWon: 0,
    };
  }

  const totals = rows.reduce(
    (acc, row) => {
      acc.tries += row.tries;
      acc.conversions += row.conversions;
      acc.penalties += row.penalties;
      acc.dropGoals += row.dropGoals;
      acc.carries += row.carries;
      acc.metres += row.metres;
      acc.tackles += row.tackles;
      acc.turnoversWon += row.turnoversWon;
      return acc;
    },
    {
      tries: 0,
      conversions: 0,
      penalties: 0,
      dropGoals: 0,
      carries: 0,
      metres: 0,
      tackles: 0,
      turnoversWon: 0,
    },
  );

  return {
    matches,
    tries: Math.round((totals.tries / matches) * 10) / 10,
    conversions: Math.round((totals.conversions / matches) * 10) / 10,
    penalties: Math.round((totals.penalties / matches) * 10) / 10,
    dropGoals: Math.round((totals.dropGoals / matches) * 10) / 10,
    carries: Math.round((totals.carries / matches) * 10) / 10,
    metres: Math.round((totals.metres / matches) * 10) / 10,
    tackles: Math.round((totals.tackles / matches) * 10) / 10,
    turnoversWon: Math.round((totals.turnoversWon / matches) * 10) / 10,
  };
}

export function sumTeamMatchSummaries(rows: ParsedTeamMatchSummary[]): ParsedTeamMatchSummary {
  return rows.reduce(
    (acc, row) => ({
      tries: acc.tries + row.tries,
      conversions: acc.conversions + row.conversions,
      penalties: acc.penalties + row.penalties,
      dropGoals: acc.dropGoals + row.dropGoals,
      carries: acc.carries + row.carries,
      metres: acc.metres + row.metres,
      tackles: acc.tackles + row.tackles,
      turnoversWon: acc.turnoversWon + row.turnoversWon,
    }),
    {
      tries: 0,
      conversions: 0,
      penalties: 0,
      dropGoals: 0,
      carries: 0,
      metres: 0,
      tackles: 0,
      turnoversWon: 0,
    },
  );
}
