const fs = require("fs");
const path = require("path");
const { spawn, execFile } = require("child_process");
const { serverEnv, collectorEnv } = require("./env");
const { rotateLog, tailFile } = require("./logs");
const { lemondBinary, killOrphans } = require("./orphans");

const STOP_GRACE_MS = 10_000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Runs `entry` as a Node child of the Electron binary, logging to `logFile`. */
function launch(name, entry, { cwd, env, logFile, onExit }) {
  rotateLog(logFile);
  const fd = fs.openSync(logFile, "a");
  const proc = { name, logFile, stopping: false, done: false, code: null };
  try {
    proc.child = spawn(process.execPath, [entry], {
      cwd,
      env,
      stdio: ["ignore", fd, fd],
      windowsHide: true,
    });
  } finally {
    fs.closeSync(fd);
  }
  proc.exited = new Promise((resolve) => {
    proc.child.once("exit", (code, signal) => {
      proc.done = true;
      proc.code = code ?? signal;
      resolve();
      if (!proc.stopping) onExit?.(name, proc.code);
    });
    proc.child.once("error", (err) => {
      if (proc.done) return;
      fs.appendFileSync(logFile, `spawn failed: ${err.message}\n`);
      proc.done = true;
      proc.code = "spawn-error";
      resolve();
      if (!proc.stopping) onExit?.(name, proc.code);
    });
  });
  return proc;
}

/** Stops a child: SIGTERM then SIGKILL on POSIX, `taskkill /T` on Windows. */
async function stopProcess(proc) {
  if (!proc || proc.done) return;
  proc.stopping = true;
  if (process.platform === "win32") {
    await new Promise((resolve) =>
      execFile(
        "taskkill",
        ["/PID", String(proc.child.pid), "/T", "/F"],
        resolve
      )
    );
  } else {
    proc.child.kill("SIGTERM");
    const timer = setTimeout(() => proc.child.kill("SIGKILL"), STOP_GRACE_MS);
    await proc.exited;
    clearTimeout(timer);
  }
  await proc.exited;
}

/**
 * Starts the collector and the server.
 * @param {object} l layout
 * @param {{server: number, collector: number}} ports
 * @param {{onExit?: (name: string, code: any) => void, chromePath?: string}} options
 */
function start(l, ports, { onExit, chromePath } = {}) {
  const launchCollector = (chrome) =>
    launch("collector", l.collectorEntry, {
      cwd: l.collectorCwd,
      env: collectorEnv(l, ports, process.env, { chromePath: chrome }),
      logFile: path.join(l.logs, "collector.log"),
      onExit,
    });

  // lemond leads its own process group, so a hard-killed server leaves it behind.
  const cleanupLemond = () =>
    process.platform === "win32"
      ? Promise.resolve()
      : killOrphans(lemondBinary(l.storage)).catch(() => {});
  cleanupLemond(); // leftovers from a previous crash

  let stopped = false;
  let restarting = Promise.resolve();
  let collector = launchCollector(chromePath);
  // cwd is userData so dotenv finds <userData>/.env.
  const server = launch("server", l.serverEntry, {
    cwd: l.userData,
    env: serverEnv(l, ports),
    logFile: path.join(l.logs, "server.log"),
    onExit,
  });
  const serverGone = server.exited.then(cleanupLemond);

  async function waitForServer(timeoutMs = 60_000) {
    const deadline = Date.now() + timeoutMs;
    const url = `http://127.0.0.1:${ports.server}/api/ping`;
    while (Date.now() < deadline) {
      if (server.done)
        throw new Error(
          `Server exited (${server.code}) before it was ready.\n${tailFile(server.logFile)}`
        );
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
        if (res.ok) return;
      } catch {
        // not listening yet
      }
      await sleep(500);
    }
    throw new Error(
      `Server did not respond within ${timeoutMs / 1000}s.\n${tailFile(server.logFile)}`
    );
  }

  /** Restarts only the collector, e.g. once Chrome has been downloaded. */
  function restartCollector(chrome) {
    if (stopped) return Promise.resolve();
    restarting = (async () => {
      await stopProcess(collector);
      // stop() may have begun while the old collector was shutting down.
      if (!stopped) collector = launchCollector(chrome);
    })();
    return restarting;
  }

  async function stop() {
    stopped = true;
    await restarting.catch(() => {});
    await Promise.all([stopProcess(server), stopProcess(collector)]);
    await serverGone;
  }

  return { waitForServer, restartCollector, stop };
}

module.exports = { start };
