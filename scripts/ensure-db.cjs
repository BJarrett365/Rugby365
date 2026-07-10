#!/usr/bin/env node
/**
 * Ensures Docker Postgres is up on :5433, then migrates and seeds.
 * Used by `npm run dev` and `npm run db:up`.
 */
const net = require("node:net");
const { execSync } = require("node:child_process");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.PGPORT || 5433);
const HOST = process.env.PGHOST || "127.0.0.1";

function checkPort(host, port, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port, timeout: timeoutMs });
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findDocker() {
  const candidates = [
    process.env.DOCKER_BIN,
    "docker",
    "/usr/local/bin/docker",
    "/opt/homebrew/bin/docker",
    `${process.env.HOME}/.docker/bin/docker`,
    "/Applications/Docker.app/Contents/Resources/bin/docker",
  ].filter(Boolean);

  for (const bin of candidates) {
    try {
      execSync(`"${bin}" version`, { stdio: "ignore", timeout: 15_000 });
      return bin;
    } catch {
      /* try next */
    }
  }
  return null;
}

function run(cmd, options = {}) {
  execSync(cmd, { stdio: "inherit", cwd: ROOT, ...options });
}

function dockerReady(docker) {
  try {
    execSync(`"${docker}" info`, { stdio: "ignore", timeout: 15_000 });
    return true;
  } catch {
    return false;
  }
}

async function waitForDocker(docker, attempts = 45) {
  if (dockerReady(docker)) return;

  try {
    execSync("open -a Docker", { stdio: "ignore" });
  } catch {
    /* Docker Desktop may already be running under another name */
  }

  process.stdout.write("[db] Waiting for Docker");
  for (let i = 0; i < attempts; i++) {
    if (dockerReady(docker)) {
      process.stdout.write("\n");
      return;
    }
    process.stdout.write(".");
    await sleep(2000);
  }
  process.stdout.write("\n");
  throw new Error("Docker Desktop did not become ready. Open Docker Desktop, then run: npm run db:up");
}

async function waitForPostgres(attempts = 30) {
  process.stdout.write(`[db] Waiting for Postgres on ${HOST}:${PORT}`);
  for (let i = 0; i < attempts; i++) {
    if (await checkPort(HOST, PORT)) {
      process.stdout.write("\n");
      return;
    }
    process.stdout.write(".");
    await sleep(1000);
  }
  process.stdout.write("\n");
  throw new Error(`Postgres did not start on ${HOST}:${PORT}. Check: docker compose logs postgres`);
}

async function main() {
  if (await checkPort(HOST, PORT)) {
    console.log(`[db] Postgres already listening on ${HOST}:${PORT}`);
    run("npm run db:migrate");
    run("node scripts/repair-db-schema.mjs");
    run("npm run db:seed");
    console.log("[db] Ready.");
    return;
  }

  console.log(`[db] Nothing listening on ${HOST}:${PORT} — starting Docker Postgres...`);

  const docker = findDocker();
  if (!docker) {
    console.error("[db] Docker CLI not found.");
    console.error("[db] Install Docker Desktop, open it, then run: npm run db:up");
    process.exit(1);
  }

  await waitForDocker(docker);
  run(`"${docker}" compose up -d`);
  await waitForPostgres();
  run("npm run db:migrate");
  run("node scripts/repair-db-schema.mjs");
  run("npm run db:seed");
  console.log("[db] Ready.");
}

main().catch((error) => {
  console.error(`[db] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
