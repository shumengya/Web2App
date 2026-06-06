import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const androidRoot = path.join(root, "template", "src-tauri", "gen", "android");

function walk(dir, matcher) {
  const hits = [];
  if (!fs.existsSync(dir)) return hits;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      hits.push(...walk(full, matcher));
    } else if (matcher(full)) {
      hits.push(full);
    }
  }
  return hits;
}

function patchMainActivity(filePath) {
  const original = fs.readFileSync(filePath, "utf8");
  const packageMatch = original.match(/^package\s+([^\s]+)/m);
  if (!packageMatch) {
    console.warn(`Skip MainActivity (no package): ${filePath}`);
    return;
  }

  const pkg = packageMatch[1];
  const content = `package ${pkg}

import android.os.Bundle
import androidx.core.view.WindowCompat

class MainActivity : TauriActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // 内容不延伸到状态栏 / 导航栏区域
        WindowCompat.setDecorFitsSystemWindows(window, true)
    }
}
`;

  fs.writeFileSync(filePath, content);
  console.log(`Patched MainActivity: ${path.relative(root, filePath)}`);
}

function ensureThemeItems(xml) {
  let next = xml;
  const items = [
    `<item name="android:windowOptOutEdgeToEdgeEnforcement">true</item>`,
    `<item name="android:statusBarColor">?android:colorBackground</item>`,
    `<item name="android:navigationBarColor">?android:colorBackground</item>`,
  ];

  for (const item of items) {
    const name = item.match(/name="([^"]+)"/)?.[1];
    if (!name) continue;
    if (next.includes(`name="${name}"`)) {
      next = next.replace(
        new RegExp(`<item name="${name}">[^<]*</item>`, "g"),
        item,
      );
    } else {
      next = next.replace(/<\/style>/, `        ${item}\n    </style>`);
    }
  }

  return next;
}

function patchThemes(filePath) {
  const original = fs.readFileSync(filePath, "utf8");
  const patched = ensureThemeItems(original);
  if (patched !== original) {
    fs.writeFileSync(filePath, patched);
    console.log(`Patched theme: ${path.relative(root, filePath)}`);
  }
}

if (!fs.existsSync(androidRoot)) {
  console.error(`Android project not found: ${androidRoot}`);
  console.error("Run tauri android init before patch-android-system-bars.mjs");
  process.exit(1);
}

for (const file of walk(androidRoot, (p) => p.endsWith("MainActivity.kt"))) {
  patchMainActivity(file);
}

for (const file of walk(androidRoot, (p) => {
  const normalized = p.replace(/\\/g, "/");
  return (
    normalized.endsWith("values/themes.xml") ||
    normalized.endsWith("values-night/themes.xml")
  );
})) {
  patchThemes(file);
}

console.log("Android system bar patch applied");
