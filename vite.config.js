import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/floor-plan-annotator/",
  test: { include: ["tests/**/*.test.{js,jsx}"] },
});
