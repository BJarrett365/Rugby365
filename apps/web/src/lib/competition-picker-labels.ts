import { competitionAdminDisplayName } from "./competition-admin-groups";

/** Disambiguate similarly named competitions in admin pickers. */
export function competitionPickerLabel(comp: { slug: string; name: string }): string {
  switch (comp.slug) {
    case "championship":
      return "Championship (England — RFU 2nd tier)";
    case "rugby-championship":
      return "Rugby Championship (Argentina · Australia · NZ · SA)";
    case "currie-cup-pd9ro98v":
      return "Currie Cup Premier Division (South Africa)";
    case "currie-cup-first-division":
      return "Currie Cup First Division (South Africa)";
    default:
      if (comp.slug.startsWith("currie-cup-first")) {
        return "Currie Cup First Division (South Africa)";
      }
      if (comp.slug.startsWith("currie-cup")) return "Currie Cup Premier Division (South Africa)";
      return competitionAdminDisplayName(comp);
  }
}

export function competitionEmptyTeamsHint(slug: string | undefined): string | null {
  if (slug === "championship") {
    return "This is the English club league. Southern Hemisphere nations are under Rugby Championship — use that entry in the competition list.";
  }
  if (slug === "rugby-championship") {
    return "Pick a season such as 2025 or 2024. Current/future shell seasons may have no teams yet.";
  }
  if (slug === "currie-cup-first-division") {
    return "Second tier of South African provincial rugby. The top division is Currie Cup Premier Division.";
  }
  if (slug?.startsWith("currie-cup") && slug !== "currie-cup-first-division") {
    return "Top South African provincial division. First Division is listed separately.";
  }
  return null;
}
