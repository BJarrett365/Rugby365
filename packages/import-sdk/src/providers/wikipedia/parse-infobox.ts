import type {
  WikipediaArchiveData,
  WikipediaCareerStint,
  WikipediaCoachingStint,
  WikipediaEntityType,
  WikipediaRefereeStint,
} from "./types";

type InfoboxParams = Record<string, string>;

const PLAYER_INFOBOXES = new Set([
  "infobox rugby biography",
  "infobox rugby union biography",
  "infobox rugby league biography",
]);

const TEAM_INFOBOXES = new Set([
  "infobox rugby union club",
  "infobox rugby league club",
  "infobox rugby team",
  "infobox national rugby union team",
  "infobox rugby union team",
]);

const COMPETITION_INFOBOXES = new Set([
  "infobox rugby union",
  "infobox rugby league",
  "infobox rugby tournament",
  "infobox sports league",
]);

const VENUE_INFOBOXES = new Set([
  "infobox stadium",
  "infobox venue",
  "infobox rugby stadium",
  "infobox sports venue",
]);

const ALL_INFOBOXES = new Set([
  ...PLAYER_INFOBOXES,
  ...TEAM_INFOBOXES,
  ...COMPETITION_INFOBOXES,
  ...VENUE_INFOBOXES,
]);

