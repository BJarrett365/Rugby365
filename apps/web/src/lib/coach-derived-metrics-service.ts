/**
 * Derived coach metrics — re-exports selection stability + player development.
 */

export type { CoachSelectionStability } from "./coach-selection-stability-service";
export { getCoachSelectionStability } from "./coach-selection-stability-service";

export {
  getCoachPlayerDevelopment,
  getCoachPlayerDevelopmentBundle,
  type CoachPlayerDevelopmentBundle,
  type CoachPlayerDevelopmentRow,
} from "./coach-player-development-service";

/** @deprecated Prefer CoachPlayerDevelopmentBundle */
export type CoachPlayerDevelopment = Awaited<
  ReturnType<typeof import("./coach-player-development-service").getCoachPlayerDevelopment>
>;
