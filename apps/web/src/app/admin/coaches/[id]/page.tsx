import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicCoachProfileView } from "@/components/coaches/PublicCoachProfileView";
import { getCoachById } from "@/lib/coach-admin-service";
import { getPublicCoachProfile } from "@/lib/public-coach-profile-service";

/** CMS preview of the public coach profile look and feel. */
export default async function CoachAdminPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const coach = await getCoachById(id);
  if (!coach) notFound();

  const profile = await getPublicCoachProfile(coach.slug, { preview: true });

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Link href="/admin/coaches" className="cms-btn cms-btn--secondary">
          All coaches
        </Link>
        <Link href={`/admin/coaches/${id}/edit`} className="cms-btn cms-btn--primary">
          Edit CMS
        </Link>
        <Link href={`/coaches/${encodeURIComponent(coach.slug)}`} className="cms-btn cms-btn--secondary">
          Public page
        </Link>
      </div>
      {profile ? (
        <PublicCoachProfileView profile={profile} />
      ) : (
        <p className="text-sm text-zinc-400">
          Could not load the public profile for {coach.name}.{" "}
          <Link href={`/admin/coaches/${id}/edit`}>Open CMS edit</Link>
        </p>
      )}
    </div>
  );
}
