const path = require("path");

jest.mock("child_process", () => ({
  ...jest.requireActual("child_process"),
  spawnSync: jest.fn(() => ({ status: 0 })),
}));
jest.mock("../../../../utils/AiProviders/embeddedLemonade/config", () => ({
  ...jest.requireActual(
    "../../../../utils/AiProviders/embeddedLemonade/config"
  ),
  isEnabled: () => true,
  lemondPlatform: () => "windows-x64",
}));

const { spawnSync } = require("child_process");
const {
  EmbeddedLemonadeEngine,
} = require("../../../../utils/AiProviders/embeddedLemonade/engine");

const ORIGINAL_PLATFORM = process.platform;

beforeEach(() => {
  Object.defineProperty(process, "platform", { value: "win32" });
  jest.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  EmbeddedLemonadeEngine.process = null;
  Object.defineProperty(process, "platform", { value: ORIGINAL_PLATFORM });
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

describe("EmbeddedLemonadeEngine on Windows", () => {
  it("runs lemond.exe", () => {
    expect(path.basename(EmbeddedLemonadeEngine.binPath)).toBe("lemond.exe");
  });

  it("kills lemond's whole process tree with taskkill", () => {
    const child = { pid: 4321, kill: jest.fn() };
    EmbeddedLemonadeEngine.process = child;
    EmbeddedLemonadeEngine.kill();
    expect(spawnSync).toHaveBeenCalledWith(
      "taskkill",
      ["/PID", "4321", "/T", "/F"],
      { windowsHide: true }
    );
    expect(child.kill).not.toHaveBeenCalled();
    expect(EmbeddedLemonadeEngine.process).toBeNull();
    expect(EmbeddedLemonadeEngine.status.state).toBe("idle");
  });
});
