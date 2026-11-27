import { useState, useEffect } from "react";
import {
  CheckCircle,
  CircleNotch,
  FolderOpen,
  Lightning,
  Plus,
} from "@phosphor-icons/react";
import { Tooltip } from "react-tooltip";
import strDistance from "js-levenshtein";
import System from "@/models/system";
import ModelTable from "@/components/lib/ModelTable";
import MonoProviderIcon from "@/components/lib/MonoProviderIcon";
import ModelTableLayout from "@/components/lib/ModelTable/layout";
import ModelTableLoadingSkeleton from "@/components/lib/ModelTable/loading";
import showToast from "@/utils/toast";
import EmbeddedLemonadeUtils from "./utils";
import {
  isDesktopApp,
  notifyDesktop,
  openDesktopPath,
  pickGgufFile,
} from "@/utils/desktop";

const DOWNLOAD_CANCELLED = "Download cancelled.";

/** Where each kind of model comes from - see server/utils/helpers/customModels.js. */
const MODEL_SOURCES = {
  llm: "embedded_lemonade-all",
  embedding: "embedded_lemonade-embedding-all",
};

/**
 * Model management for the embedded Lemonade engine: engine status, the model table, downloads and Hugging Face
 * pulls. Shared by the LLM and embedding settings. Children render right after the engine status.
 * @param {{kind?: 'llm'|'embedding', selectedModelId: string|null, onSelect: (modelId: string) => void, onboarding?: boolean, children?: React.ReactNode}} props
 */
export default function EmbeddedLemonadeModelManager({
  kind = "llm",
  selectedModelId,
  onSelect,
  onboarding = false,
  children,
}) {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  // The one download in flight: { label, percentage }. The server runs one download at a time.
  const [download, setDownload] = useState(null);
  // Recommended cards are LLM-only. Onboarding starts on them; the full table is one click away.
  const showRecommended = onboarding && kind === "llm";
  const [showAllModels, setShowAllModels] = useState(!showRecommended);

  async function fetchModels() {
    setLoading(true);
    const { models } = await System.customModels(MODEL_SOURCES[kind]);
    setModels(models || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchModels();
  }, [kind]);

  function selectModel(modelId) {
    if (!modelId || modelId === selectedModelId) return;
    onSelect(modelId);
  }

  /**
   * Downloads a model id or Hugging Face checkpoint, then selects it.
   * @param {string} modelName
   * @param {string} label - shown in the download status
   * @param {(percentage: number) => void} onProgress
   * @returns {Promise<boolean>} whether the model was downloaded
   */
  async function downloadModel(modelName, label, onProgress = () => {}) {
    if (download) {
      showToast(
        "Another model is downloading. Wait for it to finish or cancel it.",
        "info",
        { clear: true }
      );
      return false;
    }

    setDownload({ label, percentage: 0 });
    const { success, error, modelId } =
      await EmbeddedLemonadeUtils.downloadModel(modelName, (percentage) => {
        setDownload({ label, percentage });
        onProgress(percentage);
      });
    setDownload(null);

    if (!success) {
      const cancelled = error === DOWNLOAD_CANCELLED;
      showToast(
        cancelled
          ? `Download of ${label} cancelled.`
          : error || `Could not download ${label}`,
        cancelled ? "info" : "error",
        { clear: true }
      );
      return false;
    }
    await fetchModels();
    selectModel(modelId || modelName);
    notifyDesktop("Model ready", `${label} is ready to use.`);
    return true;
  }

  /**
   * Imports a .gguf file on this machine, then selects it.
   * @param {string} filePath
   * @returns {Promise<boolean>} whether the model was imported
   */
  async function importModel(filePath) {
    const { success, error, modelId } = await EmbeddedLemonadeUtils.importModel(
      filePath,
      kind
    );
    if (!success) {
      showToast(error || "Could not import the model.", "error", {
        clear: true,
      });
      return false;
    }
    showToast(`Imported ${modelId}.`, "success", { clear: true });
    await fetchModels();
    selectModel(modelId);
    notifyDesktop("Model ready", `${modelId} is ready to use.`);
    return true;
  }

  async function uninstallModel(modelId) {
    if (
      !window.confirm(
        "Are you sure you want to uninstall this model? You will need to download it again to use it."
      )
    )
      return;
    const { success, error } = await EmbeddedLemonadeUtils.removeModel(modelId);
    if (!success) {
      showToast(
        error || "An error occurred while uninstalling the model",
        "error",
        {
          clear: true,
        }
      );
      return;
    }
    await fetchModels();
  }

  return (
    <>
      <EngineStatus />
      {children}
      {download ? (
        <DownloadStatus download={download} />
      ) : (
        <PullFromHuggingFace
          kind={kind}
          onPull={(checkpoint) => downloadModel(checkpoint, checkpoint)}
        />
      )}
      {!download && <ImportLocalModel onImport={importModel} />}
      {isDesktopApp() && <OpenModelsFolder />}

      {showAllModels ? (
        <>
          {showRecommended && (
            <button
              type="button"
              onClick={() => setShowAllModels(false)}
              className="border-none w-fit text-sm text-sky-400 hover:underline"
            >
              Show recommended models
            </button>
          )}
          <ModelSelection
            models={models}
            loading={loading}
            fetchModels={fetchModels}
            selectedModelId={selectedModelId}
            selectModel={selectModel}
            downloadModel={downloadModel}
            uninstallModel={uninstallModel}
            kind={kind}
          />
        </>
      ) : (
        <RecommendedModels
          selectedModelId={selectedModelId}
          selectModel={selectModel}
          downloadModel={downloadModel}
          downloading={!!download}
          downloadedIds={
            new Set(models.filter((m) => m.downloaded).map((m) => m.id))
          }
          showAllModels={() => setShowAllModels(true)}
        />
      )}
    </>
  );
}

