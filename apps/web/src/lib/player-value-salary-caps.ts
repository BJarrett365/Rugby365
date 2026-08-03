/**
 * Club salary-cap reference (informational — not player valuation inputs).
 * Figures are approximate and change by season; label as such in UI/docs.
 */

export type ClubSalaryCapRow = {
  competitionKey: string;
  competitionName: string;
  /** Display string, e.g. "£6.4m" or "No league-wide cap". */
  salaryCapLabel: string;
  notes: string;
  /** Soft strength multiplier used by player-value club factor (0–1). */
  strengthHint: number;
};

export const CLUB_SALARY_CAPS: ClubSalaryCapRow[] = [
  {
    competitionKey: "premiership",
    competitionName: "Premiership Rugby (England)",
    salaryCapLabel: "£6.4m",
    notes: "Plus various credits and one excluded (marquee) player.",
    strengthHint: 0.85,
  },
  {
    competitionKey: "top-14",
    competitionName: "Top 14 (France)",
    salaryCapLabel: "€11m (2026)",
    notes: "Highest-spending league in the world. Planned to rise gradually.",
    strengthHint: 1,
  },
  {
    competitionKey: "united-rugby-championship",
    competitionName: "United Rugby Championship",
    salaryCapLabel: "No league-wide cap",
    notes: "Each union sets its own budget and player contracts.",
    strengthHint: 0.75,
  },
  {
    competitionKey: "super-rugby-pacific",
    competitionName: "Super Rugby Pacific",
    salaryCapLabel: "Varies by union",
    notes: "Budgets controlled by national unions rather than a single competition cap.",
    strengthHint: 0.7,
  },
];

/** Domains allowed for optional media corroboration of value signals. */
export const PLAYER_VALUE_REPUTABLE_DOMAINS = [
  "bbc.co.uk",
  "bbc.com",
  "skysports.com",
  "theguardian.com",
  "telegraph.co.uk",
  "independent.co.uk",
  "rugbypass.com",
  "planetrugby.com",
  "espn.com",
  "espn.co.uk",
  "lequipe.fr",
  "rugbyrama.fr",
  "midday.co.za",
  "news24.com",
  "irishtimes.com",
  "rte.ie",
  "walesonline.co.uk",
  "scottishrugby.org",
  "englandrugby.com",
  "premiershiprugby.com",
  "epcrugby.com",
  "unitedrugby.com",
] as const;

export function isReputablePlayerValueUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return PLAYER_VALUE_REPUTABLE_DOMAINS.some(
      (d) => host === d || host.endsWith(`.${d}`),
    );
  } catch {
    return false;
  }
}
