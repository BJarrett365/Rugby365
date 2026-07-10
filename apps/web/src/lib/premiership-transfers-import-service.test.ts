import { describe, expect, it } from "vitest";
import { parsePremiershipTransferWikitext } from "@rugby365/import-sdk";

const WIKITEXT = `
== Bath ==

=== Players in ===
* [[Dan du Preez]] from [[Sale Sharks]]
* [[Jamie Bhatti]] from [[Glasgow Warriors]]

=== Players out ===
* [[Thomas du Toit]] to [[Sharks (rugby union)|Sharks]]
* [[Mikey Summerfield]](released)
`;

describe("parsePremiershipTransferWikitext", () => {
  it("parses wikitext club transfer lists", () => {
    const doc = parsePremiershipTransferWikitext(WIKITEXT);
    expect(doc.clubs[0]?.clubName).toBe("Bath");
    expect(doc.clubs[0]?.playersIn).toHaveLength(2);
    expect(doc.clubs[0]?.playersOut).toHaveLength(2);
  });
});

describe("import idempotency keys", () => {
  it("produces stable import keys for the same transfer", () => {
    const doc = parsePremiershipTransferWikitext(WIKITEXT);
    const first = doc.clubs[0]?.playersIn[0]?.importKey;
    const again = parsePremiershipTransferWikitext(WIKITEXT).clubs[0]?.playersIn[0]?.importKey;
    expect(first).toBe(again);
  });
});
