import { describe, expect, it } from "vitest";
import { firstClubFromWikiValue, parseRwcSquadClubs } from "./rwc-squad-club-parse";
import { indexSquadPlayerNames, matchSquadPlayerIds } from "./rwc-squad-player-match";

describe("firstClubFromWikiValue", () => {
  it("takes the franchise before a provincial union", () => {
    expect(
      firstClubFromWikiValue("[[Hurricanes]] / [[Wellington Rugby Football Union|Wellington]]"),
    ).toBe("Hurricanes");
  });

  it("uses the Wikipedia page title for piped club links", () => {
    expect(firstClubFromWikiValue("[[Leicester Tigers|Leicester]]")).toBe("Leicester Tigers");
  });

  it("drops Wikipedia disambiguators from club page titles", () => {
    expect(firstClubFromWikiValue("[[Ospreys (rugby union)|Ospreys]]")).toBe("Ospreys");
    expect(firstClubFromWikiValue("[[Cardiff RFC|Cardiff]]")).toBe("Cardiff RFC");
  });

  it("reads {{Rut|Club}} templates used on later World Cup squad pages", () => {
    expect(firstClubFromWikiValue("{{Rut|Mie Honda Heat|fb=y}}")).toBe("Mie Honda Heat");
    expect(firstClubFromWikiValue("{{Rut|SC Albi}}")).toBe("SC Albi");
  });
});

describe("parseRwcSquadClubs", () => {
  it("reads {{nat rs player}} club rows from early World Cups", () => {
    const wikitext = `
===Australia===
{{nat rs player|pos=FH|name={{sortname|Michael|Lynagh}}|caps=16|club=[[University of Queensland Rugby Club|University of Queensland]] / [[Queensland Reds|Queensland]]|clubnat=AUS}}
===England===
{{nat rs player|pos=N8|name={{sortname|Dean|Richards|dab=rugby union}}|caps=3|club=[[Leicester Tigers|Leicester]]|clubnat=ENG}}
`;
    expect(parseRwcSquadClubs(wikitext)).toEqual([
      { playerName: "Michael Lynagh", clubName: "University of Queensland Rugby Club", countryName: "Australia" },
      { playerName: "Dean Richards", clubName: "Leicester Tigers", countryName: "England" },
    ]);
  });

  it("reads wikitable Club/province columns from later World Cups", () => {
    const wikitext = `
===Georgia===
{| class="wikitable sortable"
! Player !! Position !! Caps !! Club/province
|-
| {{sortname|Davit|Niniashvili}} || Fullback || 23 || [[Lyon OU|Lyon]]
|-
| {{sortname|Liam|Williams|dab=rugby union}} || Fullback || 100 || [[Saracens]]
|}
`;
    expect(parseRwcSquadClubs(wikitext)).toEqual([
      { playerName: "Davit Niniashvili", clubName: "Lyon OU", countryName: "Georgia" },
      { playerName: "Liam Williams", clubName: "Saracens", countryName: "Georgia" },
    ]);
  });

  it("keeps Franco Mostert's Honda Heat club from a Rut template", () => {
    const wikitext = `
===South Africa===
{{nat rs player|pos=LK|name={{sortname|Franco|Mostert}}|caps=67|club={{Rut|Mie Honda Heat|fb=y}}}}
`;
    expect(parseRwcSquadClubs(wikitext)).toEqual([
      { playerName: "Franco Mostert", clubName: "Mie Honda Heat", countryName: "South Africa" },
    ]);
  });
});

describe("matchSquadPlayerIds", () => {
  it("matches Franco Mostert to Francois Mostert and folds Médard", () => {
    const index = indexSquadPlayerNames([
      { id: "mostert", name: "Francois Mostert" },
      { id: "medard", name: "Maxime Medard" },
    ]);
    expect(matchSquadPlayerIds("Franco Mostert", index)).toEqual(["mostert"]);
    expect(matchSquadPlayerIds("Maxime Médard", index)).toEqual(["medard"]);
  });
});
