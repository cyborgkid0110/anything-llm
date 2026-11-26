const fs = require("fs");
const os = require("os");
const path = require("path");

const ORIGINAL_ENV = process.env;
let dir;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "dumpenv-"));
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
  fs.rmSync(dir, { recursive: true, force: true });
});

it("writes to ANYTHING_LLM_ENV_FILE when set", () => {
  const target = path.join(dir, ".env");
  process.env = {
    ...ORIGINAL_ENV,
    ANYTHING_LLM_ENV_FILE: target,
    SIG_KEY: "k".repeat(32),
  };
  const { dumpENV } = require("../../../utils/helpers/updateENV");
  expect(dumpENV()).toBe(true);
  expect(fs.readFileSync(target, "utf8")).toMatch(/SIG_KEY='k{32}'/);
});
