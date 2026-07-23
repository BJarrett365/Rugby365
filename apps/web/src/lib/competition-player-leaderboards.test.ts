import { describe, expect, it } from "vitest";
import {
  isNationsChampionshipSlug,
  nationsChampionshipHemisphereForTeam,
} from "./nations-championship-hemisphere";

describe("competition player leaderboard helpers", () => {
  it("recognises Nations Championship slug for hemisphere filters", () => {
    expect(isNationsChampionshipSlug("nations-championship")).toBe(true);
    expect(isNationsChampionshipSlug("premiership")).toBe(false);
  });

  it("maps NC pool teams to hemispheres for North/South boards", () => {
    expect(nationsChampionshipHemisphereForTeam("France")).toBe("northern");
    expect(nationsChampionshipHemisphereForTeam("New Zealand")).toBe("southern");
    expect(nationsChampionshipHemisphereForTeam("Barbarians")).toBeNull();
  });
});
