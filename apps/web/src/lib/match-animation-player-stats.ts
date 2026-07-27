/** Compact Attack / Defence / Kicking / Errors / Carries data for Match Animation. */

import type {
  SdmsMatchPlayerStats,
  SdmsPlayerStatCategory,
  SdmsPlayerStatRow,
} from "@rugby365/import-sdk";
import { rankPlayerStatRows } from "@rugby365/import-sdk";

export const ANIMATION_PLAYER_STAT_CATEGORIES = [
  "attack",
  "defend",
  "kicking",
  "errors",
  "carries",
] as const;

export type AnimationPlayerStatCategory = (typeof ANIMATION_PLAYER_STAT_CATEGORIES)[number];

export type AnimationStatChip = {
  category: AnimationPlayerStatCategory;
  categoryLabel: string;
  metric: string;
  metricLabel: string;
  value: number;
};

export type AnimationPlayerStatProfile = {
  playerId: string | null;
  playerName: string;
  teamSide: "home" | "away";
  chipsByCategory: Partial<Record<AnimationPlayerStatCategory, AnimationStatChip[]>>;
};

export type AnimationCategoryLeader = {
  category: AnimationPlayerStatCategory;
  categoryLabel: string;
  metric: string;
  metricLabel: string;
  playerId: string | null;
  playerName: string;
  value: number;
  teamSide: "home" | "away";
};

export type MatchAnimationPlayerStats = {
  players: AnimationPlayerStatProfile[];
  leaders: AnimationCategoryLeader[];
};

const CATEGORY_LABEL: Record<AnimationPlayerStatCategory, string> = {
  attack: "Attack",
  defend: "Defence",
  kicking: "Kicking",
  errors: "Errors",
  carries: "Carries",
};

/** Primary metrics shown as chips per category (match Player Stats tabs). */
const CATEGORY_METRICS: Record<
  AnimationPlayerStatCategory,
  Array<{ metric: string; label: string }>
> = {
  attack: [
    { metric: "metres", label: "Metres" },
    { metric: "defenders_beaten", label: "Def beaten" },
    { metric: "clean_breaks", label: "Breaks" },
    { metric: "try_assists", label: "Assists" },
  ],
  defend: [
    { metric: "tackles", label: "Tackles" },
    { metric: "turnovers_won", label: "TOs won" },
    { metric: "missed_tackles", label: "Missed" },
  ],
  kicking: [
    { metric: "kick_from_hand_metres", label: "Kick m" },
    { metric: "kicks_from_hand", label: "Kicks" },
    { metric: "kicks", label: "Kicks" },
  ],
  errors: [
    { metric: "handling_error", label: "Handling" },
    { metric: "bad_passes", label: "Bad pass" },
    { metric: "turnovers_conceded", label: "TOs" },
  ],
  carries: [
    { metric: "runs", label: "Runs" },
    { metric: "carries", label: "Carries" },
    { metric: "carries_metres", label: "Carry m" },
    { metric: "gain_line", label: "Gain line" },
  ],
};

/** Metric used to pick the category leader for the animation strip. */
const LEADER_METRIC: Record<AnimationPlayerStatCategory, { metric: string; label: string }> = {
  attack: { metric: "metres", label: "Metres" },
  defend: { metric: "tackles", label: "Tackles" },
  kicking: { metric: "kick_from_hand_metres", label: "Kick m" },
  errors: { metric: "handling_error", label: "Handling" },
  carries: { metric: "runs", label: "Runs" },
};

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function num(row: SdmsPlayerStatRow, metric: string): number {
  const v = Number(row[metric] ?? 0);
  return Number.isFinite(v) ? v : 0;
}

function chipsFromRow(
  category: AnimationPlayerStatCategory,
  row: SdmsPlayerStatRow,
): AnimationStatChip[] {
  const seen = new Set<string>();
  const chips: AnimationStatChip[] = [];
  for (const { metric, label } of CATEGORY_METRICS[category]) {
    if (seen.has(metric)) continue;
    seen.add(metric);
    const value = num(row, metric);
    if (value <= 0) continue;
    chips.push({
      category,
      categoryLabel: CATEGORY_LABEL[category],
      metric,
      metricLabel: label,
      value,
    });
    if (chips.length >= 3) break;
  }
  return chips;
}

function mergeProfiles(
  a: AnimationPlayerStatProfile,
  b: AnimationPlayerStatProfile,
): AnimationPlayerStatProfile {
  const chipsByCategory = { ...a.chipsByCategory };
  for (const cat of ANIMATION_PLAYER_STAT_CATEGORIES) {
    const next = b.chipsByCategory[cat];
    if (next?.length) chipsByCategory[cat] = next;
  }
  return {
    playerId: a.playerId ?? b.playerId,
    playerName: a.playerName || b.playerName,
    teamSide: a.teamSide,
    chipsByCategory,
  };
}

