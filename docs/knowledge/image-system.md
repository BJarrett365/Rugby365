# Rugby365 Image System

Part of the Rugby365 Knowledge Base. See [Player Image Enrichment](./player-image-enrichment.md) for Planet Rugby rights.

## Principles

- Planet Rugby editorial look: image-first, clean, consistent aspect ratios
- Performance: `next/image` + lazy load (priority only for player heroes)
- SEO: alt, caption, credit, ImageObject JSON-LD, Twitter/OG, `/sitemap-images.xml`
- CMS: discovery + metadata (alt, caption, credit, photographer, licence, focal, OG)
- No brand/font/colour changes

## Components

| Component | Path |
|-----------|------|
| `MediaImage` | `components/media/MediaImage.tsx` |
| `PlayerPortrait` | `components/media/PlayerPortrait.tsx` |
| `MediaGallery` | `components/media/MediaGallery.tsx` |
| `TeamCrest` | `components/matches/TeamCrest.tsx` |
| Metadata editor | `components/admin/PlayerImageMetadataEditor.tsx` |

## Tokens

`lib/media-tokens.ts` — aspect ratios, size presets, licence enum, host allow-list for optimisation.

## Public player

- Large portrait via `PlayerPortrait` (club + nation badges, number, status, credit)
- Gallery from public approved `player_images` (non-primary)
- Structured data uses `ImageObject`

## CMS

On player edit → Planet Rugby images panel:

1. Find / refresh PR candidates
2. Set primary / gallery / roles
3. **Edit metadata** — alt, caption, credit, photographer, licence, focal X/Y, AI flag, set OG image

Licence must not be `unknown` when publishing publicly (enforced on metadata publish).

## Sitemap

`GET /sitemap-images.xml` — public approved player images joined to published players.

## Rollout remaining

- Owned upload storage (R2/S3)
- Team / venue / competition / match media tables
- Crop UI + AI crop variants
- News imagery (when news product exists)
