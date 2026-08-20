/** Public Key Events: rounded minutes + paired substitution On/Off. */

export type PublicKeyEvent = {
  type: string;
  minute: number;
  second?: number;
  period?: string;
  team_id?: string;
  player_id?: string;
  player_name?: string | null;
  player_on?: string | null;
  player_off?: string | null;
  player_on_id?: string | null;
  player_off_id?: string | null;
  home_score?: number | null;
  away_score?: number | null;
};

/**
 * Home-side match for Key Events / strip markers.
 * CMS rows may carry internal UUIDs while the page home id is the SDMS provider id
 * (or the reverse) — accept any known home identifier.
 */
export function isHomeSideKeyEvent(
  teamId: string | null | undefined,
  homeTeamIds: Array<string | null | undefined> | string | null | undefined,
): boolean {
  if (!teamId) return false;
  const ids = (Array.isArray(homeTeamIds) ? homeTeamIds : [homeTeamIds])
    .map((id) => (typeof id === "string" ? id.trim() : ""))
    .filter(Boolean);
  return ids.includes(teamId);
}

function countableKeyEvent(e: PublicKeyEvent): boolean {
  if (/half\s*start|half\s*end|full\s*time|kick\s*off|period/i.test(e.type) && !e.player_name) {
    return false;
  }
  return true;
}

/**
 * Prefer the richer public timeline. Sparse CMS scoring-only imports must not
 * hide a fuller SDMS feed (subs, cards, period markers).
 */
export function selectPublicKeyEvents(
  sdmsEvents: PublicKeyEvent[],
  cmsEvents: PublicKeyEvent[],
): PublicKeyEvent[] {
  if (cmsEvents.length === 0) return sdmsEvents;
  if (sdmsEvents.length === 0) return cmsEvents;

  const sdmsCount = sdmsEvents.filter(countableKeyEvent).length;
  const cmsCount = cmsEvents.filter(countableKeyEvent).length;
  if (cmsCount < Math.max(1, Math.ceil(sdmsCount * 0.6))) {
    return sdmsEvents;
  }

  const cmsMax = Math.max(0, ...cmsEvents.map((e) => Math.floor(Number(e.minute) || 0)));
  const sdmsMax = Math.max(0, ...sdmsEvents.map((e) => Math.floor(Number(e.minute) || 0)));
  return cmsMax >= sdmsMax ? cmsEvents : sdmsEvents;
}

/** Whole match minutes only — e.g. `2'` not `2'02`. */
export function formatMatchEventMinute(minute: number | null | undefined): string {
  const m = Math.max(0, Math.floor(Number(minute) || 0));
  return `${m}'`;
}

export function isSubstitutionEventType(type: string | null | undefined): boolean {
  const t = (type ?? "").toLowerCase();
  return (
    t.includes("sub") ||
    t.includes("replacement") ||
    t.includes("player on") ||
    t.includes("player off")
  );
}

export function isSubOnType(type: string | null | undefined): boolean {
  const t = (type ?? "").toLowerCase().replace(/[_-]+/g, " ");
  return (
    (t.includes("sub") && /\bon\b/.test(t) && !/\boff\b/.test(t)) ||
    t.includes("player on")
  );
}

export function isSubOffType(type: string | null | undefined): boolean {
  const t = (type ?? "").toLowerCase().replace(/[_-]+/g, " ");
  return (t.includes("sub") && /\boff\b/.test(t)) || t.includes("player off");
}

function pairKey(e: PublicKeyEvent): string {
  const team = e.team_id ?? "no-team";
  const minute = Math.floor(Number(e.minute) || 0);
  const second = Math.floor(Number(e.second) || 0);
  return `${minute}:${second}:${team}`;
}

/**
 * Merge Sub On + Sub Off at the same minute/second/team into one substitution row.
 */
