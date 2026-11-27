const { fileFilters, pathKind, notification } = require("../src/bridgeArgs");

describe("fileFilters", () => {
  it("accepts a valid list and returns plain data", () => {
    const input = [{ name: "Models", extensions: ["gguf", "bin"] }];
    expect(fileFilters(input)).toEqual(input);
  });

  it("accepts an empty list", () => {
    expect(fileFilters([])).toEqual([]);
  });

  it.each([
    ["non-array", "gguf"],
    ["too many filters", Array(6).fill({ name: "a", extensions: ["a"] })],
    ["missing name", [{ extensions: ["a"] }]],
    ["long name", [{ name: "x".repeat(65), extensions: ["a"] }]],
    ["no extensions", [{ name: "a", extensions: [] }]],
    ["too many extensions", [{ name: "a", extensions: Array(11).fill("a") }]],
    ["bad extension", [{ name: "a", extensions: ["../x"] }]],
    ["wildcard extension", [{ name: "a", extensions: ["*"] }]],
    ["dotted extension", [{ name: "a", extensions: [".gguf"] }]],
    ["long extension", [{ name: "a", extensions: ["abcdefghijk"] }]],
    ["non-string extension", [{ name: "a", extensions: [1] }]],
    ["null entry", [null]],
  ])("rejects %s", (_label, input) => {
    expect(() => fileFilters(input)).toThrow();
  });

  it("drops unknown properties", () => {
    const out = fileFilters([{ name: "a", extensions: ["a"], extra: 1 }]);
    expect(out).toEqual([{ name: "a", extensions: ["a"] }]);
  });
});

describe("pathKind", () => {
  it.each(["models", "storage", "logs"])("accepts %s", (kind) => {
    expect(pathKind(kind)).toBe(kind);
  });

  it.each(["", "other", "../etc", "constructor", null, undefined, 1, {}])(
    "rejects %p",
    (input) => {
      expect(() => pathKind(input)).toThrow();
    }
  );
});

describe("notification", () => {
  it("accepts title and body", () => {
    expect(notification({ title: "Done", body: "ok" })).toEqual({
      title: "Done",
      body: "ok",
    });
  });

  it("defaults a missing body to empty", () => {
    expect(notification({ title: "Done" })).toEqual({
      title: "Done",
      body: "",
    });
  });

  it.each([
    ["null", null],
    ["no title", { body: "x" }],
    ["empty title", { title: "", body: "" }],
    ["long title", { title: "x".repeat(121), body: "" }],
    ["long body", { title: "t", body: "x".repeat(501) }],
    ["non-string body", { title: "t", body: 1 }],
    ["non-string title", { title: 1, body: "" }],
  ])("rejects %s", (_label, input) => {
    expect(() => notification(input)).toThrow();
  });
});
