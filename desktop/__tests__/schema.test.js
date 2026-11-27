const fs = require("fs");
const path = require("path");
const { withDatabaseUrl } = require("../src/schema");

const real = fs.readFileSync(
  path.resolve(__dirname, "../../server/prisma/schema.prisma"),
  "utf8"
);
const activeUrls = (text) =>
  text.split("\n").filter((line) => /^\s*url\s*=/.test(line));

it("rewrites only the active datasource url", () => {
  const out = withDatabaseUrl(real, "file:/u/storage/anythingllm.db");
  expect(activeUrls(out)).toEqual([
    '  url      = "file:/u/storage/anythingllm.db"',
  ]);
  const before = real.split("\n");
  const after = out.split("\n");
  expect(after.length).toBe(before.length);
  const changed = before.filter((line, i) => line !== after[i]);
  expect(changed).toHaveLength(1);
  expect(out).toContain('//   url      = env("DATABASE_URL")');
});

it("converts windows backslashes to forward slashes", () => {
  const out = withDatabaseUrl(real, "file:C:\\Users\\a\\anythingllm.db");
  expect(out).toContain('"file:C:/Users/a/anythingllm.db"');
});

it("throws when there is no datasource url to rewrite", () => {
  expect(() => withDatabaseUrl("model X {}", "file:/x")).toThrow();
});
