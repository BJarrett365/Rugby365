import { describe, expect, it } from "vitest";
import {
  buildVenueResolver,
  primaryFixtureVenueLabel,
} from "./venue-fixture-resolve-service";

const CMS_VENUES = [
  {
    id: "twickenham-id",
    name: "Twickenham Stadium",
    slug: "twickenham-stadium",
    city: "London",
    countryName: "England",
    teamId: null,
  },
  {
    id: "sandy-park-id",
    name: "Sandy Park",
    slug: "sandy-park",
    city: "Exeter",
    countryName: "England",
    teamId: "exeter-id",
  },
  {
    id: "sydney-id",
    name: "Sydney Football Stadium",
    slug: "sydney-football-stadium",
    city: "Sydney",
    countryName: "Australia",
    teamId: null,
  },
  {
    id: "sky-stadium-id",
    name: "Sky Stadium",
    slug: "sky-stadium",
    city: "Wellington",
    countryName: "New Zealand",
    teamId: "nz-id",
  },
];

describe("venue-fixture-resolve-service", () => {
  it("uses the primary label before city suffixes", () => {
    expect(primaryFixtureVenueLabel("Allianz Stadium, Sydney")).toBe("Allianz Stadium");
  });

  it("maps sponsor venue labels via aliases", () => {
    const resolver = buildVenueResolver(CMS_VENUES);
    const match = resolver.resolveFixtureVenue({ venueName: "Allianz Stadium, Sydney" });
    expect(match?.venue.id).toBe("sydney-id");
    expect(match?.method).toBe("alias");
  });

  it("maps home team grounds when fixture has no venue label", () => {
    const resolver = buildVenueResolver(CMS_VENUES);
    const match = resolver.resolveFixtureVenue({ homeTeamId: "exeter-id" });
    expect(match?.venue.id).toBe("sandy-park-id");
    expect(match?.method).toBe("home_team_ground");
  });

  it("matches exact CMS venue names", () => {
    const resolver = buildVenueResolver(CMS_VENUES);
    const match = resolver.resolveFixtureVenue({ venueName: "Twickenham Stadium" });
    expect(match?.venue.id).toBe("twickenham-id");
    expect(match?.method).toBe("exact");
  });

  it("maps Hnry Stadium to Sky Stadium", () => {
    const resolver = buildVenueResolver(CMS_VENUES);
    const match = resolver.resolveFixtureVenue({ venueName: "Hnry Stadium", homeTeamId: "nz-id" });
    expect(match?.venue.id).toBe("sky-stadium-id");
    expect(["alias", "home_team_ground"]).toContain(match?.method);
  });
});