function stripWikiMarkup(value?: string): string {
  if (!value) return "";
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/\{\{[^}]+\}\}/g, (m) => {
      const birth = m.match(/\{\{birth date and age\|(\d{4})\|(\d{1,2})\|(\d{1,2})/i);
      if (birth) return `${birth[3].padStart(2, "0")}/${birth[2].padStart(2, "0")}/${birth[1]}`;
      const convert = m.match(/\{\{convert\|([\d.]+)\|(\w+)/i);
      if (convert) return convert[1];
      return "";
    })
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/''+/g, "")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

function parseHeightCm(raw?: string): number | undefined {
  if (!raw) return undefined;
  const cleaned = stripWikiMarkup(raw);
  const m = cleaned.match(/([\d.]+)\s*m/i) ?? cleaned.match(/^([\d.]+)$/);
  if (!m) return undefined;
  return Math.round(parseFloat(m[1]) * 100);
}

function parseWeightKg(raw?: string): number | undefined {
  if (!raw) return undefined;
  const cleaned = stripWikiMarkup(raw);
  const m = cleaned.match(/([\d.]+)\s*kg/i) ?? cleaned.match(/^([\d.]+)$/);
  if (!m) return undefined;
  return Math.round(parseFloat(m[1]));
}

function parseBirthDate(raw?: string): string | undefined {
  if (!raw) return undefined;
  const stripped = stripWikiMarkup(raw);
  const iso = stripped.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = stripped.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (dmy) {
    const months: Record<string, string> = {
      january: "01",
      february: "02",
      march: "03",
      april: "04",
      may: "05",
      june: "06",
      july: "07",
      august: "08",
      september: "09",
      october: "10",
      november: "11",
      december: "12",
    };
    const mm = months[dmy[2].toLowerCase()];
    if (mm) return `${dmy[3]}-${mm}-${dmy[1].padStart(2, "0")}`;
  }
  const slash = stripped.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (slash) return `${slash[3]}-${slash[2]}-${slash[1]}`;
  return undefined;
}

function parseYearRange(label: string): { startYear?: number; endYear?: number } {
  const cleaned = stripWikiMarkup(label);
  const present = cleaned.match(/^(\d{4})\s*[–—-]\s*$/);
  if (present) return { startYear: parseInt(present[1], 10) };
  const range = cleaned.match(/^(\d{4})\s*[–—-]\s*(\d{4})$/);
  if (range) return { startYear: parseInt(range[1], 10), endYear: parseInt(range[2], 10) };
  const single = cleaned.match(/^(\d{4})$/);
  if (single) return { startYear: parseInt(single[1], 10), endYear: parseInt(single[1], 10) };
  return {};
}

function parsePositions(raw?: string): string[] | undefined {
  if (!raw) return undefined;
  return stripWikiMarkup(raw)
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

function parseIntField(raw?: string): number | undefined {
  if (!raw) return undefined;
  const n = parseInt(stripWikiMarkup(raw).replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : undefined;
}

export function parseVenueCapacity(raw?: string): number | undefined {
  if (!raw) return undefined;
  const cleaned = stripWikiMarkup(raw.replace(/&lt;br\s*\/?&gt;/gi, " ").replace(/<br\s*\/?>/gi, " "));
  const match = cleaned.match(/(\d[\d,.\s]*\d|\d+)/);
  if (!match) return undefined;
  const n = parseInt(match[1].replace(/[^\d]/g, ""), 10);
  if (!Number.isFinite(n) || n <= 0 || n > 250_000) return undefined;
  return n;
}

function primaryVenueName(params: InfoboxParams, fallback: string): string {
  const raw =
    params.stadiumname ??
    params.venue ??
    params.name ??
    params.fullname ??
    fallback;
  const decoded = raw.replace(/&lt;br\s*\/?&gt;/gi, "\n").replace(/<br\s*\/?>/gi, "\n");
  const cleaned = stripWikiMarkup(decoded);
  const firstLine = cleaned
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  return firstLine || fallback;
}

function venueCapacityFromParams(params: InfoboxParams): number | undefined {
  const raw =
    params.capacity ??
    params.seating_capacity ??
    params["seating capacity"] ??
    params.fullcapacity ??
    params.full_capacity;
  return parseVenueCapacity(raw);
}

export function parseVenueRecordAttendance(raw?: string): number | undefined {
  if (!raw) return undefined;
  const cleaned = stripWikiMarkup(raw);
  const match = cleaned.match(/([\d][\d,.\s]*\d|\d)/);
  if (!match) return undefined;
  const n = parseInt(match[1].replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : undefined;
}

function infoboxMatches(name: string): boolean {
  return ALL_INFOBOXES.has(name);
}

function extractInfoboxFromHtml(html: string): { template: string; params: InfoboxParams } | null {
  const dataMwMatches = html.matchAll(/data-mw='([^']+)'/g);
  for (const match of dataMwMatches) {
    try {
      const json = JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&apos;/g, "'"));
      const template = json?.parts?.[0]?.template;
      if (!template?.target?.wt) continue;
      const name = String(template.target.wt).trim().toLowerCase();
      if (!infoboxMatches(name)) {
        continue;
      }
      const params: InfoboxParams = {};
      for (const [key, val] of Object.entries(template.params ?? {})) {
        if (val && typeof val === "object" && "wt" in val) {
          params[key] = String((val as { wt: string }).wt);
        }
      }
      return { template: name, params };
    } catch {
      // try next block
    }
  }

  const dataMwDouble = html.matchAll(/data-mw="([^"]+)"/g);
  for (const match of dataMwDouble) {
    try {
      const json = JSON.parse(match[1].replace(/&quot;/g, '"'));
      const template = json?.parts?.[0]?.template;
      if (!template?.target?.wt) continue;
      const name = String(template.target.wt).trim().toLowerCase();
      if (!infoboxMatches(name)) {
        continue;
      }
      const params: InfoboxParams = {};
      for (const [key, val] of Object.entries(template.params ?? {})) {
        if (val && typeof val === "object" && "wt" in val) {
          params[key] = String((val as { wt: string }).wt);
        }
      }
      return { template: name, params };
    } catch {
      // try next
    }
  }

  return null;
}

export function parseNationalityFromBirthPlace(raw?: string): string | undefined {
  if (!raw) return undefined;
  const cleaned = stripWikiMarkup(raw);
  const parts = cleaned
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.at(-1) || undefined;
}

function collectRefereeRows(params: InfoboxParams): WikipediaRefereeStint[] {
  const rows: WikipediaRefereeStint[] = [];
  for (let i = 1; i <= 20; i++) {
    const years = params[`refereeyears${i}`] ?? params[`ru_refereeyears${i}`];
    const competition = params[`refereecomps${i}`] ?? params[`ru_refereecomps${i}`];
    if (!years && !competition) continue;
    if (!competition) continue;
    const yearsLabel = stripWikiMarkup(years ?? "");
    const apps = parseIntField(params[`refereeapps${i}`] ?? params[`ru_refereeapps${i}`]);
    rows.push({
      yearsLabel: yearsLabel || undefined,
      competitionName: stripWikiMarkup(competition),
      apps: apps ?? null,
      sortOrder: i,
    });
  }
  return rows;
}

function collectCoachingRows(params: InfoboxParams): WikipediaCoachingStint[] {
  const rows: WikipediaCoachingStint[] = [];
  for (let i = 1; i <= 20; i++) {
    const years = params[`coachyears${i}`] ?? params[`ru_coachyears${i}`];
    const team = params[`coachteams${i}`] ?? params[`ru_coachteams${i}`];
    if (!years && !team) continue;
    if (!team) continue;
    const yearsLabel = stripWikiMarkup(years ?? "");
    const range = parseYearRange(yearsLabel);
    rows.push({
      yearsLabel: yearsLabel || String(i),
      startYear: range.startYear ?? null,
      endYear: range.endYear ?? null,
      teamName: stripWikiMarkup(team),
      sortOrder: i,
    });
  }
  return rows;
}

function collectIndexedRows(
  params: InfoboxParams,
  prefix: string,
  teamPrefix: string,
  capsPrefix: string,
  pointsPrefix: string,
  careerType: WikipediaCareerStint["careerType"],
): WikipediaCareerStint[] {
  const rows: WikipediaCareerStint[] = [];
  for (let i = 1; i <= 12; i++) {
    const years = params[`${prefix}${i}`];
    const team = params[`${teamPrefix}${i}`];
    if (!years && !team) continue;
    if (!team) continue;
    const yearsLabel = stripWikiMarkup(years ?? "");
    const range = parseYearRange(yearsLabel);
    rows.push({
      careerType,
      yearsLabel: yearsLabel || String(i),
      startYear: range.startYear ?? null,
      endYear: range.endYear ?? null,
      teamName: stripWikiMarkup(team),
      apps: parseIntField(params[`${capsPrefix}${i}`]) ?? null,
      points: parseIntField(params[`${pointsPrefix}${i}`]) ?? null,
      sortOrder: i,
    });
  }
  return rows;
}

function detectEntityType(template: string, params: InfoboxParams): WikipediaEntityType {
  if (PLAYER_INFOBOXES.has(template)) {
    const hasRefereeCareer = Boolean(params.refereecomps1 ?? params.ru_refereecomps1);
    const hasCoachCareer = Boolean(params.coachteams1 ?? params.ru_coachteams1);
    const hasPlayerCareer = Boolean(params.clubs1 ?? params.years1);
    if (hasRefereeCareer && !hasCoachCareer && !hasPlayerCareer) return "referee";
    if (hasCoachCareer && !hasPlayerCareer) return "coach";
    return "player";
  }
  if (TEAM_INFOBOXES.has(template)) return "team";
  if (VENUE_INFOBOXES.has(template)) return "venue";
  if (COMPETITION_INFOBOXES.has(template)) return "competition";
  return "auto";
}

export function parseWikipediaArchiveFromHtml(input: {
  html: string;
  articleTitle: string;
  wikipediaUrl: string;
  wikidataId?: string;
  abstract?: string;
  imageUrl?: string;
  entityType?: WikipediaEntityType;
}): WikipediaArchiveData {
  const infobox = extractInfoboxFromHtml(input.html);
  if (!infobox) {
    throw new Error("No rugby infobox found on this Wikipedia article.");
  }

  const resolvedType =
    input.entityType && input.entityType !== "auto"
      ? input.entityType
      : detectEntityType(infobox.template, infobox.params);

  const name = stripWikiMarkup(infobox.params.name ?? input.articleTitle);
  const bioSummary = input.abstract?.trim() || undefined;

  if (resolvedType === "referee") {
    const refereeCareer = collectRefereeRows(infobox.params);
    const birthPlace = stripWikiMarkup(infobox.params.birth_place) || undefined;
    const occupation = stripWikiMarkup(infobox.params.occupation) || undefined;
    return {
      entityType: "referee",
      articleTitle: input.articleTitle,
      wikipediaUrl: input.wikipediaUrl,
      wikidataId: input.wikidataId,
      name,
      fullName: stripWikiMarkup(infobox.params.fullname ?? infobox.params.full_name ?? infobox.params.birth_name) || undefined,
      birthDate: parseBirthDate(infobox.params.birth_date),
      birthPlace,
      nationality: parseNationalityFromBirthPlace(birthPlace),
      occupation,
      imageUrl: input.imageUrl,
      bioSummary,
      refereeCareer,
      infoboxTemplate: infobox.template,
    };
  }

  if (resolvedType === "coach") {
    const coachingCareer = collectCoachingRows(infobox.params);
    const birthPlace = stripWikiMarkup(infobox.params.birth_place) || undefined;
    return {
      entityType: "coach",
      articleTitle: input.articleTitle,
      wikipediaUrl: input.wikipediaUrl,
      wikidataId: input.wikidataId,
      name,
      fullName: stripWikiMarkup(infobox.params.fullname ?? infobox.params.full_name) || undefined,
      birthDate: parseBirthDate(infobox.params.birth_date),
      birthPlace,
      nationality: parseNationalityFromBirthPlace(birthPlace),
      imageUrl: input.imageUrl,
      bioSummary,
      coachingCareer,
      infoboxTemplate: infobox.template,
    };
  }

  if (resolvedType === "player") {
    const clubCareer = collectIndexedRows(infobox.params, "years", "clubs", "apps", "points", "club");
    const cupCareer = [
      ...collectIndexedRows(
        infobox.params,
        "provinceyears",
        "province",
        "provinceapps",
        "provincepoints",
        "cup",
      ),
      ...collectIndexedRows(infobox.params, "superyears", "super", "superapps", "superpoints", "cup"),
      ...collectIndexedRows(
        infobox.params,
        "ru_provinceyears",
        "ru_province",
        "ru_provinceapps",
        "ru_provincepoints",
        "cup",
      ),
      ...collectIndexedRows(
        infobox.params,
        "ru_superyears",
        "ru_super",
        "ru_superapps",
        "ru_superpoints",
        "cup",
      ),
    ].map((row, index) => ({ ...row, sortOrder: index + 1 }));
    const internationalCareer = collectIndexedRows(
      infobox.params,
      "repyears",
      "repteam",
      "repcaps",
      "reppoints",
      "international",
    );

    return {
      entityType: "player",
      articleTitle: input.articleTitle,
      wikipediaUrl: input.wikipediaUrl,
      wikidataId: input.wikidataId,
      name,
      fullName: stripWikiMarkup(infobox.params.fullname ?? infobox.params.full_name) || undefined,
      birthDate: parseBirthDate(infobox.params.birth_date),
      birthPlace: stripWikiMarkup(infobox.params.birth_place) || undefined,
      heightCm: parseHeightCm(infobox.params.height),
      weightKg: parseWeightKg(infobox.params.weight),
      school: stripWikiMarkup(infobox.params.school) || undefined,
      university:
        stripWikiMarkup(
          infobox.params.university ??
            infobox.params.alma_mater ??
            infobox.params.almaMater ??
            infobox.params.college,
        ) || undefined,
      relatives: stripWikiMarkup(infobox.params.relatives) || undefined,
      positions: parsePositions(infobox.params.position),
      currentTeam: stripWikiMarkup(infobox.params.currentclub ?? infobox.params.currentteam) || undefined,
      imageUrl: input.imageUrl,
      bioSummary,
      clubCareer,
      cupCareer: cupCareer.length > 0 ? cupCareer : undefined,
      internationalCareer,
      infoboxTemplate: infobox.template,
    };
  }

  if (resolvedType === "team") {
    const founded = parseIntField(infobox.params.founded ?? infobox.params.established);
    return {
      entityType: "team",
      articleTitle: input.articleTitle,
      wikipediaUrl: input.wikipediaUrl,
      wikidataId: input.wikidataId,
      name: stripWikiMarkup(infobox.params.clubname ?? infobox.params.teamname ?? name),
      countryName: stripWikiMarkup(infobox.params.country) || undefined,
      foundedYear: founded,
      homeGround: stripWikiMarkup(infobox.params.location ?? infobox.params.ground) || undefined,
      imageUrl: input.imageUrl,
      bioSummary,
      infoboxTemplate: infobox.template,
    };
  }

  if (resolvedType === "venue") {
    const recordRaw =
      infobox.params.record_attendance ??
      infobox.params["record attendance"] ??
      infobox.params.highest_attendance ??
      infobox.params["highest attendance"] ??
      infobox.params["record crowd"] ??
      infobox.params.record_crowd ??
      infobox.params.attendance_record ??
      infobox.params["largest crowd"];

    const cityRaw = infobox.params.location ?? infobox.params.city ?? infobox.params.built;

    return {
      entityType: "venue",
      articleTitle: input.articleTitle,
      wikipediaUrl: input.wikipediaUrl,
      wikidataId: input.wikidataId,
      name: primaryVenueName(infobox.params, name),
      city: stripWikiMarkup(cityRaw) || undefined,
      countryName: stripWikiMarkup(infobox.params.country) || undefined,
      capacity: venueCapacityFromParams(infobox.params),
      recordAttendance: parseVenueRecordAttendance(recordRaw),
      imageUrl: input.imageUrl,
      bioSummary,
      infoboxTemplate: infobox.template,
    };
  }

  const founded = parseIntField(infobox.params.founded ?? infobox.params.inaugurated);
  return {
    entityType: "competition",
    articleTitle: input.articleTitle,
    wikipediaUrl: input.wikipediaUrl,
    wikidataId: input.wikidataId,
    name: stripWikiMarkup(infobox.params.name ?? infobox.params.tournament_name ?? name),
    countryName: stripWikiMarkup(infobox.params.country ?? infobox.params.region) || undefined,
    foundedYear: founded,
    bioSummary,
    imageUrl: input.imageUrl,
    infoboxTemplate: infobox.template,
  };
}
