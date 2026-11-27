const fs = require("fs");
const path = require("path");

const LIBC = { linux: "gnu", win32: "msvc" };

/**
 * Whether a native package suffix like `linux-x64-gnu` or `win32-x64-msvc`
 * belongs to the build platform. Variants of other libcs (musl) are dropped.
 */
function matchesPlatform(suffix, { platform, arch }) {
  const [os, cpu, abi] = suffix.split("-");
  if (os !== platform || cpu !== arch) return false;
  return abi === undefined || abi === LIBC[platform];
}

/** Packages whose names end in a platform suffix (napi-rs and sharp style). */
const SUFFIXED = [
  /^@lancedb\/lancedb-(.+)$/,
  /^@mintplex-labs\/mdpdf-(.+)$/,
  /^@img\/sharp-libvips-(.+)$/,
  /^@img\/sharp-(.+)$/,
];

/** True when `pkg` (e.g. `@img/sharp-linux-x64`) is for another platform. */
function isForeignPackage(pkg, target) {
  for (const pattern of SUFFIXED) {
    const match = pattern.exec(pkg);
    if (match) return !matchesPlatform(match[1], target);
  }
  return false;
}

function dirSize(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += dirSize(full);
    else if (entry.isFile()) total += fs.statSync(full).size;
  }
  return total;
}

/** All `node_modules` dirs under `root` (nested copies included). */
function findNodeModules(root) {
  const found = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const full = path.join(dir, entry.name);
      if (entry.name === "node_modules") {
        found.push(full);
        // Nested node_modules live inside packages, so keep walking one level of packages.
        for (const pkg of fs.readdirSync(full, { withFileTypes: true })) {
          if (!pkg.isDirectory()) continue;
          const pkgDir = path.join(full, pkg.name);
          if (pkg.name.startsWith("@"))
            for (const sub of fs.readdirSync(pkgDir))
              walk(path.join(pkgDir, sub));
          else walk(pkgDir);
        }
      } else if (!entry.name.startsWith(".")) {
        walk(full);
      }
    }
  };
  walk(root);
  return found;
}

/**
 * Removes native binaries for other platforms below `root`.
 * @returns {{removed: string[], bytes: number}}
 */
function pruneNative(
  root,
  target = { platform: process.platform, arch: process.arch }
) {
  const removed = [];
  let bytes = 0;
  const remove = (dir) => {
    bytes += dirSize(dir);
    fs.rmSync(dir, { recursive: true, force: true });
    removed.push(path.relative(root, dir));
  };

  for (const modules of findNodeModules(root)) {
    if (!fs.existsSync(modules)) continue; // removed with a parent
    for (const scope of ["@lancedb", "@mintplex-labs", "@img"]) {
      const scopeDir = path.join(modules, scope);
      if (!fs.existsSync(scopeDir)) continue;
      for (const name of fs.readdirSync(scopeDir))
        if (isForeignPackage(`${scope}/${name}`, target))
          remove(path.join(scopeDir, name));
    }
    // onnxruntime-node/bin/napi-v3/<os>/<arch>
    const napi = path.join(modules, "onnxruntime-node", "bin", "napi-v3");
    if (fs.existsSync(napi)) {
      for (const os of fs.readdirSync(napi)) {
        const osDir = path.join(napi, os);
        if (os !== target.platform) {
          remove(osDir);
          continue;
        }
        for (const cpu of fs.readdirSync(osDir))
          if (cpu !== target.arch) remove(path.join(osDir, cpu));
      }
    }
  }
  return { removed, bytes };
}

module.exports = { matchesPlatform, isForeignPackage, pruneNative, dirSize };
