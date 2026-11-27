const { tailFile } = require("./logs");

/** True when a startup failure was a port another process grabbed first. */
const isAddressInUse = (text) =>
  /EADDRINUSE|address already in use/i.test(text);

/**
 * Picks ports and starts the backend; retries once with fresh ports when a
 * port was taken between picking and binding.
 * @returns {Promise<{running: object, ports: object}>}
 */
async function startBackend({
  l,
  options = {},
  pickPorts,
  start,
  attempts = 2,
  tail = tailFile,
}) {
  for (let attempt = 1; ; attempt++) {
    const ports = await pickPorts();
    let booting = true;
    let early = null;
    const running = start(l, ports, {
      ...options,
      onExit: (name, code) => {
        if (booting) early = { name, code };
        else options.onExit?.(name, code);
      },
    });
    try {
      await running.waitForServer();
      if (early)
        throw new Error(
          `The ${early.name} exited (${early.code}) during startup.`
        );
      booting = false;
      return { running, ports };
    } catch (error) {
      await running.stop();
      const logs = Object.values(running.logFiles ?? {}).map((f) => tail(f));
      const retry = isAddressInUse([error.message, ...logs].join("\n"));
      if (!retry || attempt >= attempts) throw error;
      console.warn("[desktop] port in use, retrying with new ports");
    }
  }
}

module.exports = { startBackend, isAddressInUse };
