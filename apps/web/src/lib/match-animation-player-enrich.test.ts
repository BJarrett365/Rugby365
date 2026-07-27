import { describe, expect, it } from "vitest";
import {
  enrichAnimationEventPlayers,
  formatTimelinePlayerLine,
} from "./match-animation-player-enrich";

describe("enrichAnimationEventPlayers", () => {
  const squad = [
    {
      playerId: "p1",
      name: "Siya Kolisi",
      jerseyNumber: 6,
      imageUrl: "https://example.com/siya.jpg",
      teamId: "t1",
      externalProviderId: "ext-1",
    },
    {
      playerId: "p2",
      name: "Handre Pollard",
      jerseyNumber: 10,
      imageUrl: null,
      teamId: "t1",
      externalProviderId: "ext-2",
    },
  ];

  it("attaches jersey and image by player id", () => {
    const [enriched] = enrichAnimationEventPlayers(
      [
        {
          label: "try",
          eventType: "try",
          playerId: "p1",
          playerName: "Siya Kolisi",
        },
      ],
      squad,
    );
    expect(enriched?.jerseyNumber).toBe(6);
    expect(enriched?.imageUrl).toContain("siya");
    expect(enriched?.label).toMatch(/#6 Siya Kolisi/);
  });

  it("resolves by external provider id and name", () => {
    const [byExt] = enrichAnimationEventPlayers(
      [{ label: "penalty", eventType: "penalty", playerId: "ext-2", playerName: null }],
      squad,
    );
    expect(byExt?.playerName).toBe("Handre Pollard");
    expect(byExt?.jerseyNumber).toBe(10);

    const [byName] = enrichAnimationEventPlayers(
      [{ label: "try", eventType: "try", playerName: "siya kolisi" }],
      squad,
    );
    expect(byName?.jerseyNumber).toBe(6);
  });

  it("formats substitution labels with on/off players", () => {
    const [sub] = enrichAnimationEventPlayers(
      [
        {
          label: "substitution",
          eventType: "substitution",
          playerOff: "Siya Kolisi",
          playerOn: "Handre Pollard",
        },
      ],
      squad,
    );
    expect(sub?.label).toMatch(/Off #6 Siya Kolisi/);
    expect(sub?.label).toMatch(/On #10 Handre Pollard/);
    expect(sub?.playerOffJersey).toBe(6);
    expect(sub?.playerOnJersey).toBe(10);
  });
});

describe("formatTimelinePlayerLine", () => {
  it("prefers jersey + name", () => {
    expect(
      formatTimelinePlayerLine({
        playerName: "Bloggs",
        jerseyNumber: 7,
        fallbackLabel: "try — Bloggs",
      }),
    ).toBe("#7 Bloggs");
  });

  it("includes jersey numbers on substitutions", () => {
    expect(
      formatTimelinePlayerLine({
        playerOff: "Kolisi",
        playerOffJersey: 6,
        playerOn: "Pollard",
        playerOnJersey: 10,
        fallbackLabel: "substitution",
      }),
    ).toBe("Off #6 Kolisi · On #10 Pollard");
  });
});
