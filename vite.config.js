import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { existsSync } from "fs";

let localConfig = {};
if (existsSync("./vite.config.local.js")) {
  localConfig = await import("./vite.config.local.js").then(
    (module) => module.default
  );
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    svelte(),
    viteStaticCopy({
      targets: [
        {
          src: "data/**/*",
          dest: "data",
          transform: (contents, filepath) => {
            const filename = filepath.split("/").pop();
            if (filename === "mcqs_sample.json" || filename === "README.md") {
              return null; // Exclude these files
            }
            return contents; // Copy other files as-is
          },
        },
      ],
    }),
  ],
  ...localConfig,
});
