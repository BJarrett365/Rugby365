import { type Sport365Lineups } from "@rugby365/match-operator-agent";
import { HeadToHeadStatsSection } from "@/components/admin/HeadToHeadStatsSection";
import { buildCompetitionSlots, parseSdmsHeadToHeadRecords } from "@/lib/head-to-head-shared";

type Team = { id: string; name: string; slug: string };

type Lineups = Sport365Lineups;

type HeadToHeadMeeting = {
  matchId: string;
  date?: string;
  competition?: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: string;
};

type HeadToHead = {
  totalMeetings: number;
  homeWins: number;
  awayWins: number;
  draws: number;
  meetings: HeadToHeadMeeting[];
};

type ProviderSnapshot = {
  polledAt?: string;
  statusLabel?: string;
  statusText?: string;
  venue?: { name?: string; city?: string };
  incidentCount?: number;
  elapsedSeconds?: number;
  sourceUrl?: string;
  matchId?: string;
  lineups?: Lineups;
  sdms?: {
    headToHead?: Record<string, unknown>[];
    lastFiveMeetings?: Record<string, unknown>[];
  };
  headToHead?: HeadToHead | Record<string, unknown>[];
  lastFiveMeetings?: Record<string, unknown>[];
};

type NormalizedHeadToHead = {
  kind: "sport365" | "sdms" | "none";
  summary: {
    totalMeetings: number;
    homeWins: number;
    awayWins: number;
    draws: number;
  } | null;
  sdmsRecords: Record<string, unknown>[];
  meetings: HeadToHeadMeeting[];
};

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseSdmsMeetingRow(row: Record<string, unknown>, index: number): HeadToHeadMeeting | null {
  const homeTeam = str(row.home_team_name) ?? str(row.home_team) ?? str(row.home);
  const awayTeam = str(row.away_team_name) ?? str(row.away_team) ?? str(row.away);
  if (!homeTeam || !awayTeam) return null;
  return {
    matchId: str(row.match_id) ?? str(row.id) ?? `sdms-meeting-${index}`,
    date: str(row.date) ?? str(row.match_date) ?? str(row.kickoff_at),
    competition: str(row.competition_name) ?? str(row.competition),
    homeTeam,
    awayTeam,
    homeScore: num(row.home_score ?? row.home_team_score),
    awayScore: num(row.away_score ?? row.away_team_score),
    status: str(row.status) ?? "full_time",
  };
}

function normalizeHeadToHead(
  snap?: ProviderSnapshot | null,
  home = "Home",
  away = "Away",
): NormalizedHeadToHead {
  const raw = snap?.sdms?.headToHead ?? snap?.headToHead;
  const lastFive = snap?.sdms?.lastFiveMeetings ?? snap?.lastFiveMeetings ?? [];

  if (!raw && lastFive.length === 0) {
    return { kind: "none", summary: null, sdmsRecords: [], meetings: [] };
  }

  if (raw && !Array.isArray(raw) && typeof raw === "object") {
    const h2h = raw as Partial<HeadToHead>;
    const meetings = Array.isArray(h2h.meetings) ? h2h.meetings : [];
    return {
      kind: "sport365",
      summary: {
        totalMeetings: h2h.totalMeetings ?? meetings.length,
        homeWins: h2h.homeWins ?? 0,
        awayWins: h2h.awayWins ?? 0,
        draws: h2h.draws ?? 0,
      },
      sdmsRecords: [],
      meetings,
    };
  }

  const sdmsRecords = Array.isArray(raw) ? raw : [];
  const meetings = lastFive
    .map((row, index) => parseSdmsMeetingRow(row, index))
    .filter((row): row is HeadToHeadMeeting => row != null);

  let homeWins = 0;
  let awayWins = 0;
  let draws = 0;
  for (const meeting of meetings) {
    if (meeting.homeScore === meeting.awayScore) draws += 1;
    else if (meeting.homeTeam.toLowerCase() === home.toLowerCase()) {
      if (meeting.homeScore > meeting.awayScore) homeWins += 1;
      else awayWins += 1;
    } else if (meeting.awayTeam.toLowerCase() === home.toLowerCase()) {
      if (meeting.awayScore > meeting.homeScore) homeWins += 1;
      else awayWins += 1;
    }
  }

  return {
    kind: "sdms",
    summary:
      meetings.length > 0
        ? {
            totalMeetings: meetings.length,
            homeWins,
            awayWins,
            draws,
          }
        : null,
    sdmsRecords,
    meetings,
  };
}

