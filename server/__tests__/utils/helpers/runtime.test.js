const ORIGINAL_ENV = process.env;

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

function load(runtime) {
  process.env = { ...ORIGINAL_ENV, ANYTHING_LLM_RUNTIME: runtime };
  let runtimeModule;
  jest.isolateModules(
    () => (runtimeModule = require("../../../utils/helpers/runtime"))
  );
  return runtimeModule;
}

describe("runtime", () => {
  it.each([
    ["docker", { isDocker: true, isCloud: false, isDesktop: false }],
    ["cloud", { isDocker: false, isCloud: true, isDesktop: false }],
    ["desktop", { isDocker: false, isCloud: false, isDesktop: true }],
    ["", { isDocker: false, isCloud: false, isDesktop: false }],
  ])("detects %p", (runtime, expected) => {
    const r = load(runtime);
    expect({
      isDocker: r.isDocker(),
      isCloud: r.isCloud(),
      isDesktop: r.isDesktop(),
    }).toEqual(expected);
  });
});

describe("startupEnv", () => {
  it("snapshots the environment at require time", () => {
    process.env = { ...ORIGINAL_ENV, SNAPSHOT_PROBE: "before" };
    let snapshot;
    jest.isolateModules(
      () => (snapshot = require("../../../utils/boot/startupEnv").STARTUP_ENV)
    );
    process.env.SNAPSHOT_PROBE = "after";
    process.env.LATE_KEY = "late";
    expect(snapshot.SNAPSHOT_PROBE).toBe("before");
    expect(snapshot.LATE_KEY).toBeUndefined();
    expect(Object.isFrozen(snapshot)).toBe(true);
  });
});
