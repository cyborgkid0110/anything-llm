const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("anythingDesktop", {
  isDesktop: true,
  platform: process.platform,
  pickFile: (options) =>
    ipcRenderer.invoke("desktop:pick-file", options?.filters ?? []),
  pickFolder: () => ipcRenderer.invoke("desktop:pick-folder"),
  openPath: (kind) => ipcRenderer.invoke("desktop:open-path", kind),
  notify: (title, body = "") =>
    ipcRenderer.invoke("desktop:notify", { title, body }),
});
