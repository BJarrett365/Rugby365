// Vitest runs in plain Node without Next.js's "react-server" export condition,
// so the real `server-only` package would throw on every import. This stub
// makes it a no-op for tests while still enforcing the client/server boundary
// in the actual Next.js build.
export default undefined;
