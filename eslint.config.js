// #2 flat ESLint config across the Bun workspaces. Kept non-type-checked so
// `bun run lint` stays fast and green on the scaffold; stricter type-aware
// rules can be layered per package as real code lands.
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    // #2 never lint vendored submodules or build output.
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "contracts/lib/**",
      "contracts/out/**",
      "contracts/cache/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
  },
);
