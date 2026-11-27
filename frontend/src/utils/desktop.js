/** The desktop app's preload bridge, or null in a browser. */
function bridge() {
  return typeof window !== "undefined"
    ? (window.anythingDesktop ?? null)
    : null;
}

export function isDesktopApp() {
  return !!bridge()?.isDesktop;
}

/**
 * Opens the OS file picker for a GGUF model.
 * @returns {Promise<string|null>} the picked absolute path, or null when cancelled or outside the desktop app
 */
export async function pickGgufFile() {
  const picker = bridge()?.pickFile;
  if (!picker) return null;
  return (
    (await picker({
      filters: [{ name: "GGUF model", extensions: ["gguf"] }],
    })) ?? null
  );
}

/**
 * Opens one of the app's folders in the OS file manager.
 * @param {"models"|"storage"|"logs"} kind
 * @returns {Promise<boolean>} false outside the desktop app or when it could not be opened
 */
export async function openDesktopPath(kind) {
  const open = bridge()?.openPath;
  if (!open) return false;
  try {
    await open(kind);
    return true;
  } catch {
    return false;
  }
}

/**
 * Shows an OS notification, but only while the window is in the background - otherwise the in-app toast is enough.
 * @returns {Promise<boolean>} whether a notification was sent
 */
export async function notifyDesktop(title, body) {
  const notify = bridge()?.notify;
  if (!notify || (!document.hidden && document.hasFocus())) return false;
  try {
    await notify(title, body);
    return true;
  } catch {
    return false;
  }
}
