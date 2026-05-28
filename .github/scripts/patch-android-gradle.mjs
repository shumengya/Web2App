import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const gradlePath = path.join(
  root,
  "template/src-tauri/gen/android/app/build.gradle.kts",
);

if (!fs.existsSync(gradlePath)) {
  console.log("Android gradle file not found, skipping patch");
  process.exit(0);
}

let content = fs.readFileSync(gradlePath, "utf8");

if (content.includes("signingConfigs")) {
  console.log("Android gradle already has signingConfigs");
  process.exit(0);
}

if (!content.includes("import java.util.Properties")) {
  content = content.replace(
    /^(import .+\n)+/m,
    (block) => `${block}import java.util.Properties\nimport java.io.FileInputStream\n`,
  );
}

const signingBlock = `
    signingConfigs {
        create("release") {
            val keystorePropertiesFile = rootProject.file("keystore.properties")
            val keystoreProperties = Properties()
            if (keystorePropertiesFile.exists()) {
                keystoreProperties.load(FileInputStream(keystorePropertiesFile))
            }

            keyAlias = keystoreProperties["keyAlias"] as String
            keyPassword = keystoreProperties["password"] as String
            storeFile = file(keystoreProperties["storeFile"] as String)
            storePassword = keystoreProperties["password"] as String
        }
    }
`;

if (content.includes("buildTypes {")) {
  content = content.replace("buildTypes {", `${signingBlock}\n    buildTypes {`);
}

if (!content.includes('signingConfig = signingConfigs.getByName("release")')) {
  content = content.replace(
    /getByName\("release"\)\s*\{/,
    `getByName("release") {
            signingConfig = signingConfigs.getByName("release")`,
  );
}

fs.writeFileSync(gradlePath, content);
console.log("Patched Android gradle signing configuration");
