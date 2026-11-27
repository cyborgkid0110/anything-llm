const { BrowserWindow, shell } = require("electron");
const {
  sameOrigin,
  isExternalHttp,
  permissionAllowed,
  frameNavigationAllowed,
} = require("./navigation");

/** Keeps the window on the app origin; external links open in the OS browser. */
function lockNavigation(win, origin) {
  const { webContents } = win;
  const guard = (event) => {
    if (sameOrigin(event.url, origin)) return;
    event.preventDefault();
    if (isExternalHttp(event.url, origin)) shell.openExternal(event.url);
  };
  webContents.on("will-navigate", guard);
  webContents.on("will-redirect", guard);
  webContents.on("will-frame-navigate", (event) => {
    if (event.isMainFrame || frameNavigationAllowed(event.url, origin)) return;
    event.preventDefault();
  });
  webContents.on("will-attach-webview", (event) => event.preventDefault());
  webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalHttp(url, origin)) shell.openExternal(url);
    return { action: "deny" };
  });
}

function lockPermissions(session, origin) {
  session.setPermissionRequestHandler((_wc, permission, callback, details) =>
    callback(
      permissionAllowed({
        permission,
        url: details.requestingUrl,
        origin,
        mediaTypes: details.mediaTypes,
      })
    )
  );
  session.setPermissionCheckHandler(
    (_wc, permission, requestingOrigin, details) =>
      permissionAllowed({
        permission,
        url: details.requestingUrl || requestingOrigin,
        origin,
        mediaTypes: details.mediaType ? [details.mediaType] : undefined,
      })
  );
}

/**
 * Creates the hidden main window and loads the app.
 * @param {string} url app URL, e.g. http://127.0.0.1:3001
 */
function createMainWindow(url, { preload, autoHideMenuBar = false }) {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 360,
    minHeight: 560,
    show: false,
    autoHideMenuBar,
    backgroundColor: "#0e0f0f",
    webPreferences: {
      preload,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  });
  const { origin } = new URL(url);
  lockNavigation(win, origin);
  lockPermissions(win.webContents.session, origin);
  win.once("ready-to-show", () => win.show());
  win.loadURL(url);
  return win;
}

module.exports = { createMainWindow };
