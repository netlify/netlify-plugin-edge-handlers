const crypto = require("crypto");
const { promises: fsPromises } = require("fs");
const path = require("path");

const nodeBabel = require("@rollup/plugin-babel");
const commonjs = require("@rollup/plugin-commonjs");
const nodeResolve = require("@rollup/plugin-node-resolve");
const makeDir = require("make-dir");
const rollup = require("rollup");
const json = require("@rollup/plugin-json");

const babel = nodeBabel.babel;
const resolve = nodeResolve.nodeResolve;

const MAIN_FILE = "__netlifyMain.ts";
const CONTENT_TYPE = "application/javascript";

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

    handlers.push(func);
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
  const { output } = await bundle.generate({
    format: "iife",
  });
  return output;
}

async function writeBundle(buf, output, isLocal) {
  buf = buf[0].code;
  const shasum = crypto.createHash("sha1");
  shasum.update(buf);

  const bundleInfo = {
    sha: shasum.digest("hex"),
    content_length: buf.length,
    content_type: CONTENT_TYPE,
  };
  console.log(bundleInfo);

  if (isLocal) {
    await makeDir(output);
    const outputFile = path.join(output, bundleInfo.sha);
    await fsPromises.writeFile(outputFile, buf);
  }
}

module.exports = {
  onPostBuild: async ({ inputs }) => {
    const { mainFile } = await assemble(inputs.sourceDir);
    const bundle = await bundleFunctions(mainFile);
    await writeBundle(bundle, path.join(__dirname, "handlers-build"), true);
  },
};
