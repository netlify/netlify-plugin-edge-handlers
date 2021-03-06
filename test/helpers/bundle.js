const isPlainObj = require('is-plain-obj')
const sinon = require('sinon')

const { resolveFixtureName } = require('./fixtures')
const { normalizeHandler, isValidHandler } = require('./handler')

// Retrieve Edge Handlers bundled handlers
const loadBundle = function (t, fixtureName) {
  const { manifest, bundlePath } = loadManifest(t, fixtureName)
  const handlers = requireBundle(t, bundlePath)
  return { manifest, handlers }
}

// Load Edge Handlers `manifest.json`
const loadManifest = function (t, fixtureName) {
  const fixtureDir = resolveFixtureName(fixtureName)
  const localOutDir = `${fixtureDir}/.netlify/edge-handlers`
  const manifestPath = `${localOutDir}/manifest.json`
  // eslint-disable-next-line import/no-dynamic-require, node/global-require
  const manifest = require(manifestPath)

  validateManifest(t, manifest)

  const bundlePath = `${localOutDir}/${manifest.sha}`
  return { localOutDir, manifest, bundlePath }
}

// Validate that manifest.json has the correct shape
const validateManifest = function (t, manifest) {
  t.true(isPlainObj(manifest))
  t.is(typeof manifest.sha, 'string')
  t.true(Number.isInteger(manifest.content_length))
  t.true(manifest.content_length > 0)
  t.is(manifest.content_type, 'application/javascript')
  t.true(Array.isArray(manifest.handlers))
  t.true(manifest.handlers.every((handler) => typeof handler === 'string'))
}

// Require the bundle file.
// Spy on `netlifyRegistry.set()` to retrieve the list of handlers.
const requireBundle = function (t, bundlePath) {
  const setRegistry = sinon.spy()
  global.netlifyRegistry = { set: setRegistry }
  // eslint-disable-next-line import/no-dynamic-require, node/global-require
  require(bundlePath)
  delete global.netlifyRegistry

  const handlers = setRegistry.args.map(normalizeHandler)
  t.true(handlers.every(isValidHandler))
  return handlers
}

module.exports = { loadBundle }
