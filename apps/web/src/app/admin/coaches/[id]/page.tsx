import { redirect } from "next/navigation";

/** Canonical coach CMS route — workflow lives on the edit page. */
export default async function CoachCmsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/coaches/${id}/edit`);
}
