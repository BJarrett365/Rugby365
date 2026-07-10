export type PlayerSocialAccounts = {
  twitter?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  tiktok?: string | null;
  website?: string | null;
};

export function calculatePlayerAge(
  birthDate: string | Date | null | undefined,
  asOf: Date = new Date(),
): number | null {
  if (!birthDate) return null;
  const dob = birthDate instanceof Date ? birthDate : new Date(String(birthDate));
  if (Number.isNaN(dob.getTime())) return null;
  let age = asOf.getFullYear() - dob.getFullYear();
  const monthDiff = asOf.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && asOf.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

export function normalizeSocialAccounts(input: unknown): PlayerSocialAccounts {
  if (!input || typeof input !== "object") return {};
  const record = input as Record<string, unknown>;
  const pick = (key: keyof PlayerSocialAccounts) => {
    const value = record[key];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  };
  return {
    twitter: pick("twitter"),
    instagram: pick("instagram"),
    facebook: pick("facebook"),
    tiktok: pick("tiktok"),
    website: pick("website"),
  };
}
