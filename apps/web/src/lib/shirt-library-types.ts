export const SHIRT_STATUSES = [
  "DRAFT",
  "AWAITING_REVIEW",
  "CHANGES_REQUIRED",
  "APPROVED",
  "REJECTED",
  "ARCHIVED",
] as const;

export type ShirtStatus = (typeof SHIRT_STATUSES)[number];

export const SHIRT_KIT_TYPES = [
  "HOME",
  "AWAY",
  "THIRD",
  "ALTERNATE",
  "SPECIAL",
  "TRAINING",
] as const;

export type ShirtKitType = (typeof SHIRT_KIT_TYPES)[number];

export const SHIRT_PATTERNS = [
  "PLAIN",
  "HOOPS",
  "HORIZONTAL_STRIPES",
  "VERTICAL_STRIPES",
  "CHEST_BAND",
  "SHOULDER_PANEL",
  "SIDE_PANELS",
  "SLEEVE_BANDS",
  "GRADIENT",
  "CHEVRON",
  "SASH",
  "HALVES",
  "QUARTERS",
  "ABSTRACT",
  "CUSTOM",
] as const;

export type ShirtPatternType = (typeof SHIRT_PATTERNS)[number];

export const SHIRT_SELECTION_METHODS = [
  "MATCH_DATA",
  "DEFAULT_HOME",
  "ADMIN_OVERRIDE",
  "FALLBACK",
] as const;

export type ShirtSelectionMethod = (typeof SHIRT_SELECTION_METHODS)[number];

export type TeamShirtSetStatus =
  | "Not Started"
  | "In Progress"
  | "Awaiting Approval"
  | "Partly Approved"
  | "Fully Approved"
  | "Needs Changes";

export type ShirtPatternSettings = {
  width?: number;
  spacing?: number;
  angle?: number;
  opacity?: number;
  /** Soft tone-on-tone fabric texture (Italy-style emboss). */
  fabricTexture?: boolean;
  fabricTextureOpacity?: number;
  /** Multi-colour cuff rings, e.g. Italian flag on away kit. */
  cuffBands?: string[];
};

export type ShirtSvgConfig = {
  bodyColour: string;
  secondaryColour: string | null;
  sleeveColour: string | null;
  collarColour: string | null;
  cuffColour: string | null;
  sidePanelColour: string | null;
  patternType: ShirtPatternType | string;
  patternColour: string | null;
  patternSettings: ShirtPatternSettings;
  numberColour: string;
  numberBorderColour: string | null;
  crestEnabled: boolean;
};

export type ResolvedTeamShirt = {
  shirtId: string | null;
  versionId: string | null;
  kitType: ShirtKitType | string;
  svgConfig: ShirtSvgConfig;
  approvalStatus: ShirtStatus | "FALLBACK";
  selectionMethod: ShirtSelectionMethod;
  isFallback: boolean;
  teamName?: string | null;
};
