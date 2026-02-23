import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  root: __dirname,
  base: "./",
  plugins: [
    {
      name: "resolve-js-to-ts",
      enforce: "pre",
      resolveId(source, importer) {
        if (importer === undefined || !source.endsWith(".js")) {
          return null;
        }
        if (!(source.startsWith(".") || source.startsWith("/"))) {
          return null;
        }
        const resolvedJs = resolve(dirname(importer), source);
        if (existsSync(resolvedJs)) {
          return null;
        }
        const resolvedTs = resolvedJs.slice(0, -3) + ".ts";
        if (existsSync(resolvedTs)) {
          return resolvedTs;
        }
        return null;
      },
    },
  ],
  server: {
    fs: {
      allow: [resolve(__dirname, "..")],
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
