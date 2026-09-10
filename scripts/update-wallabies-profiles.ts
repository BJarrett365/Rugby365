/**
 * Research-backed profile updates for James O'Connor, Joseph-Aukuso Suaalii,
 * Max Jorgensen, Fraser McReight, Billy Pollard, Andrew Kellaway,
 * Harry Wilson, Filipo Daugunu and Tom Hooper.
 *
 * Test caps/height/weight: wallabies.rugby player pages (13–14 Aug 2026),
 * except Hooper (page blocked; Exeter Chiefs + All.Rugby + 10 Aug 2026 squad notes).
 * Season lines 2012–2026: All.Rugby overall tables (all competitions; skip U20
 * and unplayed 15 Aug 2026 Japan Test rows). Titles: Wikipedia / RA where explicit.
 *
 * Usage:
 *   SKIP_WIKI=1 npx tsx --require ./scripts/stub-server-only.cjs scripts/update-wallabies-profiles.ts
 */
process.env.DATABASE_URL ??= "postgresql://rugby365:rugby365@localhost:5433/rugby365";

import { and, eq } from "drizzle-orm";
import {
  competitionSeasons,
  competitions,
  playerCareerStints,
  playerImages,
  playerSeasonStats,
  playerTitles,
  players,
  teams,
} from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { updatePlayer } from "../apps/web/src/lib/entity-admin-service";
import { applyPlayerImageAction } from "../apps/web/src/lib/player-image-service";
import { createPlayerTitle } from "../apps/web/src/lib/player-titles-service";
import { enrichPlayerFromWikipedia } from "../apps/web/src/lib/wikipedia-import-service";

const AUSTRALIA_ID = "c58b3003-8f30-45cf-b176-ff0a5f98531e";
const SOURCE = "all_rugby";

type SeasonLine = {
  allRugbySeason: string;
  competitionSlug: string;
  teamSlug: string;
  appearances: number;
  tries: number;
  points: number;
  minutes: number;
};

type PlayerUpdate = {
  ids: string[];
  name: string;
  fullName: string;
  wikipediaUrl: string;
  birthDate: string;
  birthPlace: string;
  heightCm: number;
  weightKg: number;
  clubName: string;
  clubTeamId: string | null;
  positionName: string;
  positions: string[];
  school?: string;
  relatives?: string;
  bioSummary: string;
  imageUrl?: string;
  imageAlt?: string;
  imageCredit?: string;
  imageSourcePage?: string;
  caps: number;
  tries: number;
  points: number;
  intlYearsLabel: string;
  careerStatus: "active" | "released";
  statusOverride?: string | null;
  titles: Array<{
    titleType: string;
    title: string;
    year: number;
    seasonLabel?: string;
    sourceUrl: string;
  }>;
  seasonLines: SeasonLine[];
};

