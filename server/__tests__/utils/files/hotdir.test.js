jest.mock("../../../models/documents", () => ({ Document: {} }));
jest.mock("../../../models/documentSyncQueue", () => ({
  DocumentSyncQueue: {},
}));

const path = require("path");
const ORIGINAL_ENV = process.env;

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

function setEnv(env) {
  process.env = { ...ORIGINAL_ENV, STORAGE_DIR: "/srv/app/server/storage" };
  delete process.env.COLLECTOR_HOTDIR;
  Object.assign(process.env, env);
}

function loadHotdir() {
  let files;
  jest.isolateModules(() => (files = require("../../../utils/files")));
  return files.hotdirPath;
}

// Upload destinations of the first two diskStorage() calls (UI and API document uploads).
function loadMulterDestinations() {
  const configs = [];
  jest.isolateModules(() => {
    jest.doMock("multer", () => {
      const multer = () => ({});
      multer.diskStorage = (config) => {
        configs.push(config);
        return config;
      };
      return multer;
    });
    require("../../../utils/files/multer");
  });
  return configs.slice(0, 2).map((config) => {
    let out;
    config.destination(null, null, (_, dir) => (out = dir));
    return out;
  });
}

describe.each(["development", "production"])("hotdir in %s", (NODE_ENV) => {
  it("uses COLLECTOR_HOTDIR for the server hotdir and upload destinations", () => {
    setEnv({ NODE_ENV, COLLECTOR_HOTDIR: "/x/hotdir" });
    expect(loadHotdir()).toBe("/x/hotdir");
    const destinations = loadMulterDestinations();
    expect(destinations.length).toBeGreaterThan(0);
    for (const dir of destinations) {
      expect(dir).toBe("/x/hotdir");
    }
  });
});

describe("hotdir without COLLECTOR_HOTDIR", () => {
  it("keeps the production path relative to STORAGE_DIR", () => {
    setEnv({ NODE_ENV: "production" });
    const expected = path.resolve(
      "/srv/app/server/storage",
      "../../collector/hotdir"
    );
    expect(loadHotdir()).toBe(expected);
    for (const dir of loadMulterDestinations()) expect(dir).toBe(expected);
  });

  it("keeps the development path next to the code", () => {
    setEnv({ NODE_ENV: "development" });
    const expected = path.resolve(__dirname, "../../../../collector/hotdir");
    expect(loadHotdir()).toBe(expected);
  });
});
