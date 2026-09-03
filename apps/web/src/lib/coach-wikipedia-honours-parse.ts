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
  teamName?: string | null;
  kind?: "honour" | "award";
};

function classifyLevel(competition: string): ProposedCoachHonour["honourLevel"] {
  const c = competition.toLowerCase();
  if (
    /world cup|six nations|grand slam|rugby championship|tri.?nations|nations championship|lions/.test(
      c,
    )
  ) {
    return "major";
  }
  if (
    /currie cup|premiership|top 14|super rugby|super league|challenge cup|urc|pro1[24]|champions cup|npc|world club/.test(
      c,
    )
  ) {
    return "domestic_major";
  }
  if (
    /freedom cup|mandela|prince william|qatar airways|bledisloe|millennium trophy|centenary quaich|lansdowne|admiral brown/.test(
      c,
    )
  ) {
    return "series";
  }
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
  if (/runners?[- ]?up|finalist|silver/.test(t)) return { achievementType: "runner_up", shared };
  if (/winner|champion|gold|winners|grand slam/.test(t)) {
    return { achievementType: "winner", shared };
  }
  return null;
}

export function extractHonourYears(text: string): number[] {
  const years = [...text.matchAll(/\b((?:19|20)\d{2})\b/g)]
    .map((m) => Number(m[1]))
    .filter((y) => y >= 1900 && y <= 2100);
  return [...new Set(years)];
}

function titleWithoutYears(text: string): string {
  return text
    .replace(/\(\d+\)/g, " ")
    .replace(/\b(?:19|20)\d{2}\b/g, " ")
    .replace(/\s*[:—–,-]+\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isPersonalAward(text: string): boolean {
  return /award|man of steel|golden boot|coach of the year|player of the year|hall of fame|dream team|players.? player|individual/i.test(
    text,
  );
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

    const years = extractHonourYears(line);
    if (years.length === 0) continue;

    const ach = parseAchievement(line) ?? { achievementType: "winner" as const, shared: false };
    const competitionName = titleWithoutYears(
      line.replace(/\b(winners?|champions?|runner-?ups?|third|semi-?finals?|as (?:a )?(?:player|coach))\b/gi, " "),
    );
    if (!competitionName || competitionName.length < 3) continue;

    for (const year of years) {
      out.push({
        competitionName,
        year,
        achievementType: ach.achievementType,
        roleType,
        honourLevel: classifyLevel(competitionName),
        shared: ach.shared,
        sourceLine: line,
        kind: isPersonalAward(competitionName) ? "award" : "honour",
      });
    }
  }

  return dedupeProposed(out);
}

function dedupeProposed(rows: ProposedCoachHonour[]): ProposedCoachHonour[] {
  const seen = new Set<string>();
  return rows.filter((p) => {
    const key = `${p.roleType}|${p.kind ?? "honour"}|${p.competitionName}|${p.year}|${p.achievementType}|${p.teamName ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function cleanHtmlText(raw: string): string {
  return raw
    .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse a Wikipedia Honours HTML section (REST / Parsoid) into coach records.
 * Handles nested "Champion: 2023, 2024" lists under a competition heading.
 */
export function parseCoachHonoursFromHtml(html: string): ProposedCoachHonour[] {
  const sectionMatch = html.match(
    /<(?:h2)[^>]*>[\s\S]*?\bHonours?\b[\s\S]*?<\/(?:h2)>([\s\S]*?)(?=<(?:h2)\b|$)/i,
  );
  if (!sectionMatch) return [];
  const section = sectionMatch[1] ?? "";
  const out: ProposedCoachHonour[] = [];

  let roleType: "coach" | "player" = "coach";
  let teamName: string | null = null;
  let groupLabel: string | null = null;
  let inIndividual = false;

  const pushYears = (title: string, line: string, role: "coach" | "player") => {
    const years = extractHonourYears(line);
    if (!years.length) return;
    const competitionName = titleWithoutYears(title) || titleWithoutYears(line);
    if (!competitionName || competitionName.length < 3) return;
    const ach = parseAchievement(line) ?? parseAchievement(title) ?? {
      achievementType: "winner" as const,
      shared: false,
    };
    const kind: "honour" | "award" =
      inIndividual || isPersonalAward(competitionName) || isPersonalAward(line) ? "award" : "honour";
    for (const year of years) {
      out.push({
        competitionName,
        year,
        achievementType: ach.achievementType,
        roleType: role,
        honourLevel: classifyLevel(competitionName),
        shared: ach.shared,
        sourceLine: line,
        teamName,
        kind,
      });
    }
  };

  const applyHeading = (raw: string) => {
    const text = cleanHtmlText(raw).toLowerCase();
    if (/as a player|as player/.test(text)) roleType = "player";
    else if (/as a coach|as coach|managerial/.test(text)) roleType = "coach";
    else if (/individual/.test(text)) inIndividual = true;
  };

  const walk = (chunk: string, depth: number) => {
    const boldRe = /<(?:p|div|dt)[^>]*>\s*(?:<b>|<strong>)([^<]+)(?:<\/b>|<\/strong>)/gi;
    let bold: RegExpExecArray | null;
    while ((bold = boldRe.exec(chunk))) {
      const label = cleanHtmlText(bold[1] ?? "");
      if (!label) continue;
      if (/individual/i.test(label)) {
        inIndividual = true;
        continue;
      }
      if (label.length < 40) {
        teamName = label;
        inIndividual = false;
        groupLabel = null;
      }
    }

    const liRe = /<li\b[^>]*>([\s\S]*?)(?=<\/li>|<li\b)/gi;
    let match: RegExpExecArray | null;
    while ((match = liRe.exec(chunk))) {
      const inner = match[1] ?? "";
      const textPart = inner.replace(/<ul[\s\S]*$/i, "");
      const text = cleanHtmlText(textPart);
      if (text) {
        const years = extractHonourYears(text);
        if (years.length === 0) {
          if (/individual/i.test(text)) inIndividual = true;
          else groupLabel = text;
        } else {
          const useTitle =
            groupLabel && /^(winners?|champions?|champion|runner-?up)/i.test(text)
              ? groupLabel
              : titleWithoutYears(text) || groupLabel || text;
          pushYears(useTitle, text, roleType);
        }
      }
      const nested = inner.match(/<ul\b[^>]*>([\s\S]*)<\/ul>/i);
      if (nested) walk(nested[1] ?? "", depth + 1);
    }
  };

  const parts = section.split(/(?=<(h[3-6])\b)/i);
  for (const part of parts) {
    const heading = part.match(/^<(h[3-6])\b[^>]*>([\s\S]*?)<\/\1>/i);
    if (heading) applyHeading(heading[2] ?? "");
    walk(part, 1);
  }

  return dedupeProposed(out);
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
