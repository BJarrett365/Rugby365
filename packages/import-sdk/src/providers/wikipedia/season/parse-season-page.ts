import type {
  WikipediaFixtureRow,
  WikipediaSeasonPageParse,
  WikipediaSeasonStage,
  WikipediaStandingRow,
} from "./types";
import {
  combineDateTimeUtc,
  detectSeasonStartYearFromTitle,
  extractTemplateBlocks,
  parseAttendance,
  parseScore,
  parseTemplateParams,
  parseWikiDate,
  parseWikiLinkLabel,
  parseWikiTime,
  stripWikiMarkup,
} from "./wiki-text-utils";

function playedFrom(row: { won: number; draw: number; lost: number }) {
  return row.won + row.draw + row.lost;
}

function rugbyPoints(row: {
  won: number;
  draw: number;
  tryBonusPoints: number;
  losingBonusPoints: number;
  pointsDeduction: number;
}) {
  return row.won * 4 + row.draw * 2 + row.tryBonusPoints + row.losingBonusPoints - row.pointsDeduction;
}

export function parseSportsTableModule(wikitext: string): WikipediaStandingRow[] {
  const blocks = extractTemplateBlocks(wikitext, "#invoke:sports table").concat(
    extractTemplateBlocks(wikitext, "#invoke:Sports table"),
  );
  if (!blocks.length) return [];

  const block = blocks[0]!;
  const params = parseTemplateParams(block);

  const teamCodes: Array<{ code: string; rank: number }> = [];
  for (const [key, value] of Object.entries(params)) {
    const match = key.match(/^team(\d+)$/);
    if (!match) continue;
    teamCodes.push({ rank: Number.parseInt(match[1]!, 10), code: value.trim() });
  }
  teamCodes.sort((a, b) => a.rank - b.rank);

  const rows: WikipediaStandingRow[] = [];
  for (const { code, rank } of teamCodes) {
    const codeKey = code.toLowerCase();
    const nameRaw = params[`name_${codeKey}`] ?? code;
    const teamName = parseWikiLinkLabel(nameRaw).replace(/\s*\(C\)\s*$/i, "").trim();
    const won = Number.parseInt(params[`win_${codeKey}`] ?? "0", 10) || 0;
    const draw = Number.parseInt(params[`draw_${codeKey}`] ?? "0", 10) || 0;
    const lost = Number.parseInt(params[`loss_${codeKey}`] ?? "0", 10) || 0;
    const pf = Number.parseInt(params[`pf_${codeKey}`] ?? "0", 10) || 0;
    const pa = Number.parseInt(params[`pa_${codeKey}`] ?? "0", 10) || 0;
    const tfRaw = params[`tf_${codeKey}`];
    const tb = Number.parseInt(params[`tb_${codeKey}`] ?? "0", 10) || 0;
    const lb = Number.parseInt(params[`lb_${codeKey}`] ?? "0", 10) || 0;
    const adjust = Number.parseInt(params[`adjust_${codeKey}`] ?? params[`deduct_${codeKey}`] ?? "0", 10) || 0;
    const ptsExplicit = params[`pts_${codeKey}`];
    const pointsDeduction = adjust < 0 ? -adjust : 0;
    const played = Number.parseInt(params[`played_${codeKey}`] ?? "", 10) || playedFrom({ won, draw, lost });
    const points =
      (ptsExplicit != null ? Number.parseInt(ptsExplicit, 10) : null) ??
      rugbyPoints({ won, draw, tryBonusPoints: tb, losingBonusPoints: lb, pointsDeduction });

    rows.push({
      rank,
      teamName,
      played,
      won,
      draw,
      lost,
      pointsFor: pf,
      pointsAgainst: pa,
      pointsDiff: pf - pa,
      triesFor: tfRaw != null ? Number.parseInt(tfRaw, 10) || 0 : null,
      tryBonusPoints: tb,
      losingBonusPoints: lb,
      bonusPoints: tb + lb,
      pointsDeduction,
      points,
      isChampionMarker: /\(C\)/i.test(nameRaw) || /\b'''\(C\)'''/i.test(nameRaw),
      qualificationNotes: null,
    });
  }

  return rows;
}

