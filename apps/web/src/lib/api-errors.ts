import { NextResponse } from "next/server";

export function isDbUnavailable(error: unknown, depth = 0): boolean {
  if (!error || depth > 10) return false;

  if (typeof error === "object") {
    const err = error as {
      code?: string;
      cause?: unknown;
      errors?: unknown[];
      message?: string;
      errno?: number;
    };
    if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND" || err.code === "ETIMEDOUT") {
      return true;
    }
    if (err.errno === -61 || err.errno === -111 || err.errno === 53) return true;
    if (Array.isArray(err.errors)) return err.errors.some((e) => isDbUnavailable(e, depth + 1));
    if (err.cause) return isDbUnavailable(err.cause, depth + 1);
    if (typeof err.message === "string") {
      const m = err.message.toLowerCase();
      if (
        m.includes("econnrefused") ||
        m.includes("connection refused") ||
        m.includes("connect econnrefused") ||
        m.includes("cannot connect") ||
        m.includes("could not connect") ||
        m.includes("connection terminated") ||
        m.includes("no pg_hba.conf entry")
      ) {
        return true;
      }
      if (m.startsWith("failed query:") && isDbUnavailable(err.cause, depth + 1)) return true;
      if (
        m.includes("does not exist") &&
        (m.includes("column") || m.includes("relation"))
      ) {
        return false;
      }
    }
  }

  if (error instanceof Error) {
    if (isDbUnavailable({ message: error.message, cause: error.cause }, depth + 1)) return true;
  }

  return false;
}

function isSchemaMismatch(error: unknown, depth = 0): boolean {
  if (!error || depth > 10) return false;
  if (typeof error === "object") {
    const err = error as { message?: string; cause?: unknown };
    if (typeof err.message === "string") {
      const m = err.message.toLowerCase();
      if (m.includes("does not exist") && (m.includes("column") || m.includes("relation"))) {
        return true;
      }
      if (m.startsWith("failed query:") && isSchemaMismatch(err.cause, depth + 1)) return true;
    }
    if (err.cause) return isSchemaMismatch(err.cause, depth + 1);
  }
  return false;
}

export function friendlyErrorMessage(error: unknown, fallback: string): string {
  if (isDbUnavailable(error)) {
    return "Database is not running. In the rugby365 folder run: npm run db:up (Docker Desktop must be open), then refresh.";
  }
  if (isSchemaMismatch(error)) {
    return "Database schema is out of date. In the rugby365 folder run: npm run db:migrate (or npm run db:up), then refresh.";
  }
  if (error instanceof Error && error.message.startsWith("Failed query:")) {
    const cause = (error as { cause?: Error }).cause;
    if (cause?.message) return cause.message;
  }
  return error instanceof Error ? error.message : fallback;
}

export function apiErrorResponse(error: unknown, fallback: string) {
  const message = friendlyErrorMessage(error, fallback);
  const status = isDbUnavailable(error) ? 503 : 500;
  return NextResponse.json({ error: message, dbUnavailable: isDbUnavailable(error) }, { status });
}
