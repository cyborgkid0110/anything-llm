const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { withDatabaseUrl } = require("./schema");

/** Fails fast: an unwritable userData would regenerate SIG_KEY/SIG_SALT every boot. */
function assertWritable(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
    const probe = path.join(dir, ".write-test");
    fs.writeFileSync(probe, "");
    fs.rmSync(probe);
  } catch (error) {
    throw new Error(`The data folder ${dir} is not writable: ${error.message}`);
  }
}

/** Copies keep the source's modes, and a read-only install must not make user data read-only. */
function makeWritable(target) {
  if (!fs.existsSync(target)) return;
  fs.chmodSync(target, 0o755);
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) makeWritable(full);
    else if (entry.isFile()) fs.chmodSync(full, 0o644);
  }
}

/** Creates the user-data folders, seeds assets and refreshes the Prisma copy. */
function prepare(l) {
  assertWritable(l.userData);
  for (const dir of [
    l.storage,
    l.hotdir,
    l.tmp,
    l.logs,
    l.chrome,
    l.collectorCwd,
  ])
    fs.mkdirSync(dir, { recursive: true });

  // Never overwrite assets the user may have changed.
  const assets = path.join(l.storage, "assets");
  if (fs.existsSync(l.bundledAssets)) {
    fs.cpSync(l.bundledAssets, assets, { recursive: true, force: false });
    makeWritable(assets);
  }

  // Migrations change between versions, so mirror them on every start.
  const migrations = path.join(l.prisma, "migrations");
  makeWritable(l.prisma);
  fs.rmSync(migrations, { recursive: true, force: true });
  fs.mkdirSync(l.prisma, { recursive: true });
  fs.cpSync(path.join(l.bundledPrisma, "migrations"), migrations, {
    recursive: true,
  });
  makeWritable(l.prisma);
  const schema = fs.readFileSync(
    path.join(l.bundledPrisma, "schema.prisma"),
    "utf8"
  );
  fs.writeFileSync(
    path.join(l.prisma, "schema.prisma"),
    withDatabaseUrl(schema, "file:" + l.database)
  );
}

/** Runs `prisma migrate deploy` against the user-data copy of the schema. */
function migrate(l) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        l.prismaCli,
        "migrate",
        "deploy",
        "--schema",
        path.join(l.prisma, "schema.prisma"),
      ],
      {
        cwd: l.serverDir,
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: "1",
          CHECKPOINT_DISABLE: "1",
        },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      }
    );
    let output = "";
    const collect = (chunk) => (output += chunk);
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(`prisma migrate deploy exited with ${code}\n${output}`)
          )
    );
  });
}

module.exports = { prepare, migrate, assertWritable };
