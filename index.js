const crypto = require("crypto");
const { promises: fsPromises } = require("fs");
const path = require("path");

const nodeBabel = require("@rollup/plugin-babel");
const commonjs = require("@rollup/plugin-commonjs");
const nodeResolve = require("@rollup/plugin-node-resolve");
const makeDir = require("make-dir");
const rollup = require("rollup");
const json = require("@rollup/plugin-json");
const fetch = require("node-fetch");

const babel = nodeBabel.babel;
const resolve = nodeResolve.nodeResolve;

const LOCAL_OUT_DIR = path.join(process.cwd(), ".netlify", "edge-handlers");
const MANIFEST_FILE = "manifest.json";
const MAIN_FILE = "__netlifyMain.ts";
const CONTENT_TYPE = "application/javascript";
const API_HOST = "api.netlify.com";

/**
 * Generates an entrypoint for bundling the handlers
 * It also makes sure all handlers are registered with the runtime
 *
 * @param {string} src path to the edge handler directory
 * @returns {Promise<{ handlers: string[], mainFile: string }>} list of handlers and path to entrypoint
 */
async function assemble(src) {
  const tmpDir = await fsPromises.mkdtemp("handlers-"); //make temp dir `handlers-abc123`
  const handlers = [];
  let imports = "";
  let registration = "";
  const functions = await fsPromises.readdir(src, { withFileTypes: true });
  for (const func of functions) {
    if (!func.isFile() || (!func.name.endsWith(".js") && !func.name.endsWith(".ts"))) {
      continue;
    }

    const id = "func" + crypto.randomBytes(16).toString("hex");
    const name = func.name.substr(0, func.name.length - 3); // remove extension //
    imports += `import * as ${id} from "${path.resolve(src, func.name)}";\n`;
    registration += `netlifyRegistry.set("${name}", ${id});\n`;

    handlers.push(func.name);
  }

  // import path //
  const mainContents = imports + registration;
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
async function bundleFunctions(file) {
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
 * @typedef {{ sha: string, handlers: string[], content_length: number, content_type: string }} BundleInfo
 */

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

  /** @type {BundleInfo} */
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
    await fsPromises.writeFile(manifestFile, JSON.stringify(bundleInfo));
  } else {
    await uploadBundle(buf, bundleInfo, process.env.DEPLOY_ID, apiToken);
  }
}

/**
 *
 * @param {Buffer} buf UTF-8 encoded handler bundle
 * @param {BundleInfo} info metadata about the bundle
 * @param {string} deployId id of the deploy the bundle is deployed for
 * @param {string} apiToken token for authorizing on the API
 * @returns {Promise<boolean>} Whether the bundle was newly uploaded (and did not already exist)
 */
async function uploadBundle(buf, info, deployId, apiToken) {
  const resp = await fetch(`https://${API_HOST}/api/v1/deploys/${deployId}/edge_handlers`, {
    method: "POST",
    body: JSON.stringify(info),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiToken}`,
    },
  });

  if (!resp.ok) {
    throw new Error(`Invalid status: ${resp.status}`);
  }

  const { error, exists, upload_url } = await resp.json();
  if (error) {
    throw new Error(`Failed to upload: ${error}`);
  }
  if (exists) {
    console.log("Bundle already exists. Skipping upload...");
    return false;
  }
  if (!upload_url) {
    throw new Error("Missing upload url");
  }

  await fetch(upload_url, {
    method: "PUT",
    body: buf,
    headers: {
      "Content-Type": CONTENT_TYPE,
    },
  });

  return true;
}

module.exports = {
  onPostBuild: async ({ inputs, constants }) => {
    const { mainFile, handlers } = await assemble(inputs.sourceDir);
    const bundle = await bundleFunctions(mainFile);
    await publishBundle(bundle, handlers, LOCAL_OUT_DIR, constants.IS_LOCAL, constants.NETLIFY_API_TOKEN);
  },
  /**
   * @type {(deployId: string, apiToken: string) => Promise<boolean>}
   */
  deployFromManifest: async (deployId, apiToken) => {
    const manifestFile = await fsPromises.readFile(path.join(LOCAL_OUT_DIR, MANIFEST_FILE), "utf-8");
    /** @type {BundleInfo} */
    const manifest = JSON.parse(manifestFile);

    const bundle = await fsPromises.readFile(path.join(LOCAL_OUT_DIR, manifest.sha));
    return uploadBundle(bundle, manifest, deployId, apiToken);
  },
};
