"use client";

import Link from "next/link";
import { use } from "react";
import { MatchAudioVoiceSettingsClient } from "@/components/admin/MatchAudioVoiceSettingsClient";
import { MatchCmsFeatureShell } from "@/components/admin/MatchCmsFeatureShell";

/**
 * Live Audio control room — voice overrides + links to scripts / keys / defaults.
 */
export default function MatchAudioControlRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <MatchCmsFeatureShell
      matchId={id}
      title="Live Audio"
      description="Lead + Analyst voice settings for this match. Inherit competition defaults or override for this fixture only."
    >
      <div className="space-y-4">
        <div className="cms-card space-y-3 text-sm text-zinc-300">
          <p className="m-0 text-zinc-400">
            Public match centre Audio tab and Normal-time playback use private TTS segments when
            ready — voice IDs and storage paths stay server-side.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin/matches/${id}/commentary`} className="cms-btn cms-btn--primary">
              Lead / Analyst drafts
            </Link>
            <Link href="/admin/audio-commentary" className="cms-btn cms-btn--secondary">
              Global voice defaults
            </Link>
            <Link href="/admin/keys#elevenlabs" className="cms-btn cms-btn--secondary">
              ElevenLabs keys
            </Link>
            <Link
              href="/admin/knowledge/audio-commentary-rules"
              className="cms-btn cms-btn--secondary"
            >
              Audio Commentary Rules
            </Link>
            <Link href={`/admin/matches/${id}/animation`} className="cms-btn cms-btn--secondary">
              Animation settings
            </Link>
          </div>
        </div>

        <div className="cms-card space-y-3">
          <h2 className="m-0 text-base font-semibold text-zinc-100">Commentator voices</h2>
          <MatchAudioVoiceSettingsClient matchId={id} />
        </div>
      </div>
    </MatchCmsFeatureShell>
  );
}
