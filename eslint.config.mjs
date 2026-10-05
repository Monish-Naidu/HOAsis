import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Scratch scripts and run output, none of it tracked: lint was counting
    // warnings in files git does not know about.
    "scripts/.qa/**",
    "test-results/**",
    "playwright-report/**",
  ]),
]);

export default eslintConfig;
