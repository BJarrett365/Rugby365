import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["packages/**/*.test.ts", "apps/web/src/lib/**/*.test.ts"] },
  resolve: {
    alias: {
      // `server-only` throws unconditionally outside of Next.js's "react-server"
      // bundling condition (which Vitest/Node does not set), so stub it out here.
      "server-only": path.resolve(__dirname, "test/stubs/server-only.js"),
    },
  },
});
