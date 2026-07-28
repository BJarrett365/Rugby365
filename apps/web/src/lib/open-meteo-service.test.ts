import { describe, expect, it } from "vitest";
import {
  buildVenueGeocodeQuery,
  countryNameToIsoCode,
  pickBestGeocodeResult,
  windDegreesToCompass,
} from "./open-meteo-service";

describe("countryNameToIsoCode", () => {
  it("maps rugby nations", () => {
    expect(countryNameToIsoCode("England")).toBe("GB");
    expect(countryNameToIsoCode("Wales")).toBe("GB");
    expect(countryNameToIsoCode("Ireland")).toBe("IE");
    expect(countryNameToIsoCode("South Africa")).toBe("ZA");
    expect(countryNameToIsoCode("New Zealand")).toBe("NZ");
  });

  it("passes through ISO codes", () => {
    expect(countryNameToIsoCode("fr")).toBe("FR");
  });
});

describe("windDegreesToCompass", () => {
  it("maps cardinals", () => {
    expect(windDegreesToCompass(0)).toBe("N");
    expect(windDegreesToCompass(90)).toBe("E");
    expect(windDegreesToCompass(180)).toBe("S");
    expect(windDegreesToCompass(270)).toBe("W");
  });
});

describe("buildVenueGeocodeQuery", () => {
  it("joins name, city, country", () => {
    expect(
      buildVenueGeocodeQuery({
        name: "Twickenham Stadium",
        city: "London",
        countryName: "England",
      }),
    ).toBe("Twickenham Stadium, London, England");
  });
});

describe("pickBestGeocodeResult", () => {
  it("prefers name token overlap", () => {
    const best = pickBestGeocodeResult("Twickenham Stadium", [
      { id: 1, name: "London", latitude: 51.5, longitude: -0.1 },
      { id: 2, name: "Twickenham", latitude: 51.45, longitude: -0.34 },
    ]);
    expect(best?.id).toBe(2);
  });
});
