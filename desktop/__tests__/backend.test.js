const fs = require("fs");
const os = require("os");
const path = require("path");
const { layout } = require("../src/layout");
const backend = require("../src/backend");

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const until = async (check, ms = 5000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (check()) return true;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return check();
};

let root, l, pidFile;
const pids = () =>
  fs.existsSync(pidFile)
    ? fs.readFileSync(pidFile, "utf8").split("\n").filter(Boolean).map(Number)
    : [];

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "desktop-backend-"));
  l = layout({ userData: path.join(root, "u"), appRoot: root });
  pidFile = path.join(root, "collector.pids");
  fs.mkdirSync(l.logs, { recursive: true });
  fs.mkdirSync(l.collectorCwd, { recursive: true });
  fs.mkdirSync(l.userData, { recursive: true });
  fs.mkdirSync(l.collectorDir, { recursive: true });
  fs.mkdirSync(l.serverDir, { recursive: true });
  fs.writeFileSync(l.serverEntry, "setInterval(() => {}, 1000);");
  fs.writeFileSync(
    l.collectorEntry,
    `require("fs").appendFileSync(${JSON.stringify(pidFile)}, process.pid + "\\n");
setInterval(() => {}, 1000);`
  );
});
afterEach(() => {
  for (const pid of pids()) if (alive(pid)) process.kill(pid, "SIGKILL");
  fs.rmSync(root, { recursive: true, force: true });
});

const ports = { server: 1, collector: 2 };

it("stops both children", async () => {
  const running = backend.start(l, ports);
  expect(await until(() => pids().length === 1)).toBe(true);
  await running.stop();
  expect(pids().every((pid) => !alive(pid))).toBe(true);
});

it("does not launch a collector when stop begins during a restart", async () => {
  const running = backend.start(l, ports);
  expect(await until(() => pids().length === 1)).toBe(true);
  const restart = running.restartCollector("/chrome");
  await running.stop();
  await restart;
  expect(pids()).toHaveLength(1);
  expect(pids().every((pid) => !alive(pid))).toBe(true);
});

it("ignores restarts after stop", async () => {
  const running = backend.start(l, ports);
  expect(await until(() => pids().length === 1)).toBe(true);
  await running.stop();
  await running.restartCollector("/chrome");
  expect(pids()).toHaveLength(1);
});

it("restarts the collector while running", async () => {
  const running = backend.start(l, ports);
  expect(await until(() => pids().length === 1)).toBe(true);
  await running.restartCollector("/chrome");
  expect(await until(() => pids().length === 2)).toBe(true);
  const [first, second] = pids();
  expect(alive(first)).toBe(false);
  expect(alive(second)).toBe(true);
  await running.stop();
});