function stageFromRoundLabel(round: string | null, defaultStage: WikipediaSeasonStage): WikipediaSeasonStage {
  if (!round) return defaultStage;
  const value = round.toLowerCase();
  if (/\bfinal\b/.test(value) && !/semi/.test(value) && !/quarter/.test(value)) return "final";
  if (/semi/.test(value)) return "semi_final";
  if (/quarter/.test(value)) return "quarter_final";
  if (/play-?off/.test(value)) return "playoff";
  return defaultStage;
}

export function parseRugbyboxFixtures(
  wikitext: string,
  options: { defaultRound?: string | null; defaultStage?: WikipediaSeasonStage; matchweek?: number | null } = {},
): WikipediaFixtureRow[] {
  const blocks = extractTemplateBlocks(wikitext, "Rugbybox").concat(
    extractTemplateBlocks(wikitext, "rugbybox"),
  );
  const fixtures: WikipediaFixtureRow[] = [];

  for (const block of blocks) {
    const params = parseTemplateParams(block);
    const home = parseWikiLinkLabel(params.home ?? "");
    const away = parseWikiLinkLabel(params.away ?? "");
    if (!home || !away) continue;

    const score = parseScore(params.score);
    const date = parseWikiDate(params.date);
    const time = parseWikiTime(params.time);
    const round = options.defaultRound ?? null;
    const stage = stageFromRoundLabel(round, options.defaultStage ?? "regular");
    const postponed = /postponed/i.test(params.score ?? "") || /postponed/i.test(params.note ?? "");
    const cancelled = /cancelled|canceled|abandoned/i.test(params.score ?? "");

    fixtures.push({
      date,
      kickoffAt: combineDateTimeUtc(date, time),
      homeTeam: home,
      awayTeam: away,
      homeScore: score?.home ?? null,
      awayScore: score?.away ?? null,
      venueName: params.stadium ? parseWikiLinkLabel(params.stadium) : null,
      attendance: parseAttendance(params.attendance),
      refereeName: params.referee ? parseWikiLinkLabel(params.referee) : null,
      round,
      matchweek: options.matchweek ?? null,
      stage,
      status: cancelled
        ? "cancelled"
        : postponed
          ? "postponed"
          : score
            ? "full_time"
            : "scheduled",
      notes: params.note ? stripWikiMarkup(params.note) : null,
    });
  }

  return fixtures;
}

export function parseInfoboxChampion(wikitext: string): {
  championName: string | null;
  runnersUpName: string | null;
  competitionHint: string | null;
} {
  const blocks = extractTemplateBlocks(wikitext, "Infobox rugby union season").concat(
    extractTemplateBlocks(wikitext, "infobox rugby union season"),
  );
  if (!blocks.length) {
    return { championName: null, runnersUpName: null, competitionHint: null };
  }
  const params = parseTemplateParams(blocks[0]!);
  const championRaw = params.champions ?? params.champion ?? "";
  const runnersRaw = params.runnersup ?? params["runner-up"] ?? params["runners-up"] ?? "";
  return {
    championName: championRaw ? parseWikiLinkLabel(championRaw) : null,
    runnersUpName: runnersRaw ? parseWikiLinkLabel(String(runnersRaw)) : null,
    competitionHint: params.name ? stripWikiMarkup(params.name) : null,
  };
}

function fixtureKey(f: WikipediaFixtureRow): string {
  return [
    f.date ?? "",
    f.homeTeam.toLowerCase(),
    f.awayTeam.toLowerCase(),
    f.homeScore ?? "",
    f.awayScore ?? "",
    f.stage,
  ].join("|");
}

