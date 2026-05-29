import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const distDir = path.join(root, "template", "dist");
const templateDir = path.join(root, "template");

const ICON_PRIORITY = ["logo.png", "logo.jpg", "logo.jpeg", "favicon.ico"];

function findIconSource(baseDir) {
  for (const name of ICON_PRIORITY) {
    const direct = path.join(baseDir, name);
    if (fs.existsSync(direct)) return direct;
  }

  for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    for (const name of ICON_PRIORITY) {
      const nested = path.join(baseDir, entry.name, name);
      if (fs.existsSync(nested)) return nested;
    }
  }

  return null;
}

export function generateAppIcons() {
  if (!fs.existsSync(distDir)) {
    console.log("No dist directory, keeping default icons");
    return;
  }

  const iconSource = findIconSource(distDir);
  if (!iconSource) {
    console.log("No logo.png or favicon.ico found, keeping default icons");
    return;
  }

  console.log(`Generating app icons from: ${path.relative(root, iconSource)}`);
  execSync(`npx tauri icon "${iconSource}"`, {
    cwd: templateDir,
    stdio: "inherit",
  });
}
