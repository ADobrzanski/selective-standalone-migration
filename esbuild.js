const esbuild = require("esbuild");
const { nodeExternalsPlugin } = require("esbuild-node-externals");
// import esbuild from "esbuild";
// import { nodeExternalsPlugin } from "esbuild-node-externals";
esbuild
  .build({
    entryPoints: ["./src/main.ts"],
    outfile: "src/main.js",
    external: ["@angular/compiler-cli"],
    bundle: true,
    minify: false,
    treeShaking: true,
    platform: "node",
    format: "cjs",
    target: "esnext",
    plugins: [nodeExternalsPlugin()],
  })
  .catch(() => process.exit(1));
