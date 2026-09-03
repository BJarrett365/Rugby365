import { describe, expect, it } from "vitest";
import {
  isRugbyUnionPlayerTitle,
  prioritizePlayerArticleTitles,
  rugbyUnionPlayerTitle,
} from "./search-player";

describe("rugbyUnionPlayerTitle", () => {
  it("builds the standard disambiguation title", () => {
    expect(rugbyUnionPlayerTitle("Archie White")).toBe("Archie White (rugby union)");
    expect(rugbyUnionPlayerTitle("Alan O'Connor")).toBe("Alan O'Connor (rugby union)");
  });
});

describe("prioritizePlayerArticleTitles", () => {
  it("prefers exact rugby union titles over bare names", () => {
    const ordered = prioritizePlayerArticleTitles(
      ["Archie White", "Archie White (rugby union)", "Archibald White"],
      "Archie White",
    );
    expect(ordered[0]).toBe("Archie White (rugby union)");
    expect(ordered[1]).toBe("Archie White");
  });

  it("ranks other rugby union name matches above unrelated pages", () => {
    const ordered = prioritizePlayerArticleTitles(
      ["Northampton Saints", "Alex Mitchell (rugby union)", "Alex Mitchell"],
      "Alex Mitchell",
    );
    expect(ordered[0]).toBe("Alex Mitchell (rugby union)");
    expect(ordered).not.toContain("Northampton Saints");
  });
});

describe("isRugbyUnionPlayerTitle", () => {
  it("detects rugby union disambiguation suffix", () => {
    expect(isRugbyUnionPlayerTitle("Alan O'Connor (rugby union)")).toBe(true);
    expect(isRugbyUnionPlayerTitle("Alan O'Connor")).toBe(false);
  });
});
