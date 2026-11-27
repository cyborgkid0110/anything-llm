const DATASOURCE_URL = /(^datasource\s+db\s*\{[^}]*?^\s*url\s*=\s*)"[^"]*"/m;

/** Points the active `datasource db` url at `url` and leaves the rest alone. */
function withDatabaseUrl(schemaText, url) {
  if (!DATASOURCE_URL.test(schemaText))
    throw new Error("schema.prisma has no datasource url to rewrite");
  const safe = url.replace(/\\/g, "/");
  return schemaText.replace(DATASOURCE_URL, (_m, head) => `${head}"${safe}"`);
}

module.exports = { withDatabaseUrl };
