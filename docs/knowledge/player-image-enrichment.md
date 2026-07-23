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

## Code

| Area | Path |
|------|------|
| Migration | `packages/db/drizzle/0038_player_images.sql` |
| Search | `apps/web/src/lib/planet-rugby-image-search-service.ts` |
| Confidence | `apps/web/src/lib/planet-rugby-image-match.ts` |
| Persist | `apps/web/src/lib/player-image-service.ts` |
| API | `/api/admin/players/[id]/images` |
| UI | `PlayerPlanetRugbyImagesPanel.tsx` |
