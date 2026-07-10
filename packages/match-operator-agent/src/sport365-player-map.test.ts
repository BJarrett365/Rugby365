import { describe, expect, it } from "vitest";
import {
  buildLineupPlayerLookup,
  buildPlayerRegistryFromEvents,
  enrichEventPayloadsFromMatchEvents,
  formatMappedPlayerLabel,
  resolveLineupPlayer,
  resolvePlayerFromMatchData,
} from "./sport365-player-map";
import type { Sport365Lineups } from "./sport365-lineups";

const lineups: Sport365Lineups = {
  home: {
    teamName: "South Africa",
    starting: [
      { providerId: "2-953899", name: "Edwill van der Merwe", jerseyNumber: 11 },
      { providerId: "2-717514", name: "Cheslin Kolbe", jerseyNumber: 14 },
    ],
    substitutes: [{ providerId: "2-1666227", name: "Zachary Porthen", jerseyNumber: 18 }],
  },
  away: {
    teamName: "Barbarians",
    starting: [{ providerId: "2-319446", name: "Virimi Vakatawa", jerseyNumber: 13 }],
    substitutes: [],
  },
};

describe("sport365 player map", () => {
  it("resolves incident player by Sport365 provider id from lineups", () => {
    const mapped = resolveLineupPlayer(lineups, {
      playerProviderId: "2-953899",
      playerName: "Edwill van der Merwe",
      teamPos: 0,
    });
    expect(mapped).toMatchObject({
      name: "Edwill van der Merwe",
      jerseyNumber: 11,
      providerId: "2-953899",
      positionName: "wing",
      lineupMatched: true,
      mappedFrom: "lineup",
    });
    expect(formatMappedPlayerLabel(mapped!)).toBe("#11 Edwill van der Merwe");
  });

  it("falls back to name match within team when id missing", () => {
    const mapped = resolveLineupPlayer(lineups, {
      playerName: "Cheslin Kolbe",
      teamPos: 0,
    });
    expect(mapped?.jerseyNumber).toBe(14);
    expect(mapped?.lineupMatched).toBe(true);
  });

  it("builds lookup across both squads", () => {
    const lookup = buildLineupPlayerLookup(lineups);
    expect(lookup.get("2-319446")?.jerseyNumber).toBe(13);
    expect(lookup.size).toBe(4);
  });

  it("prefers match event registry before lineups", () => {
    const registry = buildPlayerRegistryFromEvents([
      {
        teamPos: 0,
        payload: {
          player: "Edwill van der Merwe",
          player_provider_id: "2-953899",
          player_jersey: 11,
          mapped_from: "match_events",
        },
      },
    ]);

    const mapped = resolvePlayerFromMatchData(
      { playerName: "Edwill van der Merwe", teamPos: 0 },
      registry,
      lineups,
    );

    expect(mapped?.jerseyNumber).toBe(11);
    expect(mapped?.mappedFrom).toBe("match_events");
  });

  it("enriches later events from earlier match events with provider ids", () => {
    const updates = enrichEventPayloadsFromMatchEvents(
      [
        {
          id: "e1",
          teamPos: 0,
          payload: {
            player: "Edwill van der Merwe",
            player_provider_id: "2-953899",
          },
        },
        {
          id: "e2",
          teamPos: 0,
          payload: {
            player: "Edwill van der Merwe",
          },
        },
      ],
      lineups,
    );

    expect(updates.get("e1")?.player_jersey).toBe(11);
    expect(updates.get("e2")?.player_jersey).toBe(11);
    expect(updates.get("e2")?.player_provider_id).toBe("2-953899");
    expect(updates.get("e2")?.mapped_from).toBe("match_events");
  });

  it("enriches Wales try scorer with international position and club", () => {
    const walesLineups: Sport365Lineups = {
      home: { teamName: "Barbarians", starting: [], substitutes: [] },
      away: {
        teamName: "Wales",
        starting: [
          {
            providerId: "2-1303759",
            name: "Dan Edwards",
            jerseyNumber: 10,
            positionName: "fly-half",
            clubName: "Ospreys",
            countryName: "Wales",
          },
        ],
        substitutes: [],
      },
    };

    const updates = enrichEventPayloadsFromMatchEvents(
      [
        {
          id: "try-23",
          teamPos: 1,
          payload: {
            player: "Dan Edwards",
            player_provider_id: "2-1303759",
          },
        },
      ],
      walesLineups,
    );

    expect(updates.get("try-23")).toMatchObject({
      player: "Dan Edwards",
      player_position: "fly-half",
      player_club: "Ospreys",
      player_role: " (fly-half, Ospreys)",
    });
  });
});
