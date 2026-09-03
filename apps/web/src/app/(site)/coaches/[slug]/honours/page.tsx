import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CoachHonoursShowcase } from "@/components/coaches/CoachHonoursShowcase";
import { CoachSubpageChrome } from "@/components/coaches/CoachSubpageChrome";
import { isPreviewParam } from "@/lib/public-entity-profile-utils";
import { getPublicCoachProfile } from "@/lib/public-coach-profile-service";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getPublicCoachProfile(slug, { preview: false });
  const name = profile?.displayName ?? slug;
  return { title: `Honours | ${name} | Rugby365`, description: `Honours and awards for ${name}` };
}

export default async function CoachHonoursPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const profile = await getPublicCoachProfile(slug, { preview: isPreviewParam(sp.preview) });
  if (!profile) notFound();

  return (
    <CoachSubpageChrome profile={profile} active="honours" variant="showcase">
      <CoachHonoursShowcase profile={profile} />
    </CoachSubpageChrome>
  );
}
