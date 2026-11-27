const net = require("net");
const { freePort } = require("../src/ports");

const listen = (port) =>
  new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen({ port, host: "127.0.0.1" }, () => resolve(srv));
  });
const close = (srv) => new Promise((resolve) => srv.close(resolve));

it("returns the preferred port when it is free", async () => {
  const probe = await listen(0);
  const { port } = probe.address();
  await close(probe);
  expect(await freePort(port)).toBe(port);
});

it("falls back to another port when the preferred one is taken", async () => {
  const taken = await listen(0);
  const { port } = taken.address();
  const found = await freePort(port);
  await close(taken);
  expect(found).not.toBe(port);
  expect(found).toBeGreaterThan(0);
});

describe("pickPorts", () => {
  it("returns two distinct free ports", async () => {
    const { pickPorts } = require("../src/ports");
    const ports = await pickPorts({ server: 0, collector: 0, engine: 0 });
    const values = Object.values(ports);
    expect(values).toHaveLength(3);
    values.forEach((port) => expect(port).toBeGreaterThan(0));
    expect(new Set(values).size).toBe(3);
  });

  it("does not hand both services the same preferred port", async () => {
    const { pickPorts } = require("../src/ports");
    const probe = await listen(0);
    const { port } = probe.address();
    await close(probe);
    const { server, collector } = await pickPorts({
      server: port,
      collector: port,
    });
    expect(server).toBe(port);
    expect(collector).not.toBe(port);
  });
});
