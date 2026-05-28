import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

const jobId = process.env.JOB_ID;
const appName = process.env.APP_NAME;
const appIdentifier = process.env.APP_IDENTIFIER;

if (!jobId || !appName || !appIdentifier) {
  console.error("JOB_ID, APP_NAME, and APP_IDENTIFIER are required");
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

function patchTauriConfig(filePath) {
  const conf = JSON.parse(fs.readFileSync(filePath, "utf8"));
  conf.productName = appName;
  conf.mainBinaryName = appName.replace(/[^\w.-]+/g, "") || "Web2App";
  conf.identifier = appIdentifier;
  conf.version = "1.0.0";
  if (conf.app?.windows?.[0]) {
    conf.app.windows[0].title = appName;
  }
  fs.writeFileSync(filePath, `${JSON.stringify(conf, null, 2)}\n`);
}

patchTauriConfig(confPath);
if (fs.existsSync(androidConfPath)) {
  patchTauriConfig(androidConfPath);
}

const iconCandidates = ["icon.png", "favicon.png", "logo.png"];
for (const candidate of iconCandidates) {
  const iconPath = path.join(distDir, candidate);
  if (fs.existsSync(iconPath)) {
    console.log(`Found icon candidate: ${candidate}`);
    break;
  }
}

console.log("Template prepared successfully");
