#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -z "${WEB2APP_ANDROID_KEYSTORE:-}" ]; then
  # shellcheck source=setup-android-signing.sh
  source "${SCRIPT_DIR}/setup-android-signing.sh"
fi

BUILD_TOOLS="${ANDROID_HOME}/build-tools/34.0.0"
KEYSTORE="${WEB2APP_ANDROID_KEYSTORE:?Missing keystore}"
STORE_PASS="${WEB2APP_ANDROID_STORE_PASS:?Missing store password}"
KEY_PASS="${WEB2APP_ANDROID_KEY_PASS:?Missing key password}"
KEY_ALIAS="${WEB2APP_ANDROID_KEY_ALIAS:-web2app}"

UNSIGNED_APK="$(find template/src-tauri -name '*unsigned*.apk' -type f | head -n 1 || true)"
APK="${UNSIGNED_APK}"
if [ -z "${APK}" ]; then
  APK="$(find template/src-tauri -name '*.apk' -type f | head -n 1 || true)"
fi

if [ -z "${APK}" ]; then
  echo "No APK found to sign"
  exit 1
fi

mkdir -p artifacts/android
OUTPUT_NAME="$(basename "${APK%.apk}")-signed.apk"

if "${BUILD_TOOLS}/apksigner" verify "${APK}" >/dev/null 2>&1; then
  echo "APK already signed: ${APK}"
  cp "${APK}" "artifacts/android/${OUTPUT_NAME}"
  ls -la artifacts/android
  exit 0
fi

echo "Signing APK: ${APK}"
ALIGNED="${RUNNER_TEMP}/app-aligned.apk"
SIGNED="${RUNNER_TEMP}/app-signed.apk"

"${BUILD_TOOLS}/zipalign" -f -p 4 "${APK}" "${ALIGNED}"
"${BUILD_TOOLS}/apksigner" sign \
  --ks "${KEYSTORE}" \
  --ks-key-alias "${KEY_ALIAS}" \
  --ks-pass "pass:${STORE_PASS}" \
  --key-pass "pass:${KEY_PASS}" \
  --out "${SIGNED}" \
  "${ALIGNED}"

"${BUILD_TOOLS}/apksigner" verify --verbose "${SIGNED}"
cp "${SIGNED}" "artifacts/android/${OUTPUT_NAME}"
ls -la artifacts/android
