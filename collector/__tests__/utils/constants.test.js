/* eslint-env jest, node */
const path = require("path");
const ORIGINAL_ENV = process.env;

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

function load(env = {}) {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.COLLECTOR_HOTDIR;
  delete process.env.COLLECTOR_TMPDIR;
  Object.assign(process.env, env);
  let constants;
  jest.isolateModules(() => (constants = require("../../utils/constants")));
  return constants;
}

describe("collector directories", () => {
  it("defaults to folders next to the code", () => {
    const { WATCH_DIRECTORY, TMP_DIRECTORY } = load();
    expect(WATCH_DIRECTORY).toBe(path.resolve(__dirname, "../../hotdir"));
    expect(TMP_DIRECTORY).toBe(path.resolve(__dirname, "../../storage/tmp"));
  });

  it("uses COLLECTOR_HOTDIR and COLLECTOR_TMPDIR when set", () => {
    const { WATCH_DIRECTORY, TMP_DIRECTORY } = load({
      COLLECTOR_HOTDIR: "/x/hotdir",
      COLLECTOR_TMPDIR: "/x/tmp",
    });
    expect(WATCH_DIRECTORY).toBe("/x/hotdir");
    expect(TMP_DIRECTORY).toBe("/x/tmp");
  });
});
