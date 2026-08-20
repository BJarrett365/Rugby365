import {
  parseRugbyPassCoachProfile,
  parseRugbyPassCoachSlug,
  rugbyPassCoachUrl,
  type RugbyPassCoachProfile,
} from "@rugby365/import-sdk";
import { getCoachById, updateCoach } from "./coach-admin-service";
import { namesLikelyMatch } from "./player-profile-enrichment-service";
import { setCoachPrimaryFromUrl } from "./coach-image-service";

export type RugbyPassCoachImportResult = {
  enriched: boolean;
  coachId: string;
  sourceUrl?: string;
  fieldsUpdated?: string[];
  reason?: string;
  profile?: RugbyPassCoachProfile;
};

function pickString(existing: string | null | undefined, incoming: string | null | undefined) {
  const current = existing?.trim();
  if (current) return undefined;
  const next = incoming?.trim();
  return next || undefined;
}

async function fetchRugbyPassHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Rugby365Bot/1.0 (+https://rugby365.com)",
      Accept: "text/html",
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`RugbyPass fetch failed (${res.status})`);
  return res.text();
}

export async function previewRugbyPassCoach(sourceUrl: string): Promise<RugbyPassCoachProfile | null> {
  const slug = parseRugbyPassCoachSlug(sourceUrl);
  if (!slug) throw new Error("Invalid RugbyPass coach URL");
  const url = rugbyPassCoachUrl(slug);
  const html = await fetchRugbyPassHtml(url);
  return parseRugbyPassCoachProfile(html, url);
}

export async function enrichCoachFromRugbyPass(
  coachId: string,
  sourceUrl?: string,
): Promise<RugbyPassCoachImportResult> {
  const coach = await getCoachById(coachId);
  if (!coach) return { enriched: false, coachId, reason: "Coach not found" };

  const urlInput =
    sourceUrl?.trim() ||
    (coach.sourceUrl && /rugbypass\.com\/coaches\//i.test(coach.sourceUrl)
      ? coach.sourceUrl
      : null) ||
    rugbyPassCoachUrl(coach.slug);

  const slug = parseRugbyPassCoachSlug(urlInput);
  if (!slug) {
    return { enriched: false, coachId, reason: "invalid_rugbypass_url" };
  }

  const url = rugbyPassCoachUrl(slug);
  let html: string;
  try {
    html = await fetchRugbyPassHtml(url);
  } catch (e) {
    return {
      enriched: false,
      coachId,
      sourceUrl: url,
      reason: e instanceof Error ? e.message : "RugbyPass fetch failed",
    };
  }

  const profile = parseRugbyPassCoachProfile(html, url);
  if (!profile) {
    return { enriched: false, coachId, sourceUrl: url, reason: "parse_failed" };
  }

  if (!namesLikelyMatch(coach.name, profile.displayName)) {
    return {
      enriched: false,
      coachId,
      sourceUrl: url,
      reason: "name_mismatch",
      profile,
    };
  }

  const fieldsUpdated: string[] = [];
  const patch: Parameters<typeof updateCoach>[1] = {};

  const fullName = pickString(coach.fullName, profile.displayName);
  if (fullName && fullName !== coach.name) {
    patch.fullName = fullName;
    fieldsUpdated.push("fullName");
  }

  const nationality = pickString(coach.nationality, profile.nationalityHint);
  if (nationality) {
    patch.nationality = nationality;
    fieldsUpdated.push("nationality");
  }

  const bio = pickString(coach.bioSummary, profile.bioSummary);
  if (bio) {
    patch.bioSummary = bio;
    fieldsUpdated.push("bioSummary");
  }

  // Always remember RugbyPass as a source when enriching.
  if (!coach.sourceUrl || /rugbypass\.com/i.test(coach.sourceUrl) || !coach.sourceUrl.trim()) {
    patch.sourceUrl = profile.sourceUrl;
    fieldsUpdated.push("sourceUrl");
  }

  if (profile.roleTitle && !coach.notes?.includes(profile.roleTitle)) {
    const noteLine = `RugbyPass role: ${profile.roleTitle}${
      profile.currentTeam ? ` · ${profile.currentTeam}` : ""
    }`;
    patch.notes = coach.notes?.trim() ? `${coach.notes.trim()} · ${noteLine}` : noteLine;
    fieldsUpdated.push("notes");
  }

  if (Object.keys(patch).length > 0) {
    await updateCoach(coachId, patch);
  }

  if (!coach.imageUrl?.trim() && profile.imageUrl) {
    try {
      await setCoachPrimaryFromUrl({
        coachId,
        imageUrl: profile.imageUrl,
        sourceProvider: "rugbypass",
        sourcePageUrl: profile.sourceUrl,
      });
      fieldsUpdated.push("imageUrl");
    } catch {
      // Non-fatal — bio/identity still enriched
    }
  }

  return {
    enriched: true,
    coachId,
    sourceUrl: profile.sourceUrl,
    fieldsUpdated,
    profile,
  };
}
