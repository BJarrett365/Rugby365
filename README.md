# Rugby365

Rugby Union Match Tracker & Commentary Engine — local dev build.

## Quick start

```bash
# 1. Dependencies
npm install

# 2. Database
docker compose up -d
cp .env.example .env   # if needed

# 3. Generate & run migrations
npm run db:generate -w @rugby365/db
npm run db:migrate
npm run db:seed

# 4. Start app
npm run dev

# 5. Replay demo match (another terminal)
npm run demo:feed
```

## URLs

| URL | Purpose |
|-----|---------|
| http://localhost:3000 | Home |
| http://localhost:3000/admin/operator | Approve commentary suggestions |
| http://localhost:3000/matches/demo-sa-barb/commentary | Live commentary widget |

## Demo flow

1. Run `npm run demo:feed`
2. Open **Operator** — at minute 23' you should see 4 phase-play suggestions
3. Click one to approve
4. Open **Commentary** page — line appears via SSE

## Tests

```bash
npm test
```

## Stack

- Next.js 15 (`apps/web`)
- Drizzle ORM + PostgreSQL (`packages/db`)
- Commentary engine (`packages/commentary`)
- World Rugby laws seed (`packages/db/seeds`)

## Project structure

```
rugby365/
├── apps/web          # Next.js — API, operator, public widget
├── packages/db       # Schema, migrations, seeds
├── packages/commentary
├── packages/shared
├── docs/stats-brain  # Stats Brain + Insight Stats plan
└── scripts/demo-live-match-feed.mjs
```

## Product plans

| Document | Description |
|----------|-------------|
| [docs/stats-brain/README.md](docs/stats-brain/README.md) | Stats Brain overview — cross-entity analytics layer |
| [docs/stats-brain/INSIGHT_STATS.md](docs/stats-brain/INSIGHT_STATS.md) | Insight Stats — master CMS, data model, detectors, publishing |
