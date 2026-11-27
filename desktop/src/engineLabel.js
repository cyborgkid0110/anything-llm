const LABELS = {
  idle: "idle",
  starting: "starting",
  ready: "ready",
  error: "error",
};

/** Tray label for the engine status payload, or null when there is none. */
function engineLabel(status) {
  if (!status || typeof status !== "object") return null;
  if (status.state === "installing")
    return Number.isFinite(status.progress)
      ? `Engine: downloading ${status.progress}%`
      : "Engine: downloading";
  return `Engine: ${LABELS[status.state] ?? "unknown"}`;
}

module.exports = { engineLabel };
