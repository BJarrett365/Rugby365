import type { ShirtSvgConfig } from "./shirt-library-types";

export function shirtConfigFromVersion(v: {
  bodyColour: string;
  secondaryColour?: string | null;
  sleeveColour?: string | null;
  collarColour?: string | null;
  cuffColour?: string | null;
  sidePanelColour?: string | null;
  patternType?: string | null;
  patternColour?: string | null;
  patternSettings?: ShirtSvgConfig["patternSettings"] | null;
  numberColour?: string | null;
  numberBorderColour?: string | null;
  crestEnabled?: boolean | null;
}): ShirtSvgConfig {
  return {
    bodyColour: v.bodyColour,
    secondaryColour: v.secondaryColour ?? null,
    sleeveColour: v.sleeveColour ?? null,
    collarColour: v.collarColour ?? null,
    cuffColour: v.cuffColour ?? null,
    sidePanelColour: v.sidePanelColour ?? null,
    patternType: v.patternType ?? "PLAIN",
    patternColour: v.patternColour ?? null,
    patternSettings: (v.patternSettings as ShirtSvgConfig["patternSettings"]) ?? {},
    numberColour: v.numberColour ?? "#FFFFFF",
    numberBorderColour: v.numberBorderColour ?? null,
    crestEnabled: v.crestEnabled !== false,
  };
}
