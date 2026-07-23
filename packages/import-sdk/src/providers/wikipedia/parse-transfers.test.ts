import { describe, expect, it } from "vitest";
import {
  flattenPremiershipTransfers,
  normalizePremiershipTransferWikitext,
  parsePremiershipTransferDocument,
  parsePremiershipTransferWikitext,
} from "./parse-transfers";

const SAMPLE = `
## Bath

### Players in

- Dan du Preez from Sale Sharks
- Jamie Bhatti from Glasgow Warriors

### Players out

- Thomas du Toit to Sharks
- Mikey Summerfield(released)
- Tomas Gwilliam(promoted from Academy)
- Alfie Barbeary to Saracens
`;

describe("parsePremiershipTransferDocument", () => {
  it("parses club sections with in/out transfers", () => {
    const doc = parsePremiershipTransferDocument(SAMPLE);
    expect(doc.clubs).toHaveLength(1);
    expect(doc.clubs[0]!.clubName).toBe("Bath");
    expect(doc.clubs[0]!.playersIn).toHaveLength(2);
    expect(doc.clubs[0]!.playersOut).toHaveLength(4);
  });

  it("detects movement types from suffixes", () => {
    const doc = parsePremiershipTransferDocument(SAMPLE);
    const out = doc.clubs[0]!.playersOut;
    expect(out.find((t) => t.playerName === "Mikey Summerfield")?.movementType).toBe("released");
    expect(out.find((t) => t.playerName === "Tomas Gwilliam")?.movementType).toBe("academy_promotion");
  });

  it("assigns from/to clubs correctly", () => {
    const doc = parsePremiershipTransferDocument(SAMPLE);
    const duPreez = doc.clubs[0]!.playersIn.find((t) => t.playerName === "Dan du Preez");
    expect(duPreez?.fromClub).toBe("Sale Sharks");
    expect(duPreez?.toClub).toBe("Bath");
    const duToit = doc.clubs[0]!.playersOut.find((t) => t.playerName === "Thomas du Toit");
    expect(duToit?.fromClub).toBe("Bath");
    expect(duToit?.toClub).toBe("Sharks");
  });

  it("skips duplicate import keys", () => {
    const dup = `${SAMPLE}\n## Bath\n### Players in\n- Dan du Preez from Sale Sharks`;
    const flat = flattenPremiershipTransfers(parsePremiershipTransferDocument(dup));
    expect(flat.filter((t) => t.playerName === "Dan du Preez")).toHaveLength(1);
  });

  it("collapses the same move listed as In and Out under different clubs", () => {
    const dual = `
## Bath
### Players in
- Dan du Preez from Sale Sharks
## Sale Sharks
### Players out
- Dan du Preez to Bath
`;
    const flat = flattenPremiershipTransfers(parsePremiershipTransferDocument(dual));
    expect(flat.filter((t) => t.playerName === "Dan du Preez")).toHaveLength(1);
  });

  it("skips no-op same-club permanent moves", () => {
    const same = `
## Bath
### Players in
- Someone from Bath
`;
    const flat = flattenPremiershipTransfers(parsePremiershipTransferDocument(same));
    expect(flat.filter((t) => t.playerName === "Someone")).toHaveLength(0);
  });

  it("builds stable import keys", () => {
    const doc = parsePremiershipTransferDocument(SAMPLE);
    const transfer = doc.clubs[0]!.playersIn[0]!;
    expect(transfer.importKey).toContain("bath");
    expect(transfer.importKey).toContain("dan-du-preez");
  });

  it("strips flagicon templates and wiki links from player names", () => {
    const wikitext = `
== Bath ==
=== Players in ===
* {{flagicon|RSA}} [[Handré Pollard]] from [[Leicester Tigers]]
=== Players out ===
* {{flagicon|ENG}} [[Ollie Lawrence]] to [[Gloucester Rugby|Gloucester]]
`;
    const doc = parsePremiershipTransferWikitext(wikitext);
    const pollard = doc.clubs[0]!.playersIn[0];
    const lawrence = doc.clubs[0]!.playersOut[0];
    expect(pollard?.playerName).toBe("Handré Pollard");
    expect(pollard?.fromClub).toBe("Leicester Tigers");
    expect(lawrence?.playerName).toBe("Ollie Lawrence");
    expect(lawrence?.toClub).toBe("Gloucester");
  });

  it("parses current Wikipedia transfer list formatting with refs and permanent markers", () => {
    const wikitext = `
== Bath ==
=== Players in ===
* {{flagicon|SCO}} Jamie Bhatti · Permanent from {{flagicon|SCO}} Glasgow Warriors<ref>{{cite web |title=Bath signing |url=https://example.com |date=17 March 2026}}</ref> (05/07/2026)
* {{flagicon|RSA}} Dan du Preez · Permanent from {{flagicon|ENG}} Sale Sharks<ref name="Dan du Preez"/> (05/07/2026)
=== Players out ===
* {{flagicon|ENG}} Harvey Cuckson to {{flagicon|WAL}} Scarlets<ref>{{Cite news|url=https://www.bbc.co.uk/sport/rugby-union/articles/ckgp825ee6jo |title=Scarlets sign lock Harvey Cuckson |date=6 May 2026}}</ref> (05/07/2026)
* {{flagicon|ENG}} Ethan Staddon · Permanent to {{flagicon|ENG}} Bristol Bears<ref name="Ethan Staddon" /> (05/07/2026)
`;
    const doc = parsePremiershipTransferWikitext(wikitext, { seasonLabel: "2026–27" });
    const bath = doc.clubs[0]!;
    expect(bath?.clubName).toBe("Bath");

    const bhatti = bath.playersIn.find((t) => t.playerName === "Jamie Bhatti");
    expect(bhatti?.fromClub).toBe("Glasgow Warriors");
    expect(bhatti?.toClub).toBe("Bath");
    expect(bhatti?.transferDate).toBe("05/07/2026");

    const duPreez = bath.playersIn.find((t) => t.playerName === "Dan du Preez");
    expect(duPreez?.fromClub).toBe("Sale Sharks");

    const cuckson = bath.playersOut.find((t) => t.playerName === "Harvey Cuckson");
    expect(cuckson?.fromClub).toBe("Bath");
    expect(cuckson?.toClub).toBe("Scarlets");

    const staddon = bath.playersOut.find((t) => t.playerName === "Ethan Staddon");
    expect(staddon?.toClub).toBe("Bristol Bears");
  });

  it("parses retired and released players with citation debris", () => {
    const wikitext = `
== Bath ==
=== Players out ===
* {{flagicon|ENG}} Joe Launchbury (retired)<ref>{{cite web |title=Launchbury retires |url=https://example.com}}</ref> (05/07/2026)
* {{flagicon|AUS}} James O'Connor (released)<ref name="OConnor">{{cite web |title=O'Connor released |url=https://example.com}}</ref> (05/07/2026)
`;
    const doc = parsePremiershipTransferWikitext(wikitext, { seasonLabel: "2026–27" });
    const out = doc.clubs[0]!.playersOut;
    expect(out.find((t) => t.playerName === "Joe Launchbury")?.movementType).toBe("retirement");
    expect(out.find((t) => t.playerName === "James O'Connor")?.movementType).toBe("released");
  });
});
