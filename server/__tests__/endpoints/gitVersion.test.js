const ORIGINAL_ENV = process.env;

afterEach(() => {
  process.env = ORIGINAL_ENV;
  jest.restoreAllMocks();
});

function load(runtime) {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.ANYTHING_LLM_RUNTIME;
  if (runtime) process.env.ANYTHING_LLM_RUNTIME = runtime;
  const execSync = jest
    .spyOn(require("child_process"), "execSync")
    .mockReturnValue(Buffer.from("abc123\n"));
  let utils;
  jest.isolateModules(() => (utils = require("../../endpoints/utils")));
  return { getGitVersion: utils.getGitVersion, execSync };
}

describe("getGitVersion", () => {
  it.each(["docker", "desktop"])("skips git in %s", (runtime) => {
    const { getGitVersion, execSync } = load(runtime);
    expect(getGitVersion()).toBe("--");
    expect(execSync).not.toHaveBeenCalled();
  });

  it("asks git otherwise", () => {
    const { getGitVersion, execSync } = load(undefined);
    expect(getGitVersion()).toBe("abc123");
    expect(execSync).toHaveBeenCalled();
  });
});
