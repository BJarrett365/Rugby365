# Audio Commentary Rules — Rugby365 Live Audio Commentary

How **Lead + Analyst** broadcast scripts are planned and voiced. For editors, ops and agents working on Match Animation audio bursts.

## Purpose

Written Intelligence Engine commentary stays on screen. Audio is a **separate dual-commentator rewrite** — never text-to-speech of the written prose word-for-word.

Public users hear bursts inside **Match Animation** (and the public Audio tab) only. They must never see MP3 names, storage URLs, ElevenLabs voice IDs, or file lists.

## Product rules (non-negotiable)

1. **Story-first** — call the biggest story now, not unused-stat rotation.
2. **Careful language** — never invent injuries, emotions, or coach quotes.
3. **Regional Creator Profiles** — pick a division (Currie Cup SA, Premiership SE, MLR US, NPC NZ, …) and assign Lead + Analyst accents. Synthetic editorial labels only (e.g. “Currie Cup Lead (SA English)”) — never invent licensed celebrity commentators.
4. **Secrets server-side** — ElevenLabs keys via `integration_settings` / env; voice IDs only in admin voice settings (never public APIs).
5. **Written ≠ audio** — admin shows both; public Match Animation gets timeline metadata + proxied audio only.
6. **Defaults vs overrides** — competition (division) defaults apply unless a match override is set; clearing the override restores defaults.

## Creator Profiles (Plexa-style)

Dropdown format: **`Display name · Accent/Org · Competition focus`**

| Surface | URL |
|---------|-----|
| Division / competition defaults | `/admin/audio-commentary` |
| Per-match override | `/admin/matches/[id]/audio` |
| API keys (not voices) | `/admin/keys` · ElevenLabs / OpenAI |

Admin controls (Voiceover panel):

- **Competition / Division** selector
- **Creator Profile** Lead + Analyst
- **Voice style** — Journalist / Television / Analyst / Former player / Storyteller
- **Delivery style** — Balanced / Energetic / Calm
- **Tone** + speed
- Checkboxes: Optimise for dual commentary · Emphasise scoreboard moments
- Collapsible **AI prompt (editable)** for TTS / rewrite direction

**Resolution order** for TTS: match override → competition defaults (`audio_commentary_defaults` by fixture competition scope) → default `audio_voice_profiles` for that scope → Currie Cup / global fallback.

Competition → scope mapping (examples): Currie Cup → `currie_cup`, Premiership/Gallagher → `premiership`, MLR → `mlr`, NPC/Bunnings → `npc`, Top 14 → `top14`, URC → `urc`, else → `global`.

### Seeded regional duos (migration `0065`)

| Scope | Duo label | Accent | OpenAI seed voices (Lead / Analyst) |
|-------|-----------|--------|--------------------------------------|
| `currie_cup` | Currie Cup SA Duo | South African English | onyx / nova |
| `premiership` | Premiership SE Duo | Southern / British English | echo / sage |
| `mlr` | MLR US Duo | American English | alloy / coral |
| `npc` | NPC NZ Duo | New Zealand English | onyx / nova |
| `top14` | Top 14 FR Duo | French-accented English | fable / shimmer |
| `global` | Site default | Neutral / SA fallback | Currie Cup duo |

ElevenLabs voice IDs remain blank until configured in admin (advanced panel).

Fields per role: display name, organisation/topic labels, voice style, delivery style, provider, voice ID / OpenAI voice name, speed (0.75–1.5), tone, optional AI prompt, optional ElevenLabs stability / similarity / style.

## Pipeline

```
Live match data
    ↓
Written commentary (Intelligence Engine)
    ↓
Audio script planner → Lead / Analyst scripts
    ↓
resolveVoiceProfileForFixture → ElevenLabs / OpenAI TTS (private storage)
    ↓
Stadium mix + segment jobs                      ← Phase 3+
    ↓
Stream proxy → Match Animation bursts + captions
```

| Step | Where |
|------|--------|
| Generate (written + scripts) | `/admin/matches/[id]/commentary` → **Generate from match data** |
| Creator Profiles / division defaults | `/admin/audio-commentary` |
| Match override + regenerate priority TTS | `/admin/matches/[id]/audio` |
| API | `POST /api/admin/matches/[id]/commentary/generate` (`generateAudioScripts: true` default) |
| Script service | `audio-commentary-script-service.ts` |
| Voice resolve | `audio-voice-settings-service.ts` → `resolveVoiceProfileForFixture` |
| Storage | `audio_commentary_scripts` · `audio_voice_profiles` · `audio_commentary_defaults` · `audio_match_voice_settings` |
| Keys | `/admin/keys/elevenlabs` · env `ELEVENLABS_API_KEY` |
| Knowledge | this page · written rules: [Commentary Rules](/admin/knowledge/commentary-rules) |

## Combination types

Each published narrative line is classified and rewritten:

| Type | When |
|------|------|
| `major_event` | Try, conversion, penalty, drop goal |
| `card` | Yellow / red / sin-bin |
| `half_time` / `full_time` | Breaks and FT report |
| `coaching_change` | Subs / tactical bench moves |
| `player_spotlight` | Named influencer / stats colour |
| `momentum` | Territory / pressure spells (prose, not bare %) |
| `prematch` / `kick_off` | Scene-setters |
| `set_piece` | Scrum / lineout platforms |
| `insight` / `quiet_minute` | Story beats without inventing drama |

Priority tags are stored for a later burst queue; Phase 1 generates scripts for all published narrative lines.

## Speakers

| Role | Job |
|------|-----|
| **Lead** | Call the moment — biggest story, scoreboard / card / kick-off energy |
| **Analyst** | Add the tactical why — platform, exits, shape — without inventing quotes |

Both scripts must be non-empty and must not equal the written `body`.

## Anti-repetition

- Rotate Lead/Analyst openers across consecutive minutes.
- Prefer fresh phrase pools per combination type.
- Never dump Opta-style bare percentages into audio.

## What public Match Animation may receive

- Burst timing (match clock)
- Caption text (Lead/Analyst lines only)
- Opaque stream token / proxied URL

**Never:** voice IDs, storage paths, filename lists, ElevenLabs account details.

## Ops checklist

1. Run migrations `0063_audio_commentary`, `0064_audio_voice_settings`, and `0065_creator_profiles`.
2. Configure division Creator Profiles at `/admin/audio-commentary` (Currie Cup SA, Premiership, MLR, NPC seeds included).
3. Generate commentary for a fixture (scripts created by default).
4. Optionally override voices on `/admin/matches/[id]/audio`; clear to revert to division default.
5. Configure ElevenLabs (or OpenAI) key before TTS generation.
6. Use **Regenerate priority audio with new voices** after changing overrides.
7. Do not publish raw storage URLs or voice IDs to the public site.
