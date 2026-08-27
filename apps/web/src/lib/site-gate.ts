/**
 * Lightweight site gate for the CMS preview (Netlify).
 * Defaults match the shared preview credentials; override via env in production.
 */
export const SITE_GATE_COOKIE = "r365_site_gate";

export function siteGateUsername(): string {
  return process.env.SITE_GATE_USERNAME?.trim() || "Password";
}

export function siteGatePassword(): string {
  return process.env.SITE_GATE_PASSWORD?.trim() || "Password";
}

export function siteGateEnabled(): boolean {
  const raw = process.env.SITE_GATE_ENABLED?.trim().toLowerCase();
  // Explicit only — local and public live stay open unless this is set true.
  return raw === "1" || raw === "true" || raw === "on";
}

function toBase64Url(value: string): string {
  // Edge-safe (no Node Buffer required on the happy path).
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const base64 =
    typeof btoa === "function"
      ? btoa(binary)
      : Buffer.from(value, "utf8").toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function buildSiteGateToken(username: string, password: string): string {
  // Deterministic non-secret token for cookie matching (preview gate only).
  return toBase64Url(`${username}:${password}`);
}

export function expectedSiteGateToken(): string {
  return buildSiteGateToken(siteGateUsername(), siteGatePassword());
}

export function credentialsMatch(username: string, password: string): boolean {
  return username === siteGateUsername() && password === siteGatePassword();
}
