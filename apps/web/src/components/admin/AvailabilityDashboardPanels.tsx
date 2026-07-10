"use client";

type DashboardBucket = {
  title: string;
  count: number;
  items: Array<{ playerName: string; detail: string; expectedReturnDate?: string | null }>;
};

export function AvailabilityDashboardPanels({
  dashboard,
}: {
  dashboard: {
    injured: Array<{ playerName: string; injuryType: string | null; status: string; expectedReturnDate: string | null }>;
    doubtful: Array<{ playerName: string; injuryType: string | null; expectedReturnDate: string | null }>;
    suspended: Array<{ playerName: string; offence: string | null; suspensionEnd: string | null }>;
    expectedBackSoon: Array<{ playerName: string; expectedReturnDate: string | null }>;
    recentlyReturned: Array<{ playerName: string; status: string }>;
    unavailablePlayers: Array<{
      playerName: string;
      reason: string;
      kind: "injury" | "suspension";
      expectedReturnDate: string | null;
    }>;
  } | null;
}) {
  if (!dashboard) return null;

  const buckets: DashboardBucket[] = [
    {
      title: "Unavailable",
      count: dashboard.unavailablePlayers.length,
      items: dashboard.unavailablePlayers.slice(0, 6).map((row) => ({
        playerName: row.playerName,
        detail: `${row.kind === "injury" ? "Injury" : "Suspension"}: ${row.reason}`,
        expectedReturnDate: row.expectedReturnDate,
      })),
    },
    {
      title: "Injured",
      count: dashboard.injured.length,
      items: dashboard.injured.slice(0, 6).map((row) => ({
        playerName: row.playerName,
        detail: row.injuryType ?? row.status,
        expectedReturnDate: row.expectedReturnDate,
      })),
    },
    {
      title: "Suspended",
      count: dashboard.suspended.length,
      items: dashboard.suspended.slice(0, 6).map((row) => ({
        playerName: row.playerName,
        detail: row.offence ?? "Suspended",
        expectedReturnDate: row.suspensionEnd,
      })),
    },
    {
      title: "Doubtful",
      count: dashboard.doubtful.length,
      items: dashboard.doubtful.slice(0, 6).map((row) => ({
        playerName: row.playerName,
        detail: row.injuryType ?? "Doubtful",
        expectedReturnDate: row.expectedReturnDate,
      })),
    },
    {
      title: "Expected back soon",
      count: dashboard.expectedBackSoon.length,
      items: dashboard.expectedBackSoon.slice(0, 6).map((row) => ({
        playerName: row.playerName,
        detail: "Expected return",
        expectedReturnDate: row.expectedReturnDate,
      })),
    },
    {
      title: "Recently returned",
      count: dashboard.recentlyReturned.length,
      items: dashboard.recentlyReturned.slice(0, 6).map((row) => ({
        playerName: row.playerName,
        detail: row.status.replace(/_/g, " "),
      })),
    },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 mb-4">
      {buckets.map((bucket) => (
        <div key={bucket.title} className="cms-card">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold m-0 text-sm">{bucket.title}</h3>
            <span className="text-xs text-zinc-500">{bucket.count}</span>
          </div>
          {bucket.items.length === 0 ? (
            <p className="text-xs text-zinc-500 m-0">None</p>
          ) : (
            <ul className="text-sm m-0 p-0 list-none space-y-1">
              {bucket.items.map((item, index) => (
                <li key={`${item.playerName}-${index}`}>
                  <span className="font-medium">{item.playerName}</span>
                  <span className="text-zinc-500"> — {item.detail}</span>
                  {item.expectedReturnDate ? (
                    <span className="block text-xs text-zinc-500">
                      Expected: {new Date(item.expectedReturnDate).toLocaleDateString()}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
