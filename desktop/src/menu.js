/** Minimal menu: Edit roles only, so clipboard shortcuts work and DevTools stay hidden. */
function menuTemplate(platform = process.platform) {
  const edit = {
    label: "Edit",
    submenu: [
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { role: "selectAll" },
    ],
  };
  return platform === "darwin" ? [{ role: "appMenu" }, edit] : [edit];
}

/** Packaged builds get the minimal menu; dev keeps Electron's default. */
function applyMenu(app) {
  if (!app.isPackaged) return;
  const { Menu } = require("electron");
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate()));
}

module.exports = { menuTemplate, applyMenu };
