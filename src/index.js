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
 * @param {string} src path to the edge handler directory
 * @returns {Promise<{ handlers: string[], mainFile: string }>} list of handlers and path to entrypoint
 */
async function assemble(src) {
  const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "handlers-")); //make temp dir `handlers-abc123`
  const handlers = [];
  const imports = [];
  const registration = [];
  const functions = await fsPromises.readdir(src, { withFileTypes: true });

  for (const func of functions) {
    const file = path.parse(func.name);

    if (!func.isFile() || (file.ext !== ".js" && file.ext !== ".ts")) {
      continue;
    }

    const id = "func" + crypto.randomBytes(16).toString("hex");

    imports.push(`import * as ${id} from "${path.resolve(src, file.name)}";`);
    registration.push(`netlifyRegistry.set("${file.name}", ${id});`);
    handlers.push(file.name);
  }

  // import path //
  const mainContents = imports.concat(registration).join("\n");
  const mainFile = path.join(tmpDir, MAIN_FILE);
  await fsPromises.writeFile(mainFile, mainContents);
  return { handlers, mainFile };
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
      "@babel/preset-env",
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

module.exports = {
  onPostBuild: async ({ inputs, constants, utils }) => {
    const { mainFile, handlers } = await assemble(inputs.sourceDir);
    const bundle = await bundleFunctions(mainFile, utils);
    await publishBundle(bundle, handlers, LOCAL_OUT_DIR, constants.IS_LOCAL, constants.NETLIFY_API_TOKEN);
  },
};
