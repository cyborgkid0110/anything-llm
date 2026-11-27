const { engineLabel } = require("../src/engineLabel");

it.each([
  [{ state: "idle" }, "Engine: idle"],
  [{ state: "starting" }, "Engine: starting"],
  [{ state: "ready" }, "Engine: ready"],
  [{ state: "installing", progress: 42 }, "Engine: downloading 42%"],
  [{ state: "installing", progress: null }, "Engine: downloading"],
  [{ state: "error", message: "boom" }, "Engine: error"],
  [{ state: "weird" }, "Engine: unknown"],
  [{}, "Engine: unknown"],
  [null, null],
  ["x", null],
])("%j -> %s", (status, expected) => {
  expect(engineLabel(status)).toBe(expected);
});
