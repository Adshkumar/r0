import fs from "node:fs";
import path from "node:path";

const source = path.resolve("public/install.ps1");
const destination = path.resolve("dist-web/install.ps1");

if (!fs.existsSync(source)) {
  throw new Error(`Installer source not found: ${source}`);
}

fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.copyFileSync(source, destination);

console.log(`Installer copied to ${destination}`);
