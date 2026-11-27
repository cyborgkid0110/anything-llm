const { menuTemplate } = require("../src/menu");

const roles = (template) =>
  template.flatMap((item) => [
    item.role,
    ...(item.submenu ?? []).map((s) => s.role),
  ]);

it("offers only an Edit menu with the standard roles", () => {
  const template = menuTemplate("linux");
  expect(template.map((item) => item.label)).toEqual(["Edit"]);
  expect(roles(template).filter(Boolean)).toEqual([
    "undo",
    "redo",
    "cut",
    "copy",
    "paste",
    "selectAll",
  ]);
});

it("has no DevTools or reload entries on any platform", () => {
  for (const platform of ["linux", "win32", "darwin"]) {
    const found = roles(menuTemplate(platform));
    expect(found).not.toContain("toggleDevTools");
    expect(found).not.toContain("reload");
    expect(found).not.toContain("forceReload");
  }
});

it("adds the app menu on macOS so Quit keeps working", () => {
  expect(menuTemplate("darwin")[0]).toEqual({ role: "appMenu" });
});