type FixtureRow = {
  id?: string;
  slug: string;
  homeScore: number;
  awayScore: number;
  status: string;
  period: string;
  matchMinute: number;
  matchSecond: number;
  competitionName?: string | null;
  kickoffAt?: string | null;
  externalMatchId?: string | null;
  sport365Url?: string | null;
  venueName?: string | null;
  venueId?: string | null;
  attendance?: number | null;
  venue?: {
    id: string;
    name: string;
    city?: string | null;
    countryName?: string | null;
    capacity?: number | null;
    recordAttendance?: number | null;
  } | null;
  providerSnapshot?: ProviderSnapshot | null;
  homeTeamId?: string | null;
  awayTeamId?: string | null;
  homeTeam?: Team | null;
  awayTeam?: Team | null;
};

type EventRow = {
  id: string;
  eventType: string;
  minute: number;
  second: number;
  payload: Record<string, unknown>;
  sourceProvider?: string | null;
  teamId?: string | null;
  team?: Team | null;
};

function formatKickoff(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatVenue(venue?: { name?: string; city?: string }) {
  if (!venue) return "—";
  return [venue.name, venue.city].filter(Boolean).join(", ") || "—";
}

function formatVenueBlock(fixture: FixtureRow, snap?: ProviderSnapshot | null) {
  const venue = fixture.venue;
  const sdmsLabel = fixture.venueName?.trim();
  const canonical = venue?.name;
  let label = canonical ?? sdmsLabel ?? formatVenue(snap?.venue);
  if (sdmsLabel && canonical && sdmsLabel.toLowerCase() !== canonical.toLowerCase()) {
    label = `${sdmsLabel} (${canonical})`;
  }
  if (label === "—") return "—";
  const location = [venue?.city, venue?.countryName].filter(Boolean).join(", ");
  const capacity = venue?.capacity;
  const attendance = fixture.attendance;
  const parts = [label];
  if (location) parts.push(location);
  if (capacity != null) parts.push(`capacity ${capacity.toLocaleString()}`);
  if (attendance != null) {
    parts.push(`attendance ${attendance.toLocaleString()}`);
    if (capacity) parts.push(`${Math.round((attendance / capacity) * 100)}% full`);
  }
  return parts.join(" · ");
}

function formatMeetingDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
}

