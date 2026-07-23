/**
 * Allow tsx scripts to import apps/web lib modules that pull in "server-only".
 * Usage: npx tsx --require ./scripts/stub-server-only.cjs scripts/….ts
 */
const Module = require("module");
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "server-only") return {};
  return originalLoad(request, parent, isMain);
};
