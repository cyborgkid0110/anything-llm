const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  lemondBinary,
  parsePgrp,
  findByBinary,
  killOrphans,
} = require("../src/orphans");

const BIN = lemondBinary("/u/storage");
let proc;

const addProc = (pid, argv, pgrp = pid, comm = "lemond") => {
  const dir = path.join(proc, String(pid));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "cmdline"), argv.join("\0") + "\0");
  fs.writeFileSync(
    path.join(dir, "stat"),
    `${pid} (${comm}) S 1 ${pgrp} ${pgrp} 0 -1 4194560`
  );
};
const removeProc = (pid) =>
  fs.rmSync(path.join(proc, String(pid)), { recursive: true });

beforeEach(() => (proc = fs.mkdtempSync(path.join(os.tmpdir(), "fake-proc-"))));
afterEach(() => fs.rmSync(proc, { recursive: true, force: true }));

it("builds the lemond path inside the storage dir", () => {
  expect(BIN).toBe(
    path.join("/u/storage", "engines", "embedded-lemonade", "lemond", "lemond")
  );
});

describe("parsePgrp", () => {
  it("handles spaces and parens in the command name", () => {
    expect(parsePgrp("12 (a b) c) S 1 345 345 0")).toBe(345);
    expect(parsePgrp("12 (lemond) S 1 99 99 0")).toBe(99);
  });
});

describe("findByBinary", () => {
  it("matches only this install's binary", () => {
    addProc(100, [BIN, "--port", "1"]);
    addProc(101, [lemondBinary("/other/storage"), "--port", "2"]);
    addProc(102, ["/bin/sh", BIN]);
    addProc(103, ["/usr/bin/node", "server.js"]);
    addProc(104, [BIN + "-other"]);
    fs.mkdirSync(path.join(proc, "self"));
    expect(findByBinary(BIN, proc)).toEqual([{ pid: 100, pgrp: 100 }]);
  });

  it("returns nothing for a missing /proc", () => {
    expect(findByBinary(BIN, path.join(proc, "nope"))).toEqual([]);
  });
});

describe("killOrphans", () => {
  it("terminates the group, then kills only survivors of the first scan", async () => {
    addProc(100, [BIN]); // leads its group, survives SIGTERM
    addProc(200, [BIN], 150); // not a leader: signal the pid only, exits
    const sent = [];
    const kill = (target, signal) => sent.push([target, signal]);
    const wait = async () => {
      removeProc(200);
      addProc(300, [BIN]); // started by the new server meanwhile
    };
    const count = await killOrphans(BIN, { procRoot: proc, kill, wait });
    expect(count).toBe(2);
    expect(sent).toEqual([
      [-100, "SIGTERM"],
      [200, "SIGTERM"],
      [-100, "SIGKILL"],
    ]);
  });

  it("does nothing when there are no leftovers", async () => {
    const kill = jest.fn();
    expect(await killOrphans(BIN, { procRoot: proc, kill })).toBe(0);
    expect(kill).not.toHaveBeenCalled();
  });

  it("ignores processes that vanish before the signal", async () => {
    addProc(100, [BIN]);
    const kill = () => {
      throw new Error("ESRCH");
    };
    await expect(
      killOrphans(BIN, { procRoot: proc, kill, wait: async () => {} })
    ).resolves.toBe(1);
  });
});
