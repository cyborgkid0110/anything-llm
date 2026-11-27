const fs = require("fs");
const {
  BrowserWindow,
  Notification,
  dialog,
  ipcMain,
  shell,
} = require("electron");
const { fileFilters, pathKind, notification } = require("./bridgeArgs");
const { sameOrigin } = require("./navigation");

/**
 * Registers the allow-listed IPC handlers. Every call must come from the app
 * origin and every argument is validated before use.
 * @param {object} l layout
 * @param {string} origin app origin, e.g. http://127.0.0.1:3001
 */
function registerIpc(l, origin) {
  const handle = (channel, fn) =>
    ipcMain.handle(channel, (event, ...args) => {
      const url = event.senderFrame?.url;
      if (!url || !sameOrigin(url, origin)) throw new Error("Untrusted sender");
      return fn(event, ...args);
    });

  const pick = async (event, properties, filters = []) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      properties,
      filters,
    });
    return canceled || !filePaths.length ? null : filePaths[0];
  };

  handle("desktop:pick-file", (event, filters) =>
    pick(event, ["openFile"], fileFilters(filters))
  );
  handle("desktop:pick-folder", (event) => pick(event, ["openDirectory"]));

  handle("desktop:open-path", async (_event, kind) => {
    const dir = l[pathKind(kind)];
    fs.mkdirSync(dir, { recursive: true });
    return (await shell.openPath(dir)) === "";
  });

  handle("desktop:notify", (_event, input) => {
    const { title, body } = notification(input);
    if (!Notification.isSupported()) return false;
    new Notification({ title, body }).show();
    return true;
  });
}

module.exports = { registerIpc };
