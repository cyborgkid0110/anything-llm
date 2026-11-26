/* eslint-env jest, node */
const fs = require("fs");
const os = require("os");
const path = require("path");

const ORIGINAL_ENV = process.env;
let root;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "whisper-"));
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
  fs.rmSync(root, { recursive: true, force: true });
  jest.restoreAllMocks();
});

it("converts audio into COLLECTOR_TMPDIR", async () => {
  const tmp = path.join(root, "tmp");
  process.env = {
    ...ORIGINAL_ENV,
    STORAGE_DIR: root,
    COLLECTOR_TMPDIR: tmp,
  };
  const convertAudioToWav = jest.fn().mockResolvedValue(false);
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});

  let LocalWhisper;
  jest.isolateModules(() => {
    jest.doMock("../../../utils/WhisperProviders/ffmpeg", () => ({
      FFMPEGWrapper: jest.fn(() => ({ convertAudioToWav })),
    }));
    ({
      LocalWhisper,
    } = require("../../../utils/WhisperProviders/localWhisper"));
  });

  const whisper = new LocalWhisper({ options: {} });
  // Skip loading the model; only the audio conversion step matters here.
  jest.spyOn(whisper, "client").mockResolvedValue(jest.fn());
  await whisper.processFile("/nowhere/in.mp3", "in.mp3");

  expect(fs.existsSync(tmp)).toBe(true);
  expect(convertAudioToWav).toHaveBeenCalledTimes(1);
  const [, outputFile] = convertAudioToWav.mock.calls[0];
  expect(path.dirname(outputFile)).toBe(tmp);
});
