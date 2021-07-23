const test = require('ava')

const { loadBundle } = require('./helpers/bundle')
const { callHandler } = require('./helpers/handler')
const { runCliBuild, runNetlifyBuild } = require('./helpers/run')

test('Edge Handlers should be bundled', async (t) => {
  await runNetlifyBuild(t, 'integration-test')

  const { manifest, handlers } = loadBundle(t, 'integration-test')
  t.deepEqual(manifest.handlers.sort(), ['example', 'hello_world'])

  const example = await callHandler(t, handlers, 'example')
  t.is(example.logs, '3 days')

  const helloWorld = await callHandler(t, handlers, 'hello_world', {
    getRequest: () => ({ headers: { get: () => 'AK' } }),
  })
  t.is(helloWorld.logs, '1,2,3,4,379')
})

test('Edge Handlers directory can be configured using build.edge_handlers', async (t) => {
  await runNetlifyBuild(t, 'config-dir')

  const { manifest } = loadBundle(t, 'config-dir')
  t.deepEqual(manifest.handlers, ['example'])
})

test('Edge Handlers directory build.edge_handlers misconfiguration is reported', async (t) => {
  const { output } = await runNetlifyBuild(t, 'wrong-config-dir', { expectedSuccess: false })
  t.true(output.includes('does-not-exist'))
})

test('Edge Handlers directory build.edge_handlers syntax error is reported', async (t) => {
  const { output } = await runNetlifyBuild(t, 'syntax-error', { expectedSuccess: false })
  t.true(output.includes('Error while bundling'))
})

test('Edge Handlers CLI build works', async (t) => {
  const { code, handlers, msg, success } = await runCliBuild('integration-test')
  t.true(success, `failed bundling integration test (${code}): ${msg}`)
  t.true(handlers.length !== 0, 'did not include any handlers')
})

test('Edge Handlers CLI build errors on syntax error', async (t) => {
  const { code, msg, success } = await runCliBuild('syntax-error')
  t.false(success, `successfully bundled broken test (${code}): ${msg}`)
})

test('Edge Handlers CLI build bundles custom directories', async (t) => {
  const { code, handlers, msg, success } = await runCliBuild('config-dir', 'custom-edge-handlers')
  t.true(success, `failed bundling integration test (${code}): ${msg}`)
  t.true(handlers.length !== 0, 'did not include any handlers')
})

test('Edge Handlers CLI outputs missing imports', async (t) => {
  const { code, importee, importer, msg, success } = await runCliBuild('missing-modules')

  t.false(success, `failed bundling integration test (${code}): ${msg}`)
  t.is(importee, 'gatsby')
  t.true(importer.length !== 0)
  t.true(importer.endsWith('.js'))
})

test('Edge Handlers should polyfill node built in modules', async (t) => {
  await runNetlifyBuild(t, 'node-polyfills')
  const { manifest, handlers } = loadBundle(t, 'node-polyfills')
  t.deepEqual(manifest.handlers, ['process_version'])

  const processVersion = await callHandler(t, handlers, 'process_version')
  t.is(processVersion.logs, 'Process version is: ')
})
