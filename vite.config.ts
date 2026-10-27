import { defineConfig } from "vitest/config";
import profilePlugin from "./profiling/plugin.ts";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === "profile" ? [profilePlugin()] : [])],
  build:
    mode === "profile"
      ? {
          outDir: "profile-dist",
          rollupOptions: {
            input: {
              app: resolve("index.html"),
              profile: resolve("profiling/index.html"),
              frame: resolve("profiling/frame.html"),
            },
          },
        }
      : undefined,
  base: "/floor-plan-annotator/",
  test: { include: ["tests/**/*.test.{ts,tsx}"] },
}));
