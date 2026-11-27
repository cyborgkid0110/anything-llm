const { OpenAI: OpenAIApi } = require("openai");
const { toChunks, reportEmbeddingProgress } = require("../../helpers");
const { isEnabled } = require("../../AiProviders/embeddedLemonade/config");
const {
  EmbeddedLemonadeEngine,
} = require("../../AiProviders/embeddedLemonade/engine");
const { EmbeddedLemonadeLLM } = require("../../AiProviders/embeddedLemonade");

/** "AnythingLLM (GGUF)" - embeds with a GGUF model on the embedded Lemonade engine. */
class EmbeddedLemonadeEmbedder {
  constructor() {
    if (!isEnabled())
      throw new Error(
        "The built-in model engine is not enabled on this instance."
      );
    if (!process.env.EMBEDDING_MODEL_PREF)
      throw new Error("No Embedding Model Pref was set.");
    this.className = "EmbeddedLemonadeEmbedder";
    this.client = new OpenAIApi({
      baseURL: EmbeddedLemonadeLLM.openaiBasePath(),
      apiKey: "not-used",
    });
    this.model = process.env.EMBEDDING_MODEL_PREF;
    // llama.cpp embeds one sequence at a time - large batches only queue up.
    this.maxConcurrentChunks = 16;
    this.embeddingMaxChunkLength =
      Number(process.env.EMBEDDING_MODEL_MAX_CHUNK_LENGTH) || 8_192;
  }

  log(text, ...args) {
    console.log(`\x1b[36m[${this.className}]\x1b[0m ${text}`, ...args);
  }

  async embedTextInput(textInput) {
    const result = await this.embedChunks(
      Array.isArray(textInput) ? textInput : [textInput]
    );
    return result?.[0] || [];
  }

  async embedChunks(textChunks = []) {
    await EmbeddedLemonadeEngine.ensureRunning();
    this.log(
      `Embedding ${textChunks.length} chunks of text with ${this.model}.`
    );

    const allResults = [];
    for (const chunk of toChunks(textChunks, this.maxConcurrentChunks)) {
      const { data = [] } = await this.client.embeddings
        .create({ model: this.model, input: chunk })
        .catch((e) => {
          const type = e?.status || e?.code || "failed_to_embed";
          const message = `AnythingLLM (GGUF) failed to embed: [${type}]: ${e.message}`;
          this.log(message);
          throw new Error(message);
        });
      allResults.push(...data);
      reportEmbeddingProgress(
        Math.min(allResults.length, textChunks.length),
        textChunks.length
      );
    }

    return allResults.length > 0 &&
      allResults.every((embd) => embd.hasOwnProperty("embedding"))
      ? allResults.map((embd) => embd.embedding)
      : null;
  }
}

module.exports = { EmbeddedLemonadeEmbedder };
