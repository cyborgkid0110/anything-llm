const fs = require("fs");

const HOST = "127.0.0.1";
// Keys the shell owns; never inherited from the parent env.
const OWNED = [
  "ANYTHING_LLM_RUNTIME",
  "STORAGE_DIR",
  "NODE_ENV",
  "ENABLE_BUILT_IN_LLM",
];

/** Forward slashes keep Prisma happy with Windows paths. */
const fileUrl = (p) => "file:" + p.replace(/\\/g, "/");

function shared(l, ports, base) {
  const env = { ...base };
  for (const key of OWNED) delete env[key];
  return {
    ...env,
    ELECTRON_RUN_AS_NODE: "1",
    NODE_ENV: "production",
    STORAGE_DIR: l.storage,
    COLLECTOR_PORT: String(ports.collector),
    COLLECTOR_HOTDIR: l.hotdir,
  };
}

/**
 * True when Chromium's sandbox cannot start without a setuid helper, i.e.
 * unprivileged user namespaces are restricted (Ubuntu 24.04+ AppArmor, or the
 * Debian sysctl). Only then does the collector's Chrome need --no-sandbox.
 */
function userNamespacesRestricted(read = (f) => fs.readFileSync(f, "utf8")) {
  const value = (file) => {
    try {
      return String(read(file)).trim();
    } catch {
      return null;
    }
  };
  return (
    value("/proc/sys/kernel/apparmor_restrict_unprivileged_userns") === "1" ||
    value("/proc/sys/kernel/unprivileged_userns_clone") === "0"
  );
}

/** Env for the server child. */
function serverEnv(
  l,
  ports,
  base = process.env,
  {
    platform = process.platform,
    sandboxRestricted = platform === "linux" && userNamespacesRestricted(),
  } = {}
) {
  const env = {
    ...shared(l, ports, base),
    ANYTHING_LLM_RUNTIME: "desktop",
    SERVER_PORT: String(ports.server),
    SERVER_HOST: HOST,
    ANYTHING_LLM_ENV_FILE: l.envFile,
    ANYTHING_LLM_DATABASE_URL: fileUrl(l.database),
    CHECKPOINT_DISABLE: "1",
  };
  // Keeps the built-in engine off a port another instance may hold.
  if (ports.engine) env.EMBEDDED_LEMONADE_PORT = String(ports.engine);
  if (platform === "linux" && sandboxRestricted)
    env.ANYTHINGLLM_CHROMIUM_ARGS = "--no-sandbox";
  return env;
}

/** Env for the collector child; `chromePath` is set once Chrome is installed. */
function collectorEnv(l, ports, base = process.env, { chromePath } = {}) {
  const env = {
    ...shared(l, ports, base),
    COLLECTOR_HOST: HOST,
    COLLECTOR_TMPDIR: l.tmp,
    PUPPETEER_CACHE_DIR: l.chrome,
  };
  if (chromePath) env.PUPPETEER_EXECUTABLE_PATH = chromePath;
  return env;
}

module.exports = {
  serverEnv,
  collectorEnv,
  fileUrl,
  userNamespacesRestricted,
};
