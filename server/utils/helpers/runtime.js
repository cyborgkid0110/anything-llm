/**
 * Where this instance is running, from the ANYTHING_LLM_RUNTIME environment variable.
 * - "docker": set by the Dockerfile.
 * - "cloud": set by the launcher on AnythingLLM Cloud instances.
 * - "desktop": set by the desktop app (or `yarn dev:desktop`) when it starts the server.
 * Unset on bare metal installs.
 */

function isDocker() {
  return process.env.ANYTHING_LLM_RUNTIME === "docker";
}

function isCloud() {
  return process.env.ANYTHING_LLM_RUNTIME === "cloud";
}

function isDesktop() {
  return process.env.ANYTHING_LLM_RUNTIME === "desktop";
}

module.exports = { isDocker, isCloud, isDesktop };
