// The boot module pulls in models and services; none of them run here.
jest.mock("../../../models/telemetry", () => ({ Telemetry: {} }));
jest.mock("../../../utils/BackgroundWorkers", () => ({
  BackgroundService: jest.fn(),
}));
jest.mock("../../../utils/EncryptionManager", () => ({
  EncryptionManager: jest.fn(),
}));
jest.mock("../../../utils/comKey", () => ({ CommunicationKey: jest.fn() }));
jest.mock("../../../utils/telemetry", () => jest.fn());
jest.mock("../../../utils/boot/eagerLoadContextWindows", () => jest.fn());
jest.mock("../../../utils/boot/markOnboarded", () => jest.fn());
jest.mock("../../../utils/boot/migrateWebBrowsingToDefault", () => jest.fn());
jest.mock("../../../utils/PushNotifications", () => ({
  PushNotifications: {},
}));
jest.mock("../../../utils/telegramBot", () => ({ TelegramBotService: {} }));

const fs = require("fs");
const ORIGINAL_ENV = process.env;

afterEach(() => {
  process.env = ORIGINAL_ENV;
  jest.restoreAllMocks();
});

function mockApp() {
  return { listen: jest.fn(() => ({ on: jest.fn() })) };
}

function loadBoot(env = {}) {
  process.env = { ...ORIGINAL_ENV };
  process.env.HTTPS_KEY_PATH = "/fake-cert/server.key";
  process.env.HTTPS_CERT_PATH = "/fake-cert/server.crt";
  delete process.env.SERVER_HOST;
  Object.assign(process.env, env);
  let boot;
  jest.isolateModules(() => (boot = require("../../../utils/boot")));
  return boot;
}

describe("bootHTTP", () => {
  it("binds to SERVER_HOST when set", () => {
    const app = mockApp();
    loadBoot({ SERVER_HOST: "127.0.0.1" }).bootHTTP(app, 13001);
    expect(app.listen).toHaveBeenCalledWith(
      13001,
      "127.0.0.1",
      expect.any(Function)
    );
  });

  it.each([
    ["unset", {}],
    ["empty", { SERVER_HOST: "" }],
  ])("passes no host when SERVER_HOST is %s", (_, env) => {
    const app = mockApp();
    loadBoot(env).bootHTTP(app, 13001);
    expect(app.listen.mock.calls[0][1]).toBeUndefined();
  });
});

describe("bootSSL", () => {
  function mockHttps() {
    const server = { listen: jest.fn(() => ({ on: jest.fn() })) };
    // Only the cert files are faked; jest itself reads files through fs too.
    const readFileSync = fs.readFileSync;
    jest
      .spyOn(fs, "readFileSync")
      .mockImplementation((file, ...args) =>
        String(file).startsWith("/fake-cert/")
          ? "pem"
          : readFileSync(file, ...args)
      );
    jest.spyOn(require("https"), "createServer").mockReturnValue(server);
    jest.doMock("@mintplex-labs/express-ws", () => ({ default: jest.fn() }));
    return server;
  }

  it("binds to SERVER_HOST when set", () => {
    const server = mockHttps();
    loadBoot({ SERVER_HOST: "127.0.0.1" }).bootSSL({}, 13001);
    expect(server.listen).toHaveBeenCalledWith(
      13001,
      "127.0.0.1",
      expect.any(Function)
    );
  });

  it("passes no host when SERVER_HOST is unset", () => {
    const server = mockHttps();
    loadBoot().bootSSL({}, 13001);
    expect(server.listen.mock.calls[0][1]).toBeUndefined();
  });
});
