const { shouldCopy } = require("../scripts/copyFilter");

describe("server", () => {
  it.each([
    ["index.js", true],
    ["endpoints/system.js", true],
    ["prisma/schema.prisma", true],
    ["prisma/migrations/1/migration.sql", true],
    ["storage", true],
    ["storage/assets", true],
    ["storage/assets/anything-llm.png", true],
    ["storage/assets/anything-llm-invert.png", true],
    ["storage/assets/custom.png", false],
    ["storage/anythingllm.db", false],
    ["storage/documents", false],
    ["storage/models/x.gguf", false],
    ["public", false],
    ["public/index.js", false],
    ["node_modules", false],
    ["node_modules/a/index.js", false],
    ["utils/__tests__/a.test.js", false],
    ["__tests__", false],
    [".env", false],
    [".gitignore", false],
    [".nvmrc", false],
    [".flowconfig", false],
    ["nodemon.json", false],
    ["eslint.config.mjs", false],
    ["jsconfig.json", false],
    ["utils/jsconfig.json", true],
    ["package.json", true],
    [".env.development", false],
    [".env.example", false],
    ["logs/server.log", false],
    ["storage\\assets\\anything-llm.png", true],
    ["storage\\documents", false],
  ])("%s -> %s", (rel, expected) => {
    expect(shouldCopy("server", rel)).toBe(expected);
  });
});

describe("collector", () => {
  it.each([
    ["index.js", true],
    ["hotdir", true],
    ["hotdir/__HOTDIR__.md", true],
    ["hotdir/upload.pdf", false],
    ["storage", false],
    ["storage/tmp", false],
    ["processLink/index.js", true],
    ["node_modules/x", false],
    [".env", false],
    ["__tests__/a.test.js", false],
  ])("%s -> %s", (rel, expected) => {
    expect(shouldCopy("collector", rel)).toBe(expected);
  });
});
