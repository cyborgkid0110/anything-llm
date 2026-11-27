const fs = require("fs");
const { Menu, Notification, Tray, nativeImage, shell } = require("electron");
const { engineLabel } = require("./engineLabel");

const POLL_MS = 10_000;

/**
 * Tray icon with Show / engine status / Quit. Returns null when the platform
 * has no tray, so the caller can fall back to quit-on-close.
 */
function createTray({ iconPath, baseUrl, dataDir, logsDir, onShow, onQuit }) {
  let tray;
  try {
    const icon = nativeImage
      .createFromPath(iconPath)
      .resize({ width: 16, height: 16 });
    tray = new Tray(icon);
  } catch (error) {
    console.warn("[desktop] tray unavailable:", error.message);
    return null;
  }
  tray.setToolTip("AnythingLLM");
  tray.on("click", onShow);

  let label = null;
  const render = () =>
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: "Show AnythingLLM", click: onShow },
        ...(label ? [{ label, enabled: false }] : []),
        { label: "Open data folder", click: () => shell.openPath(dataDir) },
        { label: "Open logs folder", click: () => shell.openPath(logsDir) },
        { type: "separator" },
        { label: "Quit", click: onQuit },
      ])
    );

  // The status route only exists with the built-in engine; hide the row otherwise.
  async function refresh() {
    let next = null;
    try {
      const res = await fetch(`${baseUrl}/api/utils/embedded-lemonade/status`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) next = engineLabel(await res.json());
    } catch {
      // server busy or stopping
    }
    if (next !== label) {
      label = next;
      render();
    }
  }

  render();
  refresh();
  const timer = setInterval(refresh, POLL_MS);
  return {
    destroy() {
      clearInterval(timer);
      tray.destroy();
    },
  };
}

/** Hides the window instead of closing it; tells the user once. */
function hideOnClose(win, { isQuitting, noticeFile }) {
  win.on("close", (event) => {
    if (isQuitting()) return;
    event.preventDefault();
    win.hide();
    if (fs.existsSync(noticeFile) || !Notification.isSupported()) return;
    fs.writeFileSync(noticeFile, "");
    new Notification({
      title: "AnythingLLM",
      body: "AnythingLLM is still running in the tray.",
    }).show();
  });
}

module.exports = { createTray, hideOnClose };