function dedupeFixtures(rows: WikipediaFixtureRow[]): WikipediaFixtureRow[] {
  const seen = new Set<string>();
  const out: WikipediaFixtureRow[] = [];
  for (const row of rows) {
    const key = fixtureKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function splitByRoundSections(wikitext: string): Array<{ round: string; matchweek: number | null; body: string }> {
  const headings = [...wikitext.matchAll(/^(={2,})\s*(Round\s+(\d+)|Semi-?finals?|Final)\s*\1/gim)];
  if (!headings.length) {
    return [{ round: "Regular season", matchweek: null, body: wikitext }];
  }

  const sections: Array<{ round: string; matchweek: number | null; body: string }> = [];
  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i]!;
    const start = heading.index! + heading[0].length;
    const end = i + 1 < headings.length ? headings[i + 1]!.index! : wikitext.length;
    const label = heading[2]!;
    const week = heading[3] ? Number.parseInt(heading[3], 10) : null;
    sections.push({
      round: /semi/i.test(label) ? "Semi-finals" : /^final$/i.test(label) ? "Final" : label,
      matchweek: week,
      body: wikitext.slice(start, end),
    });
  }
  return sections;
}

export function parsePremiershipSeasonWikitext(input: {
  pageTitle: string;
  wikipediaUrl: string;
  revisionId: number | null;
  wikitext: string;
}): WikipediaSeasonPageParse {
  const warnings: string[] = [];
  const { championName, runnersUpName, competitionHint } = parseInfoboxChampion(input.wikitext);
  const seasonStartYear = detectSeasonStartYearFromTitle(input.pageTitle);
  if (seasonStartYear == null) warnings.push("Could not detect season start year from page title");

  const standings = parseSportsTableModule(input.wikitext);
  if (!standings.length) warnings.push("No sports table module found");

  const fixtureSections = splitByRoundSections(input.wikitext);
  const fixturesRaw: WikipediaFixtureRow[] = [];
  const playoffRaw: WikipediaFixtureRow[] = [];

  for (const section of fixtureSections) {
    const isPlayoff = /semi|final/i.test(section.round) && !/^Round\s+\d+/i.test(section.round);
    const parsed = parseRugbyboxFixtures(section.body, {
      defaultRound: section.round,
      defaultStage: isPlayoff ? stageFromRoundLabel(section.round, "playoff") : "regular",
      matchweek: section.matchweek,
    });
    if (isPlayoff) playoffRaw.push(...parsed);
    else fixturesRaw.push(...parsed);
  }

  const fixtures = dedupeFixtures(fixturesRaw);
  const playoffFixtures = dedupeFixtures(playoffRaw);

  const venues = [
    ...new Set(
      [...fixtures, ...playoffFixtures]
        .map((f) => f.venueName)
        .filter((v): v is string => Boolean(v)),
    ),
  ];
  const referees = [
    ...new Set(
      [...fixtures, ...playoffFixtures]
        .map((f) => f.refereeName)
        .filter((v): v is string => Boolean(v)),
    ),
  ];

  if (!fixtures.length) warnings.push("No regular-season Rugbybox fixtures found");
  if (!playoffFixtures.length) warnings.push("No playoff fixtures found");
  if (!championName) warnings.push("No champion found in infobox");

  return {
    pageTitle: input.pageTitle,
    wikipediaUrl: input.wikipediaUrl,
    revisionId: input.revisionId,
    seasonStartYear,
    competitionHint,
    championName,
    runnersUpName,
    standings,
    fixtures,
    playoffFixtures,
    venues,
    referees,
    warnings,
  };
}

export async function parseWikipediaSeasonPage(urlOrTitle: string): Promise<WikipediaSeasonPageParse> {
  const { fetchWikipediaSeasonPage } = await import("./fetch-season-page");
  const page = await fetchWikipediaSeasonPage(urlOrTitle);
  return parsePremiershipSeasonWikitext(page);
}
