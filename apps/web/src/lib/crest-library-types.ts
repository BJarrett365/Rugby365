export type CrestStatus =
  | "DRAFT"
  | "AWAITING_REVIEW"
  | "CHANGES_REQUIRED"
  | "APPROVED"
  | "REJECTED"
  | "ARCHIVED";

export type CrestColourSwatch = {
  name: string;
  hex: string;
};

export type CrestVersionInput = {
  title?: string | null;
  description?: string | null;
  aboutCrest?: string | null;
  primaryColour?: string | null;
  secondaryColour?: string | null;
  accentColour?: string | null;
  colours?: CrestColourSwatch[];
  officialImageUrl?: string | null;
  replicaImageUrl?: string | null;
  sourceUrl?: string | null;
  sourceName?: string | null;
  notes?: string | null;
};

export type ResolvedTeamCrest = {
  crestId: string;
  teamId: string;
  versionId: string;
  status: CrestStatus;
  officialImageUrl: string | null;
  replicaImageUrl: string | null;
  /** Prefer official; fall back to replica for display. */
  displayImageUrl: string | null;
  primaryColour: string | null;
  secondaryColour: string | null;
  accentColour: string | null;
  colours: CrestColourSwatch[];
  description: string | null;
  aboutCrest: string | null;
};
