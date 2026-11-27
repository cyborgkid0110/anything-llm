const path = require("path");

/**
 * Every path the shell needs: app code (read-only) and user data (writable).
 * @param {{userData: string, appRoot: string}} dirs
 */
function layout({ userData, appRoot }) {
  const serverDir = path.join(appRoot, "server");
  const collectorDir = path.join(appRoot, "collector");
  const storage = path.join(userData, "storage");
  return {
    appRoot,
    serverDir,
    collectorDir,
    serverEntry: path.join(serverDir, "index.js"),
    collectorEntry: path.join(collectorDir, "index.js"),
    bundledAssets: path.join(serverDir, "storage", "assets"),
    bundledPrisma: path.join(serverDir, "prisma"),
    prismaCli: path.join(
      serverDir,
      "node_modules",
      "prisma",
      "build",
      "index.js"
    ),
    userData,
    storage,
    envFile: path.join(userData, ".env"),
    database: path.join(storage, "anythingllm.db"),
    prisma: path.join(userData, "prisma"),
    hotdir: path.join(userData, "hotdir"),
    tmp: path.join(userData, "tmp"),
    logs: path.join(userData, "logs"),
    models: path.join(storage, "models", "embedded-lemonade"),
    chrome: path.join(userData, "chrome"),
    collectorCwd: path.join(userData, "collector"),
  };
}

/** Repo root in dev, the resources folder when packaged. */
function appRootFor(app) {
  return app.isPackaged
    ? process.resourcesPath
    : path.resolve(__dirname, "../..");
}

module.exports = { layout, appRootFor };