export function MatchDataPanel({
  fixture,
  events,
  syncing,
}: {
  fixture: FixtureRow;
  events: EventRow[];
  syncing?: boolean;
}) {
  const snap = fixture.providerSnapshot;
  const home = fixture.homeTeam?.name ?? "Home";
  const away = fixture.awayTeam?.name ?? "Away";
  const h2h = normalizeHeadToHead(snap, home, away);
  const sdmsHeadToHeadRaw = snap?.sdms?.headToHead ?? (Array.isArray(snap?.headToHead) ? snap?.headToHead : []);
  const h2hSlots = buildCompetitionSlots(parseSdmsHeadToHeadRecords(sdmsHeadToHeadRaw));

  return (
    <div className="cms-card space-y-5">
      <div id="score" className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500 m-0">Stored match data</p>
          <p className="text-2xl font-semibold text-zinc-100 m-0 mt-1">
            {home} {fixture.homeScore}–{fixture.awayScore} {away}
          </p>
          <p className="text-sm text-zinc-500 m-0 mt-1">
            {fixture.competitionName ?? "Competition unknown"} · {fixture.status.replace(/_/g, " ")} ·{" "}
            {fixture.period.replace(/_/g, " ")}
            {fixture.matchMinute > 0 || fixture.matchSecond > 0
              ? ` · ${fixture.matchMinute}:${String(fixture.matchSecond).padStart(2, "0")}`
              : ""}
          </p>
        </div>
        {syncing ? <span className="cms-status cms-status--warning">Syncing from Sport365…</span> : null}
      </div>

      <dl className="cms-meta-grid text-sm">
        <div>
          <dt>Kickoff</dt>
          <dd>{formatKickoff(fixture.kickoffAt)}</dd>
        </div>
        <div>
          <dt>Venue</dt>
          <dd>{formatVenueBlock(fixture, snap)}</dd>
        </div>
        <div>
          <dt>Sport365 match ID</dt>
          <dd className="font-mono text-xs">{fixture.externalMatchId ?? "—"}</dd>
        </div>
        <div>
          <dt>Last synced</dt>
          <dd>{snap?.polledAt ? formatKickoff(snap.polledAt) : "—"}</dd>
        </div>
      </dl>

      {fixture.sport365Url && (
        <p className="text-xs text-zinc-600 m-0">
          Source:{" "}
          <a href={fixture.sport365Url} target="_blank" rel="noreferrer" className="text-emerald-500 hover:underline">
            Sport365 match page
          </a>
          {" · "}
          <a href={`/matches/${fixture.slug}/commentary`} className="text-zinc-400 hover:underline">
            Public commentary
          </a>
          {" · "}
          <a href={`/admin/operator?fixtureId=${fixture.id ?? ""}`} className="text-zinc-400 hover:underline">
            Approve commentary
          </a>
        </p>
      )}

      <div className="cms-card--nested p-3 text-sm match-cms-muted">
        Lineups and events are edited via the Match CMS action icons
        {events.length ? ` · ${events.length} events stored` : ""}.
      </div>

      <div>
        <p className="cms-section-title text-sm">Head to head stats</p>
        {h2h.kind === "none" && !h2hSlots.some((slot) => slot.hasData) ? (
          <p className="text-sm text-zinc-500 m-0">No head-to-head data stored yet. Sync from Planet Rugby.</p>
        ) : h2hSlots.some((slot) => slot.hasData) ? (
          <div className="space-y-3">
            <HeadToHeadStatsSection homeTeam={home} awayTeam={away} slots={h2hSlots} />
            {h2h.meetings.length > 0 ? (
              <div className="cms-table-scroll">
                <p className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Recent meetings</p>
                <table className="cms-table w-full text-sm">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Competition</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {h2h.meetings.map((meeting) => (
                      <tr key={meeting.matchId}>
                        <td className="whitespace-nowrap text-zinc-400">{formatMeetingDate(meeting.date)}</td>
                        <td className="text-zinc-400">{meeting.competition ?? "—"}</td>
                        <td>
                          {meeting.homeTeam} {meeting.homeScore}–{meeting.awayScore} {meeting.awayTeam}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : h2h.summary && h2h.summary.totalMeetings === 0 && h2h.meetings.length === 0 ? (
          <p className="text-sm text-zinc-500 m-0">
            No previous meetings between {home} and {away} in Sport365&apos;s records for this fixture.
          </p>
        ) : (
          <>
            {h2h.summary ? (
              <p className="text-sm text-zinc-400 m-0 mb-2">
                {h2h.summary.totalMeetings} meeting{h2h.summary.totalMeetings === 1 ? "" : "s"} · {home}{" "}
                {h2h.summary.homeWins} – {h2h.summary.draws} draws – {h2h.summary.awayWins} {away}
              </p>
            ) : null}
            {h2h.meetings.length === 0 ? (
              <p className="text-sm text-zinc-500 m-0">Meeting list not available for this head-to-head record.</p>
            ) : (
              <div className="cms-table-scroll">
                <table className="cms-table w-full text-sm">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Competition</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {h2h.meetings.map((meeting) => (
                      <tr key={meeting.matchId}>
                        <td className="whitespace-nowrap text-zinc-400">{formatMeetingDate(meeting.date)}</td>
                        <td className="text-zinc-400">{meeting.competition ?? "—"}</td>
                        <td>
                          {meeting.homeTeam} {meeting.homeScore}–{meeting.awayScore} {meeting.awayTeam}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
