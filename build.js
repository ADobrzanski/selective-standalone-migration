const esbuild = require("esbuild");
const { nodeExternalsPlugin } = require("esbuild-node-externals");
const { copy } = require("esbuild-plugin-copy");

esbuild
  .build({
    entryPoints: ["./src/main.ts"],
    outfile: "dist/main.js",
    external: ["@angular/compiler-cli"],
    bundle: true,
    minify: false,
    treeShaking: true,
    platform: "node",
    format: "cjs",
    target: "esnext",
    plugins: [
      nodeExternalsPlugin(),
      copy({ assets: [{ from: "./src/static/**", to: "./static" }] }),
    ],
  })
  .catch(() => process.exit(1));
