import fs from "node:fs";
import ts from "typescript";
const source = new URL("../src/lib/pro/schema.ts", import.meta.url);
const result = ts.transpileModule(fs.readFileSync(source, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
fs.writeFileSync(new URL("../src/lib/pro/schema.mjs", import.meta.url), result.outputText);
