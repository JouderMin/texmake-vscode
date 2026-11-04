export default {
  input: "src/extension.ts",
  external: ["vscode"],
  platform: "node",
  output: { file: "dist/extension.js", format: "cjs" },
};
