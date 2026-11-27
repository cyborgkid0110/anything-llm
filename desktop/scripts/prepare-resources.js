const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { shouldCopy } = require("./copyFilter");
const { pruneNative, dirSize } = require("./prune");
const { normalizeModes } = require("./modes");

const root = path.resolve(__dirname, "../..");
const out = path.resolve(__dirname, "../build/resources");
const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(0)} MB`;

function run(cmd, args, options) {
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });
  if (result.status !== 0)
    throw new Error(`${cmd} ${args.join(" ")} failed (${result.status})`);
}

function copyPackage(pkg) {
  const src = path.join(root, pkg);
  fs.cpSync(src, path.join(out, pkg), {
    recursive: true,
    filter: (file) => shouldCopy(pkg, path.relative(src, file)),
  });
}

function installProduction(pkg) {
  run(
    "yarn",
    [
      "install",
      "--production",
      "--frozen-lockfile",
      "--network-timeout",
      "600000",
    ],
    // Chrome is downloaded by the app at runtime.
    {
      cwd: path.join(out, pkg),
      env: { ...process.env, PUPPETEER_SKIP_DOWNLOAD: "true" },
    }
  );
}

function main() {
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  for (const pkg of ["server", "collector"]) {
    console.log(`\n== ${pkg}: copy + production install`);
    copyPackage(pkg);
    installProduction(pkg);
  }

  console.log("\n== prisma generate");
  run(
    process.execPath,
    [
      "node_modules/prisma/build/index.js",
      "generate",
      "--schema",
      "prisma/schema.prisma",
    ],
    {
      cwd: path.join(out, "server"),
      env: { ...process.env, CHECKPOINT_DISABLE: "1" },
    }
  );

  console.log("\n== frontend");
  if (!fs.existsSync(path.join(root, "frontend", "node_modules")))
    run(
      "yarn",
      ["install", "--frozen-lockfile", "--network-timeout", "600000"],
      {
        cwd: path.join(root, "frontend"),
      }
    );
  run(process.execPath, [
    path.join(__dirname, "build-frontend.js"),
    "--out",
    path.join(out, "server", "public"),
  ]);

  console.log(
    `\n== prune native binaries (${process.platform}-${process.arch})`
  );
  for (const pkg of ["server", "collector"]) {
    const { removed, bytes } = pruneNative(path.join(out, pkg));
    for (const entry of removed) console.log(`  removed ${pkg}/${entry}`);
    console.log(`  ${pkg}: ${removed.length} removed, ${mb(bytes)} saved`);
  }

  if (process.platform !== "win32") {
    console.log("\n== normalize modes");
    normalizeModes(out);
  }

  console.log("\n== sizes");
  for (const pkg of ["server", "collector"])
    console.log(`  ${pkg}: ${mb(dirSize(path.join(out, pkg)))}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
