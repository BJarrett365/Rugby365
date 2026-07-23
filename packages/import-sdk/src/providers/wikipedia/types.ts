import { z } from "zod";

export const WikipediaEntityTypeSchema = z.enum(["player", "team", "competition", "venue", "coach", "referee", "auto"]);
export type WikipediaEntityType = z.infer<typeof WikipediaEntityTypeSchema>;

export const WikipediaCareerStintSchema = z.object({
  careerType: z.enum(["club", "cup", "international"]),
  yearsLabel: z.string(),
  startYear: z.number().nullable().optional(),
  endYear: z.number().nullable().optional(),
  teamName: z.string(),
  apps: z.number().nullable().optional(),
  points: z.number().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export type WikipediaCareerStint = z.infer<typeof WikipediaCareerStintSchema>;

export const WikipediaCoachingStintSchema = z.object({
  yearsLabel: z.string(),
  startYear: z.number().nullable().optional(),
  endYear: z.number().nullable().optional(),
  teamName: z.string(),
  sortOrder: z.number().int().optional(),
});

export type WikipediaCoachingStint = z.infer<typeof WikipediaCoachingStintSchema>;

export const WikipediaCoachArchiveSchema = z.object({
  entityType: z.literal("coach"),
  articleTitle: z.string(),
  wikipediaUrl: z.string(),
  wikidataId: z.string().optional(),
  name: z.string(),
  fullName: z.string().optional(),
  birthDate: z.string().optional(),
  birthPlace: z.string().optional(),
  nationality: z.string().optional(),
  imageUrl: z.string().optional(),
  bioSummary: z.string().optional(),
  coachingCareer: z.array(WikipediaCoachingStintSchema).optional(),
  infoboxTemplate: z.string().optional(),
});

export type WikipediaCoachArchive = z.infer<typeof WikipediaCoachArchiveSchema>;

export const WikipediaRefereeStintSchema = z.object({
  yearsLabel: z.string().optional(),
  competitionName: z.string(),
  apps: z.number().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export type WikipediaRefereeStint = z.infer<typeof WikipediaRefereeStintSchema>;

export const WikipediaRefereeArchiveSchema = z.object({
  entityType: z.literal("referee"),
  articleTitle: z.string(),
  wikipediaUrl: z.string(),
  wikidataId: z.string().optional(),
  name: z.string(),
  fullName: z.string().optional(),
  birthDate: z.string().optional(),
  birthPlace: z.string().optional(),
  nationality: z.string().optional(),
  occupation: z.string().optional(),
  imageUrl: z.string().optional(),
  bioSummary: z.string().optional(),
  refereeCareer: z.array(WikipediaRefereeStintSchema).optional(),
  infoboxTemplate: z.string().optional(),
});

export type WikipediaRefereeArchive = z.infer<typeof WikipediaRefereeArchiveSchema>;

export const WikipediaPlayerArchiveSchema = z.object({
  entityType: z.literal("player"),
  articleTitle: z.string(),
  wikipediaUrl: z.string(),
  wikidataId: z.string().optional(),
  name: z.string(),
  fullName: z.string().optional(),
  birthDate: z.string().optional(),
  birthPlace: z.string().optional(),
  heightCm: z.number().optional(),
  weightKg: z.number().optional(),
  school: z.string().optional(),
  relatives: z.string().optional(),
  positions: z.array(z.string()).optional(),
  currentTeam: z.string().optional(),
  imageUrl: z.string().optional(),
  bioSummary: z.string().optional(),
  /** Optional social URLs (often from Wikidata, not the wiki infobox). */
  twitter: z.string().optional(),
  instagram: z.string().optional(),
  facebook: z.string().optional(),
  website: z.string().optional(),
  clubCareer: z.array(WikipediaCareerStintSchema).optional(),
  cupCareer: z.array(WikipediaCareerStintSchema).optional(),
  internationalCareer: z.array(WikipediaCareerStintSchema).optional(),
  infoboxTemplate: z.string().optional(),
});

export type WikipediaPlayerArchive = z.infer<typeof WikipediaPlayerArchiveSchema>;

export const WikipediaTeamArchiveSchema = z.object({
  entityType: z.literal("team"),
  articleTitle: z.string(),
  wikipediaUrl: z.string(),
  wikidataId: z.string().optional(),
  name: z.string(),
  countryName: z.string().optional(),
  foundedYear: z.number().optional(),
  homeGround: z.string().optional(),
  imageUrl: z.string().optional(),
  bioSummary: z.string().optional(),
  infoboxTemplate: z.string().optional(),
});

export type WikipediaTeamArchive = z.infer<typeof WikipediaTeamArchiveSchema>;

export const WikipediaCompetitionArchiveSchema = z.object({
  entityType: z.literal("competition"),
  articleTitle: z.string(),
  wikipediaUrl: z.string(),
  wikidataId: z.string().optional(),
  name: z.string(),
  countryName: z.string().optional(),
  foundedYear: z.number().optional(),
  bioSummary: z.string().optional(),
  imageUrl: z.string().optional(),
  infoboxTemplate: z.string().optional(),
});

export type WikipediaCompetitionArchive = z.infer<typeof WikipediaCompetitionArchiveSchema>;

export const WikipediaVenueArchiveSchema = z.object({
  entityType: z.literal("venue"),
  articleTitle: z.string(),
  wikipediaUrl: z.string(),
  wikidataId: z.string().optional(),
  name: z.string(),
  city: z.string().optional(),
  countryName: z.string().optional(),
  capacity: z.number().optional(),
  recordAttendance: z.number().optional(),
  imageUrl: z.string().optional(),
  bioSummary: z.string().optional(),
  infoboxTemplate: z.string().optional(),
});

export type WikipediaVenueArchive = z.infer<typeof WikipediaVenueArchiveSchema>;

export type WikipediaArchiveData =
  | WikipediaPlayerArchive
  | WikipediaCoachArchive
  | WikipediaRefereeArchive
  | WikipediaTeamArchive
  | WikipediaCompetitionArchive
  | WikipediaVenueArchive;

export type WikipediaArticleFetchResult = {
  articleTitle: string;
  wikipediaUrl: string;
  wikidataId?: string;
  abstract?: string;
  html?: string;
  wikitext?: string;
  imageUrl?: string;
  source: "wikimedia_enterprise" | "wikipedia_public";
  fetchedAt: string;
};

export type WikipediaParseResult = WikipediaArchiveData & {
  provider: "wikipedia";
  source: WikipediaArticleFetchResult["source"];
  fetchedAt: string;
};
