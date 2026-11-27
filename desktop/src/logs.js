const fs = require("fs");

const MAX_LOG_BYTES = 10 * 1024 * 1024;
const TAIL_WINDOW = 64 * 1024;

/** Moves an oversized log to `<file>.1` so the next run starts fresh. */
function rotateLog(file, maxBytes = MAX_LOG_BYTES) {
  try {
    if (fs.statSync(file).size > maxBytes) fs.renameSync(file, file + ".1");
  } catch {
    // no log yet
  }
}

/** Last `lines` lines of a file, or "" when it cannot be read. */
function tailFile(file, lines = 50) {
  try {
    const { size } = fs.statSync(file);
    const fd = fs.openSync(file, "r");
    try {
      const length = Math.min(size, TAIL_WINDOW);
      const buffer = Buffer.alloc(length);
      fs.readSync(fd, buffer, 0, length, size - length);
      return buffer
        .toString("utf8")
        .trimEnd()
        .split("\n")
        .slice(-lines)
        .join("\n");
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return "";
  }
}

module.exports = { rotateLog, tailFile };
