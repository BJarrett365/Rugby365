import { WHOLE_RECORD_LOCK_FIELD } from "./provider-mapping-types";

export type OverwriteDecision =
  | "apply_primary"
  | "fill_empty"
  | "skip_locked"
  | "skip_unchanged"
  | "conflict";

export type FieldSyncInput = {
  field: string;
  currentValue: unknown;
  primaryValue: unknown;
  secondaryValue?: unknown;
  /** Provider proposing the write */
  source: "primary" | "secondary";
  lockedFields: Set<string>;
  /** When true, primary may overwrite non-empty current values (unless locked). */
  primaryOwnsField?: boolean;
};

export function isEmptyValue(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

export function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (isEmptyValue(a) && isEmptyValue(b)) return true;
  if (typeof a === "number" && typeof b === "string" && String(a) === b) return true;
  if (typeof b === "number" && typeof a === "string" && String(b) === a) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

export function isFieldLocked(field: string, lockedFields: Set<string>): boolean {
  return lockedFields.has(WHOLE_RECORD_LOCK_FIELD) || lockedFields.has(field);
}

/**
 * Core overwrite policy:
 * - Locks always win
 * - Primary may update primary-managed fields when unlocked
 * - Secondary may only fill empty fields unless manually approved elsewhere
 * - Disagreement between primary proposal and non-empty current (when primary does not own)
 *   or secondary vs non-empty current → conflict
 */
export function decideFieldWrite(input: FieldSyncInput): OverwriteDecision {
  if (isFieldLocked(input.field, input.lockedFields)) {
    return "skip_locked";
  }

  const incoming =
    input.source === "primary" ? input.primaryValue : input.secondaryValue;

  if (incoming === undefined) {
    return "skip_unchanged";
  }

  if (valuesEqual(input.currentValue, incoming)) {
    return "skip_unchanged";
  }

  if (input.source === "primary") {
    if (input.primaryOwnsField !== false) {
      return "apply_primary";
    }
    if (isEmptyValue(input.currentValue)) {
      return "fill_empty";
    }
    return "conflict";
  }

  // Secondary
  if (isEmptyValue(input.currentValue)) {
    return "fill_empty";
  }

  if (!isEmptyValue(input.primaryValue) && !valuesEqual(input.primaryValue, incoming)) {
    return "conflict";
  }

  return "conflict";
}
