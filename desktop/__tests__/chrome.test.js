const fs = require("fs");
const os = require("os");
const path = require("path");
const { layout } = require("../src/layout");
const { chromeBuildId } = require("../src/chrome");

it("reads the Chrome build id puppeteer expects", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "desktop-chrome-"));
  try {
    const l = layout({ userData: path.join(root, "u"), appRoot: root });
    const file = path.join(
      l.collectorDir,
      "node_modules/puppeteer-core/lib/cjs/puppeteer/revisions.js"
    );
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      file,
      'exports.PUPPETEER_REVISIONS = { chrome: "119.0.6045.105" };'
    );
    expect(chromeBuildId(l)).toBe("119.0.6045.105");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

it("throws when puppeteer-core is missing", () => {
  const l = layout({ userData: "/nope/u", appRoot: "/nope" });
  expect(() => chromeBuildId(l)).toThrow();
});
