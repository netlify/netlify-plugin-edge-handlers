const { env } = require("process");

// Ensure @netlify/build logs have colors. Must be done before requiring it.
env.FORCE_COLOR = "1";

const netlifyBuild = require("@netlify/build");

// Run @netlify/build on a specific fixture directory
// Retrieve:
//  - `success` {boolean}: whether build succeeded
//  - `output` {string}: build logs
const runNetlifyBuild = async function (t, fixtureDir, { expectedSuccess = true } = {}) {
  const { success, logs } = await netlifyBuild({ cwd: fixtureDir, buffer: true, telemetry: false });
  const output = serializeOutput(logs);
  printOutput({ output, success, expectedSuccess });
  t.is(success, expectedSuccess);
  return { output };
};

// @netlify/build stdout/stderr logs are concatenated as an array.
// This flattens them as a string similar to what would be printed in real logs.
const serializeOutput = function (logs) {
  return [logs.stdout.join("\n"), logs.stderr.join("\n")].filter(Boolean).join("\n\n");
};

// When the `DEBUG` environment variable is set, print @netlify/build logs
const printOutput = function ({ output, success, expectedSuccess }) {
  if (!isDebugMode() && success === expectedSuccess) {
    return;
  }

  console.log(output);
};

const isDebugMode = function () {
  return env.DEBUG === "1";
};

module.exports = { runNetlifyBuild };
