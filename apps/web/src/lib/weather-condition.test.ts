import { describe, expect, it } from "vitest";
import {
  resolveWeatherCondition,
  weatherConditionFromCode,
  weatherConditionFromText,
} from "./weather-condition";

describe("weatherConditionFromCode", () => {
  it("maps clear and cloudy codes", () => {
    expect(weatherConditionFromCode(0).kind).toBe("clear");
    expect(weatherConditionFromCode(2).kind).toBe("partly_cloudy");
    expect(weatherConditionFromCode(3).kind).toBe("cloudy");
  });

  it("maps precip and storm codes", () => {
    expect(weatherConditionFromCode(61).kind).toBe("rain");
    expect(weatherConditionFromCode(71).kind).toBe("snow");
    expect(weatherConditionFromCode(95).kind).toBe("thunder");
    expect(weatherConditionFromCode(45).kind).toBe("fog");
  });
});

describe("weatherConditionFromText", () => {
  it("infers from CMS notes", () => {
    expect(weatherConditionFromText("Sunny spells").kind).toBe("clear");
    expect(weatherConditionFromText("Heavy rain expected").kind).toBe("rain");
    expect(weatherConditionFromText("Light fog").kind).toBe("fog");
  });
});

describe("resolveWeatherCondition", () => {
  it("prefers WMO code over text", () => {
    expect(
      resolveWeatherCondition({ weatherCode: 0, summary: "Heavy rain" }).kind,
    ).toBe("clear");
  });
});