const PLAYERS: PlayerUpdate[] = [
  {
    ids: ["2368d6cf-ec92-4cde-be90-1d831a236440"],
    name: "James O'Connor",
    fullName: "James David O'Connor",
    wikipediaUrl: "https://en.wikipedia.org/wiki/James_O%27Connor_(rugby_union)",
    birthDate: "1990-07-05",
    birthPlace: "Southport, Queensland, Australia",
    heightCm: 181,
    weightKg: 97,
    clubName: "Leicester Tigers",
    clubTeamId: "1d9b8dcd-74ff-44b0-9f43-3ef976e3366a",
    positionName: "fly-half",
    positions: ["fly-half", "centre", "wing", "fullback"],
    school: "St Joseph's College, Nudgee",
    bioSummary:
      "Versatile Wallabies back who can play fly-half, centre, wing or fullback. Left Leicester Tigers at the end of the 2025–26 season and is currently unattached. Dual Rugby World Cup squad member (2011, 2019), including Australia's third-place finish in 2011.",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/7/70/James_O%27Connor_2011_%282%29.jpg",
    imageAlt: "James O'Connor in 2011",
    imageCredit: "Wikimedia Commons",
    imageSourcePage: "https://en.wikipedia.org/wiki/James_O%27Connor_(rugby_union)",
    caps: 70,
    tries: 14,
    points: 315,
    intlYearsLabel: "2008–present",
    careerStatus: "released",
    statusOverride: "unattached",
    titles: [
      {
        titleType: "other",
        title: "Rugby World Cup appearance",
        year: 2011,
        sourceUrl: "https://en.wikipedia.org/wiki/James_O%27Connor_(rugby_union)",
      },
      {
        titleType: "other",
        title: "Rugby World Cup third place",
        year: 2011,
        sourceUrl: "https://en.wikipedia.org/wiki/James_O%27Connor_(rugby_union)",
      },
      {
        titleType: "other",
        title: "Rugby World Cup appearance",
        year: 2019,
        sourceUrl: "https://en.wikipedia.org/wiki/James_O%27Connor_(rugby_union)",
      },
      {
        titleType: "other",
        title: "Premiership Rugby Cup winner",
        year: 2026,
        seasonLabel: "2025–26",
        sourceUrl: "https://www.rugby.com.au/news/aussie-duo-oconnor-perese-set-to-depart-premiership-club-leicester-2026429",
      },
    ],
    seasonLines: [
      { allRugbySeason: "2013-14", competitionSlug: "premiership", teamSlug: "london-irish", appearances: 14, tries: 1, points: 100, minutes: 1062 },
      { allRugbySeason: "2014-15", competitionSlug: "top-14", teamSlug: "toulon-krjdq463", appearances: 12, tries: 4, points: 59, minutes: 550 },
      { allRugbySeason: "2014-15", competitionSlug: "rugby-champions-cup", teamSlug: "toulon-krjdq463", appearances: 3, tries: 0, points: 0, minutes: 61 },
      { allRugbySeason: "2014-15", competitionSlug: "super-rugby", teamSlug: "reds-go9pkpj8", appearances: 12, tries: 0, points: 44, minutes: 864 },
      { allRugbySeason: "2015-16", competitionSlug: "top-14", teamSlug: "toulon-krjdq463", appearances: 14, tries: 8, points: 40, minutes: 1014 },
      { allRugbySeason: "2015-16", competitionSlug: "rugby-champions-cup", teamSlug: "toulon-krjdq463", appearances: 3, tries: 0, points: 9, minutes: 201 },
      { allRugbySeason: "2016-17", competitionSlug: "top-14", teamSlug: "toulon-krjdq463", appearances: 15, tries: 1, points: 8, minutes: 810 },
      { allRugbySeason: "2016-17", competitionSlug: "rugby-champions-cup", teamSlug: "toulon-krjdq463", appearances: 4, tries: 0, points: 0, minutes: 297 },
      { allRugbySeason: "2017-18", competitionSlug: "premiership", teamSlug: "sale-sharks-krjd4j3q", appearances: 11, tries: 3, points: 15, minutes: 612 },
      { allRugbySeason: "2017-18", competitionSlug: "challenge-cup", teamSlug: "sale-sharks-krjd4j3q", appearances: 2, tries: 0, points: 0, minutes: 160 },
      { allRugbySeason: "2018-19", competitionSlug: "premiership", teamSlug: "sale-sharks-krjd4j3q", appearances: 14, tries: 0, points: 0, minutes: 957 },
      { allRugbySeason: "2018-19", competitionSlug: "challenge-cup", teamSlug: "sale-sharks-krjd4j3q", appearances: 3, tries: 0, points: 0, minutes: 199 },
      { allRugbySeason: "2018-19", competitionSlug: "premiership-rugby-cup", teamSlug: "sale-sharks-krjd4j3q", appearances: 1, tries: 0, points: 0, minutes: 64 },
      { allRugbySeason: "2018-19", competitionSlug: "rugby-championship", teamSlug: "australia-og9nxrjl", appearances: 2, tries: 0, points: 0, minutes: 92 },
      { allRugbySeason: "2019-20", competitionSlug: "super-rugby", teamSlug: "reds-go9pkpj8", appearances: 16, tries: 3, points: 107, minutes: 1243 },
      { allRugbySeason: "2019-20", competitionSlug: "international-matches-n062z68w", teamSlug: "australia-og9nxrjl", appearances: 4, tries: 0, points: 8, minutes: 246 },
      { allRugbySeason: "2019-20", competitionSlug: "rugby-world-cup", teamSlug: "australia-og9nxrjl", appearances: 4, tries: 0, points: 0, minutes: 247 },
      { allRugbySeason: "2019-20", competitionSlug: "rugby-championship", teamSlug: "australia-og9nxrjl", appearances: 1, tries: 0, points: 0, minutes: 80 },
      { allRugbySeason: "2020-21", competitionSlug: "super-rugby", teamSlug: "reds-go9pkpj8", appearances: 12, tries: 1, points: 139, minutes: 886 },
      { allRugbySeason: "2020-21", competitionSlug: "rugby-championship", teamSlug: "australia-og9nxrjl", appearances: 2, tries: 0, points: 5, minutes: 45 },
      { allRugbySeason: "2021-22", competitionSlug: "super-rugby", teamSlug: "reds-go9pkpj8", appearances: 10, tries: 1, points: 87, minutes: 751 },
      { allRugbySeason: "2021-22", competitionSlug: "international-matches-n062z68w", teamSlug: "australia-og9nxrjl", appearances: 3, tries: 0, points: 0, minutes: 47 },
      { allRugbySeason: "2021-22", competitionSlug: "end-of-year-internationals", teamSlug: "australia-og9nxrjl", appearances: 3, tries: 0, points: 33, minutes: 234 },
      { allRugbySeason: "2021-22", competitionSlug: "rugby-championship", teamSlug: "australia-og9nxrjl", appearances: 1, tries: 0, points: 7, minutes: 80 },
      { allRugbySeason: "2022-23", competitionSlug: "super-rugby", teamSlug: "reds-go9pkpj8", appearances: 13, tries: 0, points: 30, minutes: 758 },
      { allRugbySeason: "2023-24", competitionSlug: "super-rugby", teamSlug: "reds-go9pkpj8", appearances: 3, tries: 0, points: 4, minutes: 70 },
      { allRugbySeason: "2023-24", competitionSlug: "international-matches-n062z68w", teamSlug: "australia-a", appearances: 2, tries: 0, points: 0, minutes: 152 },
      { allRugbySeason: "2024-25", competitionSlug: "super-rugby", teamSlug: "crusaders-5d9yde9o", appearances: 16, tries: 1, points: 48, minutes: 377 },
      { allRugbySeason: "2024-25", competitionSlug: "rugby-championship", teamSlug: "australia-og9nxrjl", appearances: 6, tries: 0, points: 32, minutes: 298 },
      { allRugbySeason: "2025-26", competitionSlug: "premiership", teamSlug: "leicester-tigers-g567e9er", appearances: 10, tries: 0, points: 36, minutes: 290 },
      { allRugbySeason: "2025-26", competitionSlug: "premiership-rugby-cup", teamSlug: "leicester-tigers-g567e9er", appearances: 3, tries: 1, points: 17, minutes: 179 },
      { allRugbySeason: "2025-26", competitionSlug: "rugby-champions-cup", teamSlug: "leicester-tigers-g567e9er", appearances: 1, tries: 0, points: 0, minutes: 80 },
      { allRugbySeason: "2025-26", competitionSlug: "end-of-year-internationals", teamSlug: "australia-og9nxrjl", appearances: 1, tries: 0, points: 4, minutes: 70 },
    ],
  },
  {
    ids: ["398c1da3-b95a-43ee-8ec9-37e3987aef19"],
    name: "Joseph Suaalii",
    fullName: "Joseph-Aukuso Suaalii",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Joseph-Aukuso_Sua'ali'i",
    birthDate: "2003-08-01",
    birthPlace: "Glenmore Park, New South Wales, Australia",
    heightCm: 196,
    weightKg: 98,
    clubName: "NSW Waratahs",
    clubTeamId: "0bd66397-4a11-4e3c-bf00-3cfff20e6395",
    positionName: "centre",
    positions: ["centre", "fullback", "wing"],
    school: "The King's School",
    bioSummary:
      "Wallabies centre for the NSW Waratahs. Switched from rugby league with the Sydney Roosters and made his Test debut against England at Twickenham in November 2024, before his Super Rugby debut.",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/8/8d/Joseph_Sua%27ali%27i.jpg",
    imageAlt: "Joseph-Aukuso Suaalii",
    imageCredit: "Wikimedia Commons",
    imageSourcePage: "https://en.wikipedia.org/wiki/Joseph-Aukuso_Suaalii",
    caps: 22,
    tries: 4,
    points: 20,
    intlYearsLabel: "2024–present",
    careerStatus: "active",
    titles: [],
    seasonLines: [
      { allRugbySeason: "2024-25", competitionSlug: "super-rugby", teamSlug: "waratahs-016o2oj5", appearances: 7, tries: 2, points: 10, minutes: 504 },
      { allRugbySeason: "2024-25", competitionSlug: "end-of-year-internationals", teamSlug: "australia-og9nxrjl", appearances: 4, tries: 0, points: 0, minutes: 208 },
      { allRugbySeason: "2024-25", competitionSlug: "international-matches-n062z68w", teamSlug: "australia-og9nxrjl", appearances: 4, tries: 0, points: 0, minutes: 320 },
      { allRugbySeason: "2024-25", competitionSlug: "rugby-championship", teamSlug: "australia-og9nxrjl", appearances: 6, tries: 4, points: 20, minutes: 440 },
      { allRugbySeason: "2025-26", competitionSlug: "super-rugby", teamSlug: "waratahs-016o2oj5", appearances: 5, tries: 0, points: 0, minutes: 379 },
      { allRugbySeason: "2025-26", competitionSlug: "end-of-year-internationals", teamSlug: "australia-og9nxrjl", appearances: 4, tries: 0, points: 0, minutes: 286 },
      { allRugbySeason: "2025-26", competitionSlug: "nations-championship", teamSlug: "australia-og9nxrjl", appearances: 3, tries: 0, points: 0, minutes: 240 },
      { allRugbySeason: "2025-26", competitionSlug: "international-matches-n062z68w", teamSlug: "australia-og9nxrjl", appearances: 1, tries: 0, points: 0, minutes: 80 },
    ],
  },
  {
    ids: ["054ae84e-d723-4b1e-a737-d50a488d58e2"],
    name: "Max Jorgensen",
    fullName: "Max Jorgensen",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Max_Jorgensen",
    birthDate: "2004-09-02",
    birthPlace: "Sheffield, South Yorkshire, England",
    heightCm: 184,
    weightKg: 88,
    clubName: "NSW Waratahs",
    clubTeamId: "0bd66397-4a11-4e3c-bf00-3cfff20e6395",
    positionName: "fullback",
    positions: ["fullback", "wing"],
    school: "St Joseph's College, Hunters Hill",
    relatives: "Son of Peter Jorgensen",
    bioSummary:
      "NSW Waratahs fullback and wing, contracted through 2031. Named in Australia's 2023 Rugby World Cup squad but withdrew with a fractured fibula and did not appear. Test debut came in the 2024 Rugby Championship.",
    imageUrl: "https://d3gbf3ykm8gp5c.cloudfront.net/content/uploads/2025/09/02101445/Max-Jorgensen-Wallabies-image.jpg",
    imageAlt: "Max Jorgensen in Wallabies colours",
    imageCredit: "Planet Rugby",
    imageSourcePage: "https://www.planetrugby.com/tag/max-jorgensen",
    caps: 24,
    tries: 8,
    points: 40,
    intlYearsLabel: "2024–present",
    careerStatus: "active",
    titles: [],
    seasonLines: [
      { allRugbySeason: "2022-23", competitionSlug: "super-rugby", teamSlug: "waratahs-016o2oj5", appearances: 11, tries: 4, points: 20, minutes: 792 },
      { allRugbySeason: "2023-24", competitionSlug: "super-rugby", teamSlug: "waratahs-016o2oj5", appearances: 8, tries: 1, points: 5, minutes: 638 },
      { allRugbySeason: "2023-24", competitionSlug: "rugby-championship", teamSlug: "australia-og9nxrjl", appearances: 3, tries: 0, points: 0, minutes: 127 },
      { allRugbySeason: "2024-25", competitionSlug: "super-rugby", teamSlug: "waratahs-016o2oj5", appearances: 6, tries: 3, points: 15, minutes: 402 },
      { allRugbySeason: "2024-25", competitionSlug: "end-of-year-internationals", teamSlug: "australia-og9nxrjl", appearances: 4, tries: 2, points: 10, minutes: 238 },
      { allRugbySeason: "2024-25", competitionSlug: "international-matches-n062z68w", teamSlug: "australia-og9nxrjl", appearances: 4, tries: 2, points: 10, minutes: 317 },
      { allRugbySeason: "2024-25", competitionSlug: "rugby-championship", teamSlug: "australia-og9nxrjl", appearances: 6, tries: 2, points: 10, minutes: 470 },
      { allRugbySeason: "2025-26", competitionSlug: "super-rugby", teamSlug: "waratahs-016o2oj5", appearances: 14, tries: 8, points: 40, minutes: 1074 },
      { allRugbySeason: "2025-26", competitionSlug: "end-of-year-internationals", teamSlug: "australia-og9nxrjl", appearances: 3, tries: 1, points: 5, minutes: 227 },
      { allRugbySeason: "2025-26", competitionSlug: "nations-championship", teamSlug: "australia-og9nxrjl", appearances: 3, tries: 0, points: 0, minutes: 240 },
      { allRugbySeason: "2025-26", competitionSlug: "international-matches-n062z68w", teamSlug: "australia-og9nxrjl", appearances: 1, tries: 1, points: 5, minutes: 80 },
    ],
  },
  {
    ids: ["4bc123d6-a6a9-4de7-8e06-76c4609de8de"],
    name: "Fraser McReight",
    fullName: "Fraser McReight",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Fraser_McReight",
    birthDate: "1999-02-19",
    birthPlace: "Buderim, Queensland, Australia",
    heightCm: 186,
    weightKg: 108,
    clubName: "Queensland Reds",
    clubTeamId: "00ceeee8-1703-4ab0-aecf-e8988d5e97ad",
    positionName: "flanker",
    positions: ["flanker"],
    school: "Brisbane Grammar School",
    bioSummary:
      "Openside flanker and 2026 Queensland Reds captain. Super Rugby AU winner with the Reds in 2021 and a 2023 Rugby World Cup squad member, appearing in all four of Australia's matches.",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/a/a6/Fraser_McReight_mid_crop_2018.jpg",
    imageAlt: "Fraser McReight in 2018",
    imageCredit: "Wikimedia Commons",
    imageSourcePage: "https://en.wikipedia.org/wiki/Fraser_McReight",
    caps: 43,
    tries: 15,
    points: 75,
    intlYearsLabel: "2020–present",
    careerStatus: "active",
    titles: [
      {
        titleType: "other",
        title: "Super Rugby AU winner",
        year: 2021,
        seasonLabel: "2021",
        sourceUrl: "https://en.wikipedia.org/wiki/Fraser_McReight",
      },
      {
        titleType: "other",
        title: "Rugby World Cup appearance",
        year: 2023,
        sourceUrl: "https://en.wikipedia.org/wiki/Fraser_McReight",
      },
    ],
    seasonLines: [
      { allRugbySeason: "2018-19", competitionSlug: "super-rugby", teamSlug: "reds-go9pkpj8", appearances: 4, tries: 0, points: 0, minutes: 12 },
      { allRugbySeason: "2019-20", competitionSlug: "super-rugby", teamSlug: "reds-go9pkpj8", appearances: 14, tries: 1, points: 5, minutes: 775 },
      { allRugbySeason: "2019-20", competitionSlug: "rugby-championship", teamSlug: "australia-og9nxrjl", appearances: 1, tries: 0, points: 0, minutes: 13 },
      { allRugbySeason: "2020-21", competitionSlug: "super-rugby", teamSlug: "reds-go9pkpj8", appearances: 13, tries: 1, points: 5, minutes: 841 },
      { allRugbySeason: "2020-21", competitionSlug: "international-matches-n062z68w", teamSlug: "australia-og9nxrjl", appearances: 1, tries: 0, points: 0, minutes: 20 },
      { allRugbySeason: "2021-22", competitionSlug: "super-rugby", teamSlug: "reds-go9pkpj8", appearances: 14, tries: 5, points: 25, minutes: 969 },
      { allRugbySeason: "2021-22", competitionSlug: "pacific-nations-cup", teamSlug: "australia-a", appearances: 3, tries: 2, points: 10, minutes: 240 },
      { allRugbySeason: "2021-22", competitionSlug: "rugby-championship", teamSlug: "australia-og9nxrjl", appearances: 6, tries: 3, points: 15, minutes: 329 },
      { allRugbySeason: "2022-23", competitionSlug: "super-rugby", teamSlug: "reds-go9pkpj8", appearances: 15, tries: 5, points: 25, minutes: 1190 },
      { allRugbySeason: "2022-23", competitionSlug: "end-of-year-internationals", teamSlug: "australia-og9nxrjl", appearances: 2, tries: 1, points: 5, minutes: 160 },
      { allRugbySeason: "2022-23", competitionSlug: "rugby-championship", teamSlug: "australia-og9nxrjl", appearances: 1, tries: 0, points: 0, minutes: 65 },
      { allRugbySeason: "2023-24", competitionSlug: "super-rugby", teamSlug: "reds-go9pkpj8", appearances: 13, tries: 7, points: 35, minutes: 1018 },
      { allRugbySeason: "2023-24", competitionSlug: "international-matches-n062z68w", teamSlug: "australia-og9nxrjl", appearances: 5, tries: 3, points: 15, minutes: 369 },
      { allRugbySeason: "2023-24", competitionSlug: "rugby-world-cup", teamSlug: "australia-og9nxrjl", appearances: 4, tries: 1, points: 5, minutes: 239 },
      { allRugbySeason: "2023-24", competitionSlug: "rugby-championship", teamSlug: "australia-og9nxrjl", appearances: 2, tries: 2, points: 10, minutes: 160 },
      { allRugbySeason: "2024-25", competitionSlug: "super-rugby", teamSlug: "reds-go9pkpj8", appearances: 13, tries: 3, points: 15, minutes: 966 },
      { allRugbySeason: "2024-25", competitionSlug: "end-of-year-internationals", teamSlug: "australia-og9nxrjl", appearances: 3, tries: 0, points: 0, minutes: 240 },
      { allRugbySeason: "2024-25", competitionSlug: "international-matches-n062z68w", teamSlug: "australia-og9nxrjl", appearances: 4, tries: 1, points: 5, minutes: 300 },
      { allRugbySeason: "2024-25", competitionSlug: "rugby-championship", teamSlug: "australia-og9nxrjl", appearances: 6, tries: 0, points: 0, minutes: 463 },
      { allRugbySeason: "2025-26", competitionSlug: "super-rugby", teamSlug: "reds-go9pkpj8", appearances: 13, tries: 3, points: 15, minutes: 1049 },
      { allRugbySeason: "2025-26", competitionSlug: "end-of-year-internationals", teamSlug: "australia-og9nxrjl", appearances: 4, tries: 1, points: 5, minutes: 304 },
      { allRugbySeason: "2025-26", competitionSlug: "nations-championship", teamSlug: "australia-og9nxrjl", appearances: 3, tries: 2, points: 10, minutes: 178 },
      { allRugbySeason: "2025-26", competitionSlug: "international-matches-n062z68w", teamSlug: "australia-og9nxrjl", appearances: 1, tries: 1, points: 5, minutes: 80 },
    ],
  },
  {
    ids: ["6daf6d73-0209-40f3-bc15-09f80b9c2d6e"],
    name: "Billy Pollard",
    fullName: "Billy Pollard",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Billy_Pollard",
    birthDate: "2001-12-09",
    birthPlace: "Sydney, New South Wales, Australia",
    heightCm: 186,
    weightKg: 110,
    clubName: "ACT Brumbies",
    clubTeamId: "c399c5a0-6fde-4a7b-9c3e-2deca12de0fa",
    positionName: "hooker",
    positions: ["hooker"],
    school: "Barker College",
    bioSummary:
      "ACT Brumbies hooker and Wallaby #958. Super Rugby debut in 2021; Test debut against Argentina in 2022. Spent a short 2023 Rugby World Cup-window loan at La Rochelle and was not part of Australia's World Cup squad.",
    caps: 22,
    tries: 3,
    points: 15,
    intlYearsLabel: "2022–present",
    careerStatus: "active",
    titles: [],
    seasonLines: [
      { allRugbySeason: "2020-21", competitionSlug: "super-rugby", teamSlug: "brumbies-vx91v29w", appearances: 1, tries: 0, points: 0, minutes: 22 },
      { allRugbySeason: "2021-22", competitionSlug: "super-rugby", teamSlug: "brumbies-vx91v29w", appearances: 7, tries: 3, points: 15, minutes: 221 },
      { allRugbySeason: "2021-22", competitionSlug: "pacific-nations-cup", teamSlug: "australia-a", appearances: 2, tries: 0, points: 0, minutes: 106 },
      { allRugbySeason: "2021-22", competitionSlug: "rugby-championship", teamSlug: "australia-og9nxrjl", appearances: 1, tries: 0, points: 0, minutes: 16 },
      { allRugbySeason: "2022-23", competitionSlug: "super-rugby", teamSlug: "brumbies-vx91v29w", appearances: 6, tries: 0, points: 0, minutes: 193 },
      { allRugbySeason: "2023-24", competitionSlug: "top-14", teamSlug: "la-rochelle-4wjx1n6p", appearances: 2, tries: 1, points: 5, minutes: 53 },
      { allRugbySeason: "2023-24", competitionSlug: "super-rugby", teamSlug: "brumbies-vx91v29w", appearances: 13, tries: 4, points: 20, minutes: 659 },
      { allRugbySeason: "2023-24", competitionSlug: "international-matches-n062z68w", teamSlug: "australia-og9nxrjl", appearances: 2, tries: 0, points: 0, minutes: 64 },
      { allRugbySeason: "2023-24", competitionSlug: "rugby-championship", teamSlug: "australia-og9nxrjl", appearances: 1, tries: 0, points: 0, minutes: 32 },
      { allRugbySeason: "2024-25", competitionSlug: "super-rugby", teamSlug: "brumbies-vx91v29w", appearances: 15, tries: 11, points: 55, minutes: 725 },
      { allRugbySeason: "2024-25", competitionSlug: "end-of-year-internationals", teamSlug: "australia-og9nxrjl", appearances: 2, tries: 0, points: 0, minutes: 53 },
      { allRugbySeason: "2024-25", competitionSlug: "international-matches-n062z68w", teamSlug: "australia-og9nxrjl", appearances: 5, tries: 0, points: 0, minutes: 209 },
      { allRugbySeason: "2024-25", competitionSlug: "rugby-championship", teamSlug: "australia-og9nxrjl", appearances: 6, tries: 1, points: 5, minutes: 364 },
      { allRugbySeason: "2025-26", competitionSlug: "super-rugby", teamSlug: "brumbies-vx91v29w", appearances: 14, tries: 2, points: 10, minutes: 691 },
      { allRugbySeason: "2025-26", competitionSlug: "end-of-year-internationals", teamSlug: "australia-og9nxrjl", appearances: 3, tries: 1, points: 5, minutes: 100 },
      { allRugbySeason: "2025-26", competitionSlug: "nations-championship", teamSlug: "australia-og9nxrjl", appearances: 1, tries: 1, points: 5, minutes: 23 },
      { allRugbySeason: "2025-26", competitionSlug: "international-matches-n062z68w", teamSlug: "australia-og9nxrjl", appearances: 1, tries: 0, points: 0, minutes: 27 },
    ],
  },
  {
    ids: ["c7e80567-8672-4ffc-8229-4d39b94a908c", "794e4645-281d-417a-a653-cc7276d51c7f"],
    name: "Andrew Kellaway",
    fullName: "Andrew John Kellaway",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Andrew_Kellaway_(rugby_union)",
    birthDate: "1995-10-12",
    birthPlace: "Sydney, New South Wales, Australia",
    heightCm: 183,
    weightKg: 94,
    clubName: "NSW Waratahs",
    clubTeamId: "0bd66397-4a11-4e3c-bf00-3cfff20e6395",
    positionName: "wing",
    positions: ["wing", "fullback", "centre"],
    school: "The Scots College",
    bioSummary:
      "Fullback and wing who left the NSW Waratahs after the 2026 Super Rugby Pacific season and is currently unattached. Capped 49 times by the Wallabies, including two appearances at the 2023 Rugby World Cup.",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/4/4f/2017.02.25.19.52.47-Andrew_Kellaway.jpg",
    imageAlt: "Andrew Kellaway in 2017",
    imageCredit: "Wikimedia Commons",
    imageSourcePage: "https://en.wikipedia.org/wiki/Andrew_Kellaway_(rugby_union)",
    caps: 49,
    tries: 14,
    points: 74,
    intlYearsLabel: "2021–present",
    careerStatus: "released",
    statusOverride: "unattached",
    titles: [
      {
        titleType: "other",
        title: "Rugby World Cup appearance",
        year: 2023,
        sourceUrl: "https://en.wikipedia.org/wiki/Andrew_Kellaway_(rugby_union)",
      },
    ],
    seasonLines: [
      { allRugbySeason: "2015-16", competitionSlug: "super-rugby", teamSlug: "waratahs-016o2oj5", appearances: 11, tries: 2, points: 10, minutes: 772 },
      { allRugbySeason: "2016-17", competitionSlug: "super-rugby", teamSlug: "waratahs-016o2oj5", appearances: 9, tries: 1, points: 5, minutes: 523 },
      { allRugbySeason: "2017-18", competitionSlug: "super-rugby", teamSlug: "waratahs-016o2oj5", appearances: 2, tries: 0, points: 0, minutes: 111 },
      { allRugbySeason: "2018-19", competitionSlug: "premiership", teamSlug: "northampton-saints-og9nrjly", appearances: 11, tries: 2, points: 10, minutes: 529 },
      { allRugbySeason: "2018-19", competitionSlug: "challenge-cup", teamSlug: "northampton-saints-og9nrjly", appearances: 5, tries: 1, points: 5, minutes: 288 },
      { allRugbySeason: "2018-19", competitionSlug: "premiership-rugby-cup", teamSlug: "northampton-saints-og9nrjly", appearances: 4, tries: 1, points: 5, minutes: 132 },
      { allRugbySeason: "2019-20", competitionSlug: "super-rugby", teamSlug: "rebels-krjdn863", appearances: 14, tries: 7, points: 35, minutes: 1052 },
      { allRugbySeason: "2020-21", competitionSlug: "super-rugby", teamSlug: "rebels-krjdn863", appearances: 4, tries: 1, points: 5, minutes: 227 },
      { allRugbySeason: "2020-21", competitionSlug: "japan-rugby-league-one", teamSlug: "green-rockets-tokatsu", appearances: 4, tries: 1, points: 5, minutes: 0 },
      { allRugbySeason: "2020-21", competitionSlug: "international-matches-n062z68w", teamSlug: "australia-og9nxrjl", appearances: 3, tries: 1, points: 5, minutes: 117 },
      { allRugbySeason: "2020-21", competitionSlug: "rugby-championship", teamSlug: "australia-og9nxrjl", appearances: 6, tries: 7, points: 35, minutes: 462 },
      { allRugbySeason: "2021-22", competitionSlug: "super-rugby", teamSlug: "rebels-krjdn863", appearances: 11, tries: 2, points: 10, minutes: 817 },
      { allRugbySeason: "2021-22", competitionSlug: "international-matches-n062z68w", teamSlug: "australia-og9nxrjl", appearances: 2, tries: 0, points: 0, minutes: 160 },
      { allRugbySeason: "2021-22", competitionSlug: "end-of-year-internationals", teamSlug: "australia-og9nxrjl", appearances: 3, tries: 1, points: 5, minutes: 192 },
      { allRugbySeason: "2021-22", competitionSlug: "rugby-championship", teamSlug: "australia-og9nxrjl", appearances: 4, tries: 2, points: 10, minutes: 217 },
      { allRugbySeason: "2022-23", competitionSlug: "super-rugby", teamSlug: "rebels-krjdn863", appearances: 9, tries: 2, points: 10, minutes: 617 },
      { allRugbySeason: "2022-23", competitionSlug: "end-of-year-internationals", teamSlug: "australia-og9nxrjl", appearances: 3, tries: 0, points: 0, minutes: 220 },
      { allRugbySeason: "2022-23", competitionSlug: "rugby-championship", teamSlug: "australia-og9nxrjl", appearances: 1, tries: 0, points: 0, minutes: 80 },
      { allRugbySeason: "2023-24", competitionSlug: "super-rugby", teamSlug: "rebels-krjdn863", appearances: 12, tries: 6, points: 30, minutes: 908 },
      { allRugbySeason: "2023-24", competitionSlug: "international-matches-n062z68w", teamSlug: "australia-og9nxrjl", appearances: 5, tries: 0, points: 0, minutes: 341 },
      { allRugbySeason: "2023-24", competitionSlug: "rugby-world-cup", teamSlug: "australia-og9nxrjl", appearances: 2, tries: 0, points: 0, minutes: 129 },
      { allRugbySeason: "2023-24", competitionSlug: "rugby-championship", teamSlug: "australia-og9nxrjl", appearances: 6, tries: 1, points: 5, minutes: 455 },
      { allRugbySeason: "2023-24", competitionSlug: "international-matches-n062z68w", teamSlug: "barbarian-f-c", appearances: 1, tries: 0, points: 0, minutes: 20 },
      { allRugbySeason: "2024-25", competitionSlug: "super-rugby", teamSlug: "waratahs-016o2oj5", appearances: 12, tries: 3, points: 15, minutes: 939 },
      { allRugbySeason: "2024-25", competitionSlug: "end-of-year-internationals", teamSlug: "australia-og9nxrjl", appearances: 4, tries: 1, points: 5, minutes: 318 },
      { allRugbySeason: "2024-25", competitionSlug: "international-matches-n062z68w", teamSlug: "australia-og9nxrjl", appearances: 3, tries: 0, points: 0, minutes: 95 },
      { allRugbySeason: "2024-25", competitionSlug: "rugby-championship", teamSlug: "australia-og9nxrjl", appearances: 4, tries: 1, points: 5, minutes: 286 },
      { allRugbySeason: "2025-26", competitionSlug: "super-rugby", teamSlug: "waratahs-016o2oj5", appearances: 8, tries: 2, points: 10, minutes: 553 },
      { allRugbySeason: "2025-26", competitionSlug: "end-of-year-internationals", teamSlug: "australia-og9nxrjl", appearances: 3, tries: 0, points: 4, minutes: 182 },
      { allRugbySeason: "2025-26", competitionSlug: "international-matches-n062z68w", teamSlug: "barbarian-f-c", appearances: 2, tries: 2, points: 10, minutes: 80 },
    ],
  },
  {
    ids: ["3b14bf56-d6fa-4a38-8818-37f2930acedc"],
    name: "Harry Wilson",
    fullName: "Harrison Wilson",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Harry_Wilson_(rugby_union,_born_1999)",
    birthDate: "1999-11-22",
    birthPlace: "Gunnedah, New South Wales, Australia",
    heightCm: 196,
    weightKg: 115,
    clubName: "Queensland Reds",
    clubTeamId: "00ceeee8-1703-4ab0-aecf-e8988d5e97ad",
    positionName: "number 8",
    positions: ["number 8", "flanker"],
    school: "St Joseph's College, Gregory Terrace",
    bioSummary:
      "Queensland Reds number eight and current Wallabies captain (Wallaby #933). Test debut against New Zealand in Wellington in 2020. Omitted from Australia's 2023 Rugby World Cup squad; first captained the Wallabies in 2024.",
    imageUrl: "https://d3gbf3ykm8gp5c.cloudfront.net/content/uploads/2025/07/25140642/Harry-Wilson-Wallabies.jpg",
    imageAlt: "Harry Wilson in Wallabies colours",
    imageCredit: "Planet Rugby",
    imageSourcePage: "https://www.planetrugby.com/tag/harry-wilson",
    caps: 40,
    tries: 4,
    points: 20,
    intlYearsLabel: "2020–present",
    careerStatus: "active",
    titles: [],
    seasonLines: [
      { allRugbySeason: "2019-20", competitionSlug: "super-rugby", teamSlug: "reds-go9pkpj8", appearances: 17, tries: 5, points: 25, minutes: 1219 },
      { allRugbySeason: "2019-20", competitionSlug: "international-matches-n062z68w", teamSlug: "australia-og9nxrjl", appearances: 2, tries: 0, points: 0, minutes: 116 },
      { allRugbySeason: "2019-20", competitionSlug: "rugby-championship", teamSlug: "australia-og9nxrjl", appearances: 4, tries: 0, points: 0, minutes: 239 },
      { allRugbySeason: "2020-21", competitionSlug: "super-rugby", teamSlug: "reds-go9pkpj8", appearances: 13, tries: 3, points: 15, minutes: 860 },
      { allRugbySeason: "2020-21", competitionSlug: "international-matches-n062z68w", teamSlug: "australia-og9nxrjl", appearances: 3, tries: 0, points: 0, minutes: 195 },
      { allRugbySeason: "2020-21", competitionSlug: "rugby-championship", teamSlug: "australia-og9nxrjl", appearances: 1, tries: 0, points: 0, minutes: 19 },
      { allRugbySeason: "2021-22", competitionSlug: "super-rugby", teamSlug: "reds-go9pkpj8", appearances: 14, tries: 5, points: 25, minutes: 1071 },
      { allRugbySeason: "2021-22", competitionSlug: "international-matches-n062z68w", teamSlug: "australia-og9nxrjl", appearances: 1, tries: 0, points: 0, minutes: 55 },
      { allRugbySeason: "2021-22", competitionSlug: "rugby-championship", teamSlug: "australia-og9nxrjl", appearances: 1, tries: 0, points: 0, minutes: 47 },
      { allRugbySeason: "2022-23", competitionSlug: "super-rugby", teamSlug: "reds-go9pkpj8", appearances: 15, tries: 6, points: 30, minutes: 1090 },
      { allRugbySeason: "2023-24", competitionSlug: "super-rugby", teamSlug: "reds-go9pkpj8", appearances: 11, tries: 2, points: 10, minutes: 782 },
      { allRugbySeason: "2023-24", competitionSlug: "international-matches-n062z68w", teamSlug: "australia-a", appearances: 1, tries: 0, points: 0, minutes: 40 },
      { allRugbySeason: "2023-24", competitionSlug: "international-matches-n062z68w", teamSlug: "australia-og9nxrjl", appearances: 1, tries: 0, points: 0, minutes: 80 },
      { allRugbySeason: "2023-24", competitionSlug: "rugby-championship", teamSlug: "australia-og9nxrjl", appearances: 6, tries: 0, points: 0, minutes: 480 },
      { allRugbySeason: "2024-25", competitionSlug: "super-rugby", teamSlug: "reds-go9pkpj8", appearances: 9, tries: 2, points: 10, minutes: 720 },
      { allRugbySeason: "2024-25", competitionSlug: "end-of-year-internationals", teamSlug: "australia-og9nxrjl", appearances: 3, tries: 1, points: 5, minutes: 224 },
      { allRugbySeason: "2024-25", competitionSlug: "international-matches-n062z68w", teamSlug: "australia-og9nxrjl", appearances: 5, tries: 1, points: 5, minutes: 379 },
      { allRugbySeason: "2024-25", competitionSlug: "rugby-championship", teamSlug: "australia-og9nxrjl", appearances: 5, tries: 2, points: 10, minutes: 384 },
      { allRugbySeason: "2025-26", competitionSlug: "super-rugby", teamSlug: "reds-go9pkpj8", appearances: 14, tries: 3, points: 15, minutes: 977 },
      { allRugbySeason: "2025-26", competitionSlug: "end-of-year-internationals", teamSlug: "australia-og9nxrjl", appearances: 4, tries: 0, points: 0, minutes: 284 },
      { allRugbySeason: "2025-26", competitionSlug: "nations-championship", teamSlug: "australia-og9nxrjl", appearances: 3, tries: 0, points: 0, minutes: 240 },
      { allRugbySeason: "2025-26", competitionSlug: "international-matches-n062z68w", teamSlug: "australia-og9nxrjl", appearances: 1, tries: 0, points: 0, minutes: 80 },
    ],
  },
  {
    ids: ["a3f4a715-e9cb-47e8-bb81-081ee1e8d400"],
    name: "Filipo Daugunu",
    fullName: "Filipo Suraki Daugunu",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Filipo_Daugunu",
    birthDate: "1995-03-04",
    birthPlace: "Labasa, Fiji",
    heightCm: 181,
    weightKg: 98,
    clubName: "Queensland Reds",
    clubTeamId: "00ceeee8-1703-4ab0-aecf-e8988d5e97ad",
    positionName: "wing",
    positions: ["wing", "centre"],
    school: "Labasa Sangam College",
    bioSummary:
      "Fiji-born Wallabies wing and centre for the Queensland Reds (Wallaby #931). Moved to Australia in 2016; Test debut against New Zealand in 2020. Played the 2024 Super Rugby season with the Melbourne Rebels before returning to the Reds.",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/1/16/Filipio_Daugunu_for_Queensland_Country_in_2017_NRC_close_up.jpg",
    imageAlt: "Filipo Daugunu for Queensland Country in 2017",
    imageCredit: "Wikimedia Commons",
    imageSourcePage: "https://en.wikipedia.org/wiki/Filipo_Daugunu",
    caps: 22,
    tries: 7,
    points: 35,
    intlYearsLabel: "2020–present",
    careerStatus: "active",
    titles: [
      {
        titleType: "other",
        title: "National Rugby Championship winner",
        year: 2017,
        seasonLabel: "2017",
        sourceUrl: "https://en.wikipedia.org/wiki/Filipo_Daugunu",
      },
    ],
    seasonLines: [
      { allRugbySeason: "2017-18", competitionSlug: "super-rugby", teamSlug: "reds-go9pkpj8", appearances: 14, tries: 6, points: 37, minutes: 915 },
      { allRugbySeason: "2018-19", competitionSlug: "super-rugby", teamSlug: "reds-go9pkpj8", appearances: 7, tries: 0, points: 0, minutes: 395 },
      { allRugbySeason: "2019-20", competitionSlug: "super-rugby", teamSlug: "reds-go9pkpj8", appearances: 13, tries: 6, points: 30, minutes: 846 },
      { allRugbySeason: "2019-20", competitionSlug: "international-matches-n062z68w", teamSlug: "australia-og9nxrjl", appearances: 2, tries: 1, points: 5, minutes: 169 },
      { allRugbySeason: "2019-20", competitionSlug: "rugby-championship", teamSlug: "australia-og9nxrjl", appearances: 3, tries: 0, points: 0, minutes: 99 },
      { allRugbySeason: "2020-21", competitionSlug: "super-rugby", teamSlug: "reds-go9pkpj8", appearances: 13, tries: 6, points: 33, minutes: 778 },
      { allRugbySeason: "2020-21", competitionSlug: "international-matches-n062z68w", teamSlug: "australia-og9nxrjl", appearances: 1, tries: 0, points: 0, minutes: 1 },
      { allRugbySeason: "2021-22", competitionSlug: "super-rugby", teamSlug: "reds-go9pkpj8", appearances: 10, tries: 2, points: 10, minutes: 668 },
      { allRugbySeason: "2021-22", competitionSlug: "end-of-year-internationals", teamSlug: "australia-og9nxrjl", appearances: 1, tries: 1, points: 5, minutes: 80 },
      { allRugbySeason: "2021-22", competitionSlug: "pacific-nations-cup", teamSlug: "australia-a", appearances: 2, tries: 3, points: 15, minutes: 146 },
      { allRugbySeason: "2022-23", competitionSlug: "super-rugby", teamSlug: "reds-go9pkpj8", appearances: 12, tries: 2, points: 10, minutes: 773 },
      { allRugbySeason: "2023-24", competitionSlug: "super-rugby", teamSlug: "rebels-krjdn863", appearances: 12, tries: 5, points: 25, minutes: 914 },
      { allRugbySeason: "2023-24", competitionSlug: "international-matches-n062z68w", teamSlug: "australia-a", appearances: 1, tries: 0, points: 0, minutes: 51 },
      { allRugbySeason: "2023-24", competitionSlug: "international-matches-n062z68w", teamSlug: "australia-og9nxrjl", appearances: 3, tries: 3, points: 15, minutes: 189 },
      { allRugbySeason: "2023-24", competitionSlug: "rugby-championship", teamSlug: "australia-og9nxrjl", appearances: 1, tries: 0, points: 0, minutes: 25 },
      { allRugbySeason: "2024-25", competitionSlug: "super-rugby", teamSlug: "reds-go9pkpj8", appearances: 12, tries: 7, points: 37, minutes: 851 },
      { allRugbySeason: "2024-25", competitionSlug: "international-matches-n062z68w", teamSlug: "australia-og9nxrjl", appearances: 2, tries: 0, points: 0, minutes: 25 },
      { allRugbySeason: "2024-25", competitionSlug: "rugby-championship", teamSlug: "australia-og9nxrjl", appearances: 3, tries: 2, points: 10, minutes: 120 },
      { allRugbySeason: "2025-26", competitionSlug: "super-rugby", teamSlug: "reds-go9pkpj8", appearances: 13, tries: 4, points: 20, minutes: 894 },
      { allRugbySeason: "2025-26", competitionSlug: "end-of-year-internationals", teamSlug: "australia-og9nxrjl", appearances: 4, tries: 0, points: 0, minutes: 106 },
      { allRugbySeason: "2025-26", competitionSlug: "nations-championship", teamSlug: "australia-og9nxrjl", appearances: 2, tries: 0, points: 0, minutes: 25 },
    ],
  },
  {
    ids: ["e52837a5-fbf4-4846-8152-31a6eb197db2"],
    name: "Tom Hooper",
    fullName: "Tom Hooper",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Tom_Hooper_(rugby_union)",
    birthDate: "2001-01-29",
    birthPlace: "Bathurst, New South Wales, Australia",
    heightCm: 199,
    weightKg: 122,
    clubName: "Exeter Chiefs",
    clubTeamId: "842c325c-8693-4e6f-8d6a-54e7f73f44a4",
    positionName: "flanker",
    positions: ["flanker", "lock"],
    school: "St Stanislaus' College",
    relatives: "Lachlan Hooper (brother)",
    bioSummary:
      "Exeter Chiefs flanker and lock, Wallaby #964. Super Rugby debut for the ACT Brumbies in 2021; Test debut in the 2023 Rugby Championship. Started all four of Australia's 2023 Rugby World Cup pool matches. Recalled to the Wallabies squad for the Townsville Test after a shoulder injury; has not yet played that match.",
    imageUrl: "https://d3gbf3ykm8gp5c.cloudfront.net/content/uploads/2023/08/05074927/Wallaby-Tom-Hooper-on-the-charge-against-the-All-Blacks.jpg",
    imageAlt: "Tom Hooper on the charge for the Wallabies",
    imageCredit: "Planet Rugby",
    imageSourcePage: "https://www.planetrugby.com/tag/tom-hooper",
    caps: 23,
    tries: 1,
    points: 5,
    intlYearsLabel: "2023–present",
    careerStatus: "active",
    titles: [
      {
        titleType: "other",
        title: "Rugby World Cup appearance",
        year: 2023,
        sourceUrl: "https://en.wikipedia.org/wiki/Tom_Hooper_(rugby_union)",
      },
    ],
    seasonLines: [
      { allRugbySeason: "2020-21", competitionSlug: "super-rugby", teamSlug: "brumbies-vx91v29w", appearances: 5, tries: 0, points: 0, minutes: 120 },
      { allRugbySeason: "2021-22", competitionSlug: "super-rugby", teamSlug: "brumbies-vx91v29w", appearances: 12, tries: 0, points: 0, minutes: 535 },
      { allRugbySeason: "2022-23", competitionSlug: "super-rugby", teamSlug: "brumbies-vx91v29w", appearances: 7, tries: 0, points: 0, minutes: 404 },
      { allRugbySeason: "2022-23", competitionSlug: "rugby-championship", teamSlug: "australia-og9nxrjl", appearances: 2, tries: 0, points: 0, minutes: 105 },
      { allRugbySeason: "2023-24", competitionSlug: "super-rugby", teamSlug: "brumbies-vx91v29w", appearances: 14, tries: 0, points: 0, minutes: 772 },
      { allRugbySeason: "2023-24", competitionSlug: "international-matches-n062z68w", teamSlug: "australia-og9nxrjl", appearances: 3, tries: 1, points: 5, minutes: 191 },
      { allRugbySeason: "2023-24", competitionSlug: "rugby-world-cup", teamSlug: "australia-og9nxrjl", appearances: 4, tries: 0, points: 0, minutes: 320 },
      { allRugbySeason: "2023-24", competitionSlug: "rugby-championship", teamSlug: "australia-og9nxrjl", appearances: 1, tries: 0, points: 0, minutes: 23 },
      { allRugbySeason: "2023-24", competitionSlug: "international-matches-n062z68w", teamSlug: "barbarian-f-c", appearances: 1, tries: 1, points: 5, minutes: 30 },
      { allRugbySeason: "2024-25", competitionSlug: "super-rugby", teamSlug: "brumbies-vx91v29w", appearances: 15, tries: 1, points: 5, minutes: 1133 },
      { allRugbySeason: "2024-25", competitionSlug: "international-matches-n062z68w", teamSlug: "australia-a", appearances: 1, tries: 0, points: 0, minutes: 80 },
      { allRugbySeason: "2024-25", competitionSlug: "international-matches-n062z68w", teamSlug: "australia-og9nxrjl", appearances: 3, tries: 0, points: 0, minutes: 115 },
      { allRugbySeason: "2024-25", competitionSlug: "rugby-championship", teamSlug: "australia-og9nxrjl", appearances: 6, tries: 0, points: 0, minutes: 427 },
      { allRugbySeason: "2025-26", competitionSlug: "premiership", teamSlug: "exeter-chiefs-016owj5k", appearances: 17, tries: 0, points: 0, minutes: 1131 },
      { allRugbySeason: "2025-26", competitionSlug: "challenge-cup", teamSlug: "exeter-chiefs-016owj5k", appearances: 6, tries: 0, points: 0, minutes: 440 },
      { allRugbySeason: "2025-26", competitionSlug: "end-of-year-internationals", teamSlug: "australia-og9nxrjl", appearances: 3, tries: 0, points: 0, minutes: 230 },
      { allRugbySeason: "2025-26", competitionSlug: "nations-championship", teamSlug: "australia-og9nxrjl", appearances: 1, tries: 0, points: 0, minutes: 12 },
    ],
  },
];

