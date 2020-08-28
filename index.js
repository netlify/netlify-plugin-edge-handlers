const rollup = require("rollup");
const nodeBabel = require("@rollup/plugin-babel");
const babel = nodeBabel.babel;
const esbuild = require("rollup-plugin-esbuild");
const nodeResolve = require("@rollup/plugin-node-resolve");
const resolve = nodeResolve.nodeResolve;
const commonjs = require("@rollup/plugin-commonjs");
const rollupStream = require("@rollup/stream");

// import { promises as fsPromises } from "fs";
const fsPromises = require("fs").promises;
const crypto = require("crypto");
const path = require("path");
const os = require("os");

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
    if (
      !func.isFile() ||
      (!func.name.endsWith(".js") && !func.name.endsWith(".ts"))
    ) {
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
  return { handlers, mainFile, js: path.join(tmpDir, "hello-world.ts") };
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
    const dir = await fsPromises.mkdir(path.normalize(output));
    const outputFile = path.join(output, bundleInfo.sha);
    await fsPromises.writeFile(outputFile, buf);
  }
}

module.exports = {
  onPostBuild: async ({ inputs }) => {
    const { js, mainFile } = await assemble(inputs.sourceDir);
    const bundle = await bundleFunctions(mainFile);
    await writeBundle(bundle, path.join(__dirname, "handlers-build"), true);
  },
};
