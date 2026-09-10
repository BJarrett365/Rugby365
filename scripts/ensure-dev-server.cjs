#!/usr/bin/env node
/**
 * Start Next.js on :3000 if it is not already listening.
 * The child is detached so it survives the terminal / agent session that launched it.
 */
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT || 3000);
const LOG_DIR = path.join(ROOT, ".logs");
const LOG = path.join(LOG_DIR, "next-dev.log");

function checkPort(port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port, timeout: timeoutMs });
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

async function main() {
  if (await checkPort(PORT)) {
    console.log(`[dev:ensure] already running at http://localhost:${PORT}`);
    return;
  }

  fs.mkdirSync(LOG_DIR, { recursive: true });
  const out = fs.openSync(LOG, "a");
  const pathEnv = [
    "/opt/homebrew/bin",
    "/usr/local/bin",
    process.env.PATH || "",
  ].join(":");

  const child = spawn("npm", ["run", "dev"], {
    cwd: ROOT,
    detached: true,
    stdio: ["ignore", out, out],
    env: { ...process.env, PATH: pathEnv },
  });
  child.unref();
  console.log(`[dev:ensure] started Next.js (pid ${child.pid}) at http://localhost:${PORT}`);
  console.log(`[dev:ensure] logs: ${LOG}`);
}

main().catch((error) => {
  console.error("[dev:ensure]", error instanceof Error ? error.message : error);
  process.exit(1);
});
