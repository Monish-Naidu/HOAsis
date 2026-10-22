import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/demo-env.ts", "./tests/setup.ts"],
    // The machine also runs the dev server, a Docker stack and browsers; four
    // workers keep the suite near thirty seconds without starving them.
    maxWorkers: 4,
    include: ["tests/**/*.test.{ts,tsx}"],
    restoreMocks: true,
    clearMocks: true,
    // Library code only. Measured 78.5% lines on 2026-10-06; the floor sits a
    // little under that so a refactor has room but the figure cannot slide.
    // Enforced by `pnpm coverage`, which `pnpm check` deliberately skips.
    coverage: {
      provider: "v8",
      include: ["src/lib/**"],
      reporter: ["text-summary", "text"],
      thresholds: { lines: 75 },
    },
  },
});
