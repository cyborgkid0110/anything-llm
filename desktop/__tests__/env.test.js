const { layout } = require("../src/layout");
const {
  serverEnv,
  collectorEnv,
  userNamespacesRestricted,
  fileUrl,
} = require("../src/env");

const l = layout({ userData: "/u", appRoot: "/app" });
const ports = { server: 4001, collector: 4002 };
const base = {
  PATH: "/bin",
  HOME: "/home/x",
  STORAGE_DIR: "/leak",
  NODE_ENV: "development",
  ANYTHING_LLM_RUNTIME: "docker",
  ENABLE_BUILT_IN_LLM: "true",
};

const shared = {
  ELECTRON_RUN_AS_NODE: "1",
  NODE_ENV: "production",
  STORAGE_DIR: l.storage,
  COLLECTOR_PORT: "4002",
  COLLECTOR_HOTDIR: l.hotdir,
};

describe("serverEnv", () => {
  const env = serverEnv(l, ports, base, {
    platform: "linux",
    sandboxRestricted: true,
  });

  it("sets the shared and server variables", () => {
    expect(env).toMatchObject({
      ...shared,
      ANYTHING_LLM_RUNTIME: "desktop",
      SERVER_PORT: "4001",
      SERVER_HOST: "127.0.0.1",
      ANYTHING_LLM_ENV_FILE: l.envFile,
      ANYTHING_LLM_DATABASE_URL: fileUrl(l.database),
      ANYTHINGLLM_CHROMIUM_ARGS: "--no-sandbox",
      CHECKPOINT_DISABLE: "1",
    });
  });

  it("inherits the parent env but does not leak overridden keys", () => {
    expect(env.PATH).toBe("/bin");
    expect(env.HOME).toBe("/home/x");
    expect(env.ENABLE_BUILT_IN_LLM).toBeUndefined();
    expect(env.STORAGE_DIR).toBe(l.storage);
  });

  it("gives the built-in engine its own port", () => {
    const withEngine = serverEnv(l, { ...ports, engine: 4003 }, base);
    expect(withEngine.EMBEDDED_LEMONADE_PORT).toBe("4003");
    expect(env.EMBEDDED_LEMONADE_PORT).toBeUndefined();
  });

  it("keeps the chromium sandbox when namespaces are available", () => {
    const open = serverEnv(l, ports, base, {
      platform: "linux",
      sandboxRestricted: false,
    });
    expect(open.ANYTHINGLLM_CHROMIUM_ARGS).toBeUndefined();
  });

  it("only disables the chromium sandbox on linux", () => {
    const win = serverEnv(l, ports, base, { platform: "win32" });
    expect(win.ANYTHINGLLM_CHROMIUM_ARGS).toBeUndefined();
  });

  it("uses forward slashes in the database url on windows", () => {
    const wl = { ...l, database: "C:\\Users\\a\\storage\\anythingllm.db" };
    const win = serverEnv(wl, ports, base, { platform: "win32" });
    expect(win.ANYTHING_LLM_DATABASE_URL).toBe(
      "file:C:/Users/a/storage/anythingllm.db"
    );
  });
});

describe("collectorEnv", () => {
  it("sets the shared and collector variables", () => {
    const env = collectorEnv(l, ports, base);
    expect(env).toMatchObject({
      ...shared,
      COLLECTOR_HOST: "127.0.0.1",
      COLLECTOR_TMPDIR: l.tmp,
      PUPPETEER_CACHE_DIR: l.chrome,
    });
    expect(env.PATH).toBe("/bin");
    expect(env.ANYTHING_LLM_RUNTIME).toBeUndefined();
    expect(env.ENABLE_BUILT_IN_LLM).toBeUndefined();
    expect(env.PUPPETEER_EXECUTABLE_PATH).toBeUndefined();
  });

  it("passes the chrome path only when one is found", () => {
    const env = collectorEnv(l, ports, base, { chromePath: "/c/chrome" });
    expect(env.PUPPETEER_EXECUTABLE_PATH).toBe("/c/chrome");
  });
});

describe("userNamespacesRestricted", () => {
  const reader = (files) => (file) => {
    if (!(file in files)) throw new Error("ENOENT");
    return files[file];
  };
  const APPARMOR = "/proc/sys/kernel/apparmor_restrict_unprivileged_userns";
  const CLONE = "/proc/sys/kernel/unprivileged_userns_clone";

  it("is true with the AppArmor restriction on", () => {
    expect(userNamespacesRestricted(reader({ [APPARMOR]: "1\n" }))).toBe(true);
  });

  it("is true with the Debian sysctl off", () => {
    expect(userNamespacesRestricted(reader({ [CLONE]: "0\n" }))).toBe(true);
  });

  it("is false when namespaces are open or the files are missing", () => {
    expect(
      userNamespacesRestricted(reader({ [APPARMOR]: "0\n", [CLONE]: "1\n" }))
    ).toBe(false);
    expect(userNamespacesRestricted(reader({}))).toBe(false);
  });
});
