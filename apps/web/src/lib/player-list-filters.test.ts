import { describe, expect, it } from "vitest";
import {
  normalizePlayerListLetter,
  playerNameInitial,
  PLAYER_LIST_LETTERS,
} from "./player-list-filters";

describe("player-list-filters", () => {
  it("exposes A–Z plus non-alpha bucket", () => {
    expect(PLAYER_LIST_LETTERS).toContain("A");
    expect(PLAYER_LIST_LETTERS).toContain("Z");
    expect(PLAYER_LIST_LETTERS).toContain("#");
  });

  it("normalizes letter filters", () => {
    expect(normalizePlayerListLetter("s")).toBe("S");
    expect(normalizePlayerListLetter("#")).toBe("#");
    expect(normalizePlayerListLetter("")).toBeUndefined();
    expect(normalizePlayerListLetter("AB")).toBeUndefined();
  });

  it("derives player name initials", () => {
    expect(playerNameInitial("Santi Carreras")).toBe("S");
    expect(playerNameInitial("Étienne Dupont")).toBe("other");
    expect(playerNameInitial("123 Player")).toBe("other");
  });
});
