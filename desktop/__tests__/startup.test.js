const { startBackend, isAddressInUse } = require("../src/startup");

const fakeBackend = ({ ready = true, serverLog = "", exitEarly } = {}) => {
  const running = {
    logFiles: { server: "s", collector: "c" },
    stop: jest.fn().mockResolvedValue(),
    waitForServer: jest.fn(async () => {
      if (!ready) throw new Error("Server exited (1) before it was ready.");
    }),
  };
  return { running, serverLog, exitEarly };
};

const run = (backends, extra = {}) => {
  let n = 0;
  const calls = [];
  const start = jest.fn((l, ports, options) => {
    const b = backends[n++];
    calls.push({ ports, options });
    if (b.exitEarly) options.onExit(b.exitEarly, 1);
    return b.running;
  });
  let port = 100;
  const pickPorts = jest.fn(async () => ({
    server: port++,
    collector: port++,
  }));
  const tail = (file) => backends[n - 1].serverLog + (file === "s" ? "" : "");
  return {
    calls,
    start,
    pickPorts,
    result: startBackend({ l: {}, start, pickPorts, tail, ...extra }),
  };
};

describe("isAddressInUse", () => {
  it.each([
    ["Error: listen EADDRINUSE: address already in use :::3001", true],
    ["bind: Address already in use", true],
    ["Cannot find module", false],
  ])("%s -> %s", (text, expected) => {
    expect(isAddressInUse(text)).toBe(expected);
  });
});

describe("startBackend", () => {
  it("returns the first backend that comes up", async () => {
    const { result, start, pickPorts } = run([fakeBackend()]);
    const { running, ports } = await result;
    expect(running).toBeDefined();
    expect(ports).toEqual({ server: 100, collector: 101 });
    expect(start).toHaveBeenCalledTimes(1);
    expect(pickPorts).toHaveBeenCalledTimes(1);
  });

  it("retries once with fresh ports after EADDRINUSE", async () => {
    const first = fakeBackend({
      ready: false,
      serverLog: "Error: listen EADDRINUSE: address already in use",
    });
    const { result, calls } = run([first, fakeBackend()]);
    const { ports } = await result;
    expect(first.running.stop).toHaveBeenCalled();
    expect(calls).toHaveLength(2);
    expect(ports).toEqual({ server: 102, collector: 103 });
  });

  it("retries when the collector dies early on EADDRINUSE", async () => {
    const first = fakeBackend({
      exitEarly: "collector",
      serverLog: "EADDRINUSE 8888",
    });
    const { result, calls } = run([first, fakeBackend()]);
    await result;
    expect(calls).toHaveLength(2);
  });

  it("does not retry other failures", async () => {
    const { result, start } = run([
      fakeBackend({ ready: false, serverLog: "TypeError: boom" }),
    ]);
    await expect(result).rejects.toThrow("before it was ready");
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("gives up after the attempt limit", async () => {
    const bad = () => fakeBackend({ ready: false, serverLog: "EADDRINUSE" });
    const { result, start } = run([bad(), bad(), bad()]);
    await expect(result).rejects.toThrow();
    expect(start).toHaveBeenCalledTimes(2);
  });

  it("forwards later exits to the caller's onExit", async () => {
    const onExit = jest.fn();
    const { result, calls } = run([fakeBackend()], { options: { onExit } });
    await result;
    calls[0].options.onExit("server", 9);
    expect(onExit).toHaveBeenCalledWith("server", 9);
  });
});
