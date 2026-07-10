"use client";

type PlayoffFixture = {
  id: string;
  kickoffAt: string | null;
  status: string;
  round: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  homeScore: number;
  awayScore: number;
};

function formatKickoff(value: string | null): string {
  if (!value) return "TBC";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBC";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function scoreLine(fixture: PlayoffFixture): string {
  if (fixture.status === "full_time" || fixture.status === "live") {
    return `${fixture.homeScore} – ${fixture.awayScore}`;
  }
  return fixture.status === "postponed" ? "Postponed" : "—";
}

export function PlayoffFixtures({ fixtures }: { fixtures: PlayoffFixture[] }) {
  if (!fixtures.length) return null;

  const byRound = new Map<string, PlayoffFixture[]>();
  for (const fixture of fixtures) {
    const round = fixture.round?.trim() || "Play-offs";
    const group = byRound.get(round) ?? [];
    group.push(fixture);
    byRound.set(round, group);
  }

  return (
    <div className="cms-card mt-4">
      <h2 className="text-base font-semibold m-0 mb-3">Play-offs</h2>
      <div className="grid gap-4">
        {[...byRound.entries()].map(([round, roundFixtures]) => (
          <div key={round}>
            <h3 className="text-sm font-medium text-zinc-400 m-0 mb-2">{round}</h3>
            <ul className="m-0 p-0 list-none grid gap-2">
              {roundFixtures.map((fixture) => (
                <li
                  key={fixture.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-sm"
                >
                  <span className="text-zinc-500 text-xs">{formatKickoff(fixture.kickoffAt)}</span>
                  <span className="flex-1 text-center font-medium text-zinc-100">
                    {fixture.homeTeam ?? "TBC"} <span className="text-zinc-500">vs</span>{" "}
                    {fixture.awayTeam ?? "TBC"}
                  </span>
                  <span className="font-mono tabular-nums text-zinc-300">{scoreLine(fixture)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
