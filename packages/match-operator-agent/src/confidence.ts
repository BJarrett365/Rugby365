import type { DetectedChange } from "./types";
import { changeToCanonicalEventType } from "./diff";

const LOW_RISK_EVENTS = new Set([
  "score_update",
  "half_time",
  "full_time",
  "fixture_status_change",
  "table_update",
]);

const HIGH_RISK_EVENTS = new Set([
  "try",
  "conversion",
  "conversion_missed",
  "card",
  "injury",
  "tmo_decision",
  "referee_decision",
  "substitution",
  "penalty",
  "disputed_event",
  "penalty_goal",
  "drop_goal",
]);

export function isLowRiskEvent(eventType: string): boolean {
  return LOW_RISK_EVENTS.has(eventType);
}

export function isHighRiskEvent(eventType: string): boolean {
  return HIGH_RISK_EVENTS.has(eventType) || eventType.startsWith("provider_type_");
}

export function requiresApproval(eventType: string, confidence: number, mode: "observer" | "assisted" | "auto"): boolean {
  if (mode === "observer") return false;
  if (confidence < 0.75) return true;
  if (isHighRiskEvent(eventType)) return true;
  if (mode === "assisted") return true;
  if (mode === "auto") return !isLowRiskEvent(eventType);
  return true;
}

export function scoreConfidence(change: DetectedChange): number {
  const eventType = changeToCanonicalEventType(change);
  let confidence = 0.9;

  if (change.kind === "incident") {
    const inc = change.incident;
    if (inc.playerName) confidence += 0.05;
    else confidence -= 0.15;
    if ([34, 35].includes(inc.type)) confidence += 0.03;
    if (inc.type === 10) confidence -= 0.1;
    if (inc.type === 1) confidence -= 0.05;
  }

  if (change.kind === "score_update" && !change.previous) {
    confidence -= 0.2;
  }

  if (change.kind === "status_change") {
    const label = change.snapshot.statusLabel;
    if (label === "full_time" || label === "half_time") confidence = 0.95;
    else confidence = 0.7;
  }

  if (isHighRiskEvent(eventType) && change.kind === "incident" && !change.incident.playerName) {
    confidence -= 0.1;
  }

  return Math.max(0, Math.min(1, Math.round(confidence * 100) / 100));
}
