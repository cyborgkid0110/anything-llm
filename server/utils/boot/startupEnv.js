/**
 * The environment this process was started with, captured before dotenv loads the .env file. Must be the first
 * require in index.js. Used where /proc/self/environ does not exist (eg: Windows).
 */
const STARTUP_ENV = Object.freeze({ ...process.env });

module.exports = { STARTUP_ENV };
