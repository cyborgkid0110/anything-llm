const { globalShortcut } = require("electron");

const ACCELERATOR = "CommandOrControl+Alt+Space";

/** Registers the show/focus shortcut; failure is logged, not fatal. */
function registerShortcuts(onShow) {
  try {
    if (!globalShortcut.register(ACCELERATOR, onShow))
      console.warn(`[desktop] ${ACCELERATOR} is taken by another app`);
  } catch (error) {
    console.warn("[desktop] global shortcut failed:", error.message);
  }
}

function unregisterShortcuts() {
  globalShortcut.unregisterAll();
}

module.exports = { registerShortcuts, unregisterShortcuts };
