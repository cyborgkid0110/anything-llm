const fs = require("fs");
const os = require("os");
const path = require("path");
const { layout } = require("../src/layout");
const { prepare } = require("../src/setup");

let root, l;
const write = (file, text) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "desktop-setup-"));
  l = layout({
    userData: path.join(root, "user"),
    appRoot: path.join(root, "app"),
  });
  write(path.join(l.bundledAssets, "logo.png"), "bundled");
  write(
    path.join(l.bundledPrisma, "schema.prisma"),
    'datasource db {\n  provider = "sqlite"\n  url      = "file:../storage/x.db"\n}\n'
  );
  write(path.join(l.bundledPrisma, "migrations", "001", "migration.sql"), "A");
  write(path.join(l.bundledPrisma, "seed.js"), "not copied");
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

it("creates the user data folders", () => {
  prepare(l);
  for (const dir of [
    l.storage,
    l.hotdir,
    l.tmp,
    l.logs,
    l.chrome,
    l.collectorCwd,
  ])
    expect(fs.statSync(dir).isDirectory()).toBe(true);
});

it("seeds assets once and never overwrites user changes", () => {
  prepare(l);
  const asset = path.join(l.storage, "assets", "logo.png");
  expect(fs.readFileSync(asset, "utf8")).toBe("bundled");
  fs.writeFileSync(asset, "custom");
  prepare(l);
  expect(fs.readFileSync(asset, "utf8")).toBe("custom");
});

it("refreshes migrations on every start and rewrites the schema url", () => {
  prepare(l);
  write(path.join(l.bundledPrisma, "migrations", "002", "migration.sql"), "B");
  prepare(l);
  expect(fs.existsSync(path.join(l.prisma, "migrations", "002"))).toBe(true);
  expect(fs.existsSync(path.join(l.prisma, "seed.js"))).toBe(false);
  const schema = fs.readFileSync(path.join(l.prisma, "schema.prisma"), "utf8");
  expect(schema).toContain(`"file:${l.database.replace(/\\/g, "/")}"`);
  expect(schema).not.toContain("../storage/x.db");
});

it("fails with a clear error when user data is not writable", () => {
  fs.mkdirSync(l.userData, { recursive: true });
  fs.chmodSync(l.userData, 0o500);
  try {
    if (process.platform === "win32" || process.getuid?.() === 0) return; // no POSIX modes
    expect(() => prepare(l)).toThrow(/not writable/);
  } finally {
    fs.chmodSync(l.userData, 0o700);
  }
});
