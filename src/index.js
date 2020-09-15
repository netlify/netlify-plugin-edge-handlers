const crypto = require("crypto");
const { promises: fsPromises } = require("fs");
const os = require("os");
const path = require("path");

const nodeBabel = require("@rollup/plugin-babel");
const commonjs = require("@rollup/plugin-commonjs");
const json = require("@rollup/plugin-json");
const nodeResolve = require("@rollup/plugin-node-resolve");
const makeDir = require("make-dir");
const rollup = require("rollup");

const babel = nodeBabel.babel;
const resolve = nodeResolve.nodeResolve;

const { LOCAL_OUT_DIR, MANIFEST_FILE, MAIN_FILE, CONTENT_TYPE } = require("./consts");
const uploadBundle = require("./upload");

/**
 * Generates an entrypoint for bundling the handlers
 * It also makes sure all handlers are registered with the runtime
 *
 * @param {string} sourceDir path to the edge handler directory
 * @returns {Promise<{ handlers: string[], mainFile: string }>} list of handlers and path to entrypoint
 */
async function assemble(sourceDir) {
  const entries = await fsPromises.readdir(sourceDir, { withFileTypes: true });
  const handlers = entries.filter(isHandlerFile).map(getFilename);

  if (handlers.length === 0) {
    return { handlers };
  }

  const imports = [];
  const registration = [];
  for (const handler of handlers) {
    const id = "func" + crypto.randomBytes(16).toString("hex");

    imports.push(`import * as ${id} from "${path.resolve(sourceDir, handler)}";`);
    registration.push(`netlifyRegistry.set("${handler}", ${id});`);
  }
  const mainContents = imports.concat(registration).join("\n");

  const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "handlers-")); //make temp dir `handlers-abc123`
  const mainFile = path.join(tmpDir, MAIN_FILE);
  await fsPromises.writeFile(mainFile, mainContents);
  return { handlers, mainFile };
}

function isHandlerFile(entry) {
  return path.extname(entry.name) === ".js" && entry.isFile();
}

function getFilename(entry) {
  return path.basename(entry.name, path.extname(entry.name));
}

/**
 * @type {import("@rollup/plugin-babel").RollupBabelInputPluginOptions}
 */
const babelConfig = {
  exclude: "node_modules/**",
  babelHelpers: "bundled",
  babelrc: false,
  configFile: false,
  presets: [
    [
      require("@babel/preset-env"),
      {
        targets: {
          chrome: "87", // latest beta release as of this commit (V8 8.6)
        },
      },
    ],
  ],
};

/**
 * Bundles the handler code based on a generated entrypoint
 *
 * @param {string} file path of the entrypoint file
 * @returns {Promise<string>} bundled code
 */
async function bundleFunctions(file, utils) {
  const options = {
    input: file,
    plugins: [
      babel(babelConfig),
      resolve(),
      commonjs(),
      json({
        compact: true,
      }),
    ],
    onwarn(msg) {
      if (msg.code == "UNRESOLVED_IMPORT") {
        utils.build.failBuild(
          `Error in ${msg.importer}, could not resolve ${msg.source} module. Please install this dependency locally and ensure it is listed in your package.json`,
        );
      }
    },
  };

  const bundle = await rollup.rollup(options);
  const {
    output: [{ code }],
  } = await bundle.generate({
    format: "iife",
  });
  return code;
}

/**
 * Writes out the bundled code to disk along with any meta info
 *
 * @param {string} bundle bundled code
 * @param {string[]} handlers names of the included handlers
 * @param {string} outputDir path to the output directory (created if not exists)
 * @param {boolean} isLocal whether we're running locally or in CI
 * @param {string | null} apiToken Netlify API token used for uploads
 * @returns {Promise<void>}
 */
async function publishBundle(bundle, handlers, outputDir, isLocal, apiToken) {
  // encode bundle into bytes
  const buf = Buffer.from(bundle, "utf-8");

  const shasum = crypto.createHash("sha1");
  shasum.update(buf);

  /** @type {import("./upload").BundleInfo} */
  const bundleInfo = {
    sha: shasum.digest("hex"),
    handlers,
    // needs to have length of the byte representation, not the string length
    content_length: buf.length,
    content_type: CONTENT_TYPE,
  };

  if (isLocal) {
    await makeDir(outputDir);

    // bundled handlers
    const outputFile = path.join(outputDir, bundleInfo.sha);
    await fsPromises.writeFile(outputFile, bundle, "utf-8");

    // manifest
    const manifestFile = path.join(outputDir, MANIFEST_FILE);
    await fsPromises.writeFile(manifestFile, JSON.stringify(bundleInfo, null, 2));
  } else {
    await uploadBundle(buf, bundleInfo, process.env.DEPLOY_ID, apiToken);
  }
}

function logHandlers(handlers, sourceDir) {
  const handlersString = handlers.map(serializeHandler).join("\n");
  console.log(`Packaging Edge handlers from ${sourceDir} directory:\n${handlersString}`);
}

function serializeHandler(handler) {
  return ` - ${handler}`;
}

module.exports = {
  onPostBuild: async ({ inputs: { sourceDir }, constants, utils }) => {
    const { mainFile, handlers } = await assemble(sourceDir);

    if (handlers.length === 0) {
      console.log(`No Edge handlers were found in ${sourceDir} directory`);
      return;
    }

    logHandlers(handlers, sourceDir);
    const bundle = await bundleFunctions(mainFile, utils);
    await publishBundle(bundle, handlers, LOCAL_OUT_DIR, constants.IS_LOCAL, constants.NETLIFY_API_TOKEN);
  },
};
