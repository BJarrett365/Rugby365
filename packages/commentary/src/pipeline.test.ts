import { describe, it, expect } from "vitest";
import { runCommentaryPipeline } from "./pipeline";

describe("runCommentaryPipeline", () => {
  const rules = [
    {
      id: "1",
      name: "phase",
      conditions: { event_type: "phase_milestone", zone: "opposition_22", phase_gte: 5 },
      templateKeys: ["phase_pressure_opp22_a", "phase_pressure_opp22_b", "phase_pressure_opp22_c", "phase_pressure_opp22_d"],
      maxSuggestions: 4,
      outputType: "phase_play_update",
    },
  ];
  const templates = [
    { templateKey: "phase_pressure_opp22_a", body: "{minute}' {team} keep the pressure on inside the {opponent} 22.", outputType: "phase_play_update" },
    { templateKey: "phase_pressure_opp22_b", body: "{minute}' {phase_count} phases now from {team} as they look for a gap.", outputType: "phase_play_update" },
    { templateKey: "phase_pressure_opp22_c", body: "{minute}' The {opponent} defence is being made to work hard here.", outputType: "phase_play_update" },
    { templateKey: "phase_pressure_opp22_d", body: "{minute}' {team} recycle again and stay on the front foot.", outputType: "phase_play_update" },
  ];

  it("produces 4 suggestions for phase 7 in opp 22", () => {
    const result = runCommentaryPipeline(
      {
        eventType: "phase_milestone",
        minute: 23,
        payload: { zone: "opposition_22", phase: 7, possession_retained: true },
        teamName: "South Africa",
        opponentName: "Barbarians",
      },
      { homeTeam: "South Africa", awayTeam: "Barbarians", homeScore: 12, awayScore: 7, phaseCount: 7 },
      rules,
      templates,
    );
    expect(result?.renderedOptions).toHaveLength(4);
    expect(result?.renderedOptions[0]).toContain("South Africa keep the pressure");
    expect(result?.renderedOptions[1]).toContain("7 phases");
  });
});
