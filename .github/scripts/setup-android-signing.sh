#!/usr/bin/env bash
set -euo pipefail

KEYSTORE_PATH="${RUNNER_TEMP}/web2app-release.jks"
STORE_PASS="${ANDROID_KEYSTORE_PASSWORD:-web2app-ci}"
KEY_PASS="${ANDROID_KEY_PASSWORD:-web2app-ci}"
KEY_ALIAS="${ANDROID_KEY_ALIAS:-web2app}"

if [ -n "${ANDROID_KEYSTORE_BASE64:-}" ]; then
  echo "Using Android keystore from repository secrets"
  echo "${ANDROID_KEYSTORE_BASE64}" | base64 -d > "${KEYSTORE_PATH}"
else
  echo "Generating CI Android keystore (sideload demo; set secrets for production)"
  keytool -genkeypair -v \
    -keystore "${KEYSTORE_PATH}" \
    -alias "${KEY_ALIAS}" \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -storepass "${STORE_PASS}" \
    -keypass "${KEY_PASS}" \
    -dname "CN=Web2App, OU=CI, O=Web2App, L=Local, ST=Local, C=CN"
fi

export WEB2APP_ANDROID_KEYSTORE="${KEYSTORE_PATH}"
export WEB2APP_ANDROID_STORE_PASS="${STORE_PASS}"
export WEB2APP_ANDROID_KEY_PASS="${KEY_PASS}"
export WEB2APP_ANDROID_KEY_ALIAS="${KEY_ALIAS}"

ANDROID_DIR="template/src-tauri/gen/android"
if [ -d "${ANDROID_DIR}" ]; then
  cat > "${ANDROID_DIR}/keystore.properties" <<EOF
keyAlias=${KEY_ALIAS}
password=${KEY_PASS}
storeFile=${KEYSTORE_PATH}
EOF
fi

echo "Android signing material ready at ${KEYSTORE_PATH}"
