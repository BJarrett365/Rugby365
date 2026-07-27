import { describe, expect, it } from "vitest";
import { soundCueForSignalKind } from "./match-animation-audio";

describe("soundCueForSignalKind", () => {
  it("maps try and conversion signals", () => {
    expect(soundCueForSignalKind("try_awarded")).toBe("try");
    expect(soundCueForSignalKind("conversion_awarded")).toBe("conversion");
    expect(soundCueForSignalKind("conversion_missed")).toBe("conversion_miss");
    expect(soundCueForSignalKind("scrum_awarded")).toBeNull();
  });
});
