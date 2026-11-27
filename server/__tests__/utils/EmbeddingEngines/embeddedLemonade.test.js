let mockEnabled = true;
jest.mock("../../../utils/AiProviders/embeddedLemonade/config", () => ({
  ...jest.requireActual("../../../utils/AiProviders/embeddedLemonade/config"),
  isEnabled: () => mockEnabled,
}));

const {
  EmbeddedLemonadeEmbedder,
} = require("../../../utils/EmbeddingEngines/embeddedLemonade");
const {
  EmbeddedLemonadeEngine,
} = require("../../../utils/AiProviders/embeddedLemonade/engine");

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  mockEnabled = true;
  process.env = { ...ORIGINAL_ENV, EMBEDDING_MODEL_PREF: "minilm" };
  delete process.env.EMBEDDING_MODEL_MAX_CHUNK_LENGTH;
  jest.spyOn(EmbeddedLemonadeEngine, "ensureRunning").mockResolvedValue();
  jest.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
  jest.restoreAllMocks();
});

describe("EmbeddedLemonadeEmbedder", () => {
  it("requires the engine and a model", () => {
    mockEnabled = false;
    expect(() => new EmbeddedLemonadeEmbedder()).toThrow("not enabled");
    mockEnabled = true;
    delete process.env.EMBEDDING_MODEL_PREF;
    expect(() => new EmbeddedLemonadeEmbedder()).toThrow(
      "No Embedding Model Pref"
    );
  });

  it("uses the configured chunk length", () => {
    expect(new EmbeddedLemonadeEmbedder().embeddingMaxChunkLength).toBe(8192);
    process.env.EMBEDDING_MODEL_MAX_CHUNK_LENGTH = "2048";
    expect(new EmbeddedLemonadeEmbedder().embeddingMaxChunkLength).toBe(2048);
  });

  it("starts the engine and embeds in batches, keeping order", async () => {
    const embedder = new EmbeddedLemonadeEmbedder();
    embedder.maxConcurrentChunks = 2;
    const create = jest
      .spyOn(embedder.client.embeddings, "create")
      .mockImplementation(async ({ model, input }) => ({
        data: input.map((text) => ({ embedding: [model.length, text.length] })),
      }));

    const result = await embedder.embedChunks(["a", "bb", "ccc"]);
    expect(EmbeddedLemonadeEngine.ensureRunning).toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(2);
    expect(result).toEqual([
      [6, 1],
      [6, 2],
      [6, 3],
    ]);
    await expect(embedder.embedTextInput("dddd")).resolves.toEqual([6, 4]);
  });

  it("throws lemond's error", async () => {
    const embedder = new EmbeddedLemonadeEmbedder();
    jest
      .spyOn(embedder.client.embeddings, "create")
      .mockRejectedValue(
        Object.assign(new Error("model not found"), { status: 404 })
      );
    await expect(embedder.embedChunks(["a"])).rejects.toThrow(
      "AnythingLLM (GGUF) failed to embed: [404]: model not found"
    );
  });
});
