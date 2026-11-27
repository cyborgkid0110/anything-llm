const fs = require("fs");
const os = require("os");
const path = require("path");
const { normalizeModes } = require("../scripts/modes");

const itPosix = process.platform === "win32" ? it.skip : it;
const mode = (file) => fs.statSync(file).mode & 0o777;

itPosix("normalizes modes and keeps the exec bit", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "desktop-modes-"));
  try {
    const dir = path.join(root, "a", "b");
    fs.mkdirSync(dir, { recursive: true });
    fs.chmodSync(dir, 0o775);
    const plain = path.join(dir, "index.js");
    const exe = path.join(dir, "rg");
    const group = path.join(dir, "lib.node");
    fs.writeFileSync(plain, "x");
    fs.writeFileSync(exe, "x");
    fs.writeFileSync(group, "x");
    fs.chmodSync(plain, 0o664);
    fs.chmodSync(exe, 0o775);
    fs.chmodSync(group, 0o666);
    fs.symlinkSync("index.js", path.join(dir, "link"));

    normalizeModes(root);

    expect(mode(root)).toBe(0o755);
    expect(mode(dir)).toBe(0o755);
    expect(mode(plain)).toBe(0o644);
    expect(mode(group)).toBe(0o644);
    expect(mode(exe)).toBe(0o755);
    expect(fs.lstatSync(path.join(dir, "link")).isSymbolicLink()).toBe(true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