export function pairSubstitutionKeyEvents(events: PublicKeyEvent[]): PublicKeyEvent[] {
  const out: PublicKeyEvent[] = [];
  const used = new Set<number>();

  const subIndexesByKey = new Map<string, number[]>();
  events.forEach((e, i) => {
    if (!isSubstitutionEventType(e.type) && !e.player_on && !e.player_off) return;
    if (!isSubstitutionEventType(e.type)) return;
    const key = pairKey(e);
    const list = subIndexesByKey.get(key) ?? [];
    list.push(i);
    subIndexesByKey.set(key, list);
  });

  for (let i = 0; i < events.length; i++) {
    if (used.has(i)) continue;
    const e = events[i]!;
    if (!isSubstitutionEventType(e.type)) {
      out.push(e);
      continue;
    }

    const group = (subIndexesByKey.get(pairKey(e)) ?? []).filter((idx) => !used.has(idx));
    if (group.length === 0) continue;

    let onEv: PublicKeyEvent | null = null;
    let offEv: PublicKeyEvent | null = null;
    for (const idx of group) {
      const row = events[idx]!;
      if (isSubOnType(row.type)) onEv = row;
      else if (isSubOffType(row.type)) offEv = row;
    }

    for (const idx of group) used.add(idx);

    if (!onEv && !offEv) {
      for (const idx of group) {
        const row = events[idx]!;
        const name = row.player_name ?? null;
        out.push({
          ...row,
          type: "substitution",
          player_name: name,
          player_on: isSubOnType(row.type) ? name : null,
          player_off: isSubOffType(row.type) ? name : null,
        });
      }
      continue;
    }

    // If only one of the pair was classified, check remaining rows in group.
    if (!onEv || !offEv) {
      for (const idx of group) {
        const row = events[idx]!;
        if (!onEv && row !== offEv) onEv = row;
        else if (!offEv && row !== onEv) offEv = row;
      }
    }

    const playerOn =
      (onEv && (isSubOnType(onEv.type) || onEv.player_on)
        ? onEv.player_on || onEv.player_name
        : null) ||
      onEv?.player_on ||
      null;
    const playerOff =
      (offEv && (isSubOffType(offEv.type) || offEv.player_off)
        ? offEv.player_off || offEv.player_name
        : null) ||
      offEv?.player_off ||
      null;

    // When group has exactly 2 and types unclear, treat first as off / second as on by jersey/role heuristics.
    let resolvedOn = playerOn;
    let resolvedOff = playerOff;
    if ((!resolvedOn || !resolvedOff) && group.length === 2) {
      const a = events[group[0]!]!;
      const b = events[group[1]!]!;
      if (isSubOnType(a.type) || isSubOffType(b.type)) {
        resolvedOn = resolvedOn || a.player_name || null;
        resolvedOff = resolvedOff || b.player_name || null;
      } else if (isSubOnType(b.type) || isSubOffType(a.type)) {
        resolvedOn = resolvedOn || b.player_name || null;
        resolvedOff = resolvedOff || a.player_name || null;
      } else {
        resolvedOn = resolvedOn || a.player_name || null;
        resolvedOff = resolvedOff || b.player_name || null;
      }
    }

    const base = onEv ?? offEv ?? e;
    out.push({
      ...base,
      type: "substitution",
      player_name: resolvedOn ?? resolvedOff,
      player_on: resolvedOn,
      player_off: resolvedOff,
      player_on_id: onEv?.player_id ?? null,
      player_off_id: offEv?.player_id ?? null,
      player_id: onEv?.player_id ?? offEv?.player_id ?? base.player_id,
    });
  }

  return out;
}

export type CmsMatchEventRow = {
  id: string;
  minute: number;
  second: number;
  eventType: string;
  teamId: string | null;
  playerId: string | null;
  payload: Record<string, unknown> | null;
};

function parseScorePair(payload: Record<string, unknown>): {
  home_score: number | null;
  away_score: number | null;
} {
  if (typeof payload.home_score === "number" || typeof payload.away_score === "number") {
    return {
      home_score: typeof payload.home_score === "number" ? payload.home_score : null,
      away_score: typeof payload.away_score === "number" ? payload.away_score : null,
    };
  }
  const raw = typeof payload.score === "string" ? payload.score.trim() : "";
  const m = /^(\d+)\s*[-–:]\s*(\d+)$/.exec(raw);
  if (!m) return { home_score: null, away_score: null };
  return { home_score: Number(m[1]), away_score: Number(m[2]) };
}

function normalizeScoringType(type: string): string | null {
  const t = type.toLowerCase().replace(/[_-]+/g, " ").trim();
  if (/\btry\b/.test(t) && !/penalty\s*try/.test(t) && !/conversion/.test(t)) return "try";
  if (/penalty\s*try/.test(t)) return "penalty_try";
  if (/conversion/.test(t)) return "conversion";
  if (/penalty/.test(t) && !/try/.test(t)) return "penalty";
  if (/drop/.test(t)) return "drop_goal";
  return null;
}

