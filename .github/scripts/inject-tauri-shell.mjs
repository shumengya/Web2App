import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const MARKER = "data-web2app-tauri-shell";
const PERMISSIONS_POLICY_MARKER = "data-web2app-permissions-policy";
const PERMISSIONS_POLICY_TAG = `<meta ${PERMISSIONS_POLICY_MARKER} http-equiv="Permissions-Policy" content="camera=*, microphone=*" />`;
const scriptPath = path.join(root, "template", "scripts", "tauri-shell.js");

export function injectTauriShell(distDir) {
  const indexPath = path.join(distDir, "index.html");
  if (!fs.existsSync(indexPath)) return;

  let html = fs.readFileSync(indexPath, "utf8");
  const needsPolicy = !html.includes(PERMISSIONS_POLICY_MARKER);
  const needsScript = !html.includes(MARKER);
  if (!needsPolicy && !needsScript) return;

  const injections = [];
  if (needsPolicy) injections.push(PERMISSIONS_POLICY_TAG);
  if (needsScript) {
    const script = fs.readFileSync(scriptPath, "utf8").trim();
    injections.push(`<script ${MARKER}>${script}</script>`);
  }
  const block = `${injections.join("\n")}\n`;

  if (html.includes("<head>")) {
    html = html.replace("<head>", `<head>\n${block}`);
  } else if (html.includes("</head>")) {
    html = html.replace("</head>", `${block}</head>`);
  } else if (html.includes("</body>")) {
    html = html.replace("</body>", `${block}</body>`);
  } else {
    html += `\n${block}`;
  }

  fs.writeFileSync(indexPath, html);
  console.log("Injected Tauri shell script into index.html");
}