import type { ParsedClubSquadDocument } from "@rugby365/import-sdk";
import { fetchExeterChiefsMensSquad } from "@rugby365/import-sdk";

export type ClubSquadParserId = "exeter-chiefs-rsc" | "manual";

export type ClubSquadParserContext = {
  sourceUrl: string;
  clubName: string;
};

export async function fetchClubSquadDocument(
  parserId: ClubSquadParserId | string | null | undefined,
  context: ClubSquadParserContext,
): Promise<ParsedClubSquadDocument> {
  switch (parserId) {
    case "exeter-chiefs-rsc":
      return fetchExeterChiefsMensSquad(context.sourceUrl);
  }

  throw new Error(
    context.sourceUrl
      ? `No squad parser configured for ${context.clubName}. Add import_parser before preview.`
      : `Missing official squad URL for ${context.clubName}.`,
  );
}

export const CLUB_SQUAD_PARSER_OPTIONS: Array<{ id: ClubSquadParserId; label: string }> = [
  { id: "exeter-chiefs-rsc", label: "Exeter Chiefs (Next.js RSC)" },
  { id: "manual", label: "Manual entry" },
];

export const SQUAD_SOURCE_TYPE_OPTIONS = [
  { id: "club_website", label: "Club website" },
  { id: "premiership_rugby", label: "Premiership Rugby" },
  { id: "wikipedia", label: "Wikipedia" },
  { id: "planet_rugby", label: "Planet Rugby" },
  { id: "all_rugby", label: "All Rugby" },
  { id: "rugbypass", label: "RugbyPass" },
  { id: "manual", label: "Manual" },
] as const;
