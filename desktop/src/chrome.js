const fs = require("fs");
const path = require("path");
const {
  Browser,
  computeExecutablePath,
  detectBrowserPlatform,
  install,
} = require("@puppeteer/browsers");

/** The Chrome build the collector's puppeteer expects. */
function chromeBuildId(l) {
  const file = path.join(
    l.collectorDir,
    "node_modules/puppeteer-core/lib/cjs/puppeteer/revisions.js"
  );
  return require(file).PUPPETEER_REVISIONS.chrome;
}

/** Path of the installed Chrome, or null when it has not been downloaded yet. */
function installedChromePath(l) {
  const executable = computeExecutablePath({
    browser: Browser.CHROME,
    buildId: chromeBuildId(l),
    cacheDir: l.chrome,
  });
  return fs.existsSync(executable) ? executable : null;
}

/** Downloads Chrome into user data (no-op when present) and returns its path. */
async function ensureChrome(l) {
  const existing = installedChromePath(l);
  if (existing) return existing;
  const installed = await install({
    browser: Browser.CHROME,
    buildId: chromeBuildId(l),
    cacheDir: l.chrome,
    platform: detectBrowserPlatform(),
  });
  return installed.executablePath;
}

module.exports = { chromeBuildId, installedChromePath, ensureChrome };
