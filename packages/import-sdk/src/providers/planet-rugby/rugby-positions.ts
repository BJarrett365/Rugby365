/** Standard rugby union jersey → position (international convention). */
export function jerseyToPositionName(jerseyNumber: number): string {
  if (jerseyNumber >= 16) return "replacement";
  const map: Record<number, string> = {
    1: "loosehead prop",
    2: "hooker",
    3: "tighthead prop",
    4: "lock",
    5: "lock",
    6: "blindside flanker",
    7: "openside flanker",
    8: "number eight",
    9: "scrum-half",
    10: "fly-half",
    11: "wing",
    12: "inside centre",
    13: "outside centre",
    14: "wing",
    15: "fullback",
  };
  return map[jerseyNumber] ?? "replacement";
}
