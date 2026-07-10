import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildSport365MatchUrl,
  isSport365CompetitionUrl,
  isSport365MatchUrl,
  parseSport365CompetitionUrl,
  parseSport365ListMatch,
} from "./sport365-competition";

const __dirname = dirname(fileURLToPath(import.meta.url));
const stageFixture = JSON.parse(
  readFileSync(join(__dirname, "fixtures/international-men-stage.json"), "utf8"),
) as { matches: unknown[] };

describe("sport365 competition parse", () => {
  it("parses competition/stage URLs", () => {
    const parsed = parseSport365CompetitionUrl(
      "https://www.sport365.com/rugby-union/international/men#/",
    );
    expect(parsed.categoryCode).toBe("international");
    expect(parsed.stageCode).toBe("men");
    expect(parsed.sportPath).toBe("rugby-union");
  });

  it("distinguishes competition URLs from single-match URLs", () => {
    const tournament = "https://www.sport365.com/rugby-union/international/men#/";
    const match =
      "https://www.sport365.com/rugby-union/international/men/south-africa-vs-barbarians/1-4307586";
    expect(isSport365CompetitionUrl(tournament)).toBe(true);
    expect(isSport365MatchUrl(tournament)).toBe(false);
    expect(isSport365MatchUrl(match)).toBe(true);
    expect(isSport365CompetitionUrl(match)).toBe(false);
  });

  it("maps stage list rows to match previews", () => {
    const row = stageFixture.matches[0] as Record<string, unknown>;
    const match = parseSport365ListMatch(row);
    expect(match).not.toBeNull();
    expect(match!.matchId).toBe("1-4307586");
    expect(match!.homeTeam).toBe("South Africa");
    expect(match!.awayTeam).toBe("Barbarians");
    expect(match!.homeScore).toBe(80);
    expect(match!.sourceUrl).toContain("south-africa-vs-barbarians");
    expect(buildSport365MatchUrl(row as never)).toBe(match!.sourceUrl);
  });
});
