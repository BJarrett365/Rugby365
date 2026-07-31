/** Common Oddschecker bookmaker short codes → display names. */
export const ODDSCHECKER_BOOKMAKER_NAMES: Record<string, string> = {
  B3: "bet365",
  WH: "William Hill",
  UN: "Unibet",
  FR: "Betfred",
  SX: "SpreadEx",
  LD: "Ladbrokes",
  VC: "BetVictor",
  KN: "BetMGM",
  BY: "BoyleSports",
  OE: "10bet",
  S6: "StarSports",
  PUP: "PricedUp",
  SI: "Sporting Index",
  GY: "Betgoodwin",
  G5: "Betano",
  VE: "Virgin Bet",
  QN: "QuinnBet",
  WA: "betway",
  CE: "Coral",
  BAH: "BetAhoy",
  BTT: "BetTom",
  BRS: "BresBet",
  SK: "Sky Bet",
  PP: "Paddy Power",
  BF: "Betfair",
  AKB: "AK Bets",
  MA: "Matchbook",
  BTU: "BetUK",
  EP: "Everygame",
};

export function bookmakerNameForCode(code: string): string {
  return ODDSCHECKER_BOOKMAKER_NAMES[code] ?? code;
}
