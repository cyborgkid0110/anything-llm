jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn(function (options) {
    this.options = options;
  }),
}));
const ORIGINAL_ENV = process.env;
afterEach(() => (process.env = ORIGINAL_ENV));

function load() {
  let prisma;
  jest.isolateModules(() => (prisma = require("../../../utils/prisma")));
  return prisma;
}

it("uses ANYTHING_LLM_DATABASE_URL when set", () => {
  process.env = {
    ...ORIGINAL_ENV,
    ANYTHING_LLM_DATABASE_URL: "file:/data/anythingllm.db",
  };
  expect(load().options).toEqual(
    expect.objectContaining({ datasourceUrl: "file:/data/anythingllm.db" })
  );
});

it("keeps the schema's url otherwise", () => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.ANYTHING_LLM_DATABASE_URL;
  expect(load().options).not.toHaveProperty("datasourceUrl");
});
