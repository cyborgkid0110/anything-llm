const { BrowserWindow } = require("electron");

const HTML = `<!doctype html><meta charset="utf-8"><title>AnythingLLM</title>
<style>html,body{height:100%;margin:0;background:#0e0f0f;color:#f4f4f5;
font:15px system-ui,sans-serif;display:flex;align-items:center;justify-content:center}</style>
<body>Starting AnythingLLM…</body>`;

/** Small frameless "Starting…" window shown while the backend boots. */
function createSplash() {
  const win = new BrowserWindow({
    width: 360,
    height: 160,
    frame: false,
    resizable: false,
    backgroundColor: "#0e0f0f",
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  win.webContents.on("will-navigate", (event) => event.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(HTML));
  return win;
}

module.exports = { createSplash };
