const { normalizeModes } = require("./modes");

/** electron-builder recreates folders with the build machine's umask; reset them before packing. */
exports.default = async function afterPack(context) {
  if (process.platform !== "win32") normalizeModes(context.appOutDir);
};
