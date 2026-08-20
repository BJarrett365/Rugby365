import { describe, expect, it } from "vitest";
import {
  buildSdmsEventId,
  sdmsEventTypeToMatchEvent,
  sdmsKeyEventPayload,
} from "./sdms-events";

describe("sdms-events", () => {
  it("maps conversion and penalty goal types", () => {
    expect(sdmsEventTypeToMatchEvent("Conversion")).toBe("conversion");
    expect(sdmsEventTypeToMatchEvent("Penalty")).toBe("penalty_goal");
    expect(sdmsEventTypeToMatchEvent("Missed Conversion")).toBe("conversion_missed");
    expect(sdmsEventTypeToMatchEvent("Missed Penalty")).toBe("penalty_missed");
    expect(sdmsEventTypeToMatchEvent("Missed Drop Goal")).toBe("drop_goal_missed");
  });

  it("builds stable ids that include player and minute, not only array index", () => {
    const event = {
      type: "Conversion",
      minute: 14,
      second: 0,
      player_id: "m98g2346",
      player_name: "Moyo Simphiwe Vusi",
      team_id: "sa",
    };
    const id = buildSdmsEventId(event, "o6gdywy6", 7);
    expect(id).toBe("o6gdywy6:conversion:14:0:m98g2346:sa:7");
    expect(id).not.toBe("o6gdywy6:7");
  });

  it("stores the stable id on the payload", () => {
    const payload = sdmsKeyEventPayload(
      {
        type: "Conversion",
        minute: 41,
        player_id: "m98g2346",
        team_id: "sa",
      },
      "o6gdywy6",
      12,
    );
    expect(payload.sdms_event_id).toContain(":conversion:41:");
    expect(payload.player_provider_id).toBe("m98g2346");
  });
});
