import type { BioRefreshTrigger } from "./player-bio-types";
import { queuePlayerBioRefresh } from "./player-bio-automation-service";

export async function triggerPlayerBioRefresh(input: {
  playerId: string;
  trigger: BioRefreshTrigger;
  force?: boolean;
}) {
  try {
    return await queuePlayerBioRefresh(input);
  } catch (error) {
    console.warn(`Player bio refresh skipped for ${input.playerId}:`, error);
    return { queued: false, reason: "Bio refresh failed" };
  }
}
