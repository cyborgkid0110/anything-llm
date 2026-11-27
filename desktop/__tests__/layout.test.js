const path = require("path");
const { layout } = require("../src/layout");

it("lays out user data and app code", () => {
  const l = layout({ userData: "/u", appRoot: "/app" });
  expect(l).toEqual({
    appRoot: "/app",
    serverDir: path.join("/app", "server"),
    collectorDir: path.join("/app", "collector"),
    serverEntry: path.join("/app", "server", "index.js"),
    collectorEntry: path.join("/app", "collector", "index.js"),
    bundledAssets: path.join("/app", "server", "storage", "assets"),
    bundledPrisma: path.join("/app", "server", "prisma"),
    prismaCli: path.join(
      "/app",
      "server",
      "node_modules",
      "prisma",
      "build",
      "index.js"
    ),
    userData: "/u",
    storage: path.join("/u", "storage"),
    envFile: path.join("/u", ".env"),
    database: path.join("/u", "storage", "anythingllm.db"),
    prisma: path.join("/u", "prisma"),
    hotdir: path.join("/u", "hotdir"),
    tmp: path.join("/u", "tmp"),
    logs: path.join("/u", "logs"),
    models: path.join("/u", "storage", "models", "embedded-lemonade"),
    chrome: path.join("/u", "chrome"),
    collectorCwd: path.join("/u", "collector"),
  });
});