function keyEventRichness(e: PublicKeyEvent): number {
  let score = 0;
  if (e.player_name?.trim()) score += 4;
  if (e.player_on?.trim()) score += 3;
  if (e.player_off?.trim()) score += 3;
  if (e.player_id) score += 2;
  if (e.home_score != null && e.away_score != null) score += 1;
  // Prefer SDMS-style provider team ids over CMS UUIDs for home/away alignment.
  if (e.team_id && !/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(e.team_id)) score += 2;
  return score;
}

function hasScorePair(e: PublicKeyEvent): boolean {
  return e.home_score != null && e.away_score != null;
}

function preferProviderTeamId(a?: string, b?: string): string | undefined {
  if (a && !/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(a)) return a;
  if (b && !/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(b)) return b;
  return a || b;
}

function mergeKeyEventPair(existing: PublicKeyEvent, incoming: PublicKeyEvent): PublicKeyEvent {
  const preferIncoming = keyEventRichness(incoming) > keyEventRichness(existing);
  const primary = preferIncoming ? incoming : existing;
  const secondary = preferIncoming ? existing : incoming;
  return {
    ...secondary,
    ...primary,
    player_name: primary.player_name?.trim() || secondary.player_name,
    player_on: primary.player_on?.trim() || secondary.player_on,
    player_off: primary.player_off?.trim() || secondary.player_off,
    player_id: primary.player_id || secondary.player_id,
    team_id: preferProviderTeamId(primary.team_id, secondary.team_id),
    home_score: primary.home_score ?? secondary.home_score,
    away_score: primary.away_score ?? secondary.away_score,
  };
}

