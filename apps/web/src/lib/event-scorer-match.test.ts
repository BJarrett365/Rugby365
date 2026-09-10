import { describe, expect, it } from "vitest";
import {
  collapseScorerCandidates,
  eventPayloadPlayerName,
  isPenaltyTryLabel,
  matchScorerToCandidates,
  normalizeScorerKey,
  type ScorerCandidate,
} from "./event-scorer-match";

function cand(name: string, extras: Partial<ScorerCandidate> = {}): ScorerCandidate {
  return {
    id: extras.id ?? name,
    name,
    slug: extras.slug ?? name.toLowerCase().replace(/\s+/g, "-"),
    imageUrl: extras.imageUrl ?? null,
  };
}

describe("normalizeScorerKey", () => {
  it("strips accents, apostrophes, and initials punctuation", () => {
    expect(normalizeScorerKey("Mo'unga")).toBe("mounga");
    expect(normalizeScorerKey("J. Barrett")).toBe("j barrett");
    expect(normalizeScorerKey("Juan Martín González")).toBe("juan martin gonzalez");
  });
});

describe("isPenaltyTryLabel", () => {
  it("ignores team penalty tries", () => {
    expect(isPenaltyTryLabel("Penalty try")).toBe(true);
    expect(isPenaltyTryLabel("Pollard")).toBe(false);
  });
});

describe("eventPayloadPlayerName", () => {
  it("reads Wikipedia box-score playerName", () => {
    expect(eventPayloadPlayerName({ playerName: "Arendse" })).toBe("Arendse");
    expect(eventPayloadPlayerName({ player: { name: "Pollard" } })).toBe("Pollard");
  });
});

describe("matchScorerToCandidates", () => {
  const allBlacks = [
    cand("Richie Mo'unga"),
    cand("Richie Mounga"),
    cand("Jordie Barrett"),
    cand("Beauden Barrett"),
    cand("Scott Barrett"),
    cand("Will Jordan"),
    cand("Samisoni Taukei'aho"),
    cand("Akira Ioane"),
    cand("Rieko Ioane"),
  ];

  it("matches surname-only labels when unique on the team", () => {
    expect(matchScorerToCandidates("Pollard", [cand("Handré Pollard"), cand("Siya Kolisi")])?.name).toBe(
      "Handré Pollard",
    );
    expect(matchScorerToCandidates("Mo'unga", allBlacks)?.name).toBe("Richie Mo'unga");
    expect(matchScorerToCandidates("Jordan", allBlacks)?.name).toBe("Will Jordan");
  });

  it("matches initial + surname for Barrett brothers", () => {
    expect(matchScorerToCandidates("J. Barrett", allBlacks)?.name).toBe("Jordie Barrett");
    expect(matchScorerToCandidates("B. Barrett", allBlacks)?.name).toBe("Beauden Barrett");
    expect(matchScorerToCandidates("S. Barrett", allBlacks)?.name).toBe("Scott Barrett");
  });

  it("does not guess when several internationals share a surname", () => {
    expect(matchScorerToCandidates("Ioane", allBlacks)).toBeNull();
    expect(
      matchScorerToCandidates("Foley", [cand("Bernard Foley"), cand("Michael Foley")]),
    ).toBeNull();
  });

  it("skips penalty tries", () => {
    expect(matchScorerToCandidates("Penalty try", allBlacks)).toBeNull();
  });

  it("prefers the apostrophe / image record when collapsing duplicates", () => {
    const collapsed = collapseScorerCandidates([
      cand("Richie Mounga", { id: "plain" }),
      cand("Richie Mo'unga", { id: "apo", imageUrl: "https://img/mo.png" }),
    ]);
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0]?.id).toBe("apo");
  });
});
