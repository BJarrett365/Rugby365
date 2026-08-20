import { CoachCmsFieldBadge, type CoachFieldKind } from "@/components/admin/CoachCmsFieldBadge";

type Props = {
  label: string;
  kind: CoachFieldKind;
  source?: string | null;
  lastChecked?: string | null;
  confidence?: string | null;
};

export function CoachCmsFieldLabel({ label, kind, source, lastChecked, confidence }: Props) {
  return (
    <div className="mb-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-zinc-400">{label}</span>
        <CoachCmsFieldBadge kind={kind} />
      </div>
      {kind === "verified" && (source || lastChecked || confidence) ? (
        <div className="mt-1 text-[11px] text-zinc-500 leading-snug">
          {source ? <div>Source: {source}</div> : null}
          {lastChecked ? <div>Checked: {lastChecked}</div> : null}
          {confidence ? <div>Confidence: {confidence.toUpperCase()}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
