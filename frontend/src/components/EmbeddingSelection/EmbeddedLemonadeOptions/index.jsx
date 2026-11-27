import { useState } from "react";
import { Info } from "@phosphor-icons/react";
import { Tooltip } from "react-tooltip";
import EmbeddedLemonadeModelManager from "@/components/EmbeddedLemonadeModelManager";
import { EMBEDDING_PREFERENCE_CHANGED_EVENT } from "@/pages/GeneralSettings/EmbeddingPreference";

/** "AnythingLLM (GGUF)" - embedding models on the embedded Lemonade engine. */
export default function EmbeddedLemonadeEmbeddingOptions({ settings }) {
  const [selectedModelId, setSelectedModelId] = useState(
    settings?.EmbeddingEngine === "embedded_lemonade"
      ? settings?.EmbeddingModelPref
      : null
  );
  const [maxChunkLength, setMaxChunkLength] = useState(
    settings?.EmbeddingModelMaxChunkLength || 8192
  );

  function selectModel(modelId) {
    setSelectedModelId(modelId);
    window.dispatchEvent(new Event(EMBEDDING_PREFERENCE_CHANGED_EVENT));
  }

  return (
    <div className="w-full flex flex-col gap-y-4">
      <input
        type="hidden"
        name="EmbeddingModelPref"
        value={selectedModelId || ""}
      />
      <EmbeddedLemonadeModelManager
        kind="embedding"
        selectedModelId={selectedModelId}
        onSelect={selectModel}
      >
        <div className="flex flex-col w-60">
          <div
            data-tooltip-place="top"
            data-tooltip-id="embedded-lemonade-chunk-length-tooltip"
            className="flex gap-x-1 items-center mb-3"
          >
            <label className="text-white text-sm font-semibold block">
              Max embedding chunk length
            </label>
            <Info
              size={16}
              className="text-theme-text-secondary cursor-pointer"
            />
            <Tooltip id="embedded-lemonade-chunk-length-tooltip">
              Maximum length of text chunks, in characters, for embedding.
            </Tooltip>
          </div>
          <input
            type="number"
            name="EmbeddingModelMaxChunkLength"
            className="border-none bg-theme-settings-input-bg text-white placeholder:text-theme-settings-input-placeholder text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-full p-2.5"
            placeholder="8192"
            min={1}
            value={maxChunkLength}
            onChange={(e) => setMaxChunkLength(Number(e.target.value))}
            onScroll={(e) => e.target.blur()}
            required={true}
            autoComplete="off"
          />
        </div>
      </EmbeddedLemonadeModelManager>
    </div>
  );
}
