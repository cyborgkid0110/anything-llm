const { spawn } = require("child_process");
const electron = require("electron");

// Chromium reads --no-sandbox before main.js runs, so it has to be a CLI flag.
// Dev only: hosts that block unprivileged user namespaces cannot run the sandbox helper.
// Extra CLI args (e.g. --remote-debugging-port) pass through to Electron.
const args = [".", ...process.argv.slice(2)];
if (
  process.platform === "linux" &&
  process.env.ANYTHINGLLM_DESKTOP_NO_SANDBOX === "1"
)
  args.push("--no-sandbox");

const child = spawn(electron, args, { stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("close", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
