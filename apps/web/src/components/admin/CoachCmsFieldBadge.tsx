export type CoachFieldKind = "editorial" | "verified" | "auto";

const LABELS: Record<CoachFieldKind, string> = {
  editorial: "EDITORIAL",
  verified: "VERIFIED",
  auto: "AUTO",
};

export function CoachCmsFieldBadge({ kind }: { kind: CoachFieldKind }) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${
        kind === "editorial"
          ? "bg-sky-950 text-sky-300 border border-sky-800"
          : kind === "verified"
            ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
            : "bg-zinc-900 text-zinc-300 border border-zinc-700"
      }`}
    >
      {LABELS[kind]}
    </span>
  );
}
