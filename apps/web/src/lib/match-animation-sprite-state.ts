export type RugbySpriteState =
  | "idle"
  | "run"
  | "kick"
  | "celebrate"
  | "goal"
  | "miss"
  | "walk"
  | "sent-off"
  | "clap-off"
  | "jog-on"
  | "booked";

function norm(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function shirtSurname(playerName: string | null | undefined): string {
  const parts = (playerName ?? "").trim().split(/\s+/).filter(Boolean);
  const last = parts[parts.length - 1] ?? "";
  return last.slice(0, 10).toUpperCase();
}

export function resolveRugbySpriteState(input: {
  eventType?: string | null;
  signalKind?: string | null;
  conversionFlight?: "idle" | "kicking" | "success" | "miss" | null;
  frontGoalView?: string | null;
}): RugbySpriteState {
  const t = `${norm(input.eventType)} ${norm(input.signalKind)} ${norm(input.frontGoalView)}`;
  const flight = input.conversionFlight;

  if (t.includes("red") && (t.includes("card") || t.includes("send"))) return "sent-off";
  if (t.includes("yellow") || t.includes("sin_bin") || t.includes("book")) return "booked";
  if (t.includes("sub") || t.includes("replacement")) return "clap-off";
  // End-of-half / whistle markers — stand still, don't keep running.
  if (
    t.includes("full_time") ||
    t.includes("half_time") ||
    t.includes("half_end") ||
    t.includes("second_half_end") ||
    t.includes("first_half_end") ||
    (t.includes("end") && (t.includes("half") || t.includes("match")))
  ) {
    return "idle";
  }
  if (t.includes("try")) return "goal";
  if (flight === "miss" || t.includes("conversion_miss") || t.includes("missed")) return "miss";
  if (flight === "kicking" || t.includes("conversion") || t.includes("penalty") || t.includes("drop")) {
    return flight === "success" ? "celebrate" : "kick";
  }
  if (t.includes("kick")) return "kick";
  if (t.includes("lineout") || t.includes("scrum") || t.includes("maul") || t.includes("ruck")) return "idle";
  return "run";
}
