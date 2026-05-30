import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const distDir = path.join(root, "template", "dist");
const templateDir = path.join(root, "template");

const ICON_PRIORITY = ["logo.png", "logo.jpg", "logo.jpeg", "favicon.ico"];

const BUNDLE_ICONS = [
  "icons/32x32.png",
  "icons/128x128.png",
  "icons/128x128@2x.png",
  "icons/icon.icns",
  "icons/icon.ico",
];

function findIconSource(baseDir) {
  if (!fs.existsSync(baseDir)) return null;

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

export function findIconSourceForJob(rootDir, jobId, dist) {
  const buildDir = jobId ? path.join(rootDir, "builds", jobId) : null;
  if (buildDir && fs.existsSync(buildDir)) {
    const fromUpload = findIconSource(buildDir);
    if (fromUpload) return fromUpload;
  }
  return findIconSource(dist);
}

async function ensureSquareIconSource(iconSource) {
  const meta = await sharp(iconSource).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  if (!width || !height) {
    throw new Error(`Unable to read icon dimensions: ${iconSource}`);
  }

  if (width === height) {
    return iconSource;
  }

  const size = Math.min(width, height);
  const left = Math.floor((width - size) / 2);
  const top = Math.floor((height - size) / 2);
  const squarePath = path.join(
    os.tmpdir(),
    `web2app-icon-${path.basename(iconSource, path.extname(iconSource))}.png`,
  );

  await sharp(iconSource)
    .extract({ left, top, width: size, height: size })
    .png()
    .toFile(squarePath);

  console.log(
    `Normalized icon to square by center crop (${width}x${height} -> ${size}x${size})`,
  );
  return squarePath;
}

export async function generateAppIcons(options = {}) {
  const { jobId } = options;
  if (!fs.existsSync(distDir)) {
    console.log("No dist directory, keeping default icons");
    return false;
  }

  const iconSource = findIconSourceForJob(root, jobId, distDir);
  if (!iconSource) {
    console.log("No logo.png or favicon.ico found, keeping default icons");
    return false;
  }

  const squareSource = await ensureSquareIconSource(iconSource);
  console.log(`Generating app icons from: ${path.relative(root, iconSource)}`);
  execSync(`npx tauri icon "${squareSource}"`, {
    cwd: templateDir,
    stdio: "inherit",
  });
  return true;
}

export { BUNDLE_ICONS };

const isCli =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCli) {
  await generateAppIcons({ jobId: process.env.JOB_ID });
}
