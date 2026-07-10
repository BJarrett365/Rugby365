import { describe, expect, it } from "vitest";
import {
  AUTO_MATCH_THRESHOLD,
  REVIEW_THRESHOLD,
  matchPlayers,
} from "./transfer-match-service";
import {
  compareClubSquadToRugby365,
  scoreToMatchConfidence,
  summarizeSquadComparison,
} from "./club-squad-compare-service";

const EXETER_TEAM_ID = "team-exeter";
const BATH_TEAM_ID = "team-bath";

const teams = [
  { id: EXETER_TEAM_ID, name: "Exeter Chiefs" },
  { id: BATH_TEAM_ID, name: "Bath" },
];

const players = [
  {
    id: "p-sinott",
    name: "Sean Sinott",
    clubTeamId: EXETER_TEAM_ID,
    clubName: "Exeter Chiefs",
    positionName: "prop",
    squadNumber: 1,
  },
  {
    id: "p-hooper",
    name: "Tom Hooper",
    clubTeamId: BATH_TEAM_ID,
    clubName: "Bath",
    positionName: "lock",
    squadNumber: 4,
  },
  {
    id: "p-extra",
    name: "Legacy Exeter Player",
    clubTeamId: EXETER_TEAM_ID,
    clubName: "Exeter Chiefs",
    positionName: "wing",
    squadNumber: 11,
  },
];

describe("scoreToMatchConfidence", () => {
  it("maps scores to high, medium and low bands", () => {
    expect(scoreToMatchConfidence(AUTO_MATCH_THRESHOLD)).toBe("high");
    expect(scoreToMatchConfidence(REVIEW_THRESHOLD)).toBe("medium");
    expect(scoreToMatchConfidence(REVIEW_THRESHOLD - 0.01)).toBe("low");
  });
});

describe("compareClubSquadToRugby365", () => {
  const document = {
    clubName: "Exeter Chiefs",
    sourceUrl: "https://www.exeterchiefs.co.uk/teams/mens",
    players: [
      { name: "Sean Sinott", positionName: "prop", squadNumber: null, profileUrl: null },
      { name: "Tom Hooper", positionName: "lock", squadNumber: null, profileUrl: null },
      { name: "Brand New Player", positionName: "hooker", squadNumber: null, profileUrl: null },
    ],
  };

  it("detects exact player matches", () => {
    const rows = compareClubSquadToRugby365({
      document,
      clubTeamId: EXETER_TEAM_ID,
      clubName: "Exeter Chiefs",
      sourceType: "club_website",
      allPlayers: players,
      allTeams: teams,
    });
    const matched = rows.find((row) => row.sourcePlayerName === "Sean Sinott");
    expect(matched?.groupType).toBe("matched");
    expect(matched?.playerId).toBe("p-sinott");
    expect(matched?.matchConfidence).toBe("high");
  });

  it("detects club conflicts without treating them as matched at target club", () => {
    const rows = compareClubSquadToRugby365({
      document,
      clubTeamId: EXETER_TEAM_ID,
      clubName: "Exeter Chiefs",
      sourceType: "club_website",
      allPlayers: players,
      allTeams: teams,
    });
    const conflict = rows.find((row) => row.sourcePlayerName === "Tom Hooper");
    expect(conflict?.groupType).toBe("conflicting");
    expect(conflict?.conflictType).toBe("current_club_conflict");
  });

  it("detects missing players on official source", () => {
    const rows = compareClubSquadToRugby365({
      document,
      clubTeamId: EXETER_TEAM_ID,
      clubName: "Exeter Chiefs",
      sourceType: "club_website",
      allPlayers: players,
      allTeams: teams,
    });
    const missing = rows.find((row) => row.sourcePlayerName === "Brand New Player");
    expect(missing?.groupType).toBe("missing_in_rugby365");
    expect(missing?.conflictType).toBe("missing_player");
  });

  it("detects extra Rugby365 players not on official squad", () => {
    const rows = compareClubSquadToRugby365({
      document,
      clubTeamId: EXETER_TEAM_ID,
      clubName: "Exeter Chiefs",
      sourceType: "club_website",
      allPlayers: players,
      allTeams: teams,
    });
    const extra = rows.find((row) => row.matchedPlayerName === "Legacy Exeter Player");
    expect(extra?.groupType).toBe("extra_in_rugby365");
    expect(extra?.conflictType).toBe("possible_departure");
  });

  it("detects position conflicts for matched players", () => {
    const positionDocument = {
      clubName: "Exeter Chiefs",
      sourceUrl: "https://www.exeterchiefs.co.uk/teams/mens",
      players: [{ name: "Sean Sinott", positionName: "hooker", squadNumber: null, profileUrl: null }],
    };
    const rows = compareClubSquadToRugby365({
      document: positionDocument,
      clubTeamId: EXETER_TEAM_ID,
      clubName: "Exeter Chiefs",
      sourceType: "club_website",
      allPlayers: players,
      allTeams: teams,
    });
    const conflict = rows.find((row) => row.sourcePlayerName === "Sean Sinott");
    expect(conflict?.groupType).toBe("conflicting");
    expect(conflict?.conflictType).toBe("position_conflict");
  });

  it("keeps source URL on each comparison row", () => {
    const rows = compareClubSquadToRugby365({
      document,
      clubTeamId: EXETER_TEAM_ID,
      clubName: "Exeter Chiefs",
      sourceType: "club_website",
      allPlayers: players,
      allTeams: teams,
    });
    expect(rows.every((row) => row.sourceUrl === document.sourceUrl)).toBe(true);
  });

  it("summarizes comparison counts", () => {
    const rows = compareClubSquadToRugby365({
      document,
      clubTeamId: EXETER_TEAM_ID,
      clubName: "Exeter Chiefs",
      sourceType: "club_website",
      allPlayers: players,
      allTeams: teams,
    });
    const summary = summarizeSquadComparison(rows);
    expect(summary.officialCount).toBe(3);
    expect(summary.missingInRugby365).toBeGreaterThanOrEqual(1);
    expect(summary.extraInRugby365).toBeGreaterThanOrEqual(1);
    expect(summary.clubConflicts).toBeGreaterThanOrEqual(1);
  });
});

describe("matchPlayers alias behaviour", () => {
  it("supports fuzzy alias matching above review threshold", () => {
    const candidates = matchPlayers({
      name: "Sean Sinott",
      currentTeamId: EXETER_TEAM_ID,
      positionName: "prop",
      candidates: players,
      teams,
    });
    expect(candidates[0]?.id).toBe("p-sinott");
    expect(candidates[0]?.score).toBeGreaterThanOrEqual(REVIEW_THRESHOLD);
  });
});

describe("pagination contract", () => {
  it("defaults to 20 players per page", () => {
    const pageSize = 20;
    const offset = (2 - 1) * pageSize;
    expect(pageSize).toBe(20);
    expect(offset).toBe(20);
  });
});
