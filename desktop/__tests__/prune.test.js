const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  matchesPlatform,
  isForeignPackage,
  pruneNative,
} = require("../scripts/prune");

const linux = { platform: "linux", arch: "x64" };
const win = { platform: "win32", arch: "x64" };

describe("matchesPlatform", () => {
  it.each([
    ["linux-x64-gnu", linux, true],
    ["linux-x64-musl", linux, false],
    ["linux-arm64-gnu", linux, false],
    ["win32-x64-msvc", linux, false],
    ["win32-x64-msvc", win, true],
    ["win32-arm64-msvc", win, false],
    ["darwin-arm64", win, false],
    ["linux-x64", linux, true],
    ["linuxmusl-x64", linux, false],
    ["wasm32", linux, false],
  ])("%s on %j -> %s", (suffix, target, expected) => {
    expect(matchesPlatform(suffix, target)).toBe(expected);
  });
});

describe("isForeignPackage", () => {
  it.each([
    ["@lancedb/lancedb-linux-x64-gnu", linux, false],
    ["@lancedb/lancedb-linux-x64-musl", linux, true],
    ["@lancedb/lancedb-win32-x64-msvc", linux, true],
    ["@lancedb/lancedb-win32-x64-msvc", win, false],
    ["@mintplex-labs/mdpdf-linux-arm64-gnu", linux, true],
    ["@img/sharp-linux-x64", linux, false],
    ["@img/sharp-linuxmusl-x64", linux, true],
    ["@img/sharp-libvips-linux-x64", linux, false],
    ["@img/sharp-libvips-linuxmusl-x64", linux, true],
    ["@img/sharp-win32-x64", win, false],
    ["@lancedb/lancedb", linux, false],
    ["@mintplex-labs/mdpdf", linux, false],
    ["@mintplex-labs/bree", linux, false],
    ["lodash", linux, false],
  ])("%s on %j -> %s", (pkg, target, expected) => {
    expect(isForeignPackage(pkg, target)).toBe(expected);
  });
});

describe("pruneNative", () => {
  let root;
  const touch = (rel) => {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "x".repeat(10));
  };
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "desktop-prune-"));
    for (const rel of [
      "node_modules/@lancedb/lancedb-linux-x64-gnu/a.node",
      "node_modules/@lancedb/lancedb-linux-x64-musl/a.node",
      "node_modules/@img/sharp-linux-x64/a.node",
      "node_modules/@img/sharp-linuxmusl-x64/a.node",
      "node_modules/@mintplex-labs/mdpdf-linux-x64-gnu/a.node",
      "node_modules/@mintplex-labs/mdpdf-linux-x64-musl/a.node",
      "node_modules/onnxruntime-node/bin/napi-v3/linux/x64/lib.so",
      "node_modules/onnxruntime-node/bin/napi-v3/linux/arm64/lib.so",
      "node_modules/onnxruntime-node/bin/napi-v3/win32/x64/o.dll",
      "node_modules/onnxruntime-node/bin/napi-v3/darwin/arm64/o.dylib",
      "node_modules/@xenova/transformers/node_modules/onnxruntime-node/bin/napi-v3/win32/x64/o.dll",
      "node_modules/@xenova/transformers/node_modules/onnxruntime-node/bin/napi-v3/linux/x64/lib.so",
    ])
      touch(rel);
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("keeps only the target platform, including nested copies", () => {
    const { removed, bytes } = pruneNative(root, linux);
    const left = (rel) => fs.existsSync(path.join(root, rel));
    expect(left("node_modules/@lancedb/lancedb-linux-x64-gnu/a.node")).toBe(
      true
    );
    expect(left("node_modules/@lancedb/lancedb-linux-x64-musl")).toBe(false);
    expect(left("node_modules/@img/sharp-linux-x64/a.node")).toBe(true);
    expect(left("node_modules/@img/sharp-linuxmusl-x64")).toBe(false);
    expect(left("node_modules/@mintplex-labs/mdpdf-linux-x64-gnu/a.node")).toBe(
      true
    );
    expect(left("node_modules/@mintplex-labs/mdpdf-linux-x64-musl")).toBe(
      false
    );
    expect(
      left("node_modules/onnxruntime-node/bin/napi-v3/linux/x64/lib.so")
    ).toBe(true);
    expect(left("node_modules/onnxruntime-node/bin/napi-v3/linux/arm64")).toBe(
      false
    );
    expect(left("node_modules/onnxruntime-node/bin/napi-v3/win32")).toBe(false);
    expect(left("node_modules/onnxruntime-node/bin/napi-v3/darwin")).toBe(
      false
    );
    expect(
      left(
        "node_modules/@xenova/transformers/node_modules/onnxruntime-node/bin/napi-v3/win32"
      )
    ).toBe(false);
    expect(
      left(
        "node_modules/@xenova/transformers/node_modules/onnxruntime-node/bin/napi-v3/linux/x64/lib.so"
      )
    ).toBe(true);
    expect(removed).toHaveLength(7);
    expect(bytes).toBe(70);
  });
});
