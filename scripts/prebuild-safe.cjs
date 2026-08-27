/** Skip local port-kill on Netlify/CI — only used by root `npm run build`. */
if (process.env.NETLIFY || process.env.CI) {
  process.exit(0);
}
const { execSync } = require("child_process");
try {
  execSync("npm run dev:kill-port", { stdio: "inherit" });
} catch {
  // ignore
}
