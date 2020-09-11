const isPlainObj = require("is-plain-obj");
const sinon = require("sinon");

const { normalizeHandler, isValidHandler } = require("./handler");

// Retrieve Edge handlers bundled handlers
const loadBundle = function (t, fixtureDir) {
  const { manifest, bundlePath } = loadManifest(t, fixtureDir);
  const handlers = requireBundle(t, bundlePath);
  return { manifest, handlers };
};

// Load Edge handlers `manifest.json`
const loadManifest = function (t, fixtureDir) {
  const localOutDir = `${fixtureDir}/.netlify/edge-handlers`;
  const manifestPath = `${localOutDir}/manifest.json`;
  const manifest = require(manifestPath);

  validateManifest(t, manifest);

  const bundlePath = `${localOutDir}/${manifest.sha}`;
  return { localOutDir, manifest, bundlePath };
};

// Validate that manifest.json has the correct shape
const validateManifest = function (t, manifest) {
  t.true(isPlainObj(manifest));
  t.is(typeof manifest.sha, "string");
  t.true(Number.isInteger(manifest.content_length));
  t.true(manifest.content_length > 0);
  t.is(manifest.content_type, "application/javascript");
  t.true(Array.isArray(manifest.handlers));
  t.true(manifest.handlers.every((handler) => typeof handler === "string"));
};

// Require the bundle file.
// Spy on `netlifyRegistry.set()` to retrieve the list of handlers.
const requireBundle = function (t, bundlePath) {
  const setRegistry = sinon.spy();
  global.netlifyRegistry = { set: setRegistry };
  require(bundlePath);
  delete global.netlifyRegistry;

  const handlers = setRegistry.args.map(normalizeHandler);
  t.true(handlers.every(isValidHandler));
  return handlers;
};

module.exports = { loadBundle };
