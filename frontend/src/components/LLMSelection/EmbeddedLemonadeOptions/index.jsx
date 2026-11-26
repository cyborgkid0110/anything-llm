import { useState } from "react";
import { CaretDown, Info } from "@phosphor-icons/react";
import { Tooltip } from "react-tooltip";
import AnythingLLMIcon from "@/media/logo/anything-llm-icon.png";
import { LLM_PREFERENCE_CHANGED_EVENT } from "@/pages/GeneralSettings/LLMPreference";
import EmbeddedLemonadeModelManager from "@/components/EmbeddedLemonadeModelManager";

/**
 * The embedded Lemonade engine (`embedded_lemonade`) - a lemond server this instance runs itself. Only offered when
 * the server has it enabled (Docker with ENABLE_BUILT_IN_LLM, or the desktop runtime), so it never shows up elsewhere.
 * @param {{onboarding?: boolean}} options - onboarding shows recommended models before the full model table.
 */
function embeddedLemonadeLLM({ onboarding = false } = {}) {
  return {
    name: "Built-in",
    value: "embedded_lemonade",
    logo: AnythingLLMIcon,
    options: (settings) => (
      <EmbeddedLemonadeOptions settings={settings} onboarding={onboarding} />
    ),
    description:
      "Run local LLMs on this server's CPU or GPU with no extra setup.",
    requiredConfig: ["EmbeddedLemonadeEnabled"],
  };
}

/**
 * Adds the embedded engine to a provider list when the server has it enabled - first, or right after the
 * `after` entry (eg: a "System default" entry that should stay on top).
 * @param {Array<object>} providers
 * @param {object|null} settings - System.keys()
 * @param {{onboarding?: boolean, after?: string}} options
 * @returns {Array<object>}
 */
export function withEmbeddedLemonade(
  providers = [],
  settings = null,
  { after = null, ...options } = {}
) {
  if (!settings?.EmbeddedLemonadeEnabled) return providers;
  const index = providers.findIndex((llm) => llm.value === after) + 1;
  return [
    ...providers.slice(0, index),
    embeddedLemonadeLLM(options),
    ...providers.slice(index),
  ];
}

export default function EmbeddedLemonadeOptions({
  settings,
  onboarding = false,
}) {
  const [selectedModelId, setSelectedModelId] = useState(
    settings?.EmbeddedLemonadeModelPref
  );
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  function selectModel(modelId) {
    setSelectedModelId(modelId);
    window.dispatchEvent(new Event(LLM_PREFERENCE_CHANGED_EVENT));
  }

  return (
    <div className="w-full flex flex-col gap-y-4">
      <input
        type="hidden"
        name="EmbeddedLemonadeModelPref"
        value={selectedModelId || ""}
      />
      <EmbeddedLemonadeModelManager
        kind="llm"
        selectedModelId={selectedModelId}
        onSelect={selectModel}
        onboarding={onboarding}
      >
        <div className="flex flex-col gap-y-[20px]">
          <button
            type="button"
            className="border-none text-theme-text-primary hover:text-theme-text-secondary flex items-center text-sm w-fit h-[40px] hover:bg-theme-bg-sidebar rounded-lg transition-all duration-300"
            onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
          >
            <div className="flex w-full gap-x-2 items-center">
              {showAdvancedSettings ? "Hide" : "Show"} Advanced Settings
            </div>
            <CaretDown
              weight="bold"
              size={14}
              className={`shrink-0 text-theme-text-secondary transition-transform ${showAdvancedSettings ? "rotate-180" : ""}`}
            />
          </button>
          {/* Hidden instead of unmounted so the field still submits with the form. */}
          <div hidden={!showAdvancedSettings}>
            <AdvancedSettings settings={settings} />
          </div>
        </div>
      </EmbeddedLemonadeModelManager>
    </div>
  );
}

function AdvancedSettings({ settings }) {
  const [maxTokens, setMaxTokens] = useState(
    settings?.EmbeddedLemonadeTokenLimit ?? ""
  );

  return (
    <div className="flex gap-[36px] flex-wrap">
      <div className="flex flex-col w-60">
        <div className="flex items-center gap-1 mb-3">
          <label className="text-white text-sm font-semibold block">
            Model context window
          </label>
          <Tooltip
            id="embedded-lemonade-context-window"
            place="top"
            delayShow={300}
            className="tooltip !text-xs !opacity-100 z-99"
            style={{ maxWidth: "350px", whiteSpace: "normal" }}
          >
            Leave empty to use the model's context window, up to 16,384 tokens.
            A set value is capped to what the model supports. Larger windows use
            more memory.
          </Tooltip>
          <div
            className="text-theme-text-secondary cursor-pointer hover:bg-theme-bg-primary flex items-center justify-center rounded-full"
            data-tooltip-id="embedded-lemonade-context-window"
          >
            <Info size={18} className="text-theme-text-secondary" />
          </div>
        </div>
        <input
          type="number"
          name="EmbeddedLemonadeTokenLimit"
          className="border-none bg-theme-settings-input-bg text-white placeholder:text-theme-settings-input-placeholder text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-full p-2.5"
          placeholder="Auto"
          // No native min/step: this field can be collapsed out of view, where the browser would block the save
          // without being able to show why. The server validates it and the save shows the error.
          step="any"
          value={maxTokens}
          onChange={(e) => setMaxTokens(e.target.value)}
          onScroll={(e) => e.target.blur()}
          required={false}
          autoComplete="off"
        />
      </div>
    </div>
  );
}
