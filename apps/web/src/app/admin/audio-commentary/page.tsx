import { AudioCommentaryAdminClient } from "@/components/admin/AudioCommentaryAdminClient";
import { PageHeader } from "@/components/shell/PageHeader";

export const metadata = {
  title: "Audio Commentary · Rugby365 CMS",
};

export const dynamic = "force-dynamic";

export default function AdminAudioCommentaryPage() {
  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Audio Commentary"
        description="Regional Creator Profiles (Lead + Analyst) by division. Per-match overrides live on each match’s Audio tab."
      />
      <AudioCommentaryAdminClient />
    </>
  );
}
