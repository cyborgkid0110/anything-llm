const { EventEmitter } = require("events");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  smokeEnabled,
  checkSetup,
  waitForLoad,
  reportSmoke,
} = require("../src/smoke");

describe("smokeEnabled", () => {
  it("is on only for the exact value 1", () => {
    expect(smokeEnabled({ ANYTHINGLLM_DESKTOP_SMOKE: "1" })).toBe(true);
    expect(smokeEnabled({ ANYTHINGLLM_DESKTOP_SMOKE: "true" })).toBe(false);
    expect(smokeEnabled({})).toBe(false);
  });
});

describe("checkSetup", () => {
  const payload = (results) => ({ results });

  it("passes with the engine on linux-x64", () => {
    const out = checkSetup(
      payload({ EmbeddedLemonadeEnabled: true, StorageDir: "/u/storage" }),
      { platform: "linux", arch: "x64" }
    );
    expect(out).toEqual({
      ok: true,
      summary: {
        platform: "linux",
        arch: "x64",
        embeddedLemonade: true,
        storageDir: "/u/storage",
      },
    });
  });

  it("fails when the engine is off on a supported platform", () => {
    for (const [platform, arch] of [
      ["linux", "x64"],
      ["win32", "x64"],
    ]) {
      const out = checkSetup(payload({ EmbeddedLemonadeEnabled: false }), {
        platform,
        arch,
      });
      expect(out.ok).toBe(false);
      expect(out.reason).toMatch(/EmbeddedLemonadeEnabled/);
    }
  });

  it("does not require the engine on other platforms", () => {
    const out = checkSetup(payload({}), { platform: "darwin", arch: "arm64" });
    expect(out.ok).toBe(true);
    expect(out.summary.embeddedLemonade).toBe(false);
  });

  it.each([[null], [{}], [{ results: "x" }]])("rejects %j", (bad) => {
    expect(checkSetup(bad, { platform: "linux", arch: "x64" }).ok).toBe(false);
  });
});

describe("waitForLoad", () => {
  it("resolves on did-finish-load", async () => {
    const wc = new EventEmitter();
    const done = waitForLoad(wc);
    wc.emit("did-finish-load");
    await expect(done).resolves.toBeUndefined();
  });

  it("rejects on did-fail-load", async () => {
    const wc = new EventEmitter();
    const done = waitForLoad(wc);
    wc.emit("did-fail-load", {}, -102, "ERR_CONNECTION_REFUSED");
    await expect(done).rejects.toThrow(/ERR_CONNECTION_REFUSED/);
  });
});

describe("reportSmoke", () => {
  it("writes stdout and the result file", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "desktop-smoke-"));
    const write = jest.spyOn(process.stdout, "write").mockReturnValue(true);
    try {
      reportSmoke(dir, "SMOKE OK {}\n");
      expect(write).toHaveBeenCalledWith("SMOKE OK {}\n");
      expect(fs.readFileSync(path.join(dir, "smoke-result.txt"), "utf8")).toBe(
        "SMOKE OK {}\n"
      );
    } finally {
      write.mockRestore();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("still prints when the folder is missing", () => {
    const write = jest.spyOn(process.stdout, "write").mockReturnValue(true);
    try {
      expect(() =>
        reportSmoke("/does/not/exist", "SMOKE FAIL x\n")
      ).not.toThrow();
      expect(write).toHaveBeenCalledWith("SMOKE FAIL x\n");
    } finally {
      write.mockRestore();
    }
  });
});