/** Shows the engine download/startup while it is not ready yet. */
function EngineStatus() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let timer = null;
    // A status request can still be in flight on unmount - it must not schedule another poll.
    let active = true;
    async function poll() {
      const next = await EmbeddedLemonadeUtils.status();
      if (!active) return;
      setStatus(next);
      if (next && !["ready", "error"].includes(next.state))
        timer = setTimeout(poll, 2000);
    }
    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  if (!status || status.state === "ready" || status.state === "idle")
    return null;
  if (status.state === "error")
    return (
      <p className="text-red-400 text-sm">
        The local LLM engine failed to start: {status.message}
      </p>
    );
  return (
    <div className="flex items-center gap-x-2 text-theme-text-secondary text-sm">
      <CircleNotch className="w-4 h-4 animate-spin" />
      <p>
        {status.message}
        {status.progress !== null ? ` ${status.progress}%` : ""}
      </p>
    </div>
  );
}

/** The download in flight, with a way to cancel it. */
function DownloadStatus({ download }) {
  return (
    <div className="flex h-[40px] items-center gap-x-2">
      <div className="border-none bg-theme-bg-secondary p-2 rounded-lg h-[24px] w-[24px] flex items-center justify-center">
        <CircleNotch
          weight="bold"
          size={14}
          className="shrink-0 animate-spin text-theme-text-secondary"
        />
      </div>
      <p className="text-left text-theme-text-secondary text-sm">
        Downloading {download.label} {download.percentage}%
      </p>
      <button
        type="button"
        onClick={async () => {
          if (!(await EmbeddedLemonadeUtils.cancelDownload()))
            showToast("Could not cancel the download.", "error", {
              clear: true,
            });
        }}
        className="border-none transition-all duration-300 px-2 py-1 rounded-lg text-white text-sm hover:bg-red-500"
      >
        Cancel
      </button>
    </div>
  );
}

/**
 * Onboarding only: three models picked for this server's hardware, as cards. Clicking a card downloads (if needed)
 * and selects the model.
 */
