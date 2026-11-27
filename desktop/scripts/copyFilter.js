const KEEP_ASSETS = new Set([
  "storage",
  "storage/assets",
  "storage/assets/anything-llm.png",
  "storage/assets/anything-llm-invert.png",
]);

// Dev-only files at a package root.
const ROOT_DEV_FILES = new Set([
  ".gitignore",
  ".nvmrc",
  ".flowconfig",
  "nodemon.json",
  "eslint.config.mjs",
  "jsconfig.json",
]);

function common(rel) {
  const parts = rel.split("/");
  const base = parts[parts.length - 1];
  return (
    parts.includes("node_modules") ||
    parts.includes("__tests__") ||
    base.startsWith(".env") ||
    base.endsWith(".log")
  );
}

/**
 * Whether a path (relative to its package root, posix separators) is copied.
 * Only the default logos from server storage are kept; setup.js seeds them.
 */
function shouldCopy(pkg, relPath) {
  const rel = relPath.replace(/\\/g, "/");
  if (!rel || rel === ".") return true;
  if (common(rel) || ROOT_DEV_FILES.has(rel)) return false;
  if (pkg === "server") {
    if (rel === "public" || rel.startsWith("public/")) return false;
    if (rel === "storage" || rel.startsWith("storage/"))
      return KEEP_ASSETS.has(rel);
  }
  if (pkg === "collector") {
    if (rel === "storage" || rel.startsWith("storage/")) return false;
    if (rel.startsWith("hotdir/")) return rel === "hotdir/__HOTDIR__.md";
  }
  return true;
}

module.exports = { shouldCopy };
