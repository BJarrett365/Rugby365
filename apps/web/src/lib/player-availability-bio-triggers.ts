import type { BioRefreshTrigger } from "./player-bio-types";

export function resolveAvailabilityBioTrigger(input: {
  kind: "injury" | "suspension";
  previousStatus?: string | null;
  nextStatus: string;
  expectedReturnDateChanged?: boolean;
}): BioRefreshTrigger | null {
  if (input.kind === "injury") {
    if (!input.previousStatus && ["injured", "long_term_injury"].includes(input.nextStatus)) {
      return "injury_confirmed";
    }
    if (input.expectedReturnDateChanged) return "injury_return_updated";
    if (input.nextStatus === "return_to_training") return "player_returned_to_training";
    if (input.nextStatus === "returned" || input.nextStatus === "available") {
      return "player_returned_to_selection";
    }
    return null;
  }

  if (
    ["suspended", "serving_suspension"].includes(input.nextStatus) &&
    input.previousStatus !== input.nextStatus
  ) {
    return "suspension_began";
  }
  if (["available_again", "overturned"].includes(input.nextStatus)) {
    return "suspension_ended";
  }
  return null;
}

export async function queueAvailabilityBioRefresh(input: {
  playerId: string;
  trigger: BioRefreshTrigger;
}) {
  const { triggerPlayerBioRefresh } = await import("./player-bio-trigger");
  return triggerPlayerBioRefresh({ playerId: input.playerId, trigger: input.trigger, force: true });
}