function seasonYear(label: string, competitionSlug: string): number {
  const start = Number(label.slice(0, 4));
  if (competitionSlug === "nations-championship") return 2026;
  if (competitionSlug === "pacific-nations-cup") return start;
  return start;
}

async function resolveCompetition(slug: string) {
  const db = getDb();
  const [row] = await db.select().from(competitions).where(eq(competitions.slug, slug)).limit(1);
  if (!row) throw new Error(`Competition not found: ${slug}`);
  return row;
}

async function resolveTeam(slug: string) {
  const db = getDb();
  const [row] = await db.select().from(teams).where(eq(teams.slug, slug)).limit(1);
  if (!row) throw new Error(`Team not found: ${slug}`);
  return row;
}

async function resolveSeason(competitionId: string, year: number) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(competitionSeasons)
    .where(and(eq(competitionSeasons.competitionId, competitionId), eq(competitionSeasons.year, year)))
    .limit(1);
  if (!row) throw new Error(`Season ${year} not found for competition ${competitionId}`);
  return row;
}

async function upsertAustraliaStint(playerId: string, spec: PlayerUpdate) {
  const db = getDb();
  const existing = await db
    .select()
    .from(playerCareerStints)
    .where(and(eq(playerCareerStints.playerId, playerId), eq(playerCareerStints.careerType, "international")));
  await db.delete(playerCareerStints).where(
    and(
      eq(playerCareerStints.playerId, playerId),
      eq(playerCareerStints.careerType, "international"),
      eq(playerCareerStints.teamName, ""),
    ),
  );
  const australia = existing.find((row) => {
    const name = row.teamName.trim();
    if (/australia\s*(a|xv|sevens|u20|u-20|school)/i.test(name)) return false;
    return /^australia$/i.test(name);
  });
  const payload = {
    teamName: "Australia",
    teamId: AUSTRALIA_ID,
    yearsLabel: spec.intlYearsLabel,
    apps: spec.caps,
    tries: spec.tries,
    points: spec.points,
    sourceProvider: SOURCE,
    sourceUrl: "https://all.rugby",
    syncedAt: new Date(),
  };
  if (australia) {
    await db.update(playerCareerStints).set(payload).where(eq(playerCareerStints.id, australia.id));
    return;
  }
  await db.insert(playerCareerStints).values({
    playerId,
    careerType: "international",
    sortOrder: 0,
    ...payload,
  });
}

