const test = require("ava");

const { loadBundle } = require("./helpers/bundle");
const { callHandler } = require("./helpers/handler");
const { runNetlifyBuild } = require("./helpers/run");

const FIXTURES_DIR = `${__dirname}/fixtures`;
const INTEGRATION_TEST_DIR = `${FIXTURES_DIR}/integration-test`;
const CONFIG_FIXTURE_DIR = `${FIXTURES_DIR}/config-dir`;
const WRONG_CONFIG_FIXTURE_DIR = `${FIXTURES_DIR}/wrong-config-dir`;

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

test("Edge handlers directory can be configured using build.edge_handlers", async (t) => {
  await runNetlifyBuild(t, CONFIG_FIXTURE_DIR);

  const { manifest } = loadBundle(t, CONFIG_FIXTURE_DIR);
  t.deepEqual(manifest.handlers, ["example"]);
});

test("Edge handlers directory build.edge_handlers misconfiguration is reported", async (t) => {
  const { output } = await runNetlifyBuild(t, WRONG_CONFIG_FIXTURE_DIR, { expectedSuccess: false });
  t.true(output.includes("does-not-exist"));
});
