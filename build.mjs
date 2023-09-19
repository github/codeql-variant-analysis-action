import { rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const actions = [
  "query",
  "update-repo-task-status",
  "update-repo-task-statuses",
];

await rm(join(__dirname, "dist"), { recursive: true, force: true });

// This will just log when a build ends
/** @type {esbuild.Plugin} */
const onEndPlugin = {
  name: "on-end",
  setup(build) {
    build.onEnd((result) => {
      console.log(`Build ended with ${result.errors.length} errors`);
    });
  },
};

const context = await esbuild.context({
  entryPoints: actions.map((actionName) => `src/${actionName}.ts`),
  bundle: true,
  outdir: "dist",
  platform: "node",
  format: "cjs",
  sourcemap: !!process.env.CODEQL_VARIANT_ANALYSIS_ACTION_GENERATE_SOURCEMAPS
    ? "external"
    : false,
  chunkNames: "chunks/[name]-[hash]",
  plugins: [onEndPlugin],
});

if (process.argv.includes("--watch")) {
  await context.watch();
} else {
  await context.rebuild();

  await context.dispose();
}
