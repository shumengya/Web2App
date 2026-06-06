import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";
import { BUNDLE_ICONS, generateAppIcons } from "./generate-app-icons.mjs";
import { injectInAppNav } from "./inject-in-app-nav.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

const jobId = process.env.JOB_ID;
const appNameZh = process.env.APP_NAME;
const appNameEn = process.env.APP_NAME_EN;
const appIdentifier = process.env.APP_IDENTIFIER;

if (!jobId || !appNameZh || !appNameEn || !appIdentifier) {
  console.error(
    "JOB_ID, APP_NAME, APP_NAME_EN, and APP_IDENTIFIER are required",
  );
  process.exit(1);
}

function readAppVersion(jobId) {
  const versionFile = path.join(root, "builds", jobId, "version.txt");
  if (fs.existsSync(versionFile)) {
    const fromFile = fs.readFileSync(versionFile, "utf8").trim();
    if (fromFile) return fromFile;
  }
  const fromEnv = (process.env.APP_VERSION ?? "").trim();
  return fromEnv || "1.0.0";
}

const appVersion = readAppVersion(jobId);
const zipPath = path.join(root, "builds", jobId, "site.zip");
const distDir = path.join(root, "template", "dist");
const confPath = path.join(root, "template", "src-tauri", "tauri.conf.json");
const androidConfPath = path.join(
  root,
  "template",
  "src-tauri",
  "tauri.android.conf.json",
);

if (!fs.existsSync(zipPath)) {
  console.error(`Missing upload: ${zipPath}`);
  process.exit(1);
}

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

const zip = new AdmZip(zipPath);
zip.extractAllTo(distDir, true);

const indexPath = path.join(distDir, "index.html");
if (!fs.existsSync(indexPath)) {
  console.error("template/dist/index.html not found after extraction");
  process.exit(1);
}

const buildDir = path.join(root, "builds", jobId);
for (const iconName of ["logo.png", "logo.jpg", "logo.jpeg", "favicon.ico"]) {
  const iconSrc = path.join(buildDir, iconName);
  if (fs.existsSync(iconSrc)) {
    fs.copyFileSync(iconSrc, path.join(distDir, iconName));
    console.log(`Copied uploaded icon: builds/${jobId}/${iconName}`);
  }
}

function toSafeBinaryName(name, fallback) {
  const ascii = name.replace(/[^a-zA-Z0-9_-]+/g, "");
  return (ascii || fallback).slice(0, 64);
}

function patchTauriConfig(filePath) {
  const conf = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const safeBinaryName = toSafeBinaryName(appNameEn, `App${jobId}`);
  conf.productName = appNameZh;
  if (filePath === confPath) {
    conf.mainBinaryName = safeBinaryName;
  }
  conf.identifier = appIdentifier;
  conf.version = appVersion;
  if (conf.app?.windows?.[0]) {
    conf.app.windows[0].title = appNameZh;
  }
  conf.app = {
    ...conf.app,
    security: {
      csp: {
        "default-src": "'self' asset: tauri: https: http: data: blob: file:",
        "connect-src":
          "'self' asset: tauri: https: http: ws: wss: data: blob: file:",
        "img-src": "'self' asset: tauri: https: http: data: blob: file:",
        "media-src": "'self' asset: tauri: https: http: data: blob: file:",
        "style-src": "'self' 'unsafe-inline' asset: tauri: https: http:",
        "script-src":
          "'self' 'unsafe-inline' 'unsafe-eval' asset: tauri: https: http:",
        "frame-src": "'self' asset: tauri: https: http: data: blob:",
        "worker-src": "'self' blob: data:",
      },
    },
  };
  conf.bundle = {
    ...conf.bundle,
    active: true,
    icon: BUNDLE_ICONS,
  };
  fs.writeFileSync(filePath, `${JSON.stringify(conf, null, 2)}\n`);
}

injectInAppNav(distDir);

patchTauriConfig(confPath);
if (fs.existsSync(androidConfPath)) {
  patchTauriConfig(androidConfPath);
}

await generateAppIcons({ jobId });

console.log("Template prepared successfully");
