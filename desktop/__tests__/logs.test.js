const fs = require("fs");
const os = require("os");
const path = require("path");
const { rotateLog, tailFile } = require("../src/logs");

let dir;
beforeEach(
  () => (dir = fs.mkdtempSync(path.join(os.tmpdir(), "desktop-logs-")))
);
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("rotateLog", () => {
  it("renames a log above the size limit to .1", () => {
    const file = path.join(dir, "server.log");
    fs.writeFileSync(file, "x".repeat(20));
    rotateLog(file, 10);
    expect(fs.existsSync(file)).toBe(false);
    expect(fs.readFileSync(file + ".1", "utf8")).toBe("x".repeat(20));
  });

  it("keeps a small log and tolerates a missing one", () => {
    const file = path.join(dir, "server.log");
    fs.writeFileSync(file, "small");
    rotateLog(file, 10);
    expect(fs.existsSync(file)).toBe(true);
    expect(() => rotateLog(path.join(dir, "none.log"), 10)).not.toThrow();
  });
});

describe("tailFile", () => {
  it("returns the last lines of a file", () => {
    const file = path.join(dir, "a.log");
    fs.writeFileSync(file, ["one", "two", "three", "four"].join("\n") + "\n");
    expect(tailFile(file, 2)).toBe("three\nfour");
  });

  it("returns an empty string for a missing file", () => {
    expect(tailFile(path.join(dir, "none.log"), 5)).toBe("");
  });
});
