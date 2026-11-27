const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "../..");
const frontend = path.join(root, "frontend");
// Optional `--out <dir>`; defaults to server/public for the dev run.
const outArg = process.argv.indexOf("--out");
const outDir =
  outArg > -1
    ? path.resolve(process.argv[outArg + 1])
    : path.join(root, "server", "public");

// Same layout the Docker build and frontend/scripts/postbuild.js produce.
const build = spawnSync(
  "npx",
  ["vite", "build", "--outDir", outDir, "--emptyOutDir"],
  {
    cwd: frontend,
    env: { ...process.env, VITE_API_BASE: "/api" },
    stdio: "inherit",
    shell: process.platform === "win32",
  }
);
if (build.status !== 0) process.exit(build.status ?? 1);

fs.renameSync(
  path.join(outDir, "index.html"),
  path.join(outDir, "_index.html")
);
console.log(`Frontend built into ${outDir}`);
