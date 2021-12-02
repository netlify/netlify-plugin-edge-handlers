import { promises as fs } from 'fs'
import { pathToFileURL } from 'url'

import isPlainObj from 'is-plain-obj'
import { spy } from 'sinon'

import { resolveFixtureName } from './fixtures.js'
import { normalizeHandler, isValidHandler } from './handler.js'

// Retrieve Edge Handlers bundled handlers
export const loadBundle = async function (t, fixtureName) {
  const { manifest, jsBundlePath } = await loadManifest(t, fixtureName)
  const handlers = await requireBundle(jsBundlePath)
  t.true(handlers.every(isValidHandler))
  return { manifest, handlers }
}

// Load Edge Handlers `manifest.json`
const loadManifest = async function (t, fixtureName) {
  const fixtureDir = resolveFixtureName(fixtureName)
  const localOutDir = `${fixtureDir}/.netlify/edge-handlers`
  const manifestContents = await fs.readFile(`${localOutDir}/manifest.json`, 'utf8')
  const manifest = JSON.parse(manifestContents)

  validateManifest(t, manifest)

  const bundlePath = `${localOutDir}/${manifest.sha}`
  const jsBundlePath = `${bundlePath}.js`
  await fs.rename(bundlePath, jsBundlePath)
  return { localOutDir, manifest, jsBundlePath }
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
const requireBundle = async function (jsBundlePath) {
  const setRegistry = spy()
  global.netlifyRegistry = { set: setRegistry }
  // `import()` arguments are URLs, not file paths.
  // Therefore, `pathToFileURL()` is needed, especially since `jsBundlePath`
  // is absolute, which means it has a drive letter on Windows.
  await import(pathToFileURL(jsBundlePath))
  delete global.netlifyRegistry

  const handlers = setRegistry.args.map(normalizeHandler)
  return handlers
}
