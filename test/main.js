const test = require("ava");

const { loadBundle } = require("./helpers/bundle");
const { callHandler } = require("./helpers/handler");
const { runNetlifyBuild } = require("./helpers/run");

const INTEGRATION_TEST_DIR = `${__dirname}/../integration-test`;

test("Edge handlers should be bundled", async (t) => {
  await runNetlifyBuild(t, INTEGRATION_TEST_DIR);

  const { manifest, handlers } = loadBundle(t, INTEGRATION_TEST_DIR);
  t.deepEqual(manifest.handlers.sort(), ["example", "hello-world"]);

  const example = await callHandler(t, handlers, "example");
  t.is(example.logs, "3 days");

  const helloWorld = await callHandler(t, handlers, "hello-world", {
    getRequest: () => ({ headers: { get: () => "AK" } }),
  });
  t.deepEqual(helloWorld.logs, "1,2,3,4,379");
});