/** Flatten SDMS five-tab player stats into animation-friendly profiles + leaders. */
export function buildMatchAnimationPlayerStats(
  playerStats: SdmsMatchPlayerStats | null | undefined,
): MatchAnimationPlayerStats | null {
  if (!playerStats) return null;

  const byKey = new Map<string, AnimationPlayerStatProfile>();

  for (const side of ["home", "away"] as const) {
    for (const category of ANIMATION_PLAYER_STAT_CATEGORIES) {
      const rows = playerStats[side][category]?.detail_list ?? [];
      for (const row of rows) {
        const playerName = row.player_name?.trim();
        if (!playerName) continue;
        const playerId = row.player_id != null ? String(row.player_id) : null;
        const chips = chipsFromRow(category, row);
        if (chips.length === 0) continue;

        const profile: AnimationPlayerStatProfile = {
          playerId,
          playerName,
          teamSide: side,
          chipsByCategory: { [category]: chips },
        };
        const keys = [
          playerId ? `id:${playerId}` : null,
          `name:${normalizeName(playerName)}`,
        ].filter(Boolean) as string[];

        for (const key of keys) {
          const existing = byKey.get(key);
          byKey.set(key, existing ? mergeProfiles(existing, profile) : profile);
        }
      }
    }
  }

  const players = Array.from(
    new Map(
      Array.from(byKey.values()).map((p) => [
        p.playerId ? `id:${p.playerId}` : `name:${normalizeName(p.playerName)}`,
        p,
      ]),
    ).values(),
  );

  if (players.length === 0) return null;

  const leaders: AnimationCategoryLeader[] = [];
  for (const category of ANIMATION_PLAYER_STAT_CATEGORIES) {
    const homeRows = playerStats.home[category]?.detail_list ?? [];
    const awayRows = playerStats.away[category]?.detail_list ?? [];
    const sided = [
      ...homeRows.map((r) => ({ ...r, side: "home" as const })),
      ...awayRows.map((r) => ({ ...r, side: "away" as const })),
    ];

    let picked: AnimationCategoryLeader | null = null;
    for (const { metric, label } of [LEADER_METRIC[category], ...CATEGORY_METRICS[category]]) {
      const ranked = rankPlayerStatRows(sided, metric, 1);
      const top = ranked[0];
      if (!top?.player_name || top.value <= 0) continue;
      picked = {
        category,
        categoryLabel: CATEGORY_LABEL[category],
        metric,
        metricLabel: label,
        playerId: top.player_id != null ? String(top.player_id) : null,
        playerName: top.player_name,
        value: top.value,
        teamSide: (top as { side?: "home" | "away" }).side ?? "home",
      };
      break;
    }
    if (picked) leaders.push(picked);
  }

  return { players, leaders };
}

/** Map event types to the most relevant Player Stats tab. */
export function animationStatCategoryForEvent(
  eventType: string | null | undefined,
): AnimationPlayerStatCategory {
  const t = (eventType ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  if (/try|assist|break|offload|pass|metre/.test(t)) return "attack";
  if (/tackle|turnover|defend|steal|ruck/.test(t)) return "defend";
  if (/conversion|penalty|drop|kick|goal/.test(t)) return "kicking";
  if (/error|knock|forward_pass|handling|scrum_feed|knock_on/.test(t)) return "errors";
  if (/carry|run|gain/.test(t)) return "carries";
  return "attack";
}

export function findAnimationPlayerStats(
  bundle: MatchAnimationPlayerStats | null | undefined,
  playerId?: string | null,
  playerName?: string | null,
): AnimationPlayerStatProfile | null {
  if (!bundle?.players.length) return null;
  if (playerId) {
    const byId = bundle.players.find((p) => p.playerId === playerId);
    if (byId) return byId;
  }
  if (playerName?.trim()) {
    const key = normalizeName(playerName);
    return bundle.players.find((p) => normalizeName(p.playerName) === key) ?? null;
  }
  return null;
}

/** Contextual chips for the active animation player (prefer event category). */
export function resolveAnimationPlayerStatChips(input: {
  bundle: MatchAnimationPlayerStats | null | undefined;
  playerId?: string | null;
  playerName?: string | null;
  eventType?: string | null;
  limit?: number;
}): AnimationStatChip[] {
  const profile = findAnimationPlayerStats(input.bundle, input.playerId, input.playerName);
  if (!profile) return [];

  const preferred = animationStatCategoryForEvent(input.eventType);
  const order: AnimationPlayerStatCategory[] = [
    preferred,
    ...ANIMATION_PLAYER_STAT_CATEGORIES.filter((c) => c !== preferred),
  ];

  const chips: AnimationStatChip[] = [];
  for (const cat of order) {
    for (const chip of profile.chipsByCategory[cat] ?? []) {
      chips.push(chip);
      if (chips.length >= (input.limit ?? 4)) return chips;
    }
  }
  return chips;
}

export function animationCategoryLabel(category: AnimationPlayerStatCategory): string {
  return CATEGORY_LABEL[category];
}
