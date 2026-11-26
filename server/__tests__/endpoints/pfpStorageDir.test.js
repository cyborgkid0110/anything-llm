jest.mock("../../models/user", () => ({
  User: { get: jest.fn(), update: jest.fn() },
}));
jest.mock("../../utils/http", () => ({
  ...jest.requireActual("../../utils/http"),
  userFromSession: jest.fn(),
}));

const fs = require("fs");
const os = require("os");
const path = require("path");

const ORIGINAL_ENV = process.env;
let storage;

beforeEach(() => {
  storage = fs.mkdtempSync(path.join(os.tmpdir(), "pfp-"));
  fs.mkdirSync(path.join(storage, "assets/pfp"), { recursive: true });
  process.env = { ...ORIGINAL_ENV, STORAGE_DIR: storage };
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
  fs.rmSync(storage, { recursive: true, force: true });
  jest.restoreAllMocks();
});

// Collects the route handlers instead of serving them.
function collectRoutes() {
  const routes = {};
  const app = new Proxy(
    {},
    {
      get:
        (_, method) =>
        (route, ...rest) => {
          routes[`${method} ${route}`] = rest.flat().pop();
        },
    }
  );
  const { systemEndpoints } = require("../../endpoints/system");
  systemEndpoints(app);
  return routes;
}

it("remove-pfp deletes the old picture from STORAGE_DIR/assets/pfp", async () => {
  const pfp = path.join(storage, "assets/pfp/old.png");
  fs.writeFileSync(pfp, "x");
  const { User } = require("../../models/user");
  require("../../utils/http").userFromSession.mockResolvedValue({ id: 1 });
  User.get.mockResolvedValue({ pfpFilename: "old.png" });
  User.update.mockResolvedValue({ success: true });

  const handler = collectRoutes()["delete /system/remove-pfp"];
  const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await handler({}, response);

  expect(fs.existsSync(pfp)).toBe(false);
  expect(response.status).toHaveBeenCalledWith(200);
});
