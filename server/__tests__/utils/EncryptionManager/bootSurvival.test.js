jest.mock("../../../utils/helpers/updateENV", () => ({
  dumpENV: jest.fn(() => {
    throw new Error("EACCES: read-only install");
  }),
}));

const ORIGINAL_ENV = process.env;

afterEach(() => {
  process.env = ORIGINAL_ENV;
  jest.restoreAllMocks();
});

it("keeps going when the key & salt cannot be persisted", () => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.SIG_KEY;
  delete process.env.SIG_SALT;
  jest.spyOn(console, "log").mockImplementation(() => {});
  const { EncryptionManager } = require("../../../utils/EncryptionManager");
  const manager = new EncryptionManager();
  expect(process.env.SIG_KEY).toBeTruthy();
  expect(manager.decrypt(manager.encrypt("hello"))).toBe("hello");
});
