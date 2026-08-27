import { describe, expect, it } from "vitest";
import {
  isSpringboksSeniorMensMatch,
  normalizeSpringboksTeamName,
  parseSpringboksMatchCentreHtml,
  parseSpringboksSquadHtml,
} from "./springboks-rugby-parse";

const SAMPLE = String.raw`prefix{\"matchId\":\"2827f5d4-1e5c-4c89-a5be-80ab66140690\",\"competitionId\":\"1a2ee9ff-821f-48eb-93ad-68c6a817149a\",\"seasonName\":\"2026\",\"competitionName\":\"Castle Double Malt Rugby's Greatest Rivalry\",\"venueName\":\"10bet Ellis Park\",\"roundNumber\":4,\"roundName\":\"1st Test\",\"utcDate\":\"2026-08-22T15:10:00\",\"isCancelled\":false,\"isPostponed\":false,\"isLive\":false,\"teams\":[{\"teamId\":\"e976cfc2-f80b-4c1a-8472-838cd54f0fbc\",\"isHomeTeam\":true,\"score\":null,\"name\":\"Springboks\",\"imagePath\":\"https://example.com/sa.png\"},{\"teamId\":\"nz-id\",\"isHomeTeam\":false,\"score\":null,\"name\":\"New Zealand\",\"imagePath\":null}],\"referees\":[]}suffix`;

const SQUAD_SAMPLE = `
{"firstName":"Siya","lastName":"Kolisi","position":"Openside Flanker","playerId":"abc-123","image":"https://media-cdn.cortextech.io/1WWmqT/head.webp","slug":"siya-kolisi"}
{"firstName":"Sacha","lastName":"Feinberg-Mngomezulu","position":"Flyhalf","playerId":"def-456","image":"https://media-cdn.cortextech.io/1WWmqT/sacha.webp","slug":"sacha-feinberg-mngomezulu"}
`;

describe("springboks-rugby-parse", () => {
  it("parses embedded match-centre fixtures", () => {
    const rows = parseSpringboksMatchCentreHtml(SAMPLE);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.matchId).toBe("2827f5d4-1e5c-4c89-a5be-80ab66140690");
    expect(rows[0]?.utcDate).toBe("2026-08-22T15:10:00Z");
    expect(rows[0]?.homeTeam?.name).toBe("Springboks");
    expect(rows[0]?.awayTeam?.name).toBe("New Zealand");
    expect(rows[0]?.venueName).toBe("10bet Ellis Park");
    expect(isSpringboksSeniorMensMatch(rows[0]!)).toBe(true);
  });

  it("normalizes Springboks to South Africa", () => {
    expect(normalizeSpringboksTeamName("Springboks")).toBe("South Africa");
    expect(normalizeSpringboksTeamName("All Blacks")).toBe("New Zealand");
  });

  it("parses official squad cards with images", () => {
    const cards = parseSpringboksSquadHtml(SQUAD_SAMPLE);
    expect(cards).toHaveLength(2);
    expect(cards.find((c) => c.slug === "siya-kolisi")?.name).toBe("Siya Kolisi");
    expect(cards.find((c) => c.slug === "sacha-feinberg-mngomezulu")?.imageUrl).toContain(
      "cortextech.io",
    );
  });
});
