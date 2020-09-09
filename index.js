const crypto = require("crypto");
const { promises: fsPromises } = require("fs");
const path = require("path");

const nodeBabel = require("@rollup/plugin-babel");
const commonjs = require("@rollup/plugin-commonjs");
const nodeResolve = require("@rollup/plugin-node-resolve");
const makeDir = require("make-dir");
const rollup = require("rollup");
const esbuild = require("rollup-plugin-esbuild");
const json = require("@rollup/plugin-json");

const babel = nodeBabel.babel;
const resolve = nodeResolve.nodeResolve;

const LOCAL_OUT_DIR = ".netlify/edge-handlers";
const MANIFEST_FILE = "manifest.json";
const MAIN_FILE = "__netlifyMain.ts";
const TYPES_FILE = "__netlifyTypes.d.ts";
const CONTENT_TYPE = "application/javascript";

async function assemble(src) {
  const tmpDir = await fsPromises.mkdtemp("handlers-"); //make temp dir `handlers-abc123`
  await fsPromises.copyFile(path.join(__dirname, "types.d.ts"), path.join(tmpDir, TYPES_FILE));
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
  const mainContents = `/// <reference path="./${TYPES_FILE}" />\n` + imports + registration;
  const mainFile = path.join(tmpDir, MAIN_FILE);
  await fsPromises.writeFile(mainFile, mainContents);
  return { handlers, mainFile };
}

async function bundleFunctions(file) {
  const options = {
    input: file,
    plugins: [
      esbuild({
        target: "es2018",
      }),
      babel({
        exclude: "node_modules/**",
        babelHelpers: "bundled",
      }),
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

async function writeBundle(bundle, outputDir, isLocal) {
  // encode bundle into bytes
  const buf = Buffer.from(bundle, "utf-8");

  const shasum = crypto.createHash("sha1");
  shasum.update(buf);

  const bundleInfo = {
    sha: shasum.digest("hex"),
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
  }
}

module.exports = {
  onPostBuild: async ({ inputs }) => {
    const { mainFile } = await assemble(inputs.sourceDir);
    const bundle = await bundleFunctions(mainFile);
    await writeBundle(bundle, path.join(__dirname, LOCAL_OUT_DIR), true);
  },
};