function RecommendedModels({
  selectedModelId,
  selectModel,
  downloadModel,
  downloading,
  downloadedIds,
  showAllModels,
}) {
  const [result, setResult] = useState(null);

  useEffect(() => {
    EmbeddedLemonadeUtils.recommendations().then(setResult);
  }, []);

  if (!result)
    return (
      <div className="flex items-center gap-x-2 text-theme-text-secondary text-sm">
        <CircleNotch className="w-4 h-4 animate-spin" />
        <p>Finding models for your hardware...</p>
      </div>
    );

  const hardware = result.vramGb
    ? `${result.vramGb} GB GPU`
    : result.ramGb
      ? `${result.ramGb} GB of memory (no supported GPU)`
      : null;

  async function choose(model) {
    if (downloadedIds.has(model.id)) return selectModel(model.id);
    if (
      !window.confirm(
        `Download ${model.name}? It is ${model.size} and may take a while to download.`
      )
    )
      return;
    await downloadModel(model.id, model.name);
  }

  return (
    <div className="flex flex-col gap-y-3">
      <div className="flex flex-col gap-y-1">
        <p className="text-white text-sm font-semibold">Recommended models</p>
        {hardware && (
          <p className="text-theme-text-secondary text-xs">
            Picked to run comfortably on this server's {hardware}.
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {result.recommendations.map(
          ({ category, label, description, model }) => {
            const selected = model.id === selectedModelId;
            const downloaded = downloadedIds.has(model.id);
            return (
              <button
                key={category}
                type="button"
                disabled={downloading && !downloaded}
                onClick={() => choose(model)}
                className={`text-left flex flex-col gap-y-2 p-4 rounded-lg border transition-all duration-200 bg-theme-bg-secondary hover:bg-theme-bg-primary disabled:opacity-50 disabled:cursor-not-allowed ${selected ? "border-primary-button" : "border-theme-modal-border"}`}
              >
                <div className="flex items-center justify-between gap-x-2">
                  <p className="text-xs uppercase font-semibold text-theme-text-secondary">
                    {label}
                  </p>
                  {selected && (
                    <CheckCircle
                      size={18}
                      weight="fill"
                      className="text-primary-button shrink-0"
                    />
                  )}
                </div>
                <div className="flex items-center gap-x-2">
                  <MonoProviderIcon
                    provider={model.name}
                    match="pattern"
                    fallbackIconKey={model.organization?.toLowerCase()}
                    size={20}
                    className="text-theme-text-primary shrink-0"
                  />
                  <p className="text-white text-base font-semibold">
                    {model.name}
                  </p>
                </div>
                <p className="text-theme-text-secondary text-xs">
                  {description}
                </p>
                <p className="text-theme-text-secondary text-xs mt-auto">
                  {[
                    model.size,
                    model.capabilities?.vision ? "Vision" : null,
                    model.capabilities?.reasoning ? "Thinking" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="text-sm text-sky-400">
                  {selected
                    ? "Selected"
                    : downloaded
                      ? "Use this model"
                      : "Download"}
                </p>
              </button>
            );
          }
        )}
      </div>
      <button
        type="button"
        onClick={showAllModels}
        className="border-none w-fit text-sm text-sky-400 hover:underline"
      >
        Show all models
      </button>
    </div>
  );
}

function ModelSelection({
  models,
  loading,
  fetchModels,
  selectedModelId,
  selectModel,
  downloadModel,
  uninstallModel,
  kind,
}) {
  const [searchQuery, setSearchQuery] = useState("");

  async function downloadFromTable(modelId, fileSize, progressCallback) {
    if (
      !window.confirm(
        `Are you sure you want to download this model? It is ${fileSize} in size and may take a while to download.`
      )
    )
      return;
    const model = models.find((m) => m.id === modelId);
    if (await downloadModel(modelId, model?.name ?? modelId, progressCallback))
      progressCallback(100);
  }

  const query = searchQuery.toLowerCase().trim();
  const filteredModels = !query
    ? models
    : models.filter((model) =>
        [model.name, model.family, model.organization].some((value) => {
          const normalized = (value || "").toLowerCase();
          return (
            normalized.includes(query) || strDistance(normalized, query) <= 2
          );
        })
      );

  // Downloaded models first, then each family in registry order.
  const groups = new Map();
  const downloaded = filteredModels.filter((model) => model.downloaded);
  if (downloaded.length) groups.set("Downloaded Models", downloaded);
  for (const model of filteredModels) {
    const family = model.family || model.organization || "Other";
    groups.set(family, [...(groups.get(family) || []), model]);
  }

  return (
    <ModelTableLayout
      fetchModels={fetchModels}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      loading={loading}
    >
      <Tooltip
        id="install-model-tooltip"
        place="top"
        className="tooltip !text-xs !opacity-100 z-99"
      />
      <Tooltip
        id="embedded-lemonade-model-badge"
        place="top"
        className="tooltip !text-xs !opacity-100 z-99"
      />
      {loading ? (
        <ModelTableLoadingSkeleton />
      ) : filteredModels.length === 0 ? (
        <div className="flex flex-col w-full gap-y-2 mt-4">
          <p className="text-theme-text-secondary text-sm">
            {kind === "embedding"
              ? "No embedding models found! The local model engine may still be starting."
              : "No models found! The local LLM engine may still be starting."}
          </p>
        </div>
      ) : (
        Array.from(groups.entries()).map(([alias, groupModels]) => (
          <ModelTable
            key={alias}
            alias={alias}
            models={groupModels}
            setActiveModel={selectModel}
            downloadModel={downloadFromTable}
            selectedModelId={selectedModelId}
            uninstallModel={uninstallModel}
            ui={{ rawTitle: true, badges: ModelBadges }}
          />
        ))
      )}
    </ModelTableLayout>
  );
}

/**
 * Pull any GGUF repository from Hugging Face (or ModelScope, per EMBEDDED_LEMONADE_REGISTRY) as
 * owner/repo[:QUANT] or its URL.
 */
function PullFromHuggingFace({ onPull, kind }) {
  const [showInput, setShowInput] = useState(false);
  const [repo, setRepo] = useState("");

  function handlePull() {
    const checkpoint = normalizeCheckpoint(repo);
    if (!checkpoint)
      return showToast(
        "Enter a repository like owner/model-GGUF or owner/model-GGUF:Q4_K_M",
        "error",
        { clear: true }
      );
    setShowInput(false);
    setRepo("");
    onPull(checkpoint);
  }

  if (!showInput)
    return (
      <button
        type="button"
        onClick={() => setShowInput(true)}
        className="w-fit relative flex h-[40px] items-center border-none hover:bg-theme-bg-sidebar rounded-lg"
      >
        <div className="flex w-full gap-x-2 items-center">
          <div className="border-none bg-theme-bg-secondary p-2 rounded-lg h-[24px] w-[24px] flex items-center justify-center">
            <Plus
              weight="bold"
              size={14}
              className="shrink-0 text-theme-text-secondary"
            />
          </div>
          <p className="text-left text-theme-text-secondary text-sm">
            Pull model from Hugging Face
          </p>
        </div>
      </button>
    );

  return (
    <div className="flex flex-col gap-y-2">
      <div className="flex w-fit items-center gap-x-2">
        <input
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            handlePull();
          }}
          className="border-none bg-theme-settings-input-bg text-white placeholder:text-theme-settings-input-placeholder text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-[360px] p-2.5"
          type="text"
          placeholder={
            kind === "embedding"
              ? "Qwen/Qwen3-Embedding-0.6B-GGUF:Q8_0"
              : "unsloth/Qwen3-4B-GGUF:Q4_K_M"
          }
          autoFocus
        />
        <button
          type="button"
          onClick={handlePull}
          className="transition-all duration-300 border border-slate-200 p-2 rounded-lg text-white text-sm items-center flex gap-x-2 hover:bg-slate-200 hover:text-slate-800"
        >
          Pull
        </button>
        <button
          type="button"
          onClick={() => {
            setShowInput(false);
            setRepo("");
          }}
          className="border-none transition-all duration-300 p-2 rounded-lg text-white text-sm items-center flex gap-x-2 hover:bg-red-500"
        >
          Cancel
        </button>
      </div>
      <p className="text-theme-text-secondary text-xs max-w-[600px]">
        Any GGUF model repository on{" "}
        <a
          href={
            kind === "embedding"
              ? "https://huggingface.co/models?library=gguf&pipeline_tag=feature-extraction&sort=trending"
              : "https://huggingface.co/models?library=gguf&sort=trending"
          }
          target="_blank"
          rel="noreferrer"
          className="text-sky-400 hover:underline"
        >
          Hugging Face
        </a>
        , as owner/repository with an optional :quantization, or its URL. When
        no quantization is given, Q4_K_M is used if the repository has it.
      </p>
    </div>
  );
}

/** Desktop app only: opens the models folder in the OS file manager. */
function OpenModelsFolder() {
  return (
    <button
      type="button"
      onClick={async () => {
        if (!(await openDesktopPath("models")))
          showToast("Could not open the models folder.", "error", {
            clear: true,
          });
      }}
      className="w-fit relative flex h-[40px] items-center border-none hover:bg-theme-bg-sidebar rounded-lg"
    >
      <div className="flex w-full gap-x-2 items-center">
        <div className="border-none bg-theme-bg-secondary p-2 rounded-lg h-[24px] w-[24px] flex items-center justify-center">
          <FolderOpen
            weight="bold"
            size={14}
            className="shrink-0 text-theme-text-secondary"
          />
        </div>
        <p className="text-left text-theme-text-secondary text-sm">
          Open models folder
        </p>
      </div>
    </button>
  );
}

/**
 * Import a .gguf file from this machine. The desktop app opens its file picker; otherwise the path is typed in.
 * @param {{onImport: (filePath: string) => Promise<boolean>}} props
 */
function ImportLocalModel({ onImport }) {
  const [showInput, setShowInput] = useState(false);
  const [filePath, setFilePath] = useState("");
  // The file name being imported, or null.
  const [importing, setImporting] = useState(null);

  async function runImport(pathToImport) {
    const value = pathToImport.trim();
    if (!value)
      return showToast("Enter the path of a .gguf file.", "error", {
        clear: true,
      });
    setImporting(value.split(/[\\/]/).pop());
    const imported = await onImport(value);
    setImporting(null);
    if (imported) {
      setShowInput(false);
      setFilePath("");
    }
  }

  async function handleClick() {
    if (!isDesktopApp()) return setShowInput(true);
    const picked = await pickGgufFile();
    if (picked) await runImport(picked);
  }

  if (importing)
    return (
      <div className="flex h-[40px] items-center gap-x-2">
        <div className="border-none bg-theme-bg-secondary p-2 rounded-lg h-[24px] w-[24px] flex items-center justify-center">
          <CircleNotch
            weight="bold"
            size={14}
            className="shrink-0 animate-spin text-theme-text-secondary"
          />
        </div>
        <p className="text-left text-theme-text-secondary text-sm">
          Importing {importing}...
        </p>
      </div>
    );

  if (!showInput)
    return (
      <button
        type="button"
        onClick={handleClick}
        className="w-fit relative flex h-[40px] items-center border-none hover:bg-theme-bg-sidebar rounded-lg"
      >
        <div className="flex w-full gap-x-2 items-center">
          <div className="border-none bg-theme-bg-secondary p-2 rounded-lg h-[24px] w-[24px] flex items-center justify-center">
            <Plus
              weight="bold"
              size={14}
              className="shrink-0 text-theme-text-secondary"
            />
          </div>
          <p className="text-left text-theme-text-secondary text-sm">
            Import local GGUF file
          </p>
        </div>
      </button>
    );

  return (
    <div className="flex flex-col gap-y-2">
      <div className="flex w-full md:w-fit flex-wrap items-center gap-x-2 gap-y-2">
        <input
          value={filePath}
          onChange={(e) => setFilePath(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            runImport(filePath);
          }}
          className="border-none bg-theme-settings-input-bg text-white placeholder:text-theme-settings-input-placeholder text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-full md:w-[360px] p-2.5"
          type="text"
          placeholder="/path/to/model.gguf"
          autoFocus
        />
        <button
          type="button"
          onClick={() => runImport(filePath)}
          className="transition-all duration-300 border border-slate-200 p-2 rounded-lg text-white text-sm items-center flex gap-x-2 hover:bg-slate-200 hover:text-slate-800"
        >
          Import
        </button>
        <button
          type="button"
          onClick={() => {
            setShowInput(false);
            setFilePath("");
          }}
          className="border-none transition-all duration-300 p-2 rounded-lg text-white text-sm items-center flex gap-x-2 hover:bg-red-500"
        >
          Cancel
        </button>
      </div>
      <p className="text-theme-text-secondary text-xs max-w-[600px]">
        The absolute path of a .gguf file on the machine running AnythingLLM.
        The file is linked or copied into the models folder.
      </p>
    </div>
  );
}

/**
 * Turns user input into an owner/repo[:quant] checkpoint. Accepts a bare checkpoint, a Hugging Face or
 * ModelScope URL, `hf.co/owner/repo:quant`, or an `ollama run hf.co/...` command.
 * @param {string} input
 * @returns {string|null}
 */
function normalizeCheckpoint(input = "") {
  const value = input
    .trim()
    .replace(/^ollama run\s+/i, "")
    .replace(/^https?:\/\//i, "")
    .replace(/^(www\.)?(huggingface\.co|hf\.co|modelscope\.cn\/models)\//i, "");
  const [path, quant = null] = value.split(":");
  const [owner, name] = path.split("/").filter(Boolean);
  if (!owner || !name) return null;
  return `${owner}/${name}${quant ? `:${quant}` : ""}`;
}

/** Badges shown before a model's name - the runtime is always llama.cpp, so only what sets a model apart. */
function ModelBadges(model) {
  const mtp = model.tags?.includes("mtp") || /\bmtp\b/i.test(model.name);
  if (!mtp) return null;
  return (
    <div className="flex items-center gap-x-1">
      <Lightning
        size={16}
        weight="duotone"
        className="text-amber-400 light:text-amber-600"
        data-tooltip-id="embedded-lemonade-model-badge"
        data-tooltip-content="Multi-token prediction: usually faster on a GPU, uses a little more memory"
      />
    </div>
  );
}
