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
  if (fs.existsSync(l.bundledAssets))
    fs.cpSync(l.bundledAssets, path.join(l.storage, "assets"), {
      recursive: true,
      force: false,
    });

  // Migrations change between versions, so mirror them on every start.
  const migrations = path.join(l.prisma, "migrations");
  fs.rmSync(migrations, { recursive: true, force: true });
  fs.mkdirSync(l.prisma, { recursive: true });
  fs.cpSync(path.join(l.bundledPrisma, "migrations"), migrations, {
    recursive: true,
  });
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
