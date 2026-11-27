const {
  sameOrigin,
  isExternalHttp,
  permissionAllowed,
  frameNavigationAllowed,
} = require("../src/navigation");

const ORIGIN = "http://127.0.0.1:3001";

describe("sameOrigin", () => {
  it.each([
    ["http://127.0.0.1:3001/", true],
    ["http://127.0.0.1:3001/workspace/x?a=1#h", true],
    ["http://127.0.0.1:3002/", false],
    ["https://127.0.0.1:3001/", false],
    ["http://localhost:3001/", false],
    ["http://127.0.0.1:3001.evil.com/", false],
    ["http://127.0.0.1:3001@evil.com/", false],
    ["file:///etc/passwd", false],
    ["data:text/html,hi", false],
    ["javascript:alert(1)", false],
    ["not a url", false],
    ["", false],
  ])("%s -> %s", (url, expected) => {
    expect(sameOrigin(url, ORIGIN)).toBe(expected);
  });
});

describe("isExternalHttp", () => {
  it.each([
    ["https://example.com/a", true],
    ["http://example.com/a", true],
    ["http://127.0.0.1:3001/a", false],
    ["file:///etc/passwd", false],
    ["javascript:alert(1)", false],
    ["mailto:a@b.c", false],
    ["garbage", false],
  ])("%s -> %s", (url, expected) => {
    expect(isExternalHttp(url, ORIGIN)).toBe(expected);
  });
});

describe("permissionAllowed", () => {
  const ok = (permission, extra = {}) =>
    permissionAllowed({
      permission,
      url: ORIGIN + "/",
      origin: ORIGIN,
      ...extra,
    });

  it("allows clipboard writes and notifications from the app", () => {
    expect(ok("clipboard-sanitized-write")).toBe(true);
    expect(ok("notifications")).toBe(true);
  });

  it("allows microphone only", () => {
    expect(ok("media", { mediaTypes: ["audio"] })).toBe(true);
    expect(ok("media", { mediaTypes: ["audio", "video"] })).toBe(false);
    expect(ok("media", { mediaTypes: ["video"] })).toBe(false);
    expect(ok("media")).toBe(false);
  });

  it("denies everything else and other origins", () => {
    expect(ok("geolocation")).toBe(false);
    expect(ok("clipboard-read")).toBe(false);
    expect(ok("openExternal")).toBe(false);
    expect(
      permissionAllowed({
        permission: "notifications",
        url: "https://evil.com/",
        origin: ORIGIN,
      })
    ).toBe(false);
  });
});

describe("frameNavigationAllowed", () => {
  it.each([
    ["about:blank", true],
    ["http://127.0.0.1:3001/embed", true],
    ["https://example.com/", false],
    ["file:///etc/passwd", false],
    ["javascript:alert(1)", false],
    ["data:text/html,hi", false],
    ["about:srcdoc", false],
  ])("%s -> %s", (url, expected) => {
    expect(frameNavigationAllowed(url, ORIGIN)).toBe(expected);
  });
});
