import { notFound } from "next/navigation";
import { getPublicRefereeProfile } from "@/lib/public-referee-profile-service";
import { mergeRefereeDashboard } from "@/lib/referee-dashboard-merge";
import { isPreviewParam } from "@/lib/public-entity-profile-utils";

export async function loadRefereeDashboard(slug: string, preview?: string) {
  const profile = await getPublicRefereeProfile(slug, { preview: isPreviewParam(preview) });
  if (!profile) return null;
  return { profile, model: mergeRefereeDashboard(profile) };
}

export async function requireRefereeDashboard(slug: string, preview?: string) {
  const loaded = await loadRefereeDashboard(slug, preview);
  if (!loaded) notFound();
  return loaded;
}
