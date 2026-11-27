const ALLOWED_PERMISSIONS = new Set([
  "clipboard-sanitized-write",
  "notifications",
  "media",
]);

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** True when `url` is on the app's own origin. */
function sameOrigin(url, origin) {
  return originOf(url) === origin;
}

/** True for http(s) URLs outside the app origin, i.e. safe to hand to the OS browser. */
function isExternalHttp(url, origin) {
  try {
    const { protocol } = new URL(url);
    return (
      (protocol === "http:" || protocol === "https:") &&
      !sameOrigin(url, origin)
    );
  } catch {
    return false;
  }
}

/** Only clipboard writes, notifications and microphone, only for the app origin. */
function permissionAllowed({ permission, url, origin, mediaTypes }) {
  if (!ALLOWED_PERMISSIONS.has(permission) || !sameOrigin(url, origin))
    return false;
  if (permission !== "media") return true;
  return (
    Array.isArray(mediaTypes) &&
    mediaTypes.length === 1 &&
    mediaTypes[0] === "audio"
  );
}

/** Subframes may only load app pages or about:blank. */
function frameNavigationAllowed(url, origin) {
  return url === "about:blank" || sameOrigin(url, origin);
}

module.exports = {
  sameOrigin,
  isExternalHttp,
  permissionAllowed,
  frameNavigationAllowed,
};
