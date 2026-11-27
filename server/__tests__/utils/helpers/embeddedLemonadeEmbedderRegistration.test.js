let mockEnabled = true;
jest.mock("../../../utils/AiProviders/embeddedLemonade/config", () => ({
  ...jest.requireActual("../../../utils/AiProviders/embeddedLemonade/config"),
  isEnabled: () => mockEnabled,
  supportedProviders: () => (mockEnabled ? ["embedded_lemonade"] : []),
}));

const ORIGINAL_ENV = process.env;
afterEach(() => {
  process.env = ORIGINAL_ENV;
  mockEnabled = true;
});

describe("embedded Lemonade embedder registration", () => {
  it("is selected for EMBEDDING_ENGINE=embedded_lemonade", () => {
    process.env = {
      ...ORIGINAL_ENV,
      EMBEDDING_ENGINE: "embedded_lemonade",
      EMBEDDING_MODEL_PREF: "minilm",
    };
    const { getEmbeddingEngineSelection } = require("../../../utils/helpers");
    expect(getEmbeddingEngineSelection().className).toBe(
      "EmbeddedLemonadeEmbedder"
    );
  });

  it("is a supported embedder only when the engine is enabled", () => {
    const { KEY_MAPPING } = require("../../../utils/helpers/updateENV");
    const [check] = KEY_MAPPING.EmbeddingEngine.checks;
    expect(check("embedded_lemonade")).toBeNull();
    mockEnabled = false;
    expect(check("embedded_lemonade")).toMatch("Invalid Embedding model type");
    expect(check("native")).toBeNull();
  });

  it("manages the engine when the embedder changes", () => {
    const { KEY_MAPPING } = require("../../../utils/helpers/updateENV");
    const {
      manageEngineOnProviderChange,
    } = require("../../../utils/AiProviders/embeddedLemonade/config");
    expect(KEY_MAPPING.EmbeddingEngine.postUpdate).toContain(
      manageEngineOnProviderChange
    );
  });
});
