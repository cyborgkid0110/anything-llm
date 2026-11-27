const fs = require("fs");
const path = require("path");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** The lemond binary the server of this user-data dir starts. */
const lemondBinary = (storage) =>
  path.join(storage, "engines", "embedded-lemonade", "lemond", "lemond");

/** Process group id from /proc/<pid>/stat; `comm` may contain spaces and parens. */
function parsePgrp(stat) {
  const rest = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
  const pgrp = Number(rest[2]);
  return Number.isInteger(pgrp) ? pgrp : null;
}

/**
 * Processes whose argv[0] is exactly `binary`. Matching the full path keeps
 * other user-data dirs and other apps' lemond untouched.
 * @returns {{pid: number, pgrp: number|null}[]}
 */
function findByBinary(binary, procRoot = "/proc") {
  const found = [];
  let entries = [];
  try {
    entries = fs.readdirSync(procRoot);
  } catch {
    return found;
  }
  for (const name of entries) {
    if (!/^\d+$/.test(name)) continue;
    try {
      const argv0 = fs
        .readFileSync(path.join(procRoot, name, "cmdline"), "utf8")
        .split("\0")[0];
      if (argv0 !== binary) continue;
      const stat = fs.readFileSync(path.join(procRoot, name, "stat"), "utf8");
      found.push({ pid: Number(name), pgrp: parsePgrp(stat) });
    } catch {
      // process exited while scanning
    }
  }
  return found;
}

/**
 * SIGTERMs leftover lemond processes (and their group, which holds the
 * llama.cpp backends), then SIGKILLs the ones that are still alive after
 * `graceMs`. The SIGTERM goes out synchronously; await the result to wait.
 * Only pids found in the first scan are ever SIGKILLed.
 */
function killOrphans(
  binary,
  { procRoot = "/proc", kill = process.kill, graceMs = 5000, wait = sleep } = {}
) {
  const send = (proc, signal) => {
    // Detached lemond leads its own group; otherwise only touch the pid.
    const target = proc.pgrp === proc.pid ? -proc.pid : proc.pid;
    try {
      kill(target, signal);
    } catch {
      // already gone
    }
  };
  const first = findByBinary(binary, procRoot);
  if (!first.length) return Promise.resolve(0);
  for (const proc of first) send(proc, "SIGTERM");
  return wait(graceMs).then(() => {
    const alive = new Set(findByBinary(binary, procRoot).map((p) => p.pid));
    const survivors = first.filter((proc) => alive.has(proc.pid));
    for (const proc of survivors) send(proc, "SIGKILL");
    return first.length;
  });
}

module.exports = { lemondBinary, parsePgrp, findByBinary, killOrphans };
