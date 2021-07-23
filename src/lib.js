const { Buffer } = require('buffer')
const crypto = require('crypto')
const { promises: fsPromises } = require('fs')
const os = require('os')
const path = require('path')
const process = require('process')

const del = require('del')
const esbuild = require('esbuild')
const makeDir = require('make-dir')
const outdent = require('outdent')

const { MANIFEST_FILE, MAIN_FILE, CONTENT_TYPE } = require('./consts')
const uploadBundle = require('./upload')

function getShasum(buf) {
  const shasum = crypto.createHash('sha1')
  shasum.update(buf)
  return shasum.digest('hex')
}

/**
 * Generates an entrypoint for bundling the handlers
 * It also makes sure all handlers are registered with the runtime
 *
 * @param {string} EDGE_HANDLERS_SRC path to the edge handler directory
 * @returns {Promise<{ handlers: string[], mainFile: string }>} list of handlers and path to entrypoint
 */
async function assemble(EDGE_HANDLERS_SRC) {
  const entries = await fsPromises.readdir(EDGE_HANDLERS_SRC, { withFileTypes: true })
  const handlers = entries.filter(isHandlerFile).map(getFilename)

  if (handlers.length === 0) {
    return { handlers }
  }

  const mainContents = handlers
    .map(
      (handler, index) => outdent`
        import * as func${index} from "${unixify(path.resolve(EDGE_HANDLERS_SRC, handler))}";
        netlifyRegistry.set("${handler}", func${index});
      `,
    )
    .map((part) => part.trim())
    .join('\n')
  // make temp dir `handlers-abc123`
  const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'handlers-'))
  const mainFile = path.join(tmpDir, MAIN_FILE)
  await fsPromises.writeFile(mainFile, mainContents)
  return { handlers, mainFile }
}

// ES modules requires forward slashes
function unixify(filePath) {
  if (process.platform !== 'win32') {
    return filePath
  }

  return filePath.replace(UNIXIFY_REGEXP, '/')
}

const UNIXIFY_REGEXP = /\\/g

function isHandlerFile(entry) {
  return path.extname(entry.name) === '.js' && entry.isFile()
}

function getFilename(entry) {
  return path.basename(entry.name, path.extname(entry.name))
}

/**
 * Bundles the handler code based on a generated entrypoint
 *
 * @param {string} file path of the entrypoint file
 * @returns {Promise<string>} bundled code
 */
async function bundleFunctions(file, utils) {
  try {
    return await bundleFunctionsForCli(file)
  } catch (error) {
    if (error.code === 'unresolved-import') {
      const { importee, importer } = error
      return utils.build.failBuild(
        `Error in ${importer}, could not resolve ${importee} module. Please install this dependency locally and ensure it is listed in your package.json`,
      )
    }
    return utils.build.failBuild('Error while bundling Edge Handlers', { error })
  }
}

/**
 * Bundles the given edge handler module for use in the CLI.
 *
 * @param {string} file path of the entrypoint file
 * @returns {Promise<string>} bundled code
 */
async function bundleFunctionsForCli(file) {
  let result
  try {
    result = await esbuild.build({
      entryPoints: [file],
      bundle: true,
      format: 'iife',
      inject: [
        require.resolve('./node-compat/globals'),
        require.resolve('./node-compat/process'),
        require.resolve('./node-compat/buffer'),
      ],
      minify: true,
      target: 'chrome92',
      treeShaking: true,
      write: false,
      plugins: [
        {
          name: 'replaceImports',
          setup(build) {
            // Redirect imports from the `process` nodejs module to our global
            build.onResolve({ filter: /^process$/ }, () => ({ path: require.resolve('process-es6') }))
          },
        },
      ],
    })
  } catch (error) {
    if (error.errors.length === 0) {
      // eslint-disable-next-line no-throw-literal
      throw {
        code: 'unknown',
        msg: `Error while building Edge Handlers: ${error}`,
        success: false,
      }
    }

    const [innerError] = error.errors

    if (innerError.text.toLowerCase().includes('could not resolve')) {
      const { column, file: importer, length, lineText } = innerError.location
      const importee = lineText.slice(column + 1, column + length - 1)

      // eslint-disable-next-line no-throw-literal
      throw {
        code: 'unresolved-import',
        msg: innerError.text,
        importee,
        importer,
        success: false,
      }
    } else {
      // eslint-disable-next-line no-throw-literal
      throw {
        code: 'unknown',
        msg: innerError.text,
        success: false,
      }
    }
  }

  if (result.outputFiles.length > 1) {
    // eslint-disable-next-line no-throw-literal
    throw {
      code: 'unknown',
      msg: `esbuild generated ${result.outputFiles.length} files, can only process one`,
      success: false,
    }
  }

  return result.outputFiles[0].text
}

/**
 * Writes out the bundled code to disk along with any meta info
 *
 * @param {string} bundle bundled code
 * @param {string[]} handlers names of the included handlers
 * @param {string} outputDir path to the output directory (created if not exists)
 * @param {boolean} isLocal whether we're running locally or in CI
 * @param {string} apiHost Netlify API host used for uploads
 * @param {string | null} apiToken Netlify API token used for uploads
 * @returns {Promise<boolean>}
 */
async function publishBundle(bundle, handlers, outputDir, isLocal, apiHost, apiToken) {
  // encode bundle into bytes
  const buf = Buffer.from(bundle, 'utf-8')
  const sha = getShasum(buf)

  /** @type {import("./upload").BundleInfo} */
  const bundleInfo = {
    sha,
    handlers,
    // needs to have length of the byte representation, not the string length
    content_length: buf.length,
    content_type: CONTENT_TYPE,
  }

  if (isLocal) {
    // cleanup previous handlers
    await del(outputDir)

    await makeDir(outputDir)

    // bundled handlers
    const outputFile = path.join(outputDir, bundleInfo.sha)
    await fsPromises.writeFile(outputFile, bundle, 'utf-8')

    // manifest
    const manifestFile = path.join(outputDir, MANIFEST_FILE)
    await fsPromises.writeFile(manifestFile, JSON.stringify(bundleInfo, null, 2))
  } else {
    const uploaded = await uploadBundle(buf, bundleInfo, process.env.DEPLOY_ID, apiHost, apiToken)
    if (!uploaded) {
      console.log('Bundle already exists. Skipping upload...')
    }
    return uploaded
  }

  return false
}

function logHandlers(handlers, EDGE_HANDLERS_SRC) {
  const handlersString = handlers.map(serializeHandler).join('\n')
  console.log(`Packaging Edge Handlers from ${EDGE_HANDLERS_SRC} directory:\n${handlersString}`)
}

function serializeHandler(handler) {
  return ` - ${handler}`
}

module.exports = {
  assemble,
  bundleFunctions,
  bundleFunctionsForCli,
  logHandlers,
  publishBundle,
}
