import { describe, expect, it } from "vitest";
import {
  TRC_2012_SPRINGBOK_RANKINGS_PLAYERS,
  trc2012RankingsPlayerKeys,
} from "./trc-2012-springboks-rankings-players";

describe("2012 Rugby Championship rankings Springboks", () => {
  it("covers the five incomplete Top 50 profiles", () => {
    expect(trc2012RankingsPlayerKeys()).toEqual([
      "ruan-pienaar",
      "francois-hougaard",
      "tendai-mtawarira",
      "jaco-taute",
      "andries-bekker",
    ]);
  });

  it("does not treat unused squad selection as an appearance", () => {
    const bekker = TRC_2012_SPRINGBOK_RANKINGS_PLAYERS["andries-bekker"].trc2012;
    expect(bekker.appearances).toBe(5);
    expect(bekker.unusedSquadMatches).toBe(1);
    expect(bekker.starts + bekker.benchAppearances).toBe(bekker.appearances);
  });

  it("credits only verified 2012 Rugby Championship match involvement", () => {
    expect(TRC_2012_SPRINGBOK_RANKINGS_PLAYERS["ruan-pienaar"].trc2012).toMatchObject({
      appearances: 6,
      starts: 4,
      benchAppearances: 2,
      points: 6,
      conversions: 3,
    });
    expect(TRC_2012_SPRINGBOK_RANKINGS_PLAYERS["francois-hougaard"].trc2012).toMatchObject({
      appearances: 6,
      starts: 6,
      points: 0,
    });
    expect(TRC_2012_SPRINGBOK_RANKINGS_PLAYERS["tendai-mtawarira"].trc2012).toMatchObject({
      appearances: 6,
      starts: 6,
      points: 0,
    });
    expect(TRC_2012_SPRINGBOK_RANKINGS_PLAYERS["jaco-taute"].trc2012).toMatchObject({
      appearances: 2,
      starts: 2,
      points: 0,
    });
  });

  it("keeps the rankings URL slugs as canonical records", () => {
    expect(TRC_2012_SPRINGBOK_RANKINGS_PLAYERS["ruan-pienaar"].canonicalSlug).toBe("ruan-pienaar-10574");
    expect(TRC_2012_SPRINGBOK_RANKINGS_PLAYERS["francois-hougaard"].canonicalSlug).toBe(
      "francois-hougaard-x91ng0jw__legacy__2f59ab8f",
    );
    expect(TRC_2012_SPRINGBOK_RANKINGS_PLAYERS["tendai-mtawarira"].canonicalSlug).toBe(
      "tendai-mtawarira-10521",
    );
    expect(TRC_2012_SPRINGBOK_RANKINGS_PLAYERS["jaco-taute"].canonicalSlug).toBe("jaco-taute");
    expect(TRC_2012_SPRINGBOK_RANKINGS_PLAYERS["andries-bekker"].canonicalSlug).toBe("andries-bekker");
  });

  it("does not invent preferred-foot or 2012 tries that are not on the match sheets", () => {
    for (const key of trc2012RankingsPlayerKeys()) {
      expect(TRC_2012_SPRINGBOK_RANKINGS_PLAYERS[key].trc2012.tries).toBe(0);
    }
  });

  it("uses Wikipedia infobox height/weight for Taute rather than an unverified alternate", () => {
    expect(TRC_2012_SPRINGBOK_RANKINGS_PLAYERS["jaco-taute"]).toMatchObject({
      fullName: "Jacob Johannes Taute",
      heightCm: 191,
      weightKg: 108,
    });
  });

  it("does not claim an unverified 2026 club for Hougaard", () => {
    expect(TRC_2012_SPRINGBOK_RANKINGS_PLAYERS["francois-hougaard"].clubName).toBe("");
    expect(TRC_2012_SPRINGBOK_RANKINGS_PLAYERS["francois-hougaard"].careerStatus).toBe("released");
  });

  it("leaves Pienaar Test tries unavailable when Wikipedia only publishes points", () => {
    expect(TRC_2012_SPRINGBOK_RANKINGS_PLAYERS["ruan-pienaar"].tries).toBeNull();
    expect(TRC_2012_SPRINGBOK_RANKINGS_PLAYERS["ruan-pienaar"].points).toBe(135);
  });
});
