const test = require("ava");

const { loadBundle } = require("./helpers/bundle");
const { callHandler } = require("./helpers/handler");
const { runNetlifyBuild } = require("./helpers/run");

test("Edge handlers should be bundled", async (t) => {
  await runNetlifyBuild(t, "integration-test");

  const { manifest, handlers } = loadBundle(t, "integration-test");
  t.deepEqual(manifest.handlers.sort(), ["example", "hello-world"]);

  const example = await callHandler(t, handlers, "example");
  t.is(example.logs, "3 days");

  const helloWorld = await callHandler(t, handlers, "hello-world", {
    getRequest: () => ({ headers: { get: () => "AK" } }),
  });
  t.deepEqual(helloWorld.logs, "1,2,3,4,379");
});

test("Edge handlers directory can be configured using build.edge_handlers", async (t) => {
  await runNetlifyBuild(t, "config-dir");

  const { manifest } = loadBundle(t, "config-dir");
  t.deepEqual(manifest.handlers, ["example"]);
});

test("Edge handlers directory build.edge_handlers misconfiguration is reported", async (t) => {
  const { output } = await runNetlifyBuild(t, "wrong-config-dir", { expectedSuccess: false });
  t.true(output.includes("does-not-exist"));
});

test("Edge handlers directory build.edge_handlers syntax error is reported", async (t) => {
  const { output } = await runNetlifyBuild(t, "syntax-error", { expectedSuccess: false });
  t.true(output.includes("Error while bundling"));
});
