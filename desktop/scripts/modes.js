const fs = require("fs");
const path = require("path");

/**
 * Dirs 755, files 644 (755 when any exec bit was set), symlinks untouched, so
 * the build machine's umask does not end up in the installer.
 */
function normalizeModes(root) {
  const walk = (dir) => {
    fs.chmodSync(dir, 0o755);
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile())
        fs.chmodSync(full, fs.statSync(full).mode & 0o111 ? 0o755 : 0o644);
    }
  };
  walk(root);
}

module.exports = { normalizeModes };
