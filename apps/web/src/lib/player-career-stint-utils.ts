export type CareerStintRow = {
  id: string;
  careerType: string;
  yearsLabel: string;
  teamName: string;
  apps: number | null;
  tries?: number | null;
  points: number | null;
};

export type CareerStintGroup = {
  key: "club" | "cup" | "international";
  label: string;
  rows: CareerStintRow[];
  totals: { apps: number; points: number };
};

const GROUP_LABELS: Record<CareerStintGroup["key"], string> = {
  club: "Club",
  cup: "Cup",
  international: "International",
};

function normalizeCareerType(value: string): CareerStintGroup["key"] | null {
  const type = value.toLowerCase();
  if (type === "club") return "club";
  if (type === "cup" || type === "provincial" || type === "super") return "cup";
  if (type === "international") return "international";
  return null;
}

export function groupCareerStints(rows: CareerStintRow[]): CareerStintGroup[] {
  const buckets: Record<CareerStintGroup["key"], CareerStintRow[]> = {
    club: [],
    cup: [],
    international: [],
  };

  for (const row of rows) {
    const key = normalizeCareerType(row.careerType);
    if (key) buckets[key].push(row);
  }

  return (["club", "cup", "international"] as const).map((key) => {
    const groupRows = buckets[key];
    return {
      key,
      label: GROUP_LABELS[key],
      rows: groupRows,
      totals: {
        apps: groupRows.reduce((sum, row) => sum + (row.apps ?? 0), 0),
        points: groupRows.reduce((sum, row) => sum + (row.points ?? 0), 0),
      },
    };
  });
}

export function wikipediaCareerTotals(rows: CareerStintRow[]) {
  const groups = groupCareerStints(rows);
  return {
    club: groups.find((group) => group.key === "club")?.totals ?? { apps: 0, points: 0 },
    cup: groups.find((group) => group.key === "cup")?.totals ?? { apps: 0, points: 0 },
    international: groups.find((group) => group.key === "international")?.totals ?? { apps: 0, points: 0 },
    all: {
      apps: groups.reduce((sum, group) => sum + group.totals.apps, 0),
      points: groups.reduce((sum, group) => sum + group.totals.points, 0),
    },
  };
}
