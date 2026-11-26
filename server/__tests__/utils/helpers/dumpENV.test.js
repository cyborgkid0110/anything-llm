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

describe("default target", () => {
  const defaultPath = path.resolve(__dirname, "../../../.env");

  it.each([
    ["unset", undefined],
    ["empty", ""],
  ])("writes server/.env when ANYTHING_LLM_ENV_FILE is %s", (_, value) => {
    process.env = { ...ORIGINAL_ENV, SIG_KEY: "k".repeat(32) };
    delete process.env.ANYTHING_LLM_ENV_FILE;
    if (value !== undefined) process.env.ANYTHING_LLM_ENV_FILE = value;
    const { dumpENV } = require("../../../utils/helpers/updateENV");
    const write = jest.spyOn(fs, "writeFileSync").mockImplementation(() => {});
    expect(dumpENV()).toBe(true);
    expect(write).toHaveBeenCalledTimes(1);
    expect(path.resolve(write.mock.calls[0][0])).toBe(defaultPath);
    write.mockRestore();
  });
});