function playerNameTokens(name: string | null | undefined): Set<string> {
  return new Set(
    (name ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9\s']/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1),
  );
}

function playerNamesOverlap(a: PublicKeyEvent, b: PublicKeyEvent): boolean {
  const ta = playerNameTokens(a.player_name);
  const tb = playerNameTokens(b.player_name);
  if (ta.size === 0 || tb.size === 0) return false;
  for (const t of ta) if (tb.has(t)) return true;
  return false;
}

function sameTeamLoose(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  return a === b;
}

/**
 * Collapse duplicate scoring rows from dual imports (e.g. rugby_data + SDMS).
 * Merges same-minute/type rows even when only one side carries a scoreline.
 * Prefers the richer row (named player + provider team id).
 */
export function dedupePublicKeyEvents(events: PublicKeyEvent[]): PublicKeyEvent[] {
  const scoringGroups = new Map<string, PublicKeyEvent[]>();
  const nonScoring: PublicKeyEvent[] = [];
  const scoringOrder: string[] = [];

  for (const e of events) {
    const minute = Math.floor(Number(e.minute) || 0);
    const scoring = normalizeScoringType(e.type);
    if (scoring) {
      const key = `${scoring}:${minute}`;
      if (!scoringGroups.has(key)) {
        scoringGroups.set(key, []);
        scoringOrder.push(key);
      }
      scoringGroups.get(key)!.push(e);
      continue;
    }
    nonScoring.push(e);
  }

  const collapsedScoring: PublicKeyEvent[] = [];
  for (const key of scoringOrder) {
    const group = scoringGroups.get(key) ?? [];
    const byScore = new Map<string, PublicKeyEvent>();
    const open: PublicKeyEvent[] = [];

    for (const e of group) {
      if (!hasScorePair(e)) {
        open.push(e);
        continue;
      }
      const scoreKey = `${e.home_score}-${e.away_score}`;
      const existing = byScore.get(scoreKey);
      byScore.set(scoreKey, existing ? mergeKeyEventPair(existing, e) : e);
    }

    if (byScore.size === 0) {
      collapsedScoring.push(open.reduce((acc, cur) => mergeKeyEventPair(acc, cur)));
      continue;
    }

    if (byScore.size === 1) {
      let merged = [...byScore.values()][0]!;
      for (const e of open) merged = mergeKeyEventPair(merged, e);
      collapsedScoring.push(merged);
      continue;
    }

    // Distinct scorelines in the same minute (e.g. two tries) — keep one per score.
    const buckets = [...byScore.entries()];
    const unusedOpen = [...open];
    for (const [, bucket] of buckets) {
      let merged = bucket;
      for (let i = unusedOpen.length - 1; i >= 0; i--) {
        const candidate = unusedOpen[i]!;
        if (
          sameTeamLoose(merged.team_id, candidate.team_id) ||
          playerNamesOverlap(merged, candidate) ||
          (!candidate.player_name?.trim() && unusedOpen.length === 1)
        ) {
          merged = mergeKeyEventPair(merged, candidate);
          unusedOpen.splice(i, 1);
        }
      }
      collapsedScoring.push(merged);
    }
    // Orphan open rows with no score twin: keep the richest named one only if unique.
    if (unusedOpen.length > 0) {
      collapsedScoring.push(unusedOpen.reduce((acc, cur) => mergeKeyEventPair(acc, cur)));
    }
  }

  const buckets = new Map<string, PublicKeyEvent>();
  const order: string[] = [];

  for (const e of nonScoring) {
    const minute = Math.floor(Number(e.minute) || 0);
    let key: string;
    if (isSubstitutionEventType(e.type) || e.player_on || e.player_off) {
      key = `sub:${minute}:${e.player_on ?? ""}:${e.player_off ?? ""}:${e.team_id ?? ""}`;
    } else {
      key = `other:${minute}:${e.type}:${e.team_id ?? ""}:${e.player_name ?? ""}`;
    }

    const existing = buckets.get(key);
    if (!existing) {
      buckets.set(key, e);
      order.push(key);
      continue;
    }
    buckets.set(key, mergeKeyEventPair(existing, e));
  }

  // Preserve chronological order: scoring by first-seen minute groups, interleave with non-scoring by minute.
  const scored = collapsedScoring;
  const others = order.map((k) => buckets.get(k)!);
  return [...scored, ...others].sort((a, b) => {
    const am = Math.floor(Number(a.minute) || 0) - Math.floor(Number(b.minute) || 0);
    if (am !== 0) return am;
    return (Number(a.second) || 0) - (Number(b.second) || 0);
  });
}

/** Map CMS match_events (including Sub On/Off payload.type) into public key events. */
export function mapCmsEventsToPublicKeyEvents(rows: CmsMatchEventRow[]): PublicKeyEvent[] {
  const mapped: PublicKeyEvent[] = rows.map((row) => {
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    const payloadType = typeof payload.type === "string" ? payload.type : row.eventType;
    const player =
      (typeof payload.player === "string" && payload.player) ||
      (typeof payload.playerName === "string" && payload.playerName) ||
      (typeof payload.player_name === "string" && payload.player_name) ||
      (typeof payload.playerInName === "string" && payload.playerInName) ||
      (typeof payload.playerOutName === "string" && payload.playerOutName) ||
      null;
    const playerOn =
      (typeof payload.playerInName === "string" && payload.playerInName) ||
      (isSubOnType(payloadType) ? player : null);
    const playerOff =
      (typeof payload.playerOutName === "string" && payload.playerOutName) ||
      (typeof payload.player_out === "string" && payload.player_out) ||
      (isSubOffType(payloadType) ? player : null);
    const scores = parseScorePair(payload);

    return {
      type: payloadType || row.eventType,
      minute: row.minute,
      second: row.second,
      period: typeof payload.period === "string" ? payload.period : undefined,
      // Prefer SDMS provider team id so public Key Events can align with home_team_id.
      team_id:
        (typeof payload.team_provider_id === "string" && payload.team_provider_id) ||
        row.teamId ||
        undefined,
      player_id:
        (typeof payload.player_provider_id === "string" && payload.player_provider_id) ||
        row.playerId ||
        (typeof payload.player_id === "string" ? payload.player_id : undefined) ||
        undefined,
      player_name: player,
      player_on: playerOn,
      player_off: playerOff,
      home_score: scores.home_score,
      away_score: scores.away_score,
    };
  });

  return dedupePublicKeyEvents(pairSubstitutionKeyEvents(mapped));
}

export function mapSdmsEventsToPublicKeyEvents(
  events: Array<{
    type: string;
    minute: number;
    second?: number;
    period?: string;
    team_id?: string;
    player_id?: string;
    player_name?: string | null;
    home_score?: number | null;
    away_score?: number | null;
  }>,
): PublicKeyEvent[] {
  return dedupePublicKeyEvents(
    pairSubstitutionKeyEvents(
      events.map((e) => ({
        type: e.type,
        minute: e.minute,
        second: e.second,
        period: e.period,
        team_id: e.team_id,
        player_id: e.player_id,
        player_name: e.player_name ?? null,
        player_on: isSubOnType(e.type) ? e.player_name ?? null : null,
        player_off: isSubOffType(e.type) ? e.player_name ?? null : null,
        home_score: e.home_score,
        away_score: e.away_score,
      })),
    ),
  );
}
