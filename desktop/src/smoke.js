const fs = require("fs");
const path = require("path");

const SMOKE_TIMEOUT_MS = 120_000;
// Platforms with a lemond build: the engine must be on there.
const ENGINE_PLATFORMS = ["linux-x64", "win32-x64"];

const smokeEnabled = (env = process.env) =>
  env.ANYTHINGLLM_DESKTOP_SMOKE === "1";

/**
 * Validates the /api/setup-complete payload.
 * @returns {{ok: boolean, reason?: string, summary?: object}}
 */
function checkSetup(
  payload,
  { platform = process.platform, arch = process.arch } = {}
) {
  const results = payload?.results;
  if (!results || typeof results !== "object")
    return { ok: false, reason: "setup-complete returned no results" };
  const engine = results.EmbeddedLemonadeEnabled === true;
  if (ENGINE_PLATFORMS.includes(`${platform}-${arch}`) && !engine)
    return { ok: false, reason: "EmbeddedLemonadeEnabled is not true" };
  return {
    ok: true,
    summary: {
      platform,
      arch,
      embeddedLemonade: engine,
      storageDir: results.StorageDir ?? null,
    },
  };
}

/** Resolves when the window has loaded, rejects when the load fails. */
function waitForLoad(webContents) {
  return new Promise((resolve, reject) => {
    webContents.once("did-finish-load", resolve);
    webContents.once("did-fail-load", (_event, code, description) =>
      reject(new Error(`Window failed to load: ${description} (${code})`))
    );
  });
}

/** Fetches and validates setup-complete from the running server. */
async function checkServer(baseUrl, target) {
  const res = await fetch(`${baseUrl}/api/setup-complete`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`setup-complete returned ${res.status}`);
  const result = checkSetup(await res.json(), target);
  if (!result.ok) throw new Error(result.reason);
  return result.summary;
}

/**
 * Prints the result and also writes it to `<userData>/smoke-result.txt`: a GUI
 * exe on Windows may not have a stdout the CI step can read.
 */
function reportSmoke(userData, text) {
  process.stdout.write(text);
  try {
    fs.writeFileSync(path.join(userData, "smoke-result.txt"), text);
  } catch {
    // stdout still has it
  }
}

module.exports = {
  SMOKE_TIMEOUT_MS,
  reportSmoke,
  smokeEnabled,
  checkSetup,
  waitForLoad,
  checkServer,
};
