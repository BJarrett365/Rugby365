/** Enrich animation events with squad player name / jersey / image. */

export type AnimationPlayerLookup = {
  playerId: string;
  name: string;
  jerseyNumber: number | null;
  imageUrl: string | null;
  teamId: string | null;
  externalProviderId: string | null;
};

export type EnrichableAnimationEvent = {
  playerId?: string | null;
  playerName?: string | null;
  playerOff?: string | null;
  playerOn?: string | null;
  playerOffJersey?: number | null;
  playerOnJersey?: number | null;
  assistPlayerName?: string | null;
  jerseyNumber?: number | null;
  imageUrl?: string | null;
  label: string;
  eventType: string;
};

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function buildPlayerLookupIndexes(players: AnimationPlayerLookup[]): {
  byId: Map<string, AnimationPlayerLookup>;
  byName: Map<string, AnimationPlayerLookup>;
  byExternalId: Map<string, AnimationPlayerLookup>;
} {
  const byId = new Map<string, AnimationPlayerLookup>();
  const byName = new Map<string, AnimationPlayerLookup>();
  const byExternalId = new Map<string, AnimationPlayerLookup>();
  for (const p of players) {
    byId.set(p.playerId, p);
    byName.set(normalizeName(p.name), p);
    if (p.externalProviderId) byExternalId.set(String(p.externalProviderId), p);
  }
  return { byId, byName, byExternalId };
}

function findByName(
  byName: Map<string, AnimationPlayerLookup>,
  name: string | null | undefined,
): AnimationPlayerLookup | null {
  if (!name?.trim()) return null;
  return byName.get(normalizeName(name)) ?? null;
}

/** Attach jersey / image / canonical name from squad lookup. */
export function enrichAnimationEventPlayers<T extends EnrichableAnimationEvent>(
  events: T[],
  players: AnimationPlayerLookup[],
): Array<T & EnrichableAnimationEvent> {
  const { byId, byName, byExternalId } = buildPlayerLookupIndexes(players);

  return events.map((ev) => {
    const byPlayerId = ev.playerId ? byId.get(ev.playerId) : null;
    const byExt = ev.playerId ? byExternalId.get(ev.playerId) : null;
    const byPlayerName = findByName(byName, ev.playerName);
    const primary = byPlayerId ?? byExt ?? byPlayerName;

    const off = findByName(byName, ev.playerOff);
    const on = findByName(byName, ev.playerOn);
    const assist = findByName(byName, ev.assistPlayerName);

    const playerName = primary?.name ?? ev.playerName ?? null;
    const jerseyNumber = primary?.jerseyNumber ?? ev.jerseyNumber ?? null;
    const imageUrl = primary?.imageUrl ?? ev.imageUrl ?? null;
    const playerOff = off?.name ?? ev.playerOff ?? null;
    const playerOn = on?.name ?? ev.playerOn ?? null;
    const playerOffJersey = off?.jerseyNumber ?? ev.playerOffJersey ?? null;
    const playerOnJersey = on?.jerseyNumber ?? ev.playerOnJersey ?? null;
    const assistPlayerName = assist?.name ?? ev.assistPlayerName ?? null;

    const typeLabel = ev.eventType.replace(/_/g, " ");
    let label = typeLabel;
    if (playerOff || playerOn) {
      const bits = [
        playerOn ? `${jerseyLabel(playerOnJersey, playerOn)} On` : null,
        playerOff ? `${jerseyLabel(playerOffJersey, playerOff)} Off` : null,
      ].filter(Boolean);
      label = `${typeLabel} — ${bits.join(" · ")}`;
    } else if (playerName) {
      label = `${typeLabel} — ${jerseyLabel(jerseyNumber, playerName)}`;
      if (assistPlayerName) label += ` (assist ${assistPlayerName})`;
    }

    return {
      ...ev,
      playerId: primary?.playerId ?? ev.playerId ?? null,
      playerName,
      playerOff,
      playerOn,
      playerOffJersey,
      playerOnJersey,
      assistPlayerName,
      jerseyNumber,
      imageUrl,
      label,
    };
  });
}

function jerseyLabel(jersey: number | null | undefined, name: string): string {
  if (jersey != null && Number.isFinite(jersey)) return `#${jersey} ${name}`;
  return name;
}

export function formatTimelinePlayerLine(input: {
  playerName?: string | null;
  jerseyNumber?: number | null;
  playerOff?: string | null;
  playerOn?: string | null;
  playerOffJersey?: number | null;
  playerOnJersey?: number | null;
  fallbackLabel: string;
}): string {
  if (input.playerOff || input.playerOn) {
    const bits = [
      input.playerOn ? `${jerseyLabel(input.playerOnJersey, input.playerOn)} On` : null,
      input.playerOff ? `${jerseyLabel(input.playerOffJersey, input.playerOff)} Off` : null,
    ].filter(Boolean);
    return bits.join(" · ") || input.fallbackLabel;
  }
  if (input.playerName) {
    return jerseyLabel(input.jerseyNumber, input.playerName);
  }
  return input.fallbackLabel;
}
