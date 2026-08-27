import { describe, expect, it } from "vitest";
import {
  isCoachRole,
  parseHeightMetresToCm,
  parseInternationalTotalsFromBio,
  parseUltimateRugbyBirthDate,
  parseUltimateRugbyCareerHtml,
  parseUltimateRugbyPlayerHtml,
  parseUltimateRugbySquadHtml,
  parseWeightKg,
  parseYearsLabel,
  ultimateRugbyExternalId,
  ultimateRugbySlugCandidates,
} from "./ultimate-rugby-parse";

const SQUAD_SNIPPET = `
<div class="flip-container">
	<div class="flipper">
		<div class="front">
			<img src="/images/entities/x/Kurt-LeeArendseSouthAfrica.jpg" alt="Kurt-Lee Arendse South Africa"></img>
			<h4>Kurt-Lee<br/>Arendse</h4>
		</div>
		<div class="back">
			<b>Left Wing</b>
			<ul class="list-unstyled">
				<li>May 6, 1999</li>
				<li>1.80m</li>
				<li>83kg</li>
			</ul>
			<a class="btn btn-primary" href="/kurt-lee-arendse">Bio</a>
		</div>
	</div>
</div>
<div class="flip-container">
	<div class="flipper">
		<div class="front"><h4>Rassie<br/>Erasmus</h4></div>
		<div class="back">
			<b>Head Coach</b>
			<ul class="list-unstyled"><li>Nov 5, 1972</li></ul>
			<a class="btn btn-primary" href="/rassie-erasmus">Bio</a>
		</div>
	</div>
</div>
`;

const PLAYER_SNIPPET = `
<meta property="og:title" content="Kurt-Lee Arendse"/>
<meta property="og:description" content="Kurt-Lee Arendse, born on 06 May 1999, is a talented South African rugby player …"/>
<meta property="og:image" content="https://www.ultimaterugby.com/images/entities/x/Kurt-Lee.jpg"/>
<meta property="al:ios:url" content="ultimaterugby://player/14830"/>
<div class="profile-detail">
  <h1 itemprop="name">Kurt-Lee Arendse<span class="pull-right"></span></h1>
  <div class="detail">
    <span>6th May 1999</span>
    <span>1.80m/83kg</span>
    <span itemprop="title">Left Wing</span>
  </div>
</div>
<p>Short news blurb about another match that should be ignored because it is unrelated filler text for the page.</p>
<p>Kurt-Lee Arendse, born on 06 May 1999, is a talented South African rugby player who represents both the South Africa National Team, known as the Springboks, and the Bulls in the United Rugby Championship. He is primarily positioned as a wing or fullback.</p>
<h4>Career</h4>
<table class="table box-border">
  <tbody>
    <tr>
      <td></td>
      <td><b><a href="/south-africa">South Africa</a></b><br/><span class="text-muted">Left Wing</span></td>
      <td>2022 - present</td>
    </tr>
    <tr>
      <td></td>
      <td><b><a href="/bulls">Bulls</a></b><br/><span class="text-muted">Left Wing</span></td>
      <td>2020 - 2026</td>
    </tr>
  </tbody>
</table>
`;

describe("ultimate-rugby-parse", () => {
  it("parses squad flip cards and flags coaches", () => {
    const cards = parseUltimateRugbySquadHtml(SQUAD_SNIPPET);
    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({
      name: "Kurt-Lee Arendse",
      position: "Left Wing",
      path: "/kurt-lee-arendse",
      isCoach: false,
      heightM: 1.8,
      weightKg: 83,
    });
    expect(cards[1]?.isCoach).toBe(true);
    expect(isCoachRole("Assistant Coach")).toBe(true);
  });

  it("parses player bio page fields including career", () => {
    const profile = parseUltimateRugbyPlayerHtml(PLAYER_SNIPPET, "/kurt-lee-arendse");
    expect(profile.name).toBe("Kurt-Lee Arendse");
    expect(profile.ultimateRugbyPlayerId).toBe("14830");
    expect(profile.externalProviderId).toBe(ultimateRugbyExternalId("14830"));
    expect(profile.birthDate).toBe("1999-05-06");
    expect(profile.heightCm).toBe(180);
    expect(profile.weightKg).toBe(83);
    expect(profile.positionName).toBe("Left Wing");
    expect(profile.bioSummary).toContain("Springboks");
    expect(profile.bioSummary).not.toContain("…");
    expect(profile.careerStints).toHaveLength(2);
    expect(profile.careerStints[0]).toMatchObject({
      teamName: "South Africa",
      careerType: "international",
      startYear: 2022,
      endYear: null,
    });
    expect(profile.careerStints[1]).toMatchObject({
      teamName: "Bulls",
      careerType: "club",
      startYear: 2020,
      endYear: 2026,
    });
  });

  it("parses height/weight/date helpers and caps from bio", () => {
    expect(parseHeightMetresToCm("1.80m/83kg")).toBe(180);
    expect(parseWeightKg("1.80m/83kg")).toBe(83);
    expect(parseUltimateRugbyBirthDate("6th May 1999")).toBe("1999-05-06");
    expect(parseYearsLabel("2004 - 2016")).toEqual({
      yearsLabel: "2004 - 2016",
      startYear: 2004,
      endYear: 2016,
    });
    expect(
      parseInternationalTotalsFromBio(
        "Habana retires having amassed 124 test caps for the Springboks, scoring 67 tries.",
      ),
    ).toEqual({ caps: 124, tries: 67, points: null });
    expect(ultimateRugbySlugCandidates("Lood de Jager")).toContain("lodewyk-de-jager");
  });

  it("parses career html alone", () => {
    const stints = parseUltimateRugbyCareerHtml(PLAYER_SNIPPET);
    expect(stints.map((s) => s.teamName)).toEqual(["South Africa", "Bulls"]);
  });
});