async function upsertTitles(playerId: string, spec: PlayerUpdate) {
  const db = getDb();
  const existing = await db.select().from(playerTitles).where(eq(playerTitles.playerId, playerId));
  for (const title of spec.titles) {
    const already = existing.some(
      (row) => row.title === title.title && row.year === title.year && row.titleType === title.titleType,
    );
    if (already) continue;
    await createPlayerTitle({
      playerId,
      titleType: title.titleType,
      title: title.title,
      year: title.year,
      seasonLabel: title.seasonLabel ?? null,
      sourceUrl: title.sourceUrl,
    });
  }
}

async function upsertImage(playerId: string, spec: PlayerUpdate) {
  if (!spec.imageUrl) {
    console.log("  image: skipped (RA player pages HTTP 429; no freely licensed fallback)");
    return;
  }
  const fromCommons = spec.imageUrl.includes("upload.wikimedia.org");
  const db = getDb();
  const [existing] = await db
    .select()
    .from(playerImages)
    .where(and(eq(playerImages.playerId, playerId), eq(playerImages.imageUrl, spec.imageUrl)))
    .limit(1);
  const imageId =
    existing?.id ??
    (
      await db
        .insert(playerImages)
        .values({
          playerId,
          imageUrl: spec.imageUrl,
          canonicalUrl: spec.imageUrl,
          sourceProvider: fromCommons ? "wikimedia" : "planet_rugby",
          sourcePageUrl: spec.imageSourcePage ?? spec.wikipediaUrl,
          altText: spec.imageAlt ?? spec.name,
          caption: spec.imageAlt ?? spec.name,
          credit: spec.imageCredit ?? (fromCommons ? "Wikimedia Commons" : "Planet Rugby"),
          licence: fromCommons ? "cc" : "planet_rugby",
          imageType: "headshot",
          role: "gallery",
          confidence: "high",
          confidenceScore: 90,
          status: "candidate",
          isPublic: false,
          matchContext: {
            source: fromCommons ? "wikimedia-commons" : "planet-rugby",
            note: "wallabies.rugby / rugby.com.au player-page images blocked (HTTP 429)",
          },
        })
        .returning({ id: playerImages.id })
    )[0]!.id;
  await applyPlayerImageAction(playerId, imageId, "set_primary");
}

