import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const MARKER = "data-web2app-tauri-shell";
const scriptPath = path.join(root, "template", "scripts", "tauri-shell.js");

export function injectTauriShell(distDir) {
  const indexPath = path.join(distDir, "index.html");
  if (!fs.existsSync(indexPath)) return;

  let html = fs.readFileSync(indexPath, "utf8");
  if (html.includes(MARKER)) return;

  const script = fs.readFileSync(scriptPath, "utf8").trim();
  const tag = `<script ${MARKER}>${script}</script>`;

  if (html.includes("<head>")) {
    html = html.replace("<head>", `<head>\n${tag}`);
  } else if (html.includes("</head>")) {
    html = html.replace("</head>", `${tag}\n</head>`);
  } else if (html.includes("</body>")) {
    html = html.replace("</body>", `${tag}\n</body>`);
  } else {
    html += `\n${tag}\n`;
  }

  fs.writeFileSync(indexPath, html);
  console.log("Injected Tauri shell script into index.html");
}