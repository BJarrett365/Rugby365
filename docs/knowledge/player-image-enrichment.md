# Planet Rugby Player Image Enrichment

Part of the Rugby365 Knowledge Base. See the [Rule Book](./rule-book.md) for permanent standards.

## Purpose

Enrich Rugby365 player profiles using **Planet Rugby–owned** images only. Planet Sport has rights to reuse Planet Rugby media.

Do **not** pull unrelated third-party hosts unless rights are separately confirmed.

## Allowed hosts

- `images.ps-aws.com`
- `d3gbf3ykm8gp5c.cloudfront.net` (Planet Rugby uploads CDN)
- `www.planetrugby.com` media paths

## Admin workflow

On `/admin/players/[id]/edit`:

1. **Find Planet Rugby Images** — discovers PR article/tag pages (DuckDuckGo `site:planetrugby.com` as discovery aid), parses CDN images, scores confidence, stores candidates.
2. Preview shows image, source article, caption/alt, credit, confidence.
3. Editor actions: Set as primary · Add to gallery · Club / International / Career / Legend role · Reject · Incorrect player · Remove from public · Refresh search.
4. Full history is kept in `player_images` (rejected rows retained).

## Confidence

| Level | Rule |
|-------|------|
| **High** | Player name in caption or alt **and** team context matches |
| **Medium** | Name in article/title/filename with strong context |
| **Low** | Weak proximity only |

**Never auto-approve Low confidence.** Editors may still set primary after review.

Built-in negative filters drop promo banners / ticket creatives (from confirmed bad matches). Editor rejections also enqueue **learning proposals** (`player_image_learning_rules`) — review via **Learn from rejected images** on the player edit screen. Approved rules affect future scoring; pending rules never apply automatically.

## Roles

One image may be marked:

- Primary profile image (`players.image_url` + `primary_image_id`)
- Current club image
- Current international image
- Career image
- Legend image
- Gallery

## Automation

Discovery refresh runs when:

- Editor clicks Find / Refresh
- Player club name changes in CMS (candidates only)

**Do not automatically replace an approved primary image.** If `primary_image_approved_at` is set, refresh only adds candidates.

## Cartoon avatars

Cartoon avatars are project-owned generated assets, not remote RugbyPass images.

- Style reference: `docs/knowledge/assets/player-avatar-style-reference.png`
- Generated files: `apps/web/public/player-avatars/*.png`
- Provenance and restore manifest: `apps/web/public/player-avatars/manifest.json`
- Source discovery: `npm run pull:player-images -- --wikipedia --planet`
- Generation: `npm run generate:cartoons -- --limit=25`
- Database restore/sync: `npm run sync:cartoons`

Generation requires `OPENAI_API_KEY` in `.env` or Admin → Keys → OpenAI. Each output is
normalized to the public player profile's 3:4 crop (1024×1365), registered in
`player_images` with `is_ai_generated=true`, and linked to its source-photo URL.
The manifest is updated after every successful generation so a fresh database can be
reconnected to assets already committed in the project.

## Code

| Area | Path |
|------|------|
| Migration | `packages/db/drizzle/0038_player_images.sql` |
| Search | `apps/web/src/lib/planet-rugby-image-search-service.ts` |
| Confidence | `apps/web/src/lib/planet-rugby-image-match.ts` |
| Persist | `apps/web/src/lib/player-image-service.ts` |
| API | `/api/admin/players/[id]/images` |
| UI | `PlayerPlanetRugbyImagesPanel.tsx` |
| Cartoon generation | `scripts/generate-cartoon-avatars.ts` |
| Cartoon DB sync | `scripts/sync-cartoon-avatar-manifest.ts` |
