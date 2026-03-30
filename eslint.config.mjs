import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([
    ".next/**",
    "**/.next/**",
    ".worktrees/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "generated/**",
    "stitch_handoff/**",
    "stitch_new_project/**",
    "_stitch_export/**",
  ]),
]);

export default eslintConfig;
