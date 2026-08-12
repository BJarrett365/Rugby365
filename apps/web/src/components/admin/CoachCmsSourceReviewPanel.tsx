"use client";

export type CoachSourceReviewRow = {
  kind: string;
  status: string;
  action?: string;
  source?: string;
  confidence?: string;
  foundValue?: Record<string, unknown> | null;
  rugby365Value?: Record<string, unknown> | null;
};

type Props = {
  title?: string;
  summary?: string | null;
  rows: CoachSourceReviewRow[];
  busy?: boolean;
  onAccept?: (row: CoachSourceReviewRow, index: number) => void;
  onKeepCurrent?: (row: CoachSourceReviewRow, index: number) => void;
  onIgnore?: (row: CoachSourceReviewRow, index: number) => void;
  onFlag?: (row: CoachSourceReviewRow, index: number) => void;
};

function statusClass(status: string): string {
  if (status.includes("missing")) return "text-amber-300";
  if (status.includes("verified") || status === "match" || status === "matched") {
    return "text-emerald-300";
  }
  if (status.includes("conflict")) return "text-red-300";
  return "text-zinc-300";
}

export function CoachCmsSourceReviewPanel({
  title = "Source review",
  summary,
  rows,
  busy,
  onAccept,
  onKeepCurrent,
  onIgnore,
  onFlag,
}: Props) {
  if (!summary && rows.length === 0) return null;

  return (
    <div className="cms-card mb-4 border border-emerald-900/40">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h3 className="font-semibold m-0">{title}</h3>
        <span className="text-[10px] uppercase tracking-wide text-zinc-500">
          Nothing auto-publishes
        </span>
      </div>
      {summary ? <p className="text-sm text-emerald-400/90 mt-0 mb-3">{summary}</p> : null}
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500 m-0">No review rows.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-800">
                <th className="py-2 pr-3">Kind</th>
                <th className="py-2 pr-3">Current Rugby365</th>
                <th className="py-2 pr-3">Found value</th>
                <th className="py-2 pr-3">Source</th>
                <th className="py-2 pr-3">Confidence</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const current = row.rugby365Value
                  ? JSON.stringify(row.rugby365Value)
                  : "—";
                const found = row.foundValue ? JSON.stringify(row.foundValue) : "—";
                const canAccept = row.status === "missing" || row.action === "review";
                return (
                  <tr key={`${row.kind}-${index}`} className="border-b border-zinc-800/60 align-top">
                    <td className="py-2 pr-3 text-zinc-400 uppercase text-xs">{row.kind}</td>
                    <td className="py-2 pr-3 text-zinc-300 font-mono text-xs break-all max-w-[14rem]">
                      {current}
                    </td>
                    <td className="py-2 pr-3 text-zinc-100 font-mono text-xs break-all max-w-[14rem]">
                      {found}
                    </td>
                    <td className="py-2 pr-3 text-zinc-500 text-xs break-all max-w-[10rem]">
                      {row.source || "—"}
                    </td>
                    <td className="py-2 pr-3 text-zinc-400 text-xs uppercase">
                      {row.confidence || "—"}
                    </td>
                    <td className={`py-2 pr-3 text-xs font-semibold uppercase ${statusClass(row.status)}`}>
                      {row.status}
                    </td>
                    <td className="py-2 pr-3 text-right whitespace-nowrap">
                      {canAccept && onAccept ? (
                        <button
                          type="button"
                          className="cms-btn cms-btn--primary text-xs mr-1"
                          disabled={busy}
                          onClick={() => onAccept(row, index)}
                        >
                          Accept
                        </button>
                      ) : null}
                      {onKeepCurrent ? (
                        <button
                          type="button"
                          className="cms-btn cms-btn--secondary text-xs mr-1"
                          disabled={busy}
                          onClick={() => onKeepCurrent(row, index)}
                        >
                          Keep current
                        </button>
                      ) : null}
                      {onIgnore ? (
                        <button
                          type="button"
                          className="cms-btn cms-btn--secondary text-xs mr-1"
                          disabled={busy}
                          onClick={() => onIgnore(row, index)}
                        >
                          Ignore
                        </button>
                      ) : null}
                      {onFlag ? (
                        <button
                          type="button"
                          className="cms-btn cms-btn--secondary text-xs"
                          disabled={busy}
                          onClick={() => onFlag(row, index)}
                        >
                          Flag
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
