const path = require("path");
const { app, dialog, shell } = require("electron");
const { layout, appRootFor } = require("./layout");
const { pickPorts } = require("./ports");
const { startBackend } = require("./startup");
const {
  SMOKE_TIMEOUT_MS,
  reportSmoke,
  smokeEnabled,
  waitForLoad,
  checkServer,
} = require("./smoke");
const { tailFile } = require("./logs");
const { prepare, migrate, assertWritable } = require("./setup");
const backend = require("./backend");
const { installedChromePath, ensureChrome } = require("./chrome");
const { createMainWindow } = require("./window");
const { createSplash } = require("./splash");
const { applyMenu } = require("./menu");
const { registerIpc } = require("./ipc");
const { createTray, hideOnClose } = require("./tray");
const { registerShortcuts, unregisterShortcuts } = require("./shortcuts");

// Own folder so this build never shares data with the official desktop app; tests and dev runs
// point it at a throwaway profile.
app.setPath(
  "userData",
  process.env.ANYTHINGLLM_DESKTOP_USER_DATA
    ? path.resolve(process.env.ANYTHINGLLM_DESKTOP_USER_DATA)
    : path.join(app.getPath("appData"), "anythingllm-custom")
);

// CI start check: boot everything, check the API, print one line and exit.
const smoke = smokeEnabled();

// Chromium's single-instance lock lives in userData and fails silently when it
// is read-only, so check before requesting the lock.
let writable = true;
try {
  assertWritable(app.getPath("userData"));
} catch (error) {
  writable = false;
  console.error(error.message);
  // Before ready, Linux prints the box to stderr instead of showing it.
  app.whenReady().then(() => {
    if (!smoke)
      dialog.showErrorBox("AnythingLLM could not start", error.message);
    else reportSmoke(app.getPath("userData"), `SMOKE FAIL ${error.message}\n`);
    app.exit(1);
  });
}

let l;
let running;
let win;
let splash;
let tray;
let quitting = false;
let stopping = null;
let failed = false;

function showWindow() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function closeSplash() {
  if (splash && !splash.isDestroyed()) splash.close();
}

async function smokeFail(reason) {
  if (failed) return;
  failed = true;
  quitting = true;
  const logs = l
    ? ["server", "collector"].map(
        (name) =>
          `--- ${name}.log\n${tailFile(path.join(l.logs, `${name}.log`))}`
      )
    : [];
  reportSmoke(
    app.getPath("userData"),
    `SMOKE FAIL ${reason}\n${logs.join("\n")}\n`
  );
  await running?.stop().catch(() => {});
  app.exit(1);
}

async function fail(title, detail) {
  if (smoke) return smokeFail(`${title} ${detail}`);
  if (failed) return;
  // Set first: closing the splash must not quit the app under the dialog.
  failed = true;
  closeSplash();
  const { response } = await dialog.showMessageBox({
    type: "error",
    title: "AnythingLLM",
    message: title,
    detail: String(detail).slice(0, 2000),
    buttons: ["Open logs", "Quit"],
    defaultId: 1,
    cancelId: 1,
  });
  if (response === 0 && l) await shell.openPath(l.logs);
  quitting = true;
  app.quit();
}

/** Chrome for link scraping downloads after the UI is up; the collector restarts once it lands. */
async function installChromeInBackground() {
  try {
    const chromePath = await ensureChrome(l);
    if (running && !quitting) await running.restartCollector(chromePath);
  } catch (error) {
    console.warn("[desktop] Chrome download failed:", error.message);
  }
}

function chromePathIfInstalled() {
  try {
    return installedChromePath(l) ?? undefined;
  } catch {
    return undefined;
  }
}

async function boot() {
  l = layout({ userData: app.getPath("userData"), appRoot: appRootFor(app) });
  splash = createSplash();
  if (smoke) setTimeout(() => smokeFail("timed out"), SMOKE_TIMEOUT_MS).unref();
  try {
    prepare(l);
    await migrate(l);
    const started = await startBackend({
      l,
      pickPorts,
      start: (...args) => (running = backend.start(...args)),
      options: {
        chromePath: smoke ? undefined : chromePathIfInstalled(),
        onExit: (name, code) => {
          if (!quitting)
            fail(
              `The ${name} stopped unexpectedly (${code}).`,
              "See the logs for details."
            );
        },
      },
    });
    const { ports } = started;

    const baseUrl = `http://127.0.0.1:${ports.server}`;
    registerIpc(l, new URL(baseUrl).origin);
    applyMenu(app);
    win = createMainWindow(baseUrl, {
      preload: path.join(__dirname, "preload.js"),
      autoHideMenuBar: app.isPackaged,
    });
    win.once("ready-to-show", closeSplash);

    if (smoke) {
      await waitForLoad(win.webContents);
      const summary = await checkServer(baseUrl, process);
      reportSmoke(
        app.getPath("userData"),
        `SMOKE OK ${JSON.stringify(summary)}\n`
      );
      quitting = true;
      await running.stop();
      app.exit(0);
      return;
    }

    tray = createTray({
      iconPath: path.join(__dirname, "../assets/icon.png"),
      baseUrl,
      dataDir: l.userData,
      logsDir: l.logs,
      onShow: showWindow,
      onQuit: () => app.quit(),
    });
    // Without a tray, closing the window quits the app.
    if (tray)
      hideOnClose(win, {
        isQuitting: () => quitting,
        noticeFile: path.join(l.userData, ".tray-notice"),
      });
    registerShortcuts(showWindow);
    installChromeInBackground();
  } catch (error) {
    await fail("AnythingLLM could not start.", error.message);
  }
}

if (!writable || !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", showWindow);
  app.on("window-all-closed", () => {
    if (!failed) app.quit();
  });
  app.on("will-quit", unregisterShortcuts);
  // Stop the children first, then quit for real.
  app.on("before-quit", (event) => {
    quitting = true;
    if (!running || stopping === "done") return;
    event.preventDefault();
    if (stopping) return;
    tray?.destroy();
    tray = null;
    stopping = running.stop().finally(() => {
      stopping = "done";
      app.quit();
    });
  });
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => app.quit());
  app.whenReady().then(boot);
}
