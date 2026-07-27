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

/** Map CMS match_events (including Sub On/Off payload.type) into public key events. */
export function mapCmsEventsToPublicKeyEvents(rows: CmsMatchEventRow[]): PublicKeyEvent[] {
  const mapped: PublicKeyEvent[] = rows.map((row) => {
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    const payloadType = typeof payload.type === "string" ? payload.type : row.eventType;
    const player =
      (typeof payload.player === "string" && payload.player) ||
      (typeof payload.playerName === "string" && payload.playerName) ||
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
      home_score: typeof payload.home_score === "number" ? payload.home_score : null,
      away_score: typeof payload.away_score === "number" ? payload.away_score : null,
    };
  });

  return pairSubstitutionKeyEvents(mapped);
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
  return pairSubstitutionKeyEvents(
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
  );
}
