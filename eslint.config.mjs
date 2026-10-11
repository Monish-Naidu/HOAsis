import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Screens read the data layer through `@/lib/data` (data/index.ts), the seam
  // where Supabase lands. The remote store is the one deep import that is part
  // of that seam, and type-only imports cost nothing at runtime.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/**"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/data/*", "!@/lib/data/remote-store"],
              allowTypeImports: true,
              message: "Import from @/lib/data (src/lib/data/index.ts), not a file behind it.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/data/library.ts", "src/lib/supabase/database.types.ts"],
    rules: {
      // The most complex existing function scores 117; keep the ceiling from growing.
      complexity: ["error", 120],
      "max-lines": ["error", { max: 2100, skipBlankLines: true, skipComments: true }],
      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: "default",
          format: ["camelCase", "PascalCase", "UPPER_CASE"],
          leadingUnderscore: "allow",
          trailingUnderscore: "allow",
        },
        {
          selector: "variable",
          format: ["camelCase", "PascalCase", "UPPER_CASE"],
          leadingUnderscore: "allow",
          trailingUnderscore: "allow",
        },
        {
          selector: "function",
          format: ["camelCase", "PascalCase", "UPPER_CASE"],
          leadingUnderscore: "allow",
          trailingUnderscore: "allow",
        },
        { selector: "typeLike", format: ["PascalCase"] },
        { selector: "property", format: null },
      ],
    },
  },
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
