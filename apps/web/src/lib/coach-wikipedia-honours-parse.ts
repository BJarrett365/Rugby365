/**
 * Parse Wikipedia honour lines into discrete proposed coach_honours records.
 * Never auto-publishes — CMS review ACCEPT / IGNORE only.
 */

export type ProposedCoachHonour = {
  competitionName: string;
  year: number;
  achievementType: "winner" | "runner_up" | "third" | "semi_final";
  roleType: "coach" | "player";
  honourLevel: "major" | "domestic_major" | "secondary" | "series" | "minor";
  shared: boolean;
  sourceLine: string;
};

function classifyLevel(competition: string): ProposedCoachHonour["honourLevel"] {
  const c = competition.toLowerCase();
  if (/world cup|six nations|rugby championship|tri.?nations|nations championship/.test(c)) {
    return "major";
  }
  if (/currie cup|premiership|top 14|super rugby|urc|pro1[24]|champions cup|npc/.test(c)) {
    return "domestic_major";
  }
  if (/freedom cup|mandela|prince william|qatar airways|bledisloe/.test(c)) return "series";
  return "secondary";
}

function parseAchievement(text: string): {
  achievementType: ProposedCoachHonour["achievementType"];
  shared: boolean;
} | null {
  const t = text.toLowerCase();
  const shared = /shared|joint/.test(t);
  if (/semi[- ]?final/.test(t)) return { achievementType: "semi_final", shared };
  if (/third|bronze/.test(t)) return { achievementType: "third", shared };
  if (/runner[- ]?up|finalist|silver/.test(t)) return { achievementType: "runner_up", shared };
  if (/winner|champion|gold|winners/.test(t)) return { achievementType: "winner", shared };
  return null;
}

/** Expand "Winners: 2019, 2023" into one proposal per year. */
export function parseWikipediaHonourLines(
  lines: string[],
  defaultRole: "coach" | "player" = "coach",
): ProposedCoachHonour[] {
  const out: ProposedCoachHonour[] = [];

  for (const raw of lines) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line) continue;

    const roleType: "coach" | "player" = /as player|player honour/i.test(line)
      ? "player"
      : /as coach|coach honour/i.test(line)
        ? "coach"
        : defaultRole;

    // Pattern: Competition — Winners: 2019, 2023
    const multi = line.match(/^(.+?)\s*[—\-–:]\s*(winners?|champions?|runner-?ups?|third|semi-?finals?)\s*:?\s*([\d,\s]+)$/i);
    if (multi) {
      const competitionName = multi[1].trim();
      const ach = parseAchievement(multi[2]);
      if (!ach) continue;
      const years = multi[3]
        .split(/[,\s]+/)
        .map((y) => Number(y))
        .filter((y) => y >= 1900 && y <= 2100);
      for (const year of years) {
        out.push({
          competitionName,
          year,
          achievementType: ach.achievementType,
          roleType,
          honourLevel: classifyLevel(competitionName),
          shared: ach.shared,
          sourceLine: line,
        });
      }
      continue;
    }

    // Pattern: 2019 Rugby World Cup Winner
    const yearFirst = line.match(/^(\d{4})\s+(.+?)\s+(winner|champion|runner-?up|third|semi-?final)\b/i);
    if (yearFirst) {
      const year = Number(yearFirst[1]);
      const competitionName = yearFirst[2].trim();
      const ach = parseAchievement(yearFirst[3]);
      if (!ach) continue;
      out.push({
        competitionName,
        year,
        achievementType: ach.achievementType,
        roleType,
        honourLevel: classifyLevel(competitionName),
        shared: ach.shared,
        sourceLine: line,
      });
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  return out.filter((p) => {
    const key = `${p.roleType}|${p.competitionName}|${p.year}|${p.achievementType}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export type HonourReviewBucket = {
  found: ProposedCoachHonour[];
  missing: ProposedCoachHonour[];
  existing: Array<{ competitionName: string | null; year: number | null; achievementType: string }>;
};

export function compareProposedHonours(
  proposed: ProposedCoachHonour[],
  existing: Array<{ competitionName: string | null; year: number | null; achievementType: string }>,
): HonourReviewBucket {
  const existingKeys = new Set(
    existing.map(
      (e) =>
        `${(e.competitionName || "").toLowerCase()}|${e.year}|${(e.achievementType || "").toLowerCase()}`,
    ),
  );
  const missing = proposed.filter(
    (p) =>
      !existingKeys.has(
        `${p.competitionName.toLowerCase()}|${p.year}|${p.achievementType.toLowerCase()}`,
      ),
  );
  return { found: proposed, missing, existing };
}
