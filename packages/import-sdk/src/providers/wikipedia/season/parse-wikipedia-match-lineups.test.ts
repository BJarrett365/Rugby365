import { describe, expect, it } from "vitest";
import { parseWikipediaChampionshipMatchLineups } from "./parse-wikipedia-match-lineups";

const SAMPLE = `
{{Rugbybox
|date=18 August 2012
|home={{ru-rt|AUS}}
|score=19 – 27
|away={{ru|NZL}}
|try1=Ashley-Cooper
|try2=Savea
}}

{| style="width:92%"
|-
|{{Football kit
 |title = Australia
}}
|{{Football kit
 |title = New Zealand
}}
|}

{| style="width:100%"
|-
|style="vertical-align:top; width:50%;"|
{| style="font-size: 100%" cellspacing="0" cellpadding="0"
|-
|FB ||'''15'''||[[Kurtley Beale]]
|-
|RW ||'''14'''||[[Adam Ashley-Cooper]]
|-
|OC ||'''13'''||[[Rob Horne]]
|-
|IC ||'''12'''||[[Anthony Fainga'a]]
|-
|LW ||'''11'''||[[Digby Ioane]]
|-
|FH ||'''10'''||[[Berrick Barnes]]
|-
|SH ||'''9''' ||[[Will Genia]]
|-
|N8 ||'''8''' ||[[Scott Higginbotham]]
|-
|OF ||'''7''' ||[[David Pocock]]
|-
|BF ||'''6''' ||[[Dave Dennis (rugby union)|Dave Dennis]] || || {{suboff|64}}
|-
|RL ||'''5''' ||[[Nathan Sharpe]]
|-
|LL ||'''4''' ||[[Sitaleki Timani]]
|-
|TP ||'''3''' ||[[Sekope Kepu]]
|-
|HK ||'''2''' ||[[Tatafu Polota-Nau]] || || {{suboff|59}}
|-
|LP ||'''1''' ||[[Benn Robinson]]
|-
|colspan=3|'''Substitutes:'''
|-
|HK ||'''16'''||[[Stephen Moore (rugby union)|Stephen Moore]] || || {{subon|59}}
|-
|PR ||'''17'''||[[James Slipper]]
|-
|colspan="3"|'''Coach:'''
|-
|colspan="4"|{{flagicon|NZL}} [[Robbie Deans]]
|}
|style="vertical-align:top; width:50%;"|
{| cellspacing="0" cellpadding="0" style="font-size:100%; margin:auto;"
|-
|FB ||'''15'''||[[Israel Dagg]]
|-
|RW ||'''14'''||[[Cory Jane]]
|-
|OC ||'''13'''||[[Ma'a Nonu]]
|-
|IC ||'''12'''||[[Sonny Bill Williams]]
|-
|LW ||'''11'''||[[Hosea Gear]]
|-
|FH ||'''10'''||[[Dan Carter]]
|-
|SH ||'''9''' ||[[Aaron Smith (rugby union)|Aaron Smith]]
|-
|N8 ||'''8''' ||[[Kieran Read]]
|-
|OF ||'''7''' ||[[Richie McCaw]]
|-
|BF ||'''6''' ||[[Liam Messam]]
|-
|RL ||'''5''' ||[[Sam Whitelock]]
|-
|LL ||'''4''' ||[[Luke Romano]]
|-
|TP ||'''3''' ||[[Owen Franks]]
|-
|HK ||'''2''' ||[[Keven Mealamu]]
|-
|LP ||'''1''' ||[[Tony Woodcock]]
|-
|colspan=3|'''Substitutes:'''
|-
|HK ||'''16'''||[[Andrew Hore]]
|-
|colspan="3"|'''Coach:'''
|-
|colspan="4"|{{flagicon|NZL}} [[Steve Hansen]]
|}
`;

describe("parseWikipediaChampionshipMatchLineups", () => {
  it("parses 2012-style Wikipedia teamsheets with jerseys and sub minutes", () => {
    const matches = parseWikipediaChampionshipMatchLineups(SAMPLE);
    expect(matches).toHaveLength(1);
    const match = matches[0]!;
    expect(match.homeTeam).toBe("Australia");
    expect(match.awayTeam).toBe("New Zealand");
    expect(match.home.players.find((p) => p.jerseyNumber === 15)?.playerLabel).toBe("Kurtley Beale");
    expect(match.away.players.find((p) => p.jerseyNumber === 15)?.playerLabel).toBe("Israel Dagg");
    expect(match.home.players.find((p) => p.jerseyNumber === 2)?.minutesPlayed).toBe(59);
    expect(match.home.players.find((p) => p.jerseyNumber === 16)?.minutesPlayed).toBe(21);
    expect(match.home.players.find((p) => p.jerseyNumber === 17)?.minutesPlayed).toBe(0);
    expect(match.home.coachName).toBe("Robbie Deans");
  });
});
