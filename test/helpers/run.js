import { exec } from 'child_process'
import { env } from 'process'
import { fileURLToPath } from 'url'

// Ensure @netlify/build logs have colors. Must be done before requiring it.
env.FORCE_COLOR = '1'

// eslint-disable-next-line import/first
import netlifyBuild from '@netlify/build'

// eslint-disable-next-line import/first
import { resolveFixtureName } from './fixtures.js'

const CLI_PATH = fileURLToPath(new URL('../../src/cli.js', import.meta.url))
const FIXTURES_DIR = fileURLToPath(new URL('../fixtures', import.meta.url))

// Run @netlify/build on a specific fixture directory
// Retrieve:
//  - `success` {boolean}: whether build succeeded
//  - `output` {string}: build logs
export const runNetlifyBuild = async function (t, fixtureName, { expectedSuccess = true } = {}) {
  const cwd = resolveFixtureName(fixtureName)
  const { success, logs } = await netlifyBuild({ cwd, buffer: true, telemetry: false })
  const output = serializeOutput(logs)
  printOutput({ output, success, expectedSuccess })
  t.is(success, expectedSuccess)
  return { output }
}

/**
 * Run a CLI build.
 *
 * @param {*} t the test function
 * @param {*} fixtureName the fixture to bundle
 */
export const runCliBuild = async (fixtureName, subdir = 'netlify/edge-handlers') => {
  const fixturePath = `${FIXTURES_DIR}/${fixtureName}/${subdir}`

  const options = { maxBuffer: 1024 * 1024 * 32, windowsHide: true }

  const output = await new Promise((resolve, reject) => {
    exec(`node ${CLI_PATH} build ${fixturePath}`, options, (err, stdout) => {
      if (err) {
        reject(err)
      } else {
        resolve(stdout)
      }
    })
  })

  return JSON.parse(output)
}

// @netlify/build stdout/stderr logs are concatenated as an array.
// This flattens them as a string similar to what would be printed in real logs.
const serializeOutput = function (logs) {
  return [logs.stdout.join('\n'), logs.stderr.join('\n')].filter(Boolean).join('\n\n')
}

// When the `DEBUG` environment variable is set, print @netlify/build logs
const printOutput = function ({ output, success, expectedSuccess }) {
  if (!isDebugMode() && success === expectedSuccess) {
    return
  }

  console.log(output)
}

const isDebugMode = function () {
  return env.DEBUG === '1'
}
