import eslint from "@eslint/js";
import { globalIgnores } from "eslint/config";
import github from "eslint-plugin-github";
import tseslint from "typescript-eslint";

export default tseslint.config(
  globalIgnores([
    "dist/",
    "node_modules/",
    "script/",
    "eslint.config.mjs",
    "build.mjs",
  ]),
  github.getFlatConfigs().recommended,
  ...github.getFlatConfigs().typescript,
  tseslint.configs.recommendedTypeChecked,
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      "sort-imports": "off",
      "i18n-text/no-en": "off",
      "import/extensions": [
        "error",
        {
          json: "always",
        },
      ],
      "import/named": "off",
      "import/no-amd": "error",
      "import/no-commonjs": "error",
      "import/no-dynamic-require": "error",
      "import/no-extraneous-dependencies": [
        "error",
        {
          devDependencies: true,
        },
      ],
      "import/no-namespace": "off",
      "import/no-unresolved": "error",
      "import/no-webpack-loader-syntax": "error",
      "import/order": [
        "error",
        {
          alphabetize: {
            order: "asc",
          },
          "newlines-between": "always",
        },
      ],
      "no-console": "off",
      "no-sequences": "error",
      "no-shadow": "off",
      "@typescript-eslint/naming-convention": "error",
      "eslint-comments/no-use": [
        "error",
        {
          allow: [
            "eslint-disable",
            "eslint-enable",
            "eslint-disable-next-line",
          ],
        },
      ],
      "@typescript-eslint/no-shadow": "error",
      "one-var": ["error", "never"],
      "@typescript-eslint/restrict-template-expressions": "off",
    },
    settings: {
      "import/parsers": {
        "@typescript-eslint/parser": [".ts", ".tsx"],
      },
      "import/resolver": {
        typescript: {},
      },
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