async function upsertSeasonLine(playerId: string, line: SeasonLine) {
  const db = getDb();
  const competition = await resolveCompetition(line.competitionSlug);
  const team = await resolveTeam(line.teamSlug);
  const year = seasonYear(line.allRugbySeason, line.competitionSlug);
  const season = await resolveSeason(competition.id, year);

  const [existing] = await db
    .select()
    .from(playerSeasonStats)
    .where(
      and(
        eq(playerSeasonStats.playerId, playerId),
        eq(playerSeasonStats.seasonId, season.id),
        eq(playerSeasonStats.teamId, team.id),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(playerSeasonStats)
      .set({
        appearances: line.appearances,
        tries: line.tries,
        points: line.points,
        minutesPlayed: line.minutes || existing.minutesPlayed,
        competitionId: competition.id,
        sourceProvider: SOURCE,
        syncedAt: new Date(),
      })
      .where(eq(playerSeasonStats.id, existing.id));
    return;
  }
  await db.insert(playerSeasonStats).values({
    playerId,
    seasonId: season.id,
    competitionId: competition.id,
    teamId: team.id,
    appearances: line.appearances,
    tries: line.tries,
    points: line.points,
    minutesPlayed: line.minutes,
    sourceProvider: SOURCE,
    syncedAt: new Date(),
  });
}

async function updateOneRecord(playerId: string, spec: PlayerUpdate) {
  if (process.env.SKIP_WIKI !== "1") {
    const wiki = await enrichPlayerFromWikipedia(playerId, spec.name, {
      fillMissingOnly: false,
      sourceUrl: spec.wikipediaUrl,
    });
    console.log(`  wikipedia: ${wiki.reason ?? "ok"} ${wiki.wikipediaUrl ?? ""}`);
  }

  await updatePlayer(playerId, {
    name: spec.name,
    fullName: spec.fullName,
    birthDate: spec.birthDate,
    birthPlace: spec.birthPlace,
    heightCm: spec.heightCm,
    weightKg: spec.weightKg,
    clubName: spec.clubName,
    clubTeamId: spec.clubTeamId,
    countryName: "Australia",
    nationCode: "AU",
    internationalTeamId: AUSTRALIA_ID,
    positionName: spec.positionName,
    school: spec.school ?? null,
    bioSummary: spec.bioSummary,
    careerStatus: spec.careerStatus,
    statusOverride: spec.statusOverride ?? null,
    preferredFoot: null,
    isPublic: true,
    publishStatus: "published",
  });

  const db = getDb();
  await db
    .update(players)
    .set({
      name: spec.name,
      positions: spec.positions,
      relatives: spec.relatives ?? null,
      wikipediaUrl: spec.wikipediaUrl,
      lastVerifiedAt: new Date(),
      profileUpdatedAt: new Date(),
    })
    .where(eq(players.id, playerId));

  await upsertAustraliaStint(playerId, spec);
  await upsertTitles(playerId, spec);
  await upsertImage(playerId, spec);
  for (const line of spec.seasonLines) {
    await upsertSeasonLine(playerId, line);
  }
  console.log(`  season lines: ${spec.seasonLines.length}`);
}

async function main() {
  for (const spec of PLAYERS) {
    console.log(`\n== ${spec.name} ==`);
    for (const id of spec.ids) {
      console.log(`  record ${id}`);
      await updateOneRecord(id, spec);
    }
  }
  console.log("\nDone.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
