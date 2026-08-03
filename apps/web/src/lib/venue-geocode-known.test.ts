import { describe, expect, it } from "vitest";
import {
  knownVenueCoordsNeedRepair,
  lookupKnownVenueGeo,
} from "./venue-geocode-known";

describe("lookupKnownVenueGeo", () => {
  it("resolves NZ sponsor stadium names", () => {
    expect(lookupKnownVenueGeo("Navigation Homes Stadium")?.city).toBe("Pukekohe");
    expect(lookupKnownVenueGeo("Apollo Projects Stadium")?.city).toBe("Christchurch");
    expect(lookupKnownVenueGeo("North Harbour Stadium")?.countryCode).toBe("NZ");
  });
});

describe("knownVenueCoordsNeedRepair", () => {
  it("repairs missing coords and wrong-country geocodes", () => {
    const known = lookupKnownVenueGeo("North Harbour Stadium")!;
    expect(
      knownVenueCoordsNeedRepair(known, {
        latitude: null,
        longitude: null,
      }),
    ).toBe(true);
    expect(
      knownVenueCoordsNeedRepair(known, {
        latitude: 47.15067,
        longitude: -53.66455,
        countryCode: "CA",
      }),
    ).toBe(true);
    expect(
      knownVenueCoordsNeedRepair(known, {
        latitude: known.latitude,
        longitude: known.longitude,
        countryCode: "NZ",
      }),
    ).toBe(false);
  });
});
