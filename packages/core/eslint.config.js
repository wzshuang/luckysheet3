/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    files: ["src/**/*.{ts,js}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "vue",
              message: "@luckysheet3/core must stay framework-agnostic. Do not import vue.",
            },
          ],
          patterns: [
            {
              group: ["vue/*", "@vue/*"],
              message: "@luckysheet3/core must stay framework-agnostic. Do not import vue.",
            },
          ],
        },
      ],
    },
  },
];
