import { describe, it, expect } from "vitest";
import { renderTemplate } from "./template-renderer";

describe("renderTemplate", () => {
  it("renders phase pressure line", () => {
    const out = renderTemplate(
      "{minute}' {team} keep the pressure on inside the {opponent} 22.",
      {
        team: "South Africa",
        opponent: "Barbarians",
        minute: 23,
        event_type: "phase_milestone",
        zone: "opposition_22",
      },
    );
    expect(out).toBe("23' South Africa keep the pressure on inside the Barbarians 22.");
  });

  it("renders player name in try template", () => {
    const out = renderTemplate("{minute}' TRY! {player} scores for {team}.", {
      team: "South Africa",
      opponent: "Barbarians",
      minute: 4,
      event_type: "try",
      player: "Edwill van der Merwe",
      player_jersey: 11,
    });
    expect(out).toBe("4' TRY! Edwill van der Merwe scores for South Africa.");
  });

  it("renders international player role in try template", () => {
    const out = renderTemplate("{minute}' TRY! {player}{player_role} scores for {team}!", {
      team: "Wales",
      opponent: "Barbarians",
      minute: 23,
      event_type: "try",
      player: "Dan Edwards",
      player_role: " (fly-half, Ospreys)",
    });
    expect(out).toBe("23' TRY! Dan Edwards (fly-half, Ospreys) scores for Wales!");
  });
});
