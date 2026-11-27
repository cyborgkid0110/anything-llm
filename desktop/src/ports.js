const net = require("net");

const HOST = "127.0.0.1";

function tryListen(port) {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen({ port, host: HOST }, () => {
      const { port: bound } = srv.address();
      srv.close(() => resolve(bound));
    });
  });
}

/** Resolves `preferred` when free, otherwise any free localhost port. */
async function freePort(preferred) {
  try {
    return await tryListen(preferred);
  } catch {
    return tryListen(0);
  }
}

/** Server, collector and engine ports; never the same one twice. */
async function pickPorts({
  server = 3001,
  collector = 8888,
  engine = 13355,
} = {}) {
  const ports = {};
  const taken = new Set();
  for (const [name, preferred] of Object.entries({
    server,
    collector,
    engine,
  })) {
    let port = await freePort(preferred);
    while (taken.has(port)) port = await freePort(0);
    taken.add(port);
    ports[name] = port;
  }
  return ports;
}

module.exports = { freePort, pickPorts };
