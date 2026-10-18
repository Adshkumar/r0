import path from "node:path";

const oxlint = path.resolve("node_modules/.bin/oxlint.exe");
const config = path.resolve("scripts/check/design-advisory.json");

const result = await Bun.$`${oxlint} -c ${config} -A all -f json src src-tauri public`
  .nothrow()
  .quiet();

console.log("Exit code:", result.exitCode);
console.log("Stdout length:", result.stdout.length);
console.log("Stderr length:", result.stderr.length);
console.log("Stdout preview:", result.stdout.toString().slice(0, 200));
console.log("Stderr preview:", result.stderr.toString().slice(0, 200));
