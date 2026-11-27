const PATH_KINDS = ["models", "storage", "logs"];
const EXTENSION = /^[a-z0-9]{1,10}$/i;

const isString = (v) => typeof v === "string";
const isPlainObject = (v) =>
  v !== null && typeof v === "object" && !Array.isArray(v);

/** Open-dialog filters: up to 5 `{ name, extensions[] }`. */
function fileFilters(input) {
  if (!Array.isArray(input) || input.length > 5)
    throw new Error("filters must be an array of at most 5 items");
  return input.map((filter) => {
    if (!isPlainObject(filter)) throw new Error("filter must be an object");
    const { name, extensions } = filter;
    if (!isString(name) || !name || name.length > 64)
      throw new Error("filter name must be 1-64 characters");
    if (
      !Array.isArray(extensions) ||
      extensions.length < 1 ||
      extensions.length > 10
    )
      throw new Error("filter extensions must have 1-10 items");
    if (!extensions.every((ext) => isString(ext) && EXTENSION.test(ext)))
      throw new Error("invalid filter extension");
    return { name, extensions: [...extensions] };
  });
}

/** One of the folders the app may reveal. */
function pathKind(input) {
  if (!PATH_KINDS.includes(input)) throw new Error("unknown path kind");
  return input;
}

/** Notification text: title 1-120 chars, body up to 500. */
function notification(input) {
  if (!isPlainObject(input)) throw new Error("notification must be an object");
  const { title, body = "" } = input;
  if (!isString(title) || !title || title.length > 120)
    throw new Error("title must be 1-120 characters");
  if (!isString(body) || body.length > 500)
    throw new Error("body must be at most 500 characters");
  return { title, body };
}

module.exports = { fileFilters, pathKind, notification, PATH_KINDS };
