/* eslint-env jest, node */
const fs = require("fs");
const os = require("os");
const path = require("path");

const ORIGINAL_ENV = process.env;
let root;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "wipe-"));
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
  fs.rmSync(root, { recursive: true, force: true });
});

it("empties COLLECTOR_HOTDIR and COLLECTOR_TMPDIR, keeping the placeholders", async () => {
  const hotdir = path.join(root, "hotdir");
  const tmp = path.join(root, "tmp");
  fs.mkdirSync(hotdir);
  fs.mkdirSync(tmp);
  for (const [dir, names] of [
    [hotdir, ["a.txt", "b.pdf", "__HOTDIR__.md"]],
    [tmp, ["c.wav", ".placeholder"]],
  ]) {
    for (const name of names) fs.writeFileSync(path.join(dir, name), "x");
  }

  process.env = {
    ...ORIGINAL_ENV,
    STORAGE_DIR: root,
    COLLECTOR_HOTDIR: hotdir,
    COLLECTOR_TMPDIR: tmp,
  };
  let files;
  jest.isolateModules(() => (files = require("../../../utils/files")));
  jest.spyOn(console, "log").mockImplementation(() => {});
  await files.wipeCollectorStorage();

  expect(fs.readdirSync(hotdir)).toEqual(["__HOTDIR__.md"]);
  expect(fs.readdirSync(tmp)).toEqual([".placeholder"]);
});
