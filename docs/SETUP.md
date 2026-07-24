# Local setup guide

Tools and steps to run Rugby365 after cloning from GitHub.

## Required tools

Install these before cloning or running the app.

| Tool | Why | Suggested install (macOS) |
|------|-----|---------------------------|
| **Git** | Clone and push | Xcode CLT (`xcode-select --install`) or [git-scm.com](https://git-scm.com/) |
| **Node.js 20+** | Runs Next.js, scripts, and npm workspaces | [nodejs.org](https://nodejs.org/) LTS, or `brew install node@20` |
| **npm** | Comes with Node — used for install / workspaces | Bundled with Node (do not switch to yarn/pnpm for this repo) |
| **Docker Desktop** | Postgres 16 on port **5433** via `docker compose` | [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop/) |

Verify:

```bash
git --version
node -v    # should be v20.x or newer
npm -v
docker version
docker compose version
```

Docker must be **running** (whale icon in the menu bar) before `npm run dev` or `npm run db:up`. The first time you start the app, `scripts/ensure-db.cjs` will try to open Docker Desktop on macOS if the daemon is not ready.

## Optional tools

| Tool | Why |
|------|-----|
| **GitHub CLI (`gh`)** | PRs, issues, auth checks — `brew install gh` then `gh auth login` |
| **SSH key for GitHub** | Clone/push without HTTPS prompts — [GitHub SSH docs](https://docs.github.com/en/authentication/connecting-to-github-with-ssh) |
| **Cursor / VS Code** | Editing; open the repo root (`rugby365/`), not only `apps/web` |

## Clone and first run

```bash
# SSH (preferred if you have a GitHub SSH key)
git clone git@github.com:BJarrett365/Rugby365.git
cd Rugby365

# or HTTPS
# git clone https://github.com/BJarrett365/Rugby365.git

npm install

cp .env.example .env
# Edit .env if needed — never commit .env

# Starts Docker Postgres (if needed), migrates, seeds, then Next.js
npm run db:up
npm run dev
```

App: [http://localhost:3000](http://localhost:3000)  
Admin / operator: [http://localhost:3000/admin/operator](http://localhost:3000/admin/operator)

Default local DB (from `.env.example`):

```text
postgresql://rugby365:rugby365@localhost:5433/rugby365
```

Operator password default: `rugby365-dev` (`OPERATOR_PASSWORD` in `.env`).

## Environment variables

Copy `.env.example` → `.env`. Minimum for local app + DB:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres connection (port **5433**) |
| `OPERATOR_PASSWORD` | Admin / operator gate |
| `NEXT_PUBLIC_APP_URL` | Usually `http://localhost:3000` |

Optional (integrations — ask a maintainer for tokens; do not commit them):

| Variable | Purpose |
|----------|---------|
| `RUGBY_DATA_API_BASE_URL` / `RUGBY_DATA_API_TOKEN` | Six Logic / Rugby Data (P1) feed |
| `WIKIMEDIA_ENTERPRISE_*` | Wikipedia archive import |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | AI features (CMS can also store a key) |

Planet Rugby SDMS endpoints used by import code do not require a separate key in `.env.example` for basic local UI work; full match/stats import flows need DB data and, for P1, the Rugby Data token.

## Everyday commands

| Command | What it does |
|---------|----------------|
| `npm run db:up` | Ensure Docker Postgres is up, migrate, seed |
| `npm run db:check` | Connectivity check |
| `npm run db:migrate` | Run Drizzle migrations only |
| `npm run db:seed` | Seed data |
| `npm run dev` | Ensure DB, then start Next.js on **3000** |
| `npm run dev:restart` | Kill port 3000, clear Next cache, restart web |
| `npm test` | Vitest |
| `npm run typecheck` | TypeScript across workspaces |
| `npm run demo:feed` | Replay demo live match feed (separate terminal) |

## Ports

| Port | Service |
|------|---------|
| **3000** | Next.js (`apps/web`) |
| **5433** | Postgres (host) → container `5432` |

If 3000 is busy: `npm run dev:kill-port` then `npm run dev`.

## Troubleshooting

**`Cannot connect to the Docker daemon`**  
Open Docker Desktop and wait until it is fully started, then `npm run db:up`.

**Postgres connection refused on 5433**  
Confirm `docker compose ps` shows `postgres` healthy/up. From repo root: `docker compose up -d`.

**`npm install` fails / wrong Node**  
Use Node 20+. Check with `node -v`. Avoid mixing yarn/pnpm lockfiles.

**Dev server stale / weird build errors**  
`npm run dev:restart` or `npm run dev:restart:full`.

**Need a clean DB volume** (destroys local data):

```bash
docker compose down -v
npm run db:up
```

## Repo layout (where to work)

```text
rugby365/
├── apps/web              # Next.js app + API routes + UI
├── packages/db           # Drizzle schema, migrations, seeds
├── packages/import-sdk   # Provider parsers (SDMS, etc.)
├── packages/commentary   # Commentary engine
├── docs/                 # Product and setup docs
└── scripts/              # DB helpers, demo feed, one-off jobs
```

## Security notes for contributors

- Never commit `.env`, API tokens, or operator passwords.
- Prefer SSH for GitHub push/pull on shared machines.
- Do not force-push `main` unless a maintainer asks you to.
