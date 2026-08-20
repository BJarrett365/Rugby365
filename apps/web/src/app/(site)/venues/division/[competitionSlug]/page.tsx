import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ competitionSlug: string }>;
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
};

/** Legacy route — redirects to canonical /venues/competition/[slug]. */
export default async function DivisionVenuesRedirect({ params, searchParams }: PageProps) {
  const { competitionSlug } = await params;
  const sp = (await searchParams) ?? {};
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (val) qs.set(k, val);
  }
  const q = qs.toString();
  redirect(`/venues/competition/${competitionSlug}${q ? `?${q}` : ""}`);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { competitionSlug } = await params;
  return {
    alternates: { canonical: `/venues/competition/${competitionSlug}` },
  };
}

