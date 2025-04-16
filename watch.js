const { nodeExternalsPlugin } = require("esbuild-node-externals");
const esbuild = require("esbuild");

async function watch() {
  const ctx = esbuild
    .context({
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
  (await ctx).watch();
  console.log("Watching...");
}
watch();
