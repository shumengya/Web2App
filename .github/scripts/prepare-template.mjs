import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";
import { generateAppIcons } from "./generate-app-icons.mjs";

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

function toSafeBinaryName(name, fallback) {
  const ascii = name.replace(/[^a-zA-Z0-9_-]+/g, "");
  return (ascii || fallback).slice(0, 64);
}

function patchTauriConfig(filePath) {
  const conf = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const safeBinaryName = toSafeBinaryName(appNameEn, `App${jobId}`);
  conf.productName = appNameZh;
  conf.mainBinaryName = safeBinaryName;
  conf.identifier = appIdentifier;
  conf.version = "1.0.0";
  if (conf.app?.windows?.[0]) {
    conf.app.windows[0].title = appNameZh;
  }
  fs.writeFileSync(filePath, `${JSON.stringify(conf, null, 2)}\n`);
}

patchTauriConfig(confPath);
if (fs.existsSync(androidConfPath)) {
  patchTauriConfig(androidConfPath);
}

generateAppIcons();

console.log("Template prepared successfully");
